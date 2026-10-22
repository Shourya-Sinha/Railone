/**
 * SANDBOX payment simulator. No real money moves and no payment gateway is contacted.
 * Only the documented demo test instruments are accepted.
 */
export type PaymentInput =
  | { method: 'WALLET' }
  | { method: 'DEMO_UPI'; upiId: string }
  | { method: 'DEMO_CARD'; cardNumber: string; expiry: string; cvv: string; nameOnCard?: string };

export type PaymentResult =
  | { ok: true; meta: Record<string, string> }
  | { ok: false; code: 'INSUFFICIENT_BALANCE' | 'DECLINED' | 'INVALID_INSTRUMENT'; reason: string };

/** Documented sandbox cards. Any other number is rejected. */
export const DEMO_TEST_CARDS: Record<string, 'SUCCESS' | 'DECLINED'> = {
  '4111111111111111': 'SUCCESS',
  '5555555555554444': 'SUCCESS',
  '4000000000000002': 'DECLINED',
};

export const DEMO_UPI_SUCCESS = 'success@demoupi';
export const DEMO_UPI_FAIL = 'fail@demoupi';
const VPA_RE = /^[a-z0-9.\-_]{2,64}@[a-z]{2,32}$/i;

export function luhnValid(num: string): boolean {
  if (!/^\d{12,19}$/.test(num)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function expiryValid(expiry: string, now = new Date()): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  const endOfMonth = new Date(Date.UTC(year, month, 1));
  return endOfMonth.getTime() > now.getTime();
}

export function simulatePayment(input: PaymentInput, amountPaise: number, walletBalancePaise: number, now = new Date()): PaymentResult {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'Invalid payment amount' };
  }
  switch (input.method) {
    case 'WALLET':
      if (walletBalancePaise < amountPaise) {
        return { ok: false, code: 'INSUFFICIENT_BALANCE', reason: 'Insufficient demo wallet balance' };
      }
      return { ok: true, meta: { instrument: 'RailwayOne demo wallet' } };

    case 'DEMO_UPI': {
      const vpa = input.upiId.trim().toLowerCase();
      if (!VPA_RE.test(vpa)) return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'Enter a valid UPI ID, e.g. success@demoupi' };
      if (!vpa.endsWith('@demoupi')) return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'Only sandbox UPI IDs ending in @demoupi are accepted' };
      if (vpa === DEMO_UPI_FAIL || vpa.startsWith('fail')) return { ok: false, code: 'DECLINED', reason: 'Payment declined by the demo bank (sandbox)' };
      const [user] = vpa.split('@');
      return { ok: true, meta: { instrument: 'Demo UPI', vpa: `${user!.slice(0, 2)}***@demoupi` } };
    }

    case 'DEMO_CARD': {
      const num = input.cardNumber.replace(/[\s-]/g, '');
      if (!luhnValid(num)) return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'Card number is invalid' };
      const outcome = DEMO_TEST_CARDS[num];
      if (!outcome) return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'Only RailwayOne sandbox test cards are accepted' };
      if (!expiryValid(input.expiry, now)) return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'Card expiry must be a future date in MM/YY format' };
      if (!/^\d{3}$/.test(input.cvv)) return { ok: false, code: 'INVALID_INSTRUMENT', reason: 'CVV must be 3 digits' };
      if (outcome === 'DECLINED') return { ok: false, code: 'DECLINED', reason: 'Card declined by the demo issuer (sandbox)' };
      // Never retain full card numbers — only the last four digits.
      return { ok: true, meta: { instrument: 'Demo card', last4: num.slice(-4) } };
    }
  }
}
