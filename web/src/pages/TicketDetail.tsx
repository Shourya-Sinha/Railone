import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Printer, RotateCcw, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { inr } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { TicketCard } from '@/components/TicketCard';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Alert, ErrorState, Skeleton } from '@/components/ui/feedback';

const CLERKAGE_PER_PAX = 1500; // mirrors DEMO_FARE_TABLE.cancellation (server is authoritative)

export default function TicketDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isNew = params.get('new') === '1';

  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api<{ booking: Booking }>(`/bookings/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api<{ booking: Booking; refundPaise: number }>(`/bookings/${id}/cancel`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.setQueryData(['booking', id], { booking: r.booking });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      refresh();
      setConfirmOpen(false);
      toast(`Cancelled · ${inr(r.refundPaise)} demo refund added to wallet`);
    },
  });

  if (q.isPending) return (<div><PageHeader title="Demo ticket" /><Skeleton className="mx-auto h-[640px] max-w-md rounded-3xl" /></div>);
  if (q.isError) return (<div><PageHeader title="Demo ticket" /><ErrorState title="Ticket not found" message={(q.error as Error).message} onRetry={() => void q.refetch()} /></div>);
  const b = q.data.booking;
  const refund = Math.max(0, b.totalPaise - CLERKAGE_PER_PAX * b.passengers);

  return (
    <div>
      <PageHeader title="Demo ticket" subtitle={b.bookingRef} backTo="/tickets" />
      {isNew && b.status === 'CONFIRMED' && (
        <div className="no-print mb-5 flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-pop"><CheckCircle2 className="size-9" /></span>
          <h2 className="mt-3 text-xl font-extrabold">Demo booking successful</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">A simulated ticket has been generated. Remember: it is <strong className="text-red-600">not valid for travel</strong>.</p>
        </div>
      )}
      {b.status === 'PENDING_PAYMENT' && (
        <Alert tone="warning" title="Payment pending" className="no-print mb-4">
          This demo booking hasn't been paid. <Link to={`/checkout/${b.id}`} className="font-semibold underline">Complete payment</Link>
        </Alert>
      )}

      <TicketCard b={b} />

      <div className="no-print mx-auto mt-5 grid max-w-md grid-cols-2 gap-2.5">
        <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
        <a href={`/api/bookings/${b.id}/receipt.pdf`} download className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[15px] font-semibold text-slate-800 hover:bg-slate-50">
          <Download className="size-4" /> Receipt (PDF)
        </a>
        {b.cancellable && (
          <Button variant="outline" className="col-span-2 !text-red-700" icon={<XCircle className="size-4" />} onClick={() => { cancel.reset(); setConfirmOpen(true); }}>Cancel ticket (simulation)</Button>
        )}
        <Button variant="secondary" className="col-span-2" icon={<RotateCcw className="size-4" />} onClick={() => nav(b.type === 'PLATFORM' ? `/platform?station=${b.source.code}` : `/unreserved?from=${b.source.code}&to=${b.destination?.code}`)}>
          Book again
        </Button>
      </div>
      {b.type === 'PLATFORM' && b.status === 'CONFIRMED' && <p className="no-print mt-3 text-center text-xs text-slate-500">Platform tickets cannot be cancelled (demo rule).</p>}

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel this demo ticket?"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep ticket</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel ticket</Button>
          </div>
        }
      >
        <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-slate-600">Fare paid (demo)</dt><dd className="font-semibold">{inr(b.totalPaise)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-600">Clerkage ({b.passengers} × ₹15)</dt><dd className="font-semibold text-red-600">− {inr(Math.min(b.totalPaise, CLERKAGE_PER_PAX * b.passengers))}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-bold">Demo refund to wallet</dt><dd className="text-lg font-extrabold text-emerald-700">{inr(refund)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">This simulates a cancellation. The refund is credited instantly to your demo wallet; no real money is involved.</p>
        {cancel.isError && <Alert tone="error" className="mt-3">{(cancel.error as ApiError).message}</Alert>}
      </Sheet>
    </div>
  );
}
