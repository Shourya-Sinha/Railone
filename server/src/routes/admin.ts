import { Router } from 'express';
import { z } from 'zod';
import os from 'node:os';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { parse } from '../middleware/validate.js';
import { PageQuery, pageMeta } from '../lib/pagination.js';
import { audit } from '../services/audit.js';
import { bookingDTO } from '../services/bookingService.js';
import { invalidateStations, stationCacheInfo } from '../services/stationCache.js';

/** Administrator API. Mounted behind requireRole('ADMIN'). */
export const adminRouter = Router();
const startedAt = new Date();
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

adminRouter.get('/stats', async (_req, res) => {
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const since24h = new Date(Date.now() - 86_400_000);
  const [users, admins, newUsers, activeSessions, byStatus, byType, revenue, refunds, txnByType, errors24h, daily, topRoutes] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.transaction.aggregate({ where: { type: 'BOOKING_PAYMENT', status: 'SUCCESS' }, _sum: { amountPaise: true } }),
    prisma.transaction.aggregate({ where: { type: 'REFUND', status: 'SUCCESS' }, _sum: { amountPaise: true } }),
    prisma.transaction.groupBy({ by: ['type', 'status'], _count: { _all: true }, _sum: { amountPaise: true } }),
    prisma.errorLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.$queryRaw<{ d: string; bookings: number; confirmed: number; revenue: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS d,
             count(*)::int AS bookings,
             count(*) FILTER (WHERE status IN ('CONFIRMED','CANCELLED'))::int AS confirmed,
             coalesce(sum("totalFarePaise") FILTER (WHERE status IN ('CONFIRMED','CANCELLED')), 0)::int AS revenue
      FROM "Booking"
      WHERE "createdAt" > now() - interval '14 days'
      GROUP BY d ORDER BY d`,
    prisma.$queryRaw<{ src: string; dst: string | null; n: number }[]>`
      SELECT s.code AS src, d.code AS dst, count(*)::int AS n
      FROM "Booking" b JOIN "Station" s ON s.id = b."sourceId" LEFT JOIN "Station" d ON d.id = b."destinationId"
      WHERE b.type = 'UNRESERVED' AND b.status IN ('CONFIRMED','CANCELLED')
      GROUP BY s.code, d.code ORDER BY n DESC LIMIT 5`,
  ]);
  res.json({
    users: { total: users, admins, newLast7Days: newUsers, activeSessions },
    bookings: {
      total: byStatus.reduce((s, r) => s + r._count._all, 0),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byType: Object.fromEntries(byType.map((r) => [r.type, r._count._all])),
    },
    revenue: { grossPaise: revenue._sum.amountPaise ?? 0, refundsPaise: refunds._sum.amountPaise ?? 0 },
    transactions: txnByType.map((r) => ({ type: r.type, status: r.status, count: r._count._all, amountPaise: r._sum.amountPaise ?? 0 })),
    errorsLast24h: errors24h,
    daily,
    topRoutes,
  });
});

// ── Users ────────────────────────────────────────────────────────────────────
const UsersQuery = PageQuery.extend({ q: z.string().trim().max(80).optional(), role: z.enum(['USER', 'ADMIN']).optional(), disabled: z.enum(['true', 'false']).optional() });
adminRouter.get('/users', async (req, res) => {
  const q = parse(UsersQuery, req.query);
  const where: Prisma.UserWhereInput = {
    ...(q.q ? { OR: [{ name: ci(q.q) }, { email: ci(q.q) }, { phone: { contains: q.q } }] } : {}),
    ...(q.role ? { role: q.role } : {}),
    ...(q.disabled ? { disabled: q.disabled === 'true' } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { _count: { select: { bookings: true } } } }),
  ]);
  res.json({
    users: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, disabled: u.disabled, walletBalancePaise: u.walletBalancePaise, bookings: u._count.bookings, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })),
    meta: pageMeta(q.page, q.pageSize, total),
  });
});

adminRouter.patch('/users/:id', async (req, res) => {
  const body = parse(z.object({ disabled: z.boolean() }), req.body);
  const id = String(req.params.id);
  if (id === req.user!.id) throw new AppError(400, 'BAD_REQUEST', 'You cannot disable your own account');
  const user = await prisma.user.update({ where: { id }, data: { disabled: body.disabled } }).catch(() => null);
  if (!user) throw notFound('User');
  if (body.disabled) await prisma.session.deleteMany({ where: { userId: id } });
  await audit(body.disabled ? 'ADMIN_USER_DISABLED' : 'ADMIN_USER_ENABLED', 'User', { entityId: id, actorId: req.user!.id, ip: req.ip });
  res.json({ ok: true });
});

// ── Bookings ─────────────────────────────────────────────────────────────────
const BookingsQuery = PageQuery.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
  type: z.enum(['UNRESERVED', 'PLATFORM']).optional(),
});
adminRouter.get('/bookings', async (req, res) => {
  const q = parse(BookingsQuery, req.query);
  const where: Prisma.BookingWhereInput = {
    ...(q.q ? { OR: [{ bookingRef: ci(q.q) }, { user: { email: ci(q.q) } }, { source: { code: q.q.toUpperCase() } }, { destination: { code: q.q.toUpperCase() } }] } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.type ? { type: q.type } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { source: true, destination: true, user: { select: { email: true, name: true } } } }),
  ]);
  res.json({ bookings: rows.map((b) => ({ ...bookingDTO(b), qrPayload: undefined, user: b.user })), meta: pageMeta(q.page, q.pageSize, total) });
});

// ── Transactions ─────────────────────────────────────────────────────────────
const TxnQuery = PageQuery.extend({
  q: z.string().trim().max(80).optional(),
  type: z.enum(['BOOKING_PAYMENT', 'REFUND', 'WALLET_TOPUP']).optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  method: z.enum(['WALLET', 'DEMO_UPI', 'DEMO_CARD']).optional(),
});
adminRouter.get('/transactions', async (req, res) => {
  const q = parse(TxnQuery, req.query);
  const where: Prisma.TransactionWhereInput = {
    ...(q.q ? { OR: [{ txnRef: ci(q.q) }, { user: { email: ci(q.q) } }, { booking: { bookingRef: ci(q.q) } }] } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.method ? { method: q.method } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { user: { select: { email: true } }, booking: { select: { bookingRef: true } } } }),
  ]);
  res.json({ transactions: rows, meta: pageMeta(q.page, q.pageSize, total) });
});

// ── Stations dataset management ──────────────────────────────────────────────
const StationsQuery = PageQuery.extend({
  q: z.string().trim().max(60).optional(),
  zone: z.string().trim().max(10).optional(),
  active: z.enum(['true', 'false']).optional(),
  popular: z.enum(['true', 'false']).optional(),
});
const StationBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{1,5}$/, 'Code must be 1–5 letters'),
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  zone: z.string().trim().toUpperCase().min(2).max(6),
  lat: z.number().min(6).max(37.5),
  lng: z.number().min(68).max(97.5),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

adminRouter.get('/stations', async (req, res) => {
  const q = parse(StationsQuery, req.query);
  const where: Prisma.StationWhereInput = {
    ...(q.q ? { OR: [{ code: ci(q.q) }, { name: ci(q.q) }, { city: ci(q.q) }, { state: ci(q.q) }] } : {}),
    ...(q.zone ? { zone: q.zone } : {}),
    ...(q.active ? { isActive: q.active === 'true' } : {}),
    ...(q.popular ? { isPopular: q.popular === 'true' } : {}),
  };
  const [total, rows, zones] = await Promise.all([
    prisma.station.count({ where }),
    prisma.station.findMany({ where, orderBy: [{ isPopular: 'desc' }, { name: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.station.findMany({ distinct: ['zone'], select: { zone: true }, orderBy: { zone: 'asc' } }),
  ]);
  res.json({ stations: rows, zones: zones.map((z) => z.zone), meta: pageMeta(q.page, q.pageSize, total) });
});

adminRouter.post('/stations', async (req, res) => {
  const body = parse(StationBody, req.body);
  const st = await prisma.station.create({ data: body });
  invalidateStations();
  await audit('ADMIN_STATION_CREATED', 'Station', { entityId: String(st.id), actorId: req.user!.id, ip: req.ip, meta: { code: st.code } });
  res.status(201).json({ station: st });
});

adminRouter.patch('/stations/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw notFound('Station');
  const body = parse(StationBody.omit({ code: true }).partial(), req.body);
  const st = await prisma.station.update({ where: { id }, data: body }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound('Station');
    throw e;
  });
  invalidateStations();
  await audit('ADMIN_STATION_UPDATED', 'Station', { entityId: String(id), actorId: req.user!.id, ip: req.ip, meta: body as Prisma.InputJsonValue });
  res.json({ station: st });
});

// ── Health, error logs & audit trail ─────────────────────────────────────────
adminRouter.get('/health', async (_req, res) => {
  const t0 = performance.now();
  let db: { ok: boolean; latencyMs: number; error?: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true, latencyMs: Math.round((performance.now() - t0) * 10) / 10 };
  } catch (e) {
    db = { ok: false, latencyMs: -1, error: (e as Error).message };
  }
  const [pending, migrations] = await Promise.all([
    prisma.booking.count({ where: { status: 'PENDING_PAYMENT' } }),
    prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST`.catch(() => []),
  ]);
  const mem = process.memoryUsage();
  res.json({
    status: db.ok ? 'ok' : 'degraded',
    version: process.env.npm_package_version ?? '1.0.0',
    node: process.version,
    environment: process.env.NODE_ENV,
    startedAt,
    uptimeSec: Math.round(process.uptime()),
    database: db,
    migrations: migrations.map((m) => ({ name: m.migration_name, appliedAt: m.finished_at })),
    memory: { rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576), systemFreeMb: Math.round(os.freemem() / 1048576) },
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    stationCache: stationCacheInfo(),
    pendingPayments: pending,
  });
});

