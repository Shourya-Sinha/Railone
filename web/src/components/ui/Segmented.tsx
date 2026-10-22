import clsx from 'clsx';

export function Segmented<T extends string>({ value, onChange, options, label, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" aria-label={label} className={clsx('flex gap-1 rounded-xl bg-slate-100 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-lg px-3 font-semibold transition',
            size === 'sm' ? 'h-9 text-[13px]' : 'h-10 text-sm',
            value === o.value ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {o.label}
          {o.count != null && <span className="ml-1 text-xs text-slate-400">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition',
        active ? 'bg-brand-800 text-white ring-brand-800' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}
