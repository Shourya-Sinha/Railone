import { describe, expect, it } from 'vitest';
import { fmtDuration, inr, initials } from '../format';
import { addDays, dayDiff, istToday } from '../date';
import { buildPayment } from '@/components/PaymentMethods';

describe('formatting', () => {
  it('formats paise as rupees', () => {
    expect(inr(12500)).toContain('125');
    expect(inr(12550, { decimals: true })).toContain('125.50');
  });
  it('formats durations and initials', () => {
    expect(fmtDuration(125)).toBe('2h 05m');
    expect(initials('Asha Kumari Singh')).toBe('AK');
  });
});

describe('IST date helpers', () => {
  it('computes the IST calendar date', () => {
    // 20:00 UTC on 22 Oct is already 23 Oct in IST (+05:30)
    expect(istToday(new Date('2026-10-22T20:00:00Z'))).toBe('2026-10-23');
    expect(istToday(new Date('2026-10-22T10:00:00Z'))).toBe('2026-10-22');
  });
  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dayDiff('2026-10-22', '2026-10-24')).toBe(2);
  });
});

describe('simulated payment input (client checks)', () => {
  const noCard = { number: '', expiry: '', cvv: '' };
  it('wallet needs no details', () => {
    expect(buildPayment('WALLET', '', noCard)).toEqual({ payment: { method: 'WALLET' }, errors: {} });
  });
  it('validates demo UPI IDs', () => {
    expect(buildPayment('DEMO_UPI', 'success@demoupi', noCard).payment).toEqual({ method: 'DEMO_UPI', upiId: 'success@demoupi' });
    expect(buildPayment('DEMO_UPI', 'not-an-id', noCard).errors.upi).toBeDefined();
  });
  it('validates demo card fields and strips spaces', () => {
    const ok = buildPayment('DEMO_CARD', '', { number: '4111 1111 1111 1111', expiry: '12/30', cvv: '123' });
    expect(ok.payment).toEqual({ method: 'DEMO_CARD', cardNumber: '4111111111111111', expiry: '12/30', cvv: '123' });
    const bad = buildPayment('DEMO_CARD', '', { number: '4111', expiry: '1230', cvv: '12' });
    expect(Object.keys(bad.errors).sort()).toEqual(['cardNumber', 'cvv', 'expiry']);
    expect(bad.payment).toBeUndefined();
  });
});
