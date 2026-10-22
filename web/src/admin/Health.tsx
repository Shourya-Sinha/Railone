import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Activity, Clock, Database, HardDrive, Server } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { AdminPageTitle, Kpi } from './shared';

type Health = {
  status: 'ok' | 'degraded'; version: string; node: string; environment: string; startedAt: string; uptimeSec: number;
  database: { ok: boolean; latencyMs: number; error?: string };
  migrations: { name: string; appliedAt: string | null }[];
  memory: { rssMb: number; heapUsedMb: number; systemFreeMb: number };
  loadAvg: number[]; stationCache: { size: number; loadedAt: string | null }; pendingPayments: number;
};
const uptime = (s: number) => `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

export default function HealthPage() {
  const q = useQuery({ queryKey: ['admin', 'health'], queryFn: () => api<Health>('/admin/health'), refetchInterval: 10_000 });
  if (q.isError) return <ErrorState title="Health check failed" message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  const h = q.data;
  return (
    <div>
      <AdminPageTitle title="System health" subtitle="Auto-refreshes every 10 seconds" action={h && (
        <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold', h.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
          <span className={clsx('size-2.5 rounded-full', h.status === 'ok' ? 'animate-pulse bg-emerald-500' : 'bg-red-500')} />{h.status === 'ok' ? 'All systems operational' : 'Degraded'}
        </span>
      )} />
      {!h ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Database" tone={h.database.ok ? 'green' : 'red'} icon={<Database className="size-5" />} value={h.database.ok ? `${h.database.latencyMs} ms` : 'Down'} sub={h.database.error ?? 'PostgreSQL round-trip'} />
            <Kpi label="Uptime" icon={<Clock className="size-5" />} value={uptime(h.uptimeSec)} sub={`since ${fmtDateTime(h.startedAt)}`} />
            <Kpi label="Memory (RSS)" tone="saffron" icon={<HardDrive className="size-5" />} value={`${h.memory.rssMb} MB`} sub={`heap ${h.memory.heapUsedMb} MB · free ${h.memory.systemFreeMb} MB`} />
            <Kpi label="Pending payments" icon={<Activity className="size-5" />} value={h.pendingPayments} sub="bookings on 15-min hold" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Server className="size-4 text-brand-700" />Runtime</h2>
              <dl className="divide-y divide-slate-100 text-sm">
                {[['App version', h.version], ['Node.js', h.node], ['Environment', h.environment], ['Load average (1/5/15m)', h.loadAvg.join(' / ')], ['Station cache', `${h.stationCache.size} stations${h.stationCache.loadedAt ? ` · loaded ${fmtDateTime(h.stationCache.loadedAt)}` : ''}`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Database className="size-4 text-brand-700" />Applied migrations</h2>
              {h.migrations.length === 0 ? <p className="text-sm text-slate-500">No migration records found.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">{h.migrations.map((m) => <li key={m.name} className="flex justify-between gap-4 py-2"><span className="font-mono text-xs">{m.name}</span><span className="text-xs text-slate-500">{m.appliedAt ? fmtDateTime(m.appliedAt) : 'pending'}</span></li>)}</ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
