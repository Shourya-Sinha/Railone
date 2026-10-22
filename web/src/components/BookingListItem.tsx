import { Link } from 'react-router-dom';
import { ChevronRight, DoorOpen, TrainFront } from 'lucide-react';
import { fmtDay, inr } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { StatusBadge } from './ui/Badge';

export function BookingListItem({ b }: { b: Booking }) {
  const isPf = b.type === 'PLATFORM';
  const to = b.status === 'PENDING_PAYMENT' ? `/checkout/${b.id}` : `/tickets/${b.id}`;
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-slate-200/60 transition hover:ring-brand-200">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isPf ? 'bg-saffron-50 text-saffron-600' : 'bg-brand-50 text-brand-700'}`}>
        {isPf ? <DoorOpen className="size-5" /> : <TrainFront className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-bold text-slate-900">
          {isPf ? `Platform · ${b.source.code}` : `${b.source.code} → ${b.destination?.code}`}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {fmtDay(b.journeyDate)} · {b.passengers} {isPf ? 'person' : 'pax'}{b.passengers > 1 ? (isPf ? 's' : '') : ''} · {b.bookingRef}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="text-sm font-bold tabular-nums text-slate-900">{inr(b.totalPaise)}</span>
        <StatusBadge status={b.status} validUntil={b.validUntil} />
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-500" aria-hidden />
    </Link>
  );
}
