/**
 * Seed script — loads the SAMPLE station dataset and creates demo accounts with
 * simulated booking history. Safe to re-run (idempotent).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type BookingStatus, type Prisma, type TrainType } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { calculatePlatformFare, calculateRefund, calculateUnreservedFare } from '../src/domain/fare.js';
import { demoRailDistanceKm } from '../src/domain/geo.js';
import { buildQrPayload } from '../src/domain/qr.js';
import { generateTrains } from '../src/domain/trains.js';
import { demoBookingRef, demoTxnRef } from '../src/lib/ids.js';
import { endOfIstDay, istDateString, toDbDate } from '../src/lib/time.js';
import { seeded } from '../src/domain/rng.js';

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[seed] Missing ${name}. Copy .env.example to .env first.`);
    process.exit(1);
  }
  return v;
}

interface StationRow { code: string; name: string; city: string; state: string; zone: string; lat: number; lng: number; isPopular?: boolean }

async function seedStations() {
  const file = process.env.STATION_DATASET ?? path.resolve(here, '../data/stations.sample.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { version: string; stations: StationRow[] };
  for (const s of doc.stations) {
    await prisma.station.upsert({
      where: { code: s.code },
      create: { ...s, isPopular: !!s.isPopular },
      update: { name: s.name, city: s.city, state: s.state, zone: s.zone, lat: s.lat, lng: s.lng, isPopular: !!s.isPopular },
    });
  }
  console.log(`[seed] ${doc.stations.length} stations from dataset ${doc.version}`);
}

async function upsertUser(email: string, password: string, name: string, role: 'USER' | 'ADMIN', walletPaise: number, phone?: string) {
  const passwordHash = await hashPassword(password);
  return prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash, walletBalancePaise: walletPaise, phone: phone ?? null, preferences: { language: 'en', notifyBookings: true, defaultTrainType: 'EXPRESS', paperlessTicket: true } },
    update: { passwordHash, role, disabled: false },
  });
}

async function createHistoricBooking(userId: string, opts: { type: 'UNRESERVED' | 'PLATFORM'; src: { id: number; code: string; city: string; lat: number; lng: number }; dst?: { id: number; code: string; city: string; lat: number; lng: number }; createdAt: Date; status: BookingStatus; adults: number; children: number; trainType?: TrainType; method: 'WALLET' | 'DEMO_UPI' | 'DEMO_CARD' }) {
  const secret = requireEnv('SESSION_SECRET');
  const journeyDate = istDateString(opts.createdAt);
  let quote;
  let distanceKm: number | null = null;
  let trainNumber: string | null = null;
  let trainName: string | null = null;
  if (opts.type === 'UNRESERVED' && opts.dst) {
    distanceKm = demoRailDistanceKm(opts.src, opts.dst);
    const train = generateTrains(opts.src, opts.dst, distanceKm).find((t) => t.type === opts.trainType) ?? generateTrains(opts.src, opts.dst, distanceKm)[0]!;
    trainNumber = train.number;
    trainName = train.name;
    quote = calculateUnreservedFare({ distanceKm, trainType: train.type, adults: opts.adults, children: opts.children });
    opts.trainType = train.type;
  } else {
    quote = calculatePlatformFare(opts.adults);
  }
  const ref = demoBookingRef(opts.type);
  const paid = opts.status === 'CONFIRMED' || opts.status === 'CANCELLED';
  const paidAt = new Date(opts.createdAt.getTime() + 60_000);
  const refund = opts.status === 'CANCELLED' ? calculateRefund(quote.totalPaise, opts.adults + opts.children) : null;
  const booking = await prisma.booking.create({
    data: {
      bookingRef: ref, userId, type: opts.type, status: opts.status, sourceId: opts.src.id, destinationId: opts.dst?.id ?? null,
      journeyDate: toDbDate(journeyDate), trainType: opts.trainType ?? null, trainNumber, trainName,
      classCode: opts.type === 'PLATFORM' ? 'PF' : 'II', adults: opts.adults, children: opts.children, distanceKm,
      fareBreakdown: quote as unknown as Prisma.InputJsonValue, totalFarePaise: quote.totalPaise, fareTableVersion: quote.fareTableVersion,
      paymentMethod: paid ? opts.method : null,
      qrPayload: paid ? buildQrPayload({ bookingRef: ref, type: opts.type, from: opts.src.code, to: opts.dst?.code, journeyDate, adults: opts.adults, children: opts.children, totalPaise: quote.totalPaise }, secret) : null,
      holdExpiresAt: paid ? null : new Date(opts.createdAt.getTime() + 15 * 60_000),
      validFrom: paid ? paidAt : null,
      validUntil: paid ? (opts.type === 'PLATFORM' ? new Date(paidAt.getTime() + 2 * 3600_000) : endOfIstDay(journeyDate)) : null,
      paidAt: paid ? paidAt : null,
      cancelledAt: refund ? new Date(paidAt.getTime() + 20 * 60_000) : null,
      refundPaise: refund?.refundPaise ?? null,
      createdAt: opts.createdAt,
    },
  });
  if (paid) {
    await prisma.transaction.create({
      data: { txnRef: demoTxnRef(), userId, bookingId: booking.id, type: 'BOOKING_PAYMENT', status: 'SUCCESS', method: opts.method, amountPaise: quote.totalPaise, meta: { seeded: true }, createdAt: paidAt },
    });
    await prisma.auditLog.create({ data: { action: 'PAYMENT_SUCCEEDED', entity: 'Booking', entityId: booking.id, actorId: userId, meta: { seeded: true, bookingRef: ref }, createdAt: paidAt } });
  }
  if (refund) {
    await prisma.transaction.create({
      data: { txnRef: demoTxnRef(), userId, bookingId: booking.id, type: 'REFUND', status: 'SUCCESS', method: 'WALLET', amountPaise: refund.refundPaise, meta: { seeded: true, clerkagePaise: refund.clerkagePaise }, createdAt: new Date(paidAt.getTime() + 20 * 60_000) },
    });
  }
  return booking;
}

async function main() {
  await seedStations();
  const stations = await prisma.station.findMany();
  const byCode = new Map(stations.map((s) => [s.code, s]));
  const st = (c: string) => byCode.get(c)!;

  const demo = await upsertUser(requireEnv('SEED_DEMO_EMAIL'), requireEnv('SEED_DEMO_PASSWORD'), 'Aarav Sharma', 'USER', 250_000, '9876543210');
  await upsertUser(requireEnv('SEED_ADMIN_EMAIL'), requireEnv('SEED_ADMIN_PASSWORD'), 'Demo Administrator', 'ADMIN', 0);
  console.log('[seed] demo + admin accounts ready');

  // Demo user's sample history (only once)
  if ((await prisma.booking.count({ where: { userId: demo.id } })) === 0) {
    const now = Date.now();
    const H = 3600_000;
    await createHistoricBooking(demo.id, { type: 'UNRESERVED', src: st('PNBE'), dst: st('GAYA'), createdAt: new Date(now - 2 * 24 * H), status: 'CONFIRMED', adults: 2, children: 0, trainType: 'EXPRESS', method: 'WALLET' });
    await createHistoricBooking(demo.id, { type: 'UNRESERVED', src: st('PNBE'), dst: st('MFP'), createdAt: new Date(now - 5 * 24 * H), status: 'CANCELLED', adults: 1, children: 1, trainType: 'ORDINARY', method: 'DEMO_UPI' });
    await createHistoricBooking(demo.id, { type: 'PLATFORM', src: st('PNBE'), createdAt: new Date(now - 8 * 24 * H), status: 'CONFIRMED', adults: 2, children: 0, method: 'WALLET' });
    await createHistoricBooking(demo.id, { type: 'UNRESERVED', src: st('RJPB'), dst: st('BSB'), createdAt: new Date(now - 12 * 24 * H), status: 'CONFIRMED', adults: 1, children: 0, trainType: 'SUPERFAST', method: 'DEMO_CARD' });
    await prisma.transaction.create({ data: { txnRef: demoTxnRef(), userId: demo.id, type: 'WALLET_TOPUP', status: 'SUCCESS', method: 'DEMO_UPI', amountPaise: 200_000, balanceAfterPaise: 250_000, meta: { seeded: true, vpa: 'su***@demoupi' }, createdAt: new Date(now - 14 * 24 * H) } });
    await prisma.notification.createMany({
      data: [
        { userId: demo.id, kind: 'WELCOME', title: 'Welcome to RailwayOne Pro', body: 'This is a demo prototype. Tickets you book here are simulated and NOT valid for travel.', link: '/help', createdAt: new Date(now - 14 * 24 * H) },
        { userId: demo.id, kind: 'WALLET', title: 'Demo wallet topped up', body: 'INR 2,000.00 demo credits were added to your wallet.', link: '/wallet', createdAt: new Date(now - 14 * 24 * H) },
        { userId: demo.id, kind: 'BOOKING_CANCELLED', title: 'Demo ticket cancelled', body: 'Your PNBE → MFP demo ticket was cancelled and refunded to your wallet.', link: '/history', read: false, createdAt: new Date(now - 5 * 24 * H) },
        { userId: demo.id, kind: 'TIP', title: 'Tip: try the platform ticket demo', body: 'Book a demo platform ticket for any station in under 30 seconds.', link: '/platform', read: false, createdAt: new Date(now - 1 * 24 * H) },
      ],
    });
    console.log('[seed] demo booking history created');
  }

  // Mock population for the admin dashboard (only once)
  if ((await prisma.user.count({ where: { email: { endsWith: '@example.test' } } })) === 0) {
    const r = seeded('seed-population');
    const sharedHash = await hashPassword(crypto.randomBytes(24).toString('hex')); // mock users cannot log in
    const FIRST = ['Priya', 'Rahul', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Kavya', 'Rohan', 'Isha', 'Aditya', 'Meera', 'Karan', 'Neha', 'Siddharth', 'Pooja', 'Manish', 'Divya', 'Amit', 'Riya', 'Suresh', 'Lakshmi', 'Farhan', 'Gurpreet', 'Tanvi'];
    const LAST = ['Verma', 'Iyer', 'Kumar', 'Singh', 'Nair', 'Das', 'Reddy', 'Patel', 'Gupta', 'Bose', 'Khan', 'Mishra', 'Joshi', 'Rao'];
    const popular = stations.filter((s) => s.isPopular);
    const bihar = stations.filter((s) => s.state === 'Bihar');
    for (let i = 0; i < 28; i++) {
      const first = FIRST[i % FIRST.length]!;
      const last = r.pick(LAST);
      const createdAt = new Date(Date.now() - r.int(1, 40) * 86_400_000 - r.int(0, 86_000) * 1000);
      const u = await prisma.user.create({
        data: { email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.test`, name: `${first} ${last}`, passwordHash: sharedHash, walletBalancePaise: r.int(0, 3000) * 100, createdAt, disabled: i === 27 },
      });
      const n = r.int(0, 5);
      for (let j = 0; j < n; j++) {
        const pool = r.chance(0.5) ? bihar : popular;
        const src = r.pick(pool);
        let dst = r.pick(pool);
        while (dst.code === src.code) dst = r.pick(pool);
        const roll = r.next();
        const status: BookingStatus = roll < 0.74 ? 'CONFIRMED' : roll < 0.86 ? 'CANCELLED' : 'EXPIRED';
        const isPf = r.chance(0.18);
        const adults = r.int(1, 3);
        await createHistoricBooking(u.id, {
          type: isPf ? 'PLATFORM' : 'UNRESERVED', src, dst: isPf ? undefined : dst,
          createdAt: new Date(Date.now() - r.int(0, 13) * 86_400_000 - r.int(0, 80_000) * 1000),
          status, adults, children: isPf ? 0 : r.int(0, Math.min(1, 4 - adults)),
          trainType: r.pick(['ORDINARY', 'EXPRESS', 'SUPERFAST'] as const), method: r.pick(['WALLET', 'DEMO_UPI', 'DEMO_CARD'] as const),
        });
      }
      if (r.chance(0.2)) {
        await prisma.transaction.create({ data: { txnRef: demoTxnRef(), userId: u.id, type: 'WALLET_TOPUP', status: 'FAILED', method: 'DEMO_CARD', amountPaise: 50_000, failureReason: 'Card declined by the demo issuer (sandbox)', createdAt } });
      }
    }
    await prisma.errorLog.createMany({
      data: [
        { level: 'warn', source: 'server', message: '[seed sample] Slow query detected on /api/stations (312 ms)', path: '/api/stations?q=a', method: 'GET', status: 200, createdAt: new Date(Date.now() - 3 * 3600_000) },
        { level: 'error', source: 'web', message: '[seed sample] TypeError: Cannot read properties of undefined (reading "code")', path: '/unreserved', createdAt: new Date(Date.now() - 26 * 3600_000) },
      ],
    });
    console.log('[seed] mock population for admin dashboard created');
  }
  console.log('[seed] done. All data is DEMO data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
