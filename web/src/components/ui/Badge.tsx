import type { ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'saffron';
const tones: Record<Tone, string> = {
  blue: 'bg-brand-50 text-brand-800 ring-brand-200/70',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  red: 'bg-red-50 text-red-700 ring-red-200/70',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  saffron: 'bg-saffron-50 text-saffron-700 ring-saffron-200/70',
};

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}

const STATUS: Record<string, { tone: Tone; label: string }> = {
  CONFIRMED: { tone: 'green', label: 'Confirmed' },
  PENDING_PAYMENT: { tone: 'amber', label: 'Payment pending' },
  CANCELLED: { tone: 'red', label: 'Cancelled' },
  EXPIRED: { tone: 'slate', label: 'Expired' },
  SUCCESS: { tone: 'green', label: 'Success' },
  FAILED: { tone: 'red', label: 'Failed' },
  USED: { tone: 'slate', label: 'Journey date passed' },
};

export function StatusBadge({ status, validUntil }: { status: string; validUntil?: string | null }) {
  const key = status === 'CONFIRMED' && validUntil && new Date(validUntil) < new Date() ? 'USED' : status;
  const s = STATUS[key] ?? { tone: 'slate' as Tone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
