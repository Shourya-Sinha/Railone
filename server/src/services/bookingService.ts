import type { Booking, Prisma, Station, TrainType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError, invalidJourney, notFound } from '../lib/errors.js';
import { demoBookingRef, demoTxnRef } from '../lib/ids.js';
import { endOfIstDay, fromDbDate, istDateString, toDbDate } from '../lib/time.js';
import { formatINR } from '../lib/money.js';
import { calculatePlatformFare, calculateRefund, calculateUnreservedFare } from '../domain/fare.js';
import { DEMO_FARE_TABLE } from '../domain/fareTable.js';
import { demoRailDistanceKm } from '../domain/geo.js';
import { validateUnreservedJourney } from '../domain/journey.js';
import { simulatePayment, type PaymentInput } from '../domain/payment.js';
import { buildQrPayload, DEMO_WARNING } from '../domain/qr.js';
import { generateTrains } from '../domain/trains.js';
import { getStation } from './stationCache.js';
import { audit, notify } from './audit.js';

export const PAYMENT_HOLD_MINUTES = 15;

type BookingWithStations = Booking & { source: Station; destination: Station | null };
const withStations = { source: true, destination: true } as const;

export function bookingDTO(b: BookingWithStations) {
  const today = istDateString();
  const journeyDate = fromDbDate(b.journeyDate);
  const cancellable =
    b.status === 'CONFIRMED' && b.type === 'UNRESERVED' && journeyDate >= today && (!b.validUntil || b.validUntil > new Date());
  return {
    id: b.id,
    bookingRef: b.bookingRef,
    type: b.type,
    status: b.status,
    source: { code: b.source.code, name: b.source.name, city: b.source.city },
    destination: b.destination ? { code: b.destination.code, name: b.destination.name, city: b.destination.city } : null,
    journeyDate,
    trainType: b.trainType,
    trainNumber: b.trainNumber,
    trainName: b.trainName,
    classCode: b.classCode,
    adults: b.adults,
    children: b.children,
    passengers: b.adults + b.children,
    distanceKm: b.distanceKm,
    fare: b.fareBreakdown,
    totalPaise: b.totalFarePaise,
    fareTableVersion: b.fareTableVersion,
    paymentMethod: b.paymentMethod,
    qrPayload: b.status === 'CONFIRMED' ? b.qrPayload : null,
    holdExpiresAt: b.holdExpiresAt,
    validFrom: b.validFrom,
    validUntil: b.validUntil,
    paidAt: b.paidAt,
    cancelledAt: b.cancelledAt,
    refundPaise: b.refundPaise,
    createdAt: b.createdAt,
    cancellable,
    demoWarning: DEMO_WARNING,
  };
}
export type BookingDTO = ReturnType<typeof bookingDTO>;

/** Mark stale unpaid bookings as EXPIRED (optionally only for one user). */
export async function expireStaleBookings(userId?: string) {
  const r = await prisma.booking.updateMany({
    where: { status: 'PENDING_PAYMENT', holdExpiresAt: { lt: new Date() }, ...(userId ? { userId } : {}) },
    data: { status: 'EXPIRED' },
  });
  return r.count;
}

