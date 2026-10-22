import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-lg bg-slate-200/80', className)} />;
}

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200/60">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-slate-200/60">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <XCircle className="size-7" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';
const tones: Record<Tone, { cls: string; icon: ReactNode }> = {
  info: { cls: 'bg-brand-50 text-brand-900 ring-brand-100', icon: <Info className="size-5 text-brand-600" /> },
  success: { cls: 'bg-emerald-50 text-emerald-900 ring-emerald-100', icon: <CheckCircle2 className="size-5 text-emerald-600" /> },
  warning: { cls: 'bg-saffron-50 text-saffron-700 ring-saffron-100', icon: <AlertTriangle className="size-5 text-saffron-600" /> },
  error: { cls: 'bg-red-50 text-red-800 ring-red-100', icon: <XCircle className="size-5 text-red-600" /> },
};

export function Alert({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-xl p-3.5 text-sm ring-1', tones[tone].cls, className)}>
      <span className="shrink-0">{tones[tone].icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}