const LogQuery = PageQuery.extend({ q: z.string().trim().max(100).optional(), level: z.enum(['error', 'warn']).optional(), source: z.enum(['server', 'web']).optional() });
adminRouter.get('/errors', async (req, res) => {
  const q = parse(LogQuery, req.query);
  const where: Prisma.ErrorLogWhereInput = {
    ...(q.q ? { OR: [{ message: ci(q.q) }, { path: ci(q.q) }, { requestId: ci(q.q) }] } : {}),
    ...(q.level ? { level: q.level } : {}),
    ...(q.source ? { source: q.source } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ errors: rows, meta: pageMeta(q.page, q.pageSize, total) });
});

const AuditQuery = PageQuery.extend({ q: z.string().trim().max(100).optional(), action: z.string().trim().max(60).optional() });
adminRouter.get('/audit', async (req, res) => {
  const q = parse(AuditQuery, req.query);
  const where: Prisma.AuditLogWhereInput = {
    ...(q.action ? { action: q.action } : {}),
    ...(q.q ? { OR: [{ action: ci(q.q) }, { entity: ci(q.q) }, { entityId: ci(q.q) }, { actorId: ci(q.q) }] } : {}),
  };
  const [total, rows, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  res.json({ entries: rows, actions: actions.map((a) => a.action), meta: pageMeta(q.page, q.pageSize, total) });
});