async function uniqueRef(kind: 'UNRESERVED' | 'PLATFORM') {
  for (let i = 0; i < 5; i++) {
    const ref = demoBookingRef(kind);
    if (!(await prisma.booking.findUnique({ where: { bookingRef: ref }, select: { id: true } }))) return ref;
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate a booking reference');
}

/** Resolve + validate an unreserved journey and compute the server-side fare. */
export async function quoteUnreserved(input: { from: string; to: string; journeyDate: string; trainType: TrainType; adults: number; children: number }) {
  const [source, destination] = await Promise.all([getStation(input.from), getStation(input.to)]);
  const issues = validateUnreservedJourney({
    source, destination, sourceCode: input.from, destinationCode: input.to,
    journeyDate: input.journeyDate, today: istDateString(), adults: input.adults, children: input.children,
  });
  if (issues.length) throw invalidJourney(issues[0]!.message, { fields: issues });
  const distanceKm = demoRailDistanceKm(source!, destination!);
  const quote = calculateUnreservedFare({ distanceKm, trainType: input.trainType, adults: input.adults, children: input.children });
  return { source: source!, destination: destination!, distanceKm, quote };
}

export async function createUnreservedBooking(
  userId: string,
  input: { from: string; to: string; journeyDate: string; trainType: TrainType; trainNumber?: string; adults: number; children: number },
  ip?: string,
) {
  const { source, destination, distanceKm, quote } = await quoteUnreserved(input);

  let trainName: string | null = null;
  if (input.trainNumber) {
    const train = generateTrains(source, destination, distanceKm).find((t) => t.number === input.trainNumber);
    if (!train) throw invalidJourney('Selected train does not run on this demo route', { fields: [{ field: 'trainNumber', message: 'Unknown train for route' }] });
    if (train.type !== input.trainType) throw invalidJourney('Train type does not match the selected train');
    trainName = train.name;
  }

  const booking = await prisma.booking.create({
    data: {
      bookingRef: await uniqueRef('UNRESERVED'),
      userId,
      type: 'UNRESERVED',
      sourceId: source.id,
      destinationId: destination.id,
      journeyDate: toDbDate(input.journeyDate),
      trainType: input.trainType,
      trainNumber: input.trainNumber ?? null,
      trainName,
      classCode: 'II',
      adults: input.adults,
      children: input.children,
      distanceKm,
      fareBreakdown: quote as unknown as Prisma.InputJsonValue,
      totalFarePaise: quote.totalPaise,
      fareTableVersion: quote.fareTableVersion,
      holdExpiresAt: new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000),
    },
    include: withStations,
  });
  await audit('BOOKING_CREATED', 'Booking', { entityId: booking.id, actorId: userId, ip, meta: { ref: booking.bookingRef, type: 'UNRESERVED', totalPaise: quote.totalPaise } });
  return bookingDTO(booking);
}

export async function createPlatformBooking(userId: string, input: { station: string; persons: number }, ip?: string) {
  const station = await getStation(input.station);
  if (!station) throw invalidJourney(`Unknown station "${input.station}"`, { fields: [{ field: 'station', message: 'Select a valid station' }] });
  if (!station.isActive) throw invalidJourney(`${station.name} is not available for booking`);
  let quote;
  try {
    quote = calculatePlatformFare(input.persons);
  } catch (e) {
    throw invalidJourney((e as Error).message, { fields: [{ field: 'persons', message: (e as Error).message }] });
  }
  const booking = await prisma.booking.create({
    data: {
      bookingRef: await uniqueRef('PLATFORM'),
      userId,
      type: 'PLATFORM',
      sourceId: station.id,
      journeyDate: toDbDate(istDateString()),
      classCode: 'PF',
      adults: input.persons,
      children: 0,
      fareBreakdown: quote as unknown as Prisma.InputJsonValue,
      totalFarePaise: quote.totalPaise,
      fareTableVersion: quote.fareTableVersion,
      holdExpiresAt: new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000),
    },
    include: withStations,
  });
  await audit('BOOKING_CREATED', 'Booking', { entityId: booking.id, actorId: userId, ip, meta: { ref: booking.bookingRef, type: 'PLATFORM', totalPaise: quote.totalPaise } });
  return bookingDTO(booking);
}

export async function getUserBooking(userId: string, id: string) {
  await expireStaleBookings(userId);
  const b = await prisma.booking.findFirst({ where: { id, userId }, include: withStations });
  if (!b) throw notFound('Booking');
  return b;
}

