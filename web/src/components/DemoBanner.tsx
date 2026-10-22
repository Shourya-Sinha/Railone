import { ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

export function DemoStrip({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center gap-1.5 bg-saffron-50 px-3 py-1 text-center text-[11px] font-medium text-saffron-700', className)}>
      <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
      <span>Demo prototype · mock data · not affiliated with Indian Railways</span>
    </div>
  );
}

export function DemoOnlyBanner({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div role="note" className={clsx('flex items-center justify-center gap-2 bg-red-600 text-center font-extrabold uppercase tracking-wide text-white', compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-[13px]', className)}>
      <ShieldAlert className={compact ? 'size-3.5' : 'size-4'} aria-hidden />
      DEMO ONLY — NOT VALID FOR TRAVEL
    </div>
  );
}
