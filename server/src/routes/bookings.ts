import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { parse } from '../middleware/validate.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { PageQuery, pageMeta } from '../lib/pagination.js';
import {
  bookingDTO, cancelBooking, createPlatformBooking, createUnreservedBooking, expireStaleBookings, getUserBooking, payForBooking,
} from '../services/bookingService.js';
import { renderReceiptPdf } from '../services/receipt.js';

export const PaymentSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('WALLET') }),
  z.object({ method: z.literal('DEMO_UPI'), upiId: z.string().trim().min(3, 'Enter a UPI ID').max(100) }),
  z.object({
    method: z.literal('DEMO_CARD'),
    cardNumber: z.string().trim().min(12, 'Enter the card number').max(23),
    expiry: z.string().trim().regex(/^\d{2}\/\d{2}$/, 'Expiry must be MM/YY'),
    cvv: z.string().trim().regex(/^\d{3}$/, 'CVV must be 3 digits'),
    nameOnCard: z.string().trim().max(60).optional(),
  }),
]);

const Code = z.string().trim().toUpperCase().min(1).max(8);
const UnreservedBody = z.object({
  from: Code,
  to: Code,
  journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  trainType: z.enum(['ORDINARY', 'EXPRESS', 'SUPERFAST']),
  trainNumber: z.string().regex(/^\d{5}$/).optional(),
  adults: z.number().int().min(0).max(4),
  children: z.number().int().min(0).max(4),
});
const PlatformBody = z.object({ station: Code, persons: z.number().int().min(1, 'At least one person').max(4, 'Maximum 4 persons') });
const ListQuery = PageQuery.extend({
  status: z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
  type: z.enum(['UNRESERVED', 'PLATFORM']).optional(),
  scope: z.enum(['all', 'active', 'past']).default('all'),
});

export const bookingsRouter = Router();

bookingsRouter.post('/unreserved', async (req, res) => {
  const body = parse(UnreservedBody, req.body);
  res.status(201).json({ booking: await createUnreservedBooking(req.user!.id, body, req.ip) });
});

bookingsRouter.post('/platform', async (req, res) => {
  const body = parse(PlatformBody, req.body);
  res.status(201).json({ booking: await createPlatformBooking(req.user!.id, body, req.ip) });
});

bookingsRouter.get('/', async (req, res) => {
  const q = parse(ListQuery, req.query);
  const userId = req.user!.id;
  await expireStaleBookings(userId);
  const now = new Date();
  const where: Prisma.BookingWhereInput = { userId, ...(q.status ? { status: q.status } : {}), ...(q.type ? { type: q.type } : {}) };
  if (q.scope === 'active') Object.assign(where, { status: 'CONFIRMED', validUntil: { gt: now } });
  if (q.scope === 'past') where.OR = [{ status: { in: ['CANCELLED', 'EXPIRED'] } }, { status: 'CONFIRMED', validUntil: { lte: now } }];
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, include: { source: true, destination: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ bookings: rows.map(bookingDTO), meta: pageMeta(q.page, q.pageSize, total) });
});

bookingsRouter.get('/:id', async (req, res) => {
  res.json({ booking: bookingDTO(await getUserBooking(req.user!.id, String(req.params.id))) });
});

bookingsRouter.post('/:id/pay', paymentLimiter, async (req, res) => {
  const payment = parse(PaymentSchema, req.body);
  res.json(await payForBooking(req.user!.id, String(req.params.id), payment, req.ip));
});

bookingsRouter.post('/:id/cancel', async (req, res) => {
  res.json(await cancelBooking(req.user!.id, String(req.params.id), req.ip));
});

bookingsRouter.get('/:id/receipt.pdf', async (req, res) => {
  const b = bookingDTO(await getUserBooking(req.user!.id, String(req.params.id)));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="RailwayOnePro-DEMO-receipt-${b.bookingRef}.pdf"`);
  renderReceiptPdf(b, user).pipe(res);
});
