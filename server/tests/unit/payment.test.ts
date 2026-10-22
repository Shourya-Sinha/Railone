import { describe, expect, it } from 'vitest';
import { DEMO_TEST_CARDS, expiryValid, luhnValid, simulatePayment } from '../../src/domain/payment.js';
import { buildQrPayload, DEMO_WARNING } from '../../src/domain/qr.js';

const NOW = new Date('2026-10-22T10:00:00Z');

describe('sandbox payment simulator', () => {
  it('debits the wallet only when balance is sufficient', () => {
    expect(simulatePayment({ method: 'WALLET' }, 5000, 5000, NOW)).toMatchObject({ ok: true });
    expect(simulatePayment({ method: 'WALLET' }, 5001, 5000, NOW)).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE' });
  });

  it('rejects non-positive or fractional amounts', () => {
    expect(simulatePayment({ method: 'WALLET' }, 0, 10_000, NOW)).toMatchObject({ ok: false, code: 'INVALID_INSTRUMENT' });
    expect(simulatePayment({ method: 'WALLET' }, 10.5, 10_000, NOW)).toMatchObject({ ok: false });
  });

  it('accepts sandbox UPI IDs and declines the fail ID', () => {
    const ok = simulatePayment({ method: 'DEMO_UPI', upiId: 'success@demoupi' }, 1000, 0, NOW);
    expect(ok).toMatchObject({ ok: true });
    if (ok.ok) expect(ok.meta.vpa).toBe('su***@demoupi');
    expect(simulatePayment({ method: 'DEMO_UPI', upiId: 'fail@demoupi' }, 1000, 0, NOW)).toMatchObject({ ok: false, code: 'DECLINED' });
  });

  it('refuses real-looking UPI handles and malformed IDs', () => {
    expect(simulatePayment({ method: 'DEMO_UPI', upiId: 'someone@okbank' }, 1000, 0, NOW)).toMatchObject({ ok: false, code: 'INVALID_INSTRUMENT' });
    expect(simulatePayment({ method: 'DEMO_UPI', upiId: 'not-a-vpa' }, 1000, 0, NOW)).toMatchObject({ ok: false, code: 'INVALID_INSTRUMENT' });
  });

  it('accepts only documented test cards and never returns the full PAN', () => {
    const ok = simulatePayment({ method: 'DEMO_CARD', cardNumber: '4111 1111 1111 1111', expiry: '12/30', cvv: '123' }, 1000, 0, NOW);
    expect(ok).toEqual({ ok: true, meta: { instrument: 'Demo card', last4: '1111' } });
    expect(simulatePayment({ method: 'DEMO_CARD', cardNumber: '4000000000000002', expiry: '12/30', cvv: '123' }, 1000, 0, NOW)).toMatchObject({ ok: false, code: 'DECLINED' });
    // valid Luhn but not a sandbox card
    expect(simulatePayment({ method: 'DEMO_CARD', cardNumber: '4242424242424242', expiry: '12/30', cvv: '123' }, 1000, 0, NOW)).toMatchObject({ ok: false, code: 'INVALID_INSTRUMENT' });
  });

  it('validates card expiry and CVV', () => {
    expect(simulatePayment({ method: 'DEMO_CARD', cardNumber: '4111111111111111', expiry: '09/26', cvv: '123' }, 1000, 0, NOW)).toMatchObject({ ok: false });
    expect(simulatePayment({ method: 'DEMO_CARD', cardNumber: '4111111111111111', expiry: '12/30', cvv: '12' }, 1000, 0, NOW)).toMatchObject({ ok: false });
    expect(expiryValid('10/26', NOW)).toBe(true);
    expect(expiryValid('13/30', NOW)).toBe(false);
  });

  it('implements the Luhn check', () => {
    for (const n of Object.keys(DEMO_TEST_CARDS)) expect(luhnValid(n)).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
    expect(luhnValid('abc')).toBe(false);
  });
});

describe('simulated QR payload', () => {
  const b = { bookingRef: 'DEMO-UTS-ABCDEFGH', type: 'UNRESERVED', from: 'PNBE', to: 'HWH', journeyDate: '2026-10-22', adults: 2, children: 1, totalPaise: 34500 };
  it('embeds the demo warning and a signature', () => {
    const p = buildQrPayload(b, 'x'.repeat(40));
    expect(p).toContain(DEMO_WARNING);
    expect(p).toContain('REF:DEMO-UTS-ABCDEFGH');
    expect(p).toMatch(/\|SIG:[\w-]{16}$/);
  });
  it('changes signature when data or secret changes', () => {
    const p1 = buildQrPayload(b, 'x'.repeat(40));
    expect(buildQrPayload({ ...b, adults: 3 }, 'x'.repeat(40)).split('SIG:')[1]).not.toBe(p1.split('SIG:')[1]);
    expect(buildQrPayload(b, 'y'.repeat(40)).split('SIG:')[1]).not.toBe(p1.split('SIG:')[1]);
  });
});
