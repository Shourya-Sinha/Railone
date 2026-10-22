import { fmtDateTime, inr, METHOD_LABEL } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { AdminPageTitle, DataTable, FilterSelect, Mono, Toolbar, useAdminList, type Column } from './shared';

type Txn = { id: string; txnRef: string; type: string; status: 'SUCCESS' | 'FAILED'; method: string; amountPaise: number; failureReason: string | null; meta: Record<string, unknown> | null; createdAt: string; user: { email: string }; booking: { bookingRef: string } | null };

export default function TransactionsPage() {
  const { query, q, setQ, filters, setFilter, setPage } = useAdminList<{ transactions: Txn[] }>('transactions', ['type', 'status', 'method']);
  const cols: Column<Txn>[] = [
    { key: 'ref', header: 'Txn ref', cell: (t) => <div><Mono>{t.txnRef}</Mono><p className="text-xs text-slate-500">{fmtDateTime(t.createdAt)}</p></div> },
    { key: 'user', header: 'User', cell: (t) => <span className="text-xs">{t.user.email}</span> },
    { key: 'type', header: 'Type', cell: (t) => <span className="text-xs font-medium">{t.type.replace('_', ' ')}</span> },
    { key: 'method', header: 'Method', cell: (t) => <div className="text-xs"><p>{METHOD_LABEL[t.method]}</p>{t.meta?.instrument != null && <p className="text-slate-500">{String(t.meta.instrument)}</p>}</div> },
    { key: 'booking', header: 'Booking', cell: (t) => t.booking ? <Mono>{t.booking.bookingRef}</Mono> : <span className="text-slate-400">—</span> },
    { key: 'amount', header: 'Amount', className: 'text-right tabular-nums font-semibold', cell: (t) => inr(t.amountPaise, { decimals: true }) },
    { key: 'status', header: 'Status', cell: (t) => <div><Badge tone={t.status === 'SUCCESS' ? 'green' : 'red'}>{t.status}</Badge>{t.failureReason && <p className="mt-1 max-w-48 truncate text-xs text-red-600" title={t.failureReason}>{t.failureReason}</p>}</div> },
  ];
  return (
    <div>
      <AdminPageTitle title="Transactions" subtitle="Sandbox payment ledger · no real money" />
      <Toolbar q={q} setQ={setQ} placeholder="Search txn ref, booking ref or email">
        <FilterSelect label="Type" value={filters.type!} onChange={(v) => setFilter('type', v)} options={[['BOOKING_PAYMENT', 'Booking payment'], ['REFUND', 'Refund'], ['WALLET_TOPUP', 'Wallet top-up']]} />
        <FilterSelect label="Status" value={filters.status!} onChange={(v) => setFilter('status', v)} options={[['SUCCESS', 'Success'], ['FAILED', 'Failed']]} />
        <FilterSelect label="Method" value={filters.method!} onChange={(v) => setFilter('method', v)} options={[['WALLET', 'Wallet'], ['DEMO_UPI', 'Demo UPI'], ['DEMO_CARD', 'Demo card']]} />
      </Toolbar>
      <DataTable columns={cols} rows={query.data?.transactions} loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} meta={query.data?.meta} onPage={setPage} />
    </div>
  );
}
