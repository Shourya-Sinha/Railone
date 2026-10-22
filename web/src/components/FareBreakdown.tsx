import { Info } from 'lucide-react';
import { inr, TRAIN_TYPE_LABEL } from '@/lib/format';
import type { FareQuote } from '@/lib/types';

export function FareBreakdown({ quote, compact }: { quote: FareQuote; compact?: boolean }) {
  return (
    <div>
      <dl className="space-y-2 text-sm">
        {quote.lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <dt className="text-slate-600">{l.label} × {l.quantity} <span className="text-slate-400">@ {inr(l.unitPaise)}</span></dt>
            <dd className="font-medium tabular-nums text-slate-900">{inr(l.amountPaise)}</dd>
          </div>
        ))}
        {!compact && quote.baseAdultRupees != null && (
          <div className="flex justify-between gap-3 text-xs text-slate-500">
            <dt>Includes base ₹{quote.baseAdultRupees} + {TRAIN_TYPE_LABEL[quote.trainType ?? ''] ?? ''} surcharge ₹{quote.surchargeRupees}</dt>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-dashed border-slate-200 pt-2.5">
          <dt className="font-bold text-slate-900">Total (demo fare)</dt>
          <dd className="text-lg font-extrabold tabular-nums text-brand-900">{inr(quote.totalPaise)}</dd>
        </div>
      </dl>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Calculated on the server from {quote.fareTableVersion}. {quote.disclaimer}
      </p>
    </div>
  );
}
