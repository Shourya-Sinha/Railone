import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { api } from '@/lib/api';
import type { Booking, BookingStatus, PageMeta } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { BookingListItem } from '@/components/BookingListItem';
import { Chip } from '@/components/ui/Segmented';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/Pagination';

const STATUSES: { v: BookingStatus | ''; l: string }[] = [
  { v: '', l: 'All' }, { v: 'CONFIRMED', l: 'Confirmed' }, { v: 'CANCELLED', l: 'Cancelled' }, { v: 'PENDING_PAYMENT', l: 'Pending' }, { v: 'EXPIRED', l: 'Expired' },
];

export default function HistoryPage() {
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [type, setType] = useState<'' | 'UNRESERVED' | 'PLATFORM'>('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '10', ...(status ? { status } : {}), ...(type ? { type } : {}) });
  const q = useQuery({ queryKey: ['bookings', 'history', status, type, page], queryFn: () => api<{ bookings: Booking[]; meta: PageMeta }>(`/bookings?${qs}`), placeholderData: (p) => p });

  return (
    <div>
      <PageHeader title="Booking history" subtitle="Every demo booking you've made" />
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => <Chip key={s.v} active={status === s.v} onClick={() => { setStatus(s.v); setPage(1); }}>{s.l}</Chip>)}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter by ticket type">
          {([['', 'All types'], ['UNRESERVED', 'Journey'], ['PLATFORM', 'Platform']] as const).map(([v, l]) => <Chip key={v} active={type === v} onClick={() => { setType(v); setPage(1); }}>{l}</Chip>)}
        </div>
      </div>
      <div className="mt-4">
        {q.isPending ? (
          <ListSkeleton rows={4} />
        ) : q.isError ? (
          <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
        ) : q.data.bookings.length === 0 ? (
          <Card><EmptyState icon={<History className="size-7" />} title="No bookings match these filters" body="Try clearing a filter." /></Card>
        ) : (
          <>
            <div className="space-y-2.5">{q.data.bookings.map((b) => <BookingListItem key={b.id} b={b} />)}</div>
            <Pagination meta={q.data.meta} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