/** Simulated checkout. Wallet debits are atomic and guarded against double-spend. */
export async function payForBooking(userId: string, bookingId: string, payment: PaymentInput, ip?: string) {
  const booking = await getUserBooking(userId, bookingId);
  if (booking.status !== 'PENDING_PAYMENT') {
    throw new AppError(409, 'BOOKING_NOT_PAYABLE', booking.status === 'EXPIRED' ? 'The payment window for this booking has expired. Please book again.' : 'This booking has already been processed');
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const result = simulatePayment(payment, booking.totalFarePaise, user.walletBalancePaise);

  if (!result.ok) {
    if (result.code === 'INVALID_INSTRUMENT') {
      throw new AppError(400, 'VALIDATION_ERROR', result.reason, { fields: [{ field: 'payment', message: result.reason }] });
    }
    const txn = await prisma.transaction.create({
      data: {
        txnRef: demoTxnRef(), userId, bookingId: booking.id, type: 'BOOKING_PAYMENT', status: 'FAILED',
        method: payment.method, amountPaise: booking.totalFarePaise, failureReason: result.reason,
      },
    });
    await audit('PAYMENT_FAILED', 'Transaction', { entityId: txn.id, actorId: userId, ip, meta: { bookingRef: booking.bookingRef, reason: result.code } });
    throw new AppError(402, result.code === 'INSUFFICIENT_BALANCE' ? 'INSUFFICIENT_BALANCE' : 'PAYMENT_FAILED', result.reason, { txnRef: txn.txnRef });
  }

  const now = new Date();
  const journeyDate = fromDbDate(booking.journeyDate);
  const validUntil =
    booking.type === 'PLATFORM' ? new Date(now.getTime() + DEMO_FARE_TABLE.platform.validityHours * 3600_000) : endOfIstDay(journeyDate);
  const qrPayload = buildQrPayload(
    {
      bookingRef: booking.bookingRef, type: booking.type, from: booking.source.code, to: booking.destination?.code,
      journeyDate, adults: booking.adults, children: booking.children, totalPaise: booking.totalFarePaise,
    },
    env.SESSION_SECRET,
  );

  const txnRef = demoTxnRef();
  await prisma.$transaction(async (tx) => {
    if (payment.method === 'WALLET') {
      const debit = await tx.user.updateMany({
        where: { id: userId, walletBalancePaise: { gte: booking.totalFarePaise } },
        data: { walletBalancePaise: { decrement: booking.totalFarePaise } },
      });
      if (debit.count === 0) throw new AppError(402, 'INSUFFICIENT_BALANCE', 'Insufficient demo wallet balance');
    }
    const confirm = await tx.booking.updateMany({
      where: { id: booking.id, status: 'PENDING_PAYMENT' },
      data: { status: 'CONFIRMED', paidAt: now, paymentMethod: payment.method, qrPayload, validFrom: now, validUntil, holdExpiresAt: null },
    });
    if (confirm.count === 0) throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking has already been processed');
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { walletBalancePaise: true } });
    const txn = await tx.transaction.create({
      data: {
        txnRef, userId, bookingId: booking.id, type: 'BOOKING_PAYMENT', status: 'SUCCESS', method: payment.method,
        amountPaise: booking.totalFarePaise, balanceAfterPaise: payment.method === 'WALLET' ? fresh.walletBalancePaise : null, meta: result.meta,
      },
    });
    await notify(tx, userId, {
      kind: 'BOOKING_CONFIRMED',
      title: booking.type === 'PLATFORM' ? 'Demo platform ticket ready' : 'Demo journey ticket ready',
      body: `${booking.bookingRef} · ${booking.source.code}${booking.destination ? ' → ' + booking.destination.code : ''} · ${formatINR(booking.totalFarePaise)} (simulated). Not valid for travel.`,
      link: `/tickets/${booking.id}`,
    });
    await audit('PAYMENT_SUCCEEDED', 'Transaction', { db: tx, entityId: txn.id, actorId: userId, ip, meta: { bookingRef: booking.bookingRef, method: payment.method, amountPaise: booking.totalFarePaise } });
  });

  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: withStations });
  return { booking: bookingDTO(updated), txnRef };
}

