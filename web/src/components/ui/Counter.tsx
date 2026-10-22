import { Minus, Plus } from 'lucide-react';

export function Counter({ label, description, value, onChange, min = 0, max = 4, disableInc }: { label: string; description?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; disableInc?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={`${label} count`}>
        <button type="button" className="flex size-10 items-center justify-center rounded-lg bg-white text-brand-800 shadow-sm disabled:bg-transparent disabled:text-slate-300 disabled:shadow-none" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Decrease ${label}`}>
          <Minus className="size-4" />
        </button>
        <output className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">{value}</output>
        <button type="button" className="flex size-10 items-center justify-center rounded-lg bg-white text-brand-800 shadow-sm disabled:bg-transparent disabled:text-slate-300 disabled:shadow-none" onClick={() => onChange(value + 1)} disabled={value >= max || disableInc} aria-label={`Increase ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
