import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../middleware/validate.js';
import { paymentLimiter } from '../middleware/rateLimit.js';
import { PageQuery, pageMeta } from '../lib/pagination.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { topUpWallet } from '../services/bookingService.js';
import { audit } from '../services/audit.js';
import { PaymentSchema } from './bookings.js';
import { PasswordSchema, userDTO } from './auth.js';

export const accountRouter = Router();

// ── Wallet ───────────────────────────────────────────────────────────────────
const TxnQuery = PageQuery.extend({ type: z.enum(['BOOKING_PAYMENT', 'REFUND', 'WALLET_TOPUP']).optional() });

accountRouter.get('/wallet', async (req, res) => {
  const q = parse(TxnQuery, req.query);
  const userId = req.user!.id;
  const where: Prisma.TransactionWhereInput = { userId, ...(q.type ? { type: q.type } : {}) };
  const [user, total, rows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { walletBalancePaise: true } }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { booking: { select: { bookingRef: true, id: true } } } }),
  ]);
  res.json({
    balancePaise: user.walletBalancePaise,
    transactions: rows.map((t) => ({
      id: t.id, txnRef: t.txnRef, type: t.type, status: t.status, method: t.method, amountPaise: t.amountPaise,
      balanceAfterPaise: t.balanceAfterPaise, failureReason: t.failureReason, meta: t.meta, createdAt: t.createdAt,
      booking: t.booking,
    })),
    meta: pageMeta(q.page, q.pageSize, total),
  });
});

const TopUpBody = z.object({ amountRupees: z.number().int('Enter a whole rupee amount'), payment: PaymentSchema });
accountRouter.post('/wallet/topup', paymentLimiter, async (req, res) => {
  const body = parse(TopUpBody, req.body);
  res.json(await topUpWallet(req.user!.id, body.amountRupees, body.payment, req.ip));
});

// ── Profile & settings ───────────────────────────────────────────────────────
const PrefsSchema = z
  .object({
    language: z.enum(['en', 'hi']).optional(),
    notifyBookings: z.boolean().optional(),
    notifyOffers: z.boolean().optional(),
    defaultTrainType: z.enum(['ORDINARY', 'EXPRESS', 'SUPERFAST']).optional(),
    paperlessTicket: z.boolean().optional(),
  })
  .strict();
const ProfileBody = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80).optional(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number').nullable().optional(),
  preferences: PrefsSchema.optional(),
});

accountRouter.patch('/me', async (req, res) => {
  const body = parse(ProfileBody, req.body);
  const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const user = await prisma.user.update({
    where: { id: current.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.preferences ? { preferences: { ...(current.preferences as object), ...body.preferences } } : {}),
    },
  });
  await audit('PROFILE_UPDATED', 'User', { entityId: user.id, actorId: user.id, ip: req.ip });
  res.json({ user: userDTO(user) });
});

const PasswordBody = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: PasswordSchema });
accountRouter.post('/me/password', async (req, res) => {
  const body = parse(PasswordBody, req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect', { fields: [{ field: 'currentPassword', message: 'Current password is incorrect' }] });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  // Revoke all other sessions
  await prisma.session.deleteMany({ where: { userId: user.id, id: { not: req.user!.sessionId } } });
  await audit('PASSWORD_CHANGED', 'User', { entityId: user.id, actorId: user.id, ip: req.ip });
  res.json({ ok: true });
});

// ── Notifications ────────────────────────────────────────────────────────────
accountRouter.get('/notifications', async (req, res) => {
  const q = parse(PageQuery, req.query);
  const where = { userId: req.user!.id };
  const [total, unread, rows] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, read: false } }),
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ notifications: rows, unread, meta: pageMeta(q.page, q.pageSize, total) });
});
accountRouter.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});
accountRouter.post('/notifications/:id/read', async (req, res) => {
  await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: req.user!.id }, data: { read: true } });
  res.json({ ok: true });
});

// ── Support ──────────────────────────────────────────────────────────────────
const SupportBody = z.object({
  category: z.enum(['BOOKING', 'PAYMENT', 'REFUND', 'ACCOUNT', 'FEEDBACK', 'OTHER']),
  subject: z.string().trim().min(4, 'Subject is too short').max(120),
  message: z.string().trim().min(10, 'Please describe the issue in at least 10 characters').max(2000),
});
accountRouter.get('/support/requests', async (req, res) => {
  const rows = await prisma.supportRequest.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ requests: rows });
});
accountRouter.post('/support/requests', async (req, res) => {
  const body = parse(SupportBody, req.body);
  const r = await prisma.supportRequest.create({ data: { ...body, userId: req.user!.id } });
  await audit('SUPPORT_REQUEST', 'SupportRequest', { entityId: r.id, actorId: req.user!.id, ip: req.ip });
  res.status(201).json({ request: r });
});
