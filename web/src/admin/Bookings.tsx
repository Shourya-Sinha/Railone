import { useState } from 'react';
import { inr, fmtDate, fmtDateTime, METHOD_LABEL, TRAIN_TYPE_LABEL } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { AdminPageTitle, DataTable, FilterSelect, Mono, Toolbar, useAdminList, type Column } from './shared';

type AdminBooking = Booking & { user: { email: string; name: string } };

export default function BookingsPage() {
  const [sel, setSel] = useState<AdminBooking | null>(null);
  const { query, q, setQ, filters, setFilter, setPage } = useAdminList<{ bookings: AdminBooking[] }>('bookings', ['status', 'type']);
  const cols: Column<AdminBooking>[] = [
    { key: 'ref', header: 'Booking', cell: (b) => <div><Mono>{b.bookingRef}</Mono><p className="text-xs text-slate-500">{fmtDateTime(b.createdAt)}</p></div> },
    { key: 'user', header: 'User', cell: (b) => <span className="text-xs">{b.user.email}</span> },
    { key: 'type', header: 'Type', cell: (b) => <Badge tone={b.type === 'PLATFORM' ? 'slate' : 'blue'}>{b.type === 'PLATFORM' ? 'Platform' : 'Unreserved'}</Badge> },
    { key: 'route', header: 'Route', cell: (b) => <span className="font-semibold">{b.source.code}{b.destination && ` → ${b.destination.code}`}</span> },
    { key: 'date', header: 'Journey', cell: (b) => fmtDate(b.journeyDate) },
    { key: 'pax', header: 'Pax', className: 'text-right tabular-nums', cell: (b) => b.passengers },
    { key: 'total', header: 'Total', className: 'text-right tabular-nums', cell: (b) => inr(b.totalPaise) },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} validUntil={b.validUntil} /> },
  ];
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{v}</dd></div>;
  return (
    <div>
      <AdminPageTitle title="Bookings" subtitle="All demo tickets across users · click a row for details" />
      <Toolbar q={q} setQ={setQ} placeholder="Search ref, user email or station code">
        <FilterSelect label="Status" value={filters.status!} onChange={(v) => setFilter('status', v)} options={[['CONFIRMED', 'Confirmed'], ['PENDING_PAYMENT', 'Pending payment'], ['CANCELLED', 'Cancelled'], ['EXPIRED', 'Expired']]} />
        <FilterSelect label="Type" value={filters.type!} onChange={(v) => setFilter('type', v)} options={[['UNRESERVED', 'Unreserved'], ['PLATFORM', 'Platform']]} />
      </Toolbar>
      <DataTable columns={cols} rows={query.data?.bookings} loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} meta={query.data?.meta} onPage={setPage} onRowClick={setSel} />
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.bookingRef ?? 'Booking'}>
        {sel && (
          <dl className="divide-y divide-slate-100">
            {row('Status', <StatusBadge status={sel.status} validUntil={sel.validUntil} />)}
            {row('User', `${sel.user.name} (${sel.user.email})`)}
            {row('Type', sel.type)}
            {row('From', `${sel.source.name} (${sel.source.code})`)}
            {sel.destination && row('To', `${sel.destination.name} (${sel.destination.code})`)}
            {row('Journey date', fmtDate(sel.journeyDate))}
            {sel.trainType && row('Train', `${TRAIN_TYPE_LABEL[sel.trainType]}${sel.trainNumber ? ` · ${sel.trainNumber}` : ''}`)}
            {row('Passengers', `${sel.adults} adult · ${sel.children} child`)}
            {sel.distanceKm != null && row('Demo distance', `${sel.distanceKm} km`)}
            {row('Total', inr(sel.totalPaise, { decimals: true }))}
            {row('Fare table', sel.fareTableVersion)}
            {row('Payment', sel.paymentMethod ? METHOD_LABEL[sel.paymentMethod] : '—')}
            {sel.paidAt && row('Paid at', fmtDateTime(sel.paidAt))}
            {sel.validUntil && row('Valid until', fmtDateTime(sel.validUntil))}
            {sel.cancelledAt && row('Cancelled at', fmtDateTime(sel.cancelledAt))}
            {sel.refundPaise != null && row('Refund', inr(sel.refundPaise, { decimals: true }))}
            {row('Created', fmtDateTime(sel.createdAt))}
          </dl>
        )}
      </Sheet>
    </div>
  );
}
