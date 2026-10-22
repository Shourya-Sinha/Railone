import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import type { Booking, PageMeta } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { BookingListItem } from '@/components/BookingListItem';
import { Segmented } from '@/components/ui/Segmented';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/Pagination';

export default function MyTicketsPage() {
  const nav = useNavigate();
  const [scope, setScope] = useState<'active' | 'past'>('active');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['bookings', scope, page],
    queryFn: () => api<{ bookings: Booking[]; meta: PageMeta }>(`/bookings?scope=${scope}&page=${page}&pageSize=10`),
    placeholderData: (p) => p,
  });
  return (
    <div>
      <PageHeader title="My tickets" subtitle="Your demo journey & platform tickets" back={false} />
      <Segmented label="Ticket filter" value={scope} onChange={(v) => { setScope(v); setPage(1); }} options={[{ value: 'active', label: 'Active' }, { value: 'past', label: 'Past & cancelled' }]} className="mb-4" />
      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      ) : q.data.bookings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ticket className="size-7" />}
            title={scope === 'active' ? 'No active demo tickets' : 'Nothing here yet'}
            body={scope === 'active' ? 'Tickets stay active until the end of the journey day (platform tickets: 2 hours).' : 'Past, used, expired and cancelled demo tickets appear here.'}
            action={scope === 'active' ? <div className="flex gap-2"><Button onClick={() => nav('/unreserved')}>Book journey</Button><Button variant="secondary" onClick={() => nav('/platform')}>Platform ticket</Button></div> : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-2.5">{q.data.bookings.map((b) => <BookingListItem key={b.id} b={b} />)}</div>
          <Pagination meta={q.data.meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
