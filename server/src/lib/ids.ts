import crypto from 'node:crypto';

// Crockford-like alphabet without ambiguous characters (0/O, 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Demo booking reference, e.g. DEMO-UTS-7KX9M2QH. The DEMO prefix is mandatory. */
export function demoBookingRef(kind: 'UNRESERVED' | 'PLATFORM'): string {
  return `DEMO-${kind === 'UNRESERVED' ? 'UTS' : 'PF'}-${randomCode(8)}`;
}

export function demoTxnRef(): string {
  return `DTXN${Date.now().toString(36).toUpperCase()}${randomCode(5)}`;
}
