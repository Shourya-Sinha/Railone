import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { AdminPageTitle, DataTable, FilterSelect, Mono, Toolbar, useAdminList, type Column } from './shared';

type ErrorRow = { id: string; level: string; source: string; message: string; stack: string | null; path: string | null; method: string | null; status: number | null; userId: string | null; requestId: string | null; createdAt: string };
type AuditRow = { id: string; actorId: string | null; action: string; entity: string; entityId: string | null; meta: unknown; ip: string | null; createdAt: string };

function ErrorsTab() {
  const [sel, setSel] = useState<ErrorRow | null>(null);
  const { query, q, setQ, filters, setFilter, setPage } = useAdminList<{ errors: ErrorRow[] }>('errors', ['level', 'source']);
  const cols: Column<ErrorRow>[] = [
    { key: 'time', header: 'Time', cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</span> },
    { key: 'level', header: 'Level', cell: (r) => <Badge tone={r.level === 'error' ? 'red' : 'amber'}>{r.level}</Badge> },
    { key: 'source', header: 'Source', cell: (r) => <Badge tone={r.source === 'web' ? 'blue' : 'slate'}>{r.source}</Badge> },
    { key: 'msg', header: 'Message', cell: (r) => <p className="max-w-md truncate" title={r.message}>{r.message}</p> },
    { key: 'path', header: 'Request', cell: (r) => <Mono>{r.method} {r.path}{r.status ? ` · ${r.status}` : ''}</Mono> },
    { key: 'rid', header: 'Request ID', cell: (r) => r.requestId ? <Mono>{r.requestId.slice(0, 8)}</Mono> : '—' },
  ];
  return (
    <>
      <Toolbar q={q} setQ={setQ} placeholder="Search message, path or request ID">
        <FilterSelect label="Level" value={filters.level!} onChange={(v) => setFilter('level', v)} options={[['error', 'Error'], ['warn', 'Warning']]} />
        <FilterSelect label="Source" value={filters.source!} onChange={(v) => setFilter('source', v)} options={[['server', 'Server'], ['web', 'Web client']]} />
      </Toolbar>
      <DataTable columns={cols} rows={query.data?.errors} loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} meta={query.data?.meta} onPage={setPage} onRowClick={setSel} empty="No errors logged. 🎉" />
      <Sheet open={!!sel} onClose={() => setSel(null)} title="Error details" size="lg">
        {sel && (
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{sel.message}</p>
            <p className="text-slate-500">{fmtDateTime(sel.createdAt)} · {sel.source} · {sel.method} {sel.path} {sel.status}</p>
            {sel.requestId && <p>Request ID: <Mono>{sel.requestId}</Mono></p>}
            {sel.userId && <p>User ID: <Mono>{sel.userId}</Mono></p>}
            {sel.stack && <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{sel.stack}</pre>}
          </div>
        )}
      </Sheet>
    </>
  );
}

function AuditTab() {
  const { query, q, setQ, filters, setFilter, setPage } = useAdminList<{ entries: AuditRow[]; actions: string[] }>('audit', ['action']);
  const cols: Column<AuditRow>[] = [
    { key: 'time', header: 'Time', cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</span> },
    { key: 'action', header: 'Action', cell: (r) => <span className="font-mono text-xs font-semibold text-brand-800">{r.action}</span> },
    { key: 'entity', header: 'Entity', cell: (r) => <span className="text-xs">{r.entity}{r.entityId && <> · <Mono>{r.entityId.slice(0, 12)}</Mono></>}</span> },
    { key: 'actor', header: 'Actor', cell: (r) => r.actorId ? <Mono>{r.actorId.slice(0, 12)}</Mono> : <span className="text-slate-400">system</span> },
    { key: 'ip', header: 'IP', cell: (r) => <Mono>{r.ip ?? '—'}</Mono> },
    { key: 'meta', header: 'Details', cell: (r) => r.meta ? <code className="block max-w-xs truncate text-xs text-slate-500" title={JSON.stringify(r.meta)}>{JSON.stringify(r.meta)}</code> : '—' },
  ];
  return (
    <>
      <Toolbar q={q} setQ={setQ} placeholder="Search action, entity or ID">
        <FilterSelect label="Action" value={filters.action!} onChange={(v) => setFilter('action', v)} options={(query.data?.actions ?? []).map((a) => [a, a])} />
      </Toolbar>
      <DataTable columns={cols} rows={query.data?.entries} loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} meta={query.data?.meta} onPage={setPage} />
    </>
  );
}

export default function LogsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'audit' ? 'audit' : 'errors';
  return (
    <div>
      <AdminPageTitle title="Error & audit logs" subtitle="Server/client errors and security-relevant actions" />
      <Segmented className="mb-4 max-w-sm" label="Log type" value={tab} onChange={(v) => setParams(v === 'audit' ? { tab: 'audit' } : {})} options={[{ value: 'errors', label: 'Errors' }, { value: 'audit', label: 'Audit trail' }]} />
      {tab === 'errors' ? <ErrorsTab key="e" /> : <AuditTab key="a" />}
    </div>
  );
}
