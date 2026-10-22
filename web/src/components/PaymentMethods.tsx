import clsx from 'clsx';
import { CreditCard, Smartphone, Wallet } from 'lucide-react';
import { inr } from '@/lib/format';
import type { PaymentInput, PaymentMethod } from '@/lib/types';
import { TextField } from './ui/Field';

/** Sandbox payment-method selector shared by checkout and wallet top-up. */
export function PaymentMethods({ amountPaise, walletPaise, method, setMethod, upi, setUpi, card, setCard, errors, allowWallet = true }: {
  amountPaise: number; walletPaise: number; method: PaymentMethod; setMethod: (m: PaymentMethod) => void;
  upi: string; setUpi: (v: string) => void; card: { number: string; expiry: string; cvv: string }; setCard: (c: { number: string; expiry: string; cvv: string }) => void;
  errors: Record<string, string>; allowWallet?: boolean;
}) {
  const insufficient = walletPaise < amountPaise;
  const opts = [
    ...(allowWallet ? [{ m: 'WALLET' as const, icon: Wallet, title: 'Demo wallet', sub: insufficient ? `Balance ${inr(walletPaise)} — insufficient` : `Balance ${inr(walletPaise)}` }] : []),
    { m: 'DEMO_UPI' as const, icon: Smartphone, title: 'Demo UPI', sub: 'Sandbox VPA — no real bank' },
    { m: 'DEMO_CARD' as const, icon: CreditCard, title: 'Demo card', sub: 'Sandbox test cards only' },
  ];
  return (
    <div role="radiogroup" aria-label="Payment method" className="space-y-2.5">
      {opts.map(({ m, icon: Icon, title, sub }) => {
        const sel = method === m;
        const disabled = m === 'WALLET' && insufficient;
        return (
          <div key={m} className={clsx('rounded-2xl ring-1 transition', sel ? 'bg-brand-50/50 ring-2 ring-brand-600' : 'bg-white ring-slate-200', disabled && 'opacity-60')}>
            <button type="button" role="radio" aria-checked={sel} disabled={disabled} onClick={() => setMethod(m)} className="flex w-full items-center gap-3 p-3.5 text-left">
              <span className={clsx('flex size-10 items-center justify-center rounded-xl', sel ? 'bg-brand-800 text-white' : 'bg-slate-100 text-slate-600')}><Icon className="size-5" /></span>
              <span className="flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className={clsx('block text-xs', disabled ? 'text-red-600' : 'text-slate-500')}>{sub}</span></span>
              <span className={clsx('size-5 rounded-full border-2', sel ? 'border-[6px] border-brand-700' : 'border-slate-300')} />
            </button>
            {sel && m === 'DEMO_UPI' && (
              <div className="space-y-2 px-3.5 pb-4">
                <TextField label="UPI ID (sandbox)" value={upi} onChange={(e) => setUpi(e.target.value)} error={errors.upi} placeholder="success@demoupi" autoComplete="off" />
                <p className="text-xs text-slate-500">Use <button type="button" className="font-mono font-semibold text-brand-700 underline" onClick={() => setUpi('success@demoupi')}>success@demoupi</button> to approve or <button type="button" className="font-mono font-semibold text-brand-700 underline" onClick={() => setUpi('fail@demoupi')}>fail@demoupi</button> to simulate a decline.</p>
              </div>
            )}
            {sel && m === 'DEMO_CARD' && (
              <div className="space-y-3 px-3.5 pb-4">
                <TextField label="Card number (test)" inputMode="numeric" autoComplete="off" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) })} error={errors.cardNumber} placeholder="4111 1111 1111 1111" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Expiry (MM/YY)" inputMode="numeric" autoComplete="off" value={card.expiry} onChange={(e) => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); setCard({ ...card, expiry: v }); }} error={errors.expiry} placeholder="12/30" />
                  <TextField label="CVV" type="password" inputMode="numeric" autoComplete="off" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })} error={errors.cvv} placeholder="123" />
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold">Sandbox test cards</p>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    <li><button type="button" className="underline" onClick={() => setCard({ number: '4111 1111 1111 1111', expiry: '12/30', cvv: '123' })}>4111 1111 1111 1111</button> · approved</li>
                    <li><button type="button" className="underline" onClick={() => setCard({ number: '4000 0000 0000 0002', expiry: '12/30', cvv: '123' })}>4000 0000 0000 0002</button> · declined</li>
                  </ul>
                  <p className="mt-1">Real card numbers are rejected. Only the last 4 digits are stored.</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function buildPayment(method: PaymentMethod, upi: string, card: { number: string; expiry: string; cvv: string }): { payment?: PaymentInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (method === 'WALLET') return { payment: { method }, errors };
  if (method === 'DEMO_UPI') {
    if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(upi.trim())) errors.upi = 'Enter a valid UPI ID, e.g. success@demoupi';
    return { payment: errors.upi ? undefined : { method, upiId: upi.trim() }, errors };
  }
  const num = card.number.replace(/\s/g, '');
  if (num.length < 12) errors.cardNumber = 'Enter the test card number';
  if (!/^\d{2}\/\d{2}$/.test(card.expiry)) errors.expiry = 'Use MM/YY';
  if (!/^\d{3}$/.test(card.cvv)) errors.cvv = '3 digits';
  return { payment: Object.keys(errors).length ? undefined : { method, cardNumber: num, expiry: card.expiry, cvv: card.cvv }, errors };
}

