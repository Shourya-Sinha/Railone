import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, IndianRupee, Ticket, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, inr } from '@/lib/format';
import { addDays, istToday } from '@/lib/date';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { AdminPageTitle, Kpi } from './shared';

type Stats = {
  users: { total: number; admins: number; newLast7Days: number; activeSessions: number };
  bookings: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
  revenue: { grossPaise: number; refundsPaise: number };
  transactions: { type: string; status: string; count: number; amountPaise: number }[];
  errorsLast24h: number;
  daily: { d: string; bookings: number; confirmed: number; revenue: number }[];
  topRoutes: { src: string; dst: string | null; n: number }[];
};

const STATUS_COLORS: Record<string, string> = { CONFIRMED: '#10b981', PENDING_PAYMENT: '#f28c28', CANCELLED: '#ef4444', EXPIRED: '#94a3b8' };

function BarChart({ data }: { data: { label: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.a));
  const W = 560, H = 180, pad = 24, bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label="Bookings per day for the last 14 days">
      {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={W - pad} y1={H - t * (H - 20)} y2={H - t * (H - 20)} stroke="#e2e8f0" strokeDasharray={t ? '4 4' : undefined} />)}
      {data.map((d, i) => {
        const x = pad + i * bw + bw * 0.18, w = bw * 0.64;
        const ha = (d.a / max) * (H - 20), hb = (d.b / max) * (H - 20);
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.a} bookings, ${d.b} paid`}</title>
            <rect x={x} y={H - ha} width={w} height={ha} rx={4} fill="#c7d7f5" />
            <rect x={x} y={H - hb} width={w} height={hb} rx={4} fill="#0b3a8c" />
            {i % 2 === 0 && <text x={x + w / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#64748b">{d.label}</text>}
          </g>
        );
      })}
      <text x={pad} y={12} fontSize="10" fill="#64748b">max {max}</text>
    </svg>
  );
}

function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 52, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0 -rotate-90" role="img" aria-label="Bookings by status">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {parts.map((p) => {
          const len = (p.value / total) * C;
          const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: p.color }} /><span className="text-slate-600">{p.label.replace('_', ' ').toLowerCase()}</span><strong className="ml-auto pl-3 tabular-nums">{p.value}</strong></li>)}
      </ul>
    </div>
  );
}

export default function Overview() {
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<Stats>('/admin/stats'), refetchInterval: 30_000 });
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  const s = q.data;
  const today = istToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const series = days.map((d) => { const r = s?.daily.find((x) => x.d === d); return { label: fmtDate(d, { day: 'numeric', month: 'short' }), a: r?.bookings ?? 0, b: r?.confirmed ?? 0 }; });

  return (
    <div>
      <AdminPageTitle title="Overview" subtitle="Live statistics from the demo database · refreshes every 30s" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!s ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (
          <>
            <Kpi label="Users" icon={<Users className="size-5" />} value={s.users.total} sub={`${s.users.newLast7Days} new in 7 days · ${s.users.activeSessions} active sessions`} />
            <Kpi label="Bookings" tone="saffron" icon={<Ticket className="size-5" />} value={s.bookings.total} sub={`${s.bookings.byType.UNRESERVED ?? 0} unreserved · ${s.bookings.byType.PLATFORM ?? 0} platform`} />
            <Kpi label="Demo revenue" tone="green" icon={<IndianRupee className="size-5" />} value={inr(s.revenue.grossPaise)} sub={`${inr(s.revenue.refundsPaise)} refunded (simulated)`} />
            <Link to="/admin/logs"><Kpi label="Errors (24h)" tone={s.errorsLast24h ? 'red' : 'green'} icon={<AlertTriangle className="size-5" />} value={s.errorsLast24h} sub="View error logs →" /></Link>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Bookings · last 14 days</h2><p className="flex gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#c7d7f5]" />created</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-brand-800" />paid</span></p></div>
          {s ? <BarChart data={series} /> : <Skeleton className="h-48" />}
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
          <h2 className="mb-3 font-bold">Bookings by status</h2>
          {s ? <Donut parts={Object.keys(STATUS_COLORS).map((k) => ({ label: k, value: s.bookings.byStatus[k] ?? 0, color: STATUS_COLORS[k]! }))} /> : <Skeleton className="h-36" />}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
          <h2 className="mb-3 font-bold">Top unreserved routes</h2>
          {!s ? <Skeleton className="h-32" /> : s.topRoutes.length === 0 ? <p className="text-sm text-slate-500">No paid unreserved bookings yet.</p> : (
            <ol className="space-y-2">
              {s.topRoutes.map((r, i) => {
                const pct = (r.n / s.topRoutes[0]!.n) * 100;
                return (
                  <li key={`${r.src}-${r.dst}`} className="text-sm">
                    <div className="mb-1 flex justify-between"><span className="font-semibold">{i + 1}. {r.src} → {r.dst ?? '—'}</span><span className="tabular-nums text-slate-500">{r.n}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-saffron-500" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
          <h2 className="mb-3 font-bold">Transactions summary</h2>
          {!s ? <Skeleton className="h-32" /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">Type</th><th className="pb-2">Status</th><th className="pb-2 text-right">Count</th><th className="pb-2 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.transactions.map((t) => <tr key={t.type + t.status}><td className="py-2">{t.type.replace('_', ' ').toLowerCase()}</td><td className={t.status === 'FAILED' ? 'text-red-600' : 'text-emerald-700'}>{t.status.toLowerCase()}</td><td className="text-right tabular-nums">{t.count}</td><td className="text-right tabular-nums">{inr(t.amountPaise)}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