export async function cancelBooking(userId: string, bookingId: string, ip?: string) {
  const booking = await getUserBooking(userId, bookingId);
  const dto = bookingDTO(booking);
  if (booking.type === 'PLATFORM') throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'Platform tickets cannot be cancelled');
  if (!dto.cancellable) throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'Only active, unused demo journey tickets can be cancelled');

  const { refundPaise, clerkagePaise } = calculateRefund(booking.totalFarePaise, booking.adults + booking.children);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const upd = await tx.booking.updateMany({
      where: { id: booking.id, status: 'CONFIRMED' },
      data: { status: 'CANCELLED', cancelledAt: now, refundPaise },
    });
    if (upd.count === 0) throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'Booking was already cancelled');
    const user = await tx.user.update({ where: { id: userId }, data: { walletBalancePaise: { increment: refundPaise } } });
    const txn = await tx.transaction.create({
      data: {
        txnRef: demoTxnRef(), userId, bookingId: booking.id, type: 'REFUND', status: 'SUCCESS', method: 'WALLET',
        amountPaise: refundPaise, balanceAfterPaise: user.walletBalancePaise, meta: { clerkagePaise },
      },
    });
    await notify(tx, userId, {
      kind: 'BOOKING_CANCELLED',
      title: 'Demo ticket cancelled',
      body: `${booking.bookingRef} cancelled. ${formatINR(refundPaise)} demo refund credited to your wallet (clerkage ${formatINR(clerkagePaise)}).`,
      link: `/tickets/${booking.id}`,
    });
    await audit('BOOKING_CANCELLED', 'Booking', { db: tx, entityId: booking.id, actorId: userId, ip, meta: { refundPaise, clerkagePaise, txnId: txn.id } });
  });
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: withStations });
  return { booking: bookingDTO(updated), refundPaise, clerkagePaise };
}

export async function topUpWallet(userId: string, amountRupees: number, payment: PaymentInput, ip?: string) {
  const W = DEMO_FARE_TABLE.wallet;
  if (payment.method === 'WALLET') throw new AppError(400, 'VALIDATION_ERROR', 'Choose Demo UPI or Demo Card to add money');
  if (!Number.isInteger(amountRupees) || amountRupees < W.minTopUpRupees || amountRupees > W.maxTopUpRupees) {
    throw new AppError(400, 'VALIDATION_ERROR', `Top-up amount must be between ₹${W.minTopUpRupees} and ₹${W.maxTopUpRupees}`);
  }
  const amountPaise = amountRupees * 100;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.walletBalancePaise + amountPaise > W.maxBalanceRupees * 100) {
    throw new AppError(400, 'VALIDATION_ERROR', `Demo wallet balance cannot exceed ₹${W.maxBalanceRupees.toLocaleString('en-IN')}`);
  }
  const result = simulatePayment(payment, amountPaise, 0);
  if (!result.ok) {
    if (result.code === 'INVALID_INSTRUMENT') throw new AppError(400, 'VALIDATION_ERROR', result.reason, { fields: [{ field: 'payment', message: result.reason }] });
    const txn = await prisma.transaction.create({
      data: { txnRef: demoTxnRef(), userId, type: 'WALLET_TOPUP', status: 'FAILED', method: payment.method, amountPaise, failureReason: result.reason },
    });
    await audit('TOPUP_FAILED', 'Transaction', { entityId: txn.id, actorId: userId, ip, meta: { reason: result.code } });
    throw new AppError(402, 'PAYMENT_FAILED', result.reason, { txnRef: txn.txnRef });
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: userId }, data: { walletBalancePaise: { increment: amountPaise } } });
    const txn = await tx.transaction.create({
      data: {
        txnRef: demoTxnRef(), userId, type: 'WALLET_TOPUP', status: 'SUCCESS', method: payment.method,
        amountPaise, balanceAfterPaise: u.walletBalancePaise, meta: result.meta,
      },
    });
    await notify(tx, userId, { kind: 'WALLET', title: 'Demo wallet topped up', body: `${formatINR(amountPaise)} demo credits added. New balance ${formatINR(u.walletBalancePaise)}.`, link: '/wallet' });
    await audit('WALLET_TOPUP', 'Transaction', { db: tx, entityId: txn.id, actorId: userId, ip, meta: { amountPaise } });
    return { balancePaise: u.walletBalancePaise, txnRef: txn.txnRef };
  });
}
