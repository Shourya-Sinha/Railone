/**
 * End-to-end API tests against a real PostgreSQL database (run `npm run db:migrate && npm run db:seed` first).
 * Each run registers fresh, uniquely-named users so it can be repeated safely.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
const d = HAS_DB ? describe : describe.skip;

let app: Express;
const H = { 'X-RW1-Client': 'test', 'Content-Type': 'application/json' };
const runId = Date.now().toString(36);

function istToday(offset = 0) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const dt = new Date(`${s}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

async function register(tag: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').set(H).send({ name: `Test ${tag}`, email: `t-${tag}-${runId}@example.test`, password: 'Passw0rd!x' });
  expect(res.status).toBe(201);
  return agent;
}

d('RailwayOne Pro API', () => {
  beforeAll(async () => {
    const mod = await import('../../src/app.js');
    app = mod.createApp();
  });

  describe('auth & security', () => {
    it('reports health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', demo: true });
    });

    it('rejects state-changing requests without the client header (CSRF guard)', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns consistent validation errors', async () => {
      const res = await request(app).post('/api/auth/register').set(H).send({ name: 'A', email: 'nope', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.fields.map((f: { field: string }) => f.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
      expect(res.body.error.requestId).toBeTruthy();
    });

    it('registers with hashed password + welcome credits and sets an httpOnly session cookie', async () => {
      const res = await request(app).post('/api/auth/register').set(H).send({ name: 'Cookie Test', email: `cookie-${runId}@example.test`, password: 'Passw0rd!x' });
      expect(res.status).toBe(201);
      expect(res.body.user.walletBalancePaise).toBe(50_000);
      expect(res.body.user.passwordHash).toBeUndefined();
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/rw1_session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('rejects bad credentials without revealing which part was wrong', async () => {
      const res = await request(app).post('/api/auth/login').set(H).send({ email: `nobody-${runId}@example.test`, password: 'whatever1' });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Incorrect email or password');
    });

    it('requires authentication for protected routes', async () => {
      expect((await request(app).get('/api/bookings')).status).toBe(401);
      expect((await request(app).get('/api/wallet')).status).toBe(401);
    });

    it('enforces role-based access control on admin routes', async () => {
      const user = await register('rbac');
      expect((await user.get('/api/admin/stats')).status).toBe(403);

      const admin = request.agent(app);
      const login = await admin.post('/api/auth/login').set(H).send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.user.role).toBe('ADMIN');
      const stats = await admin.get('/api/admin/stats');
      expect(stats.status).toBe(200);
      expect(stats.body.users.total).toBeGreaterThan(0);
      const stations = await admin.get('/api/admin/stations?q=patna&page=1&pageSize=5');
      expect(stations.body.stations.length).toBeGreaterThan(0);
      expect(stations.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    });
  });

  describe('stations', () => {
    it('autocompletes by name and code', async () => {
      const res = await request(app).get('/api/stations?q=howrah');
      expect(res.body.results[0]).toMatchObject({ code: 'HWH', name: 'Howrah Junction' });
    });
    it('returns an empty result for unknown stations', async () => {
      const res = await request(app).get('/api/stations?q=qwertyuiop');
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });
    it('404s on unknown station code', async () => {
      expect((await request(app).get('/api/stations/ZZZZ')).status).toBe(404);
    });
  });

  describe('unreserved booking flow', () => {
    it('validates journeys server-side', async () => {
      const a = await register('validate');
      const same = await a.post('/api/bookings/unreserved').set(H).send({ from: 'PNBE', to: 'PNBE', journeyDate: istToday(), trainType: 'EXPRESS', adults: 1, children: 0 });
      expect(same.status).toBe(422);
      expect(same.body.error.code).toBe('INVALID_JOURNEY');

      const unknown = await a.post('/api/bookings/unreserved').set(H).send({ from: 'PNBE', to: 'ZZZZ', journeyDate: istToday(), trainType: 'EXPRESS', adults: 1, children: 0 });
      expect(unknown.status).toBe(422);
      expect(unknown.body.error.message).toContain('ZZZZ');

      const tooFar = await a.post('/api/bookings/unreserved').set(H).send({ from: 'PNBE', to: 'GAYA', journeyDate: istToday(2), trainType: 'EXPRESS', adults: 1, children: 0 });
      expect(tooFar.status).toBe(422);

      const kidsOnly = await a.post('/api/bookings/unreserved').set(H).send({ from: 'PNBE', to: 'GAYA', journeyDate: istToday(), trainType: 'EXPRESS', adults: 0, children: 2 });
      expect(kidsOnly.status).toBe(422);
    });

    it('books, simulates payment, issues a DEMO ticket, and cancels with refund', async () => {
      const a = await register('flow');
      const body = { from: 'PNBE', to: 'HWH', journeyDate: istToday(), trainType: 'EXPRESS', adults: 2, children: 1 };

      const quote = await a.post('/api/fares/quote').set(H).send({ type: 'UNRESERVED', ...body });
      expect(quote.status).toBe(200);

      // Client-supplied price fields are ignored; the server computes the fare.
      const created = await a.post('/api/bookings/unreserved').set(H).send({ ...body, totalPaise: 1 });
      expect(created.status).toBe(201);
      const b = created.body.booking;
      expect(b.status).toBe('PENDING_PAYMENT');
      expect(b.bookingRef).toMatch(/^DEMO-UTS-[A-Z0-9]{8}$/);
      expect(b.totalPaise).toBe(quote.body.quote.totalPaise);
      expect(b.qrPayload).toBeNull();

      const declined = await a.post(`/api/bookings/${b.id}/pay`).set(H).send({ method: 'DEMO_UPI', upiId: 'fail@demoupi' });
      expect(declined.status).toBe(402);
      expect(declined.body.error.code).toBe('PAYMENT_FAILED');

      const badCard = await a.post(`/api/bookings/${b.id}/pay`).set(H).send({ method: 'DEMO_CARD', cardNumber: '4242424242424242', expiry: '12/30', cvv: '123' });
      expect(badCard.status).toBe(400);

      const paid = await a.post(`/api/bookings/${b.id}/pay`).set(H).send({ method: 'WALLET' });
      expect(paid.status).toBe(200);
      expect(paid.body.booking.status).toBe('CONFIRMED');
      expect(paid.body.booking.demoWarning).toBe('DEMO ONLY — NOT VALID FOR TRAVEL');
      expect(paid.body.booking.qrPayload).toContain('NOT VALID FOR TRAVEL');

      const wallet = await a.get('/api/wallet');
      expect(wallet.body.balancePaise).toBe(50_000 - b.totalPaise);
      expect(wallet.body.transactions.map((t: { status: string }) => t.status)).toEqual(expect.arrayContaining(['SUCCESS', 'FAILED']));

      const again = await a.post(`/api/bookings/${b.id}/pay`).set(H).send({ method: 'WALLET' });
      expect(again.status).toBe(409);

      const pdf = await a.get(`/api/bookings/${b.id}/receipt.pdf`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');

      const cancelled = await a.post(`/api/bookings/${b.id}/cancel`).set(H);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.booking.status).toBe('CANCELLED');
      expect(cancelled.body.refundPaise).toBe(b.totalPaise - 3 * 1500);
      const wallet2 = await a.get('/api/wallet');
      expect(wallet2.body.balancePaise).toBe(50_000 - b.totalPaise + cancelled.body.refundPaise);

      expect((await a.post(`/api/bookings/${b.id}/cancel`).set(H)).status).toBe(409);

      const notes = await a.get('/api/notifications');
      expect(notes.body.notifications.map((n: { kind: string }) => n.kind)).toEqual(expect.arrayContaining(['BOOKING_CONFIRMED', 'BOOKING_CANCELLED']));
    });

    it('rejects wallet payment when balance is insufficient', async () => {
      const a = await register('poor');
      const created = await a.post('/api/bookings/unreserved').set(H).send({ from: 'NDLS', to: 'MAS', journeyDate: istToday(), trainType: 'SUPERFAST', adults: 4, children: 0 });
      expect(created.status).toBe(201);
      expect(created.body.booking.totalPaise).toBeGreaterThan(50_000);
      const res = await a.post(`/api/bookings/${created.body.booking.id}/pay`).set(H).send({ method: 'WALLET' });
      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
      const ok = await a.post(`/api/bookings/${created.body.booking.id}/pay`).set(H).send({ method: 'DEMO_CARD', cardNumber: '4111 1111 1111 1111', expiry: '12/30', cvv: '123' });
      expect(ok.status).toBe(200);
      expect((await a.get('/api/wallet')).body.balancePaise).toBe(50_000);
    });

    it('keeps bookings private to their owner', async () => {
      const owner = await register('owner');
      const other = await register('other');
      const created = await owner.post('/api/bookings/platform').set(H).send({ station: 'PNBE', persons: 2 });
      expect(created.status).toBe(201);
      expect((await other.get(`/api/bookings/${created.body.booking.id}`)).status).toBe(404);
      expect((await other.post(`/api/bookings/${created.body.booking.id}/pay`).set(H).send({ method: 'WALLET' })).status).toBe(404);
    });

    it('issues non-cancellable platform tickets', async () => {
      const a = await register('platform');
      const created = await a.post('/api/bookings/platform').set(H).send({ station: 'PNBE', persons: 3 });
      expect(created.body.booking.totalPaise).toBe(3000);
      expect(created.body.booking.bookingRef).toMatch(/^DEMO-PF-/);
      await a.post(`/api/bookings/${created.body.booking.id}/pay`).set(H).send({ method: 'WALLET' }).expect(200);
      const cancel = await a.post(`/api/bookings/${created.body.booking.id}/cancel`).set(H);
      expect(cancel.status).toBe(409);
      expect((await a.post('/api/bookings/platform').set(H).send({ station: 'PNBE', persons: 5 })).status).toBe(400);
    });
  });

  describe('wallet, PNR, running status', () => {
    it('tops up via sandbox instruments with limits', async () => {
      const a = await register('topup');
      const ok = await a.post('/api/wallet/topup').set(H).send({ amountRupees: 1000, payment: { method: 'DEMO_UPI', upiId: 'success@demoupi' } });
      expect(ok.status).toBe(200);
      expect(ok.body.balancePaise).toBe(150_000);
      expect((await a.post('/api/wallet/topup').set(H).send({ amountRupees: 50, payment: { method: 'DEMO_UPI', upiId: 'success@demoupi' } })).status).toBe(400);
      expect((await a.post('/api/wallet/topup').set(H).send({ amountRupees: 500, payment: { method: 'WALLET' } })).status).toBe(400);
    });

    it('serves mock PNR and running status with validation', async () => {
      const a = await register('pnr');
      expect((await a.get('/api/pnr/123')).status).toBe(400);
      expect((await a.get('/api/pnr/0000000000')).status).toBe(404);
      const ok = await a.get('/api/pnr/2451837690');
      expect(ok.status).toBe(200);
      expect(ok.body.status.mock).toBe(true);
      expect((await a.get('/api/trains/12ab3/running-status')).status).toBe(400);
      const rs = await a.get('/api/trains/12345/running-status');
      expect(rs.status).toBe(200);
      expect(rs.body.status.stops.length).toBeGreaterThanOrEqual(2);
    });

    it('returns reserved search results with class availability', async () => {
      const a = await register('reserved');
      const res = await a.get(`/api/trains/search?from=NDLS&to=HWH&date=${istToday(3)}&mode=reserved`);
      expect(res.status).toBe(200);
      expect(res.body.mock).toBe(true);
      for (const t of res.body.trains) expect(t.classes.length).toBeGreaterThan(0);
    });
  });
});
