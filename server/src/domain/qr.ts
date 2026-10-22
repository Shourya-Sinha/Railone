import crypto from 'node:crypto';

export const DEMO_WARNING = 'DEMO ONLY — NOT VALID FOR TRAVEL';

/**
 * Build the text encoded into the SIMULATED ticket QR code. The payload itself
 * states that it is not a travel credential, and carries a demo HMAC tag so
 * tampering can be detected within this prototype only.
 */
export function buildQrPayload(
  b: { bookingRef: string; type: string; from: string; to?: string | null; journeyDate: string; adults: number; children: number; totalPaise: number },
  secret: string,
): string {
  const body = [
    'RAILWAYONE-PRO-DEMO',
    DEMO_WARNING,
    `REF:${b.bookingRef}`,
    `TYPE:${b.type}`,
    `ROUTE:${b.from}${b.to ? '-' + b.to : ''}`,
    `DATE:${b.journeyDate}`,
    `PAX:${b.adults}A${b.children}C`,
    `AMT:${(b.totalPaise / 100).toFixed(2)}`,
  ].join('|');
  const key = crypto.createHmac('sha256', secret).update('qr-signing-key').digest();
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url').slice(0, 16);
  return `${body}|SIG:${sig}`;
}
