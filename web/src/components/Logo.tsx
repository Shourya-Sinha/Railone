import clsx from 'clsx';

/** Original RailwayOne Pro mark: converging rails beneath a saffron sunrise arc. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={clsx('shrink-0', className)} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#0B3A8C" />
      <path d="M11 29a13 13 0 0 1 26 0" fill="none" stroke="#F28C28" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M19.5 41 23 21M28.5 41 25 21" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18.5 37h11M20 31.5h8M21.4 26.5h5.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-9" />
      <span className="leading-none">
        <span className={clsx('block text-[17px] font-extrabold tracking-tight', light ? 'text-white' : 'text-brand-900')}>
          RailwayOne <span className="text-saffron-500">Pro</span>
        </span>
        <span className={clsx('mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em]', light ? 'text-brand-200' : 'text-slate-500')}>Demo prototype</span>
      </span>
    </span>
  );
}
