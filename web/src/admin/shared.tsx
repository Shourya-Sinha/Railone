import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { PageMeta } from '@/lib/types';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState, Skeleton } from '@/components/ui/feedback';

/** URL-synced filters + pagination for admin list endpoints. */
export function useAdminList<T>(endpoint: string, filterKeys: string[], pageSize = 15) {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounce(q.trim(), 300);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters = Object.fromEntries(filterKeys.map((k) => [k, params.get(k) ?? '']));

  useEffect(() => {
    if ((params.get('q') ?? '') === dq) return;
    const next = new URLSearchParams(params);
    if (dq) next.set('q', dq); else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('page');
    setParams(next, { replace: true });
  };
  const setPage = (p: number) => { const next = new URLSearchParams(params); next.set('page', String(p)); setParams(next); window.scrollTo({ top: 0 }); };

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (dq) qs.set('q', dq);
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const query = useQuery({ queryKey: ['admin', endpoint, qs.toString()], queryFn: () => api<T & { meta: PageMeta }>(`/admin/${endpoint}?${qs}`), placeholderData: keepPreviousData });
  return { query, q, setQ, filters, setFilter, page, setPage };
}

export function AdminPageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Toolbar({ q, setQ, placeholder, children }: { q: string; setQ: (v: string) => void; placeholder: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
      </div>
      {children}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
      <option value="">{label}: all</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export type Column<R> = { key: string; header: string; cell: (r: R) => ReactNode; className?: string };

export function DataTable<R extends { id: string | number }>({ columns, rows, loading, error, onRetry, meta, onPage, empty = 'No records match your filters.', onRowClick }: {
  columns: Column<R>[]; rows?: R[]; loading: boolean; error?: unknown; onRetry?: () => void; meta?: PageMeta; onPage: (p: number) => void; empty?: string; onRowClick?: (r: R) => void;
}) {
  if (error) return <ErrorState message={(error as Error).message} onRetry={onRetry} />;
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={clsx('px-4 py-3 font-semibold', c.className)}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !rows
              ? Array.from({ length: 6 }, (_, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-32" /></td>)}</tr>)
              : rows?.length
                ? rows.map((r) => (
                    <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx('transition', onRowClick && 'cursor-pointer hover:bg-brand-50/50')}>
                      {columns.map((c) => <td key={c.key} className={clsx('px-4 py-3 align-middle', c.className)}>{c.cell(r)}</td>)}
                    </tr>
                  ))
                : <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination meta={meta} onPage={onPage} />
    </div>
  );
}

export function Kpi({ label, value, sub, icon, tone = 'brand' }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: 'brand' | 'saffron' | 'green' | 'red' }) {
  const toneCls = { brand: 'bg-brand-50 text-brand-700', saffron: 'bg-saffron-50 text-saffron-600', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><span className={clsx('flex size-9 items-center justify-center rounded-xl', toneCls)}>{icon}</span></div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-xs text-slate-700">{children}</span>;
