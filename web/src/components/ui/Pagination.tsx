import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@/lib/types';

export function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return meta ? <p className="mt-3 text-center text-xs text-slate-500">{meta.total} record{meta.total === 1 ? '' : 's'}</p> : null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Pagination">
      <button type="button" className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:text-slate-300" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        <ChevronLeft className="size-4" /> Prev
      </button>
      <p className="text-sm text-slate-600">
        Page <strong>{meta.page}</strong> of {meta.totalPages} <span className="text-slate-400">· {meta.total} total</span>
      </p>
      <button type="button" className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:text-slate-300" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        Next <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
