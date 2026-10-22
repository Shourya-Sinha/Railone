import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck, Timer } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { fmtDay, inr } from '@/lib/format';
import type { Booking, PaymentInput, PaymentMethod } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { buildPayment, PaymentMethods } from '@/components/PaymentMethods';
import { Alert, ErrorState, Skeleton } from '@/components/ui/feedback';

function useCountdown(until?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  return Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
}

export default function CheckoutPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, refresh } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('WALLET');
  const [upi, setUpi] = useState('');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  const booking = useQuery({ queryKey: ['booking', id], queryFn: () => api<{ booking: Booking }>(`/bookings/${id}`) });
  const wallet = useQuery({ queryKey: ['wallet', 'summary'], queryFn: () => api<{ balancePaise: number }>('/wallet?pageSize=1') });
  const b = booking.data?.booking;
  const left = useCountdown(b?.holdExpiresAt);
  const walletPaise = wallet.data?.balancePaise ?? user?.walletBalancePaise ?? 0;

  useEffect(() => {
    if (b && walletPaise < b.totalPaise && method === 'WALLET') setMethod('DEMO_UPI');
  }, [b, walletPaise, method]);

  const pay = useMutation({
    mutationFn: async (payment: PaymentInput) => {
      setProcessing(true);
      await new Promise((r) => setTimeout(r, 1100)); // simulated gateway latency
      return api<{ booking: Booking; txnRef: string }>(`/bookings/${id}/pay`, { body: payment });
    },
    onSettled: () => setProcessing(false),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.setQueryData(['booking', id], { booking: r.booking });
      refresh();
      nav(`/tickets/${id}?new=1`, { replace: true });
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      if (e instanceof ApiError && e.fieldErrors.payment) setErrors({ [method === 'DEMO_UPI' ? 'upi' : 'cardNumber']: e.fieldErrors.payment });
      void booking.refetch();
    },
  });

  const submit = () => {
    if (!b) return;
    const { payment, errors: errs } = buildPayment(method, upi, card);
    setErrors(errs);
    if (payment) pay.mutate(payment);
  };

  if (booking.isPending) return (<div><PageHeader title="Checkout" /><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="mt-4 h-64 w-full rounded-2xl" /></div>);
  if (booking.isError || !b) return (<div><PageHeader title="Checkout" /><ErrorState title="Booking not found" message={(booking.error as Error)?.message} /></div>);

  if (b.status !== 'PENDING_PAYMENT') {
    return (
      <div>
        <PageHeader title="Checkout" />
        <Card className="p-6 text-center">
          {b.status === 'CONFIRMED' ? <CheckCircle2 className="mx-auto size-12 text-emerald-600" /> : <Timer className="mx-auto size-12 text-slate-400" />}
          <h2 className="mt-3 text-lg font-bold">{b.status === 'CONFIRMED' ? 'Already paid' : b.status === 'EXPIRED' ? 'Payment window expired' : 'Booking not payable'}</h2>
          <p className="mt-1 text-sm text-slate-500">{b.status === 'EXPIRED' ? 'Unpaid demo bookings are released after 15 minutes. Please book again.' : `Status: ${b.status}`}</p>
          <div className="mt-5 flex justify-center gap-2">
            {b.status === 'CONFIRMED' ? <Button onClick={() => nav(`/tickets/${b.id}`)}>View ticket</Button> : <Button onClick={() => nav(b.type === 'PLATFORM' ? '/platform' : '/unreserved')}>Book again</Button>}
          </div>
        </Card>
      </div>
    );
  }

  const mm = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
  return (
    <div className="space-y-4">
      <PageHeader title="Checkout" subtitle="Simulated payment · sandbox only" />
      <Card className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{b.type === 'PLATFORM' ? 'Platform ticket' : 'Unreserved ticket'} · {b.bookingRef}</p>
            <p className="mt-1 text-xl font-extrabold">{b.type === 'PLATFORM' ? `${b.source.name} (${b.source.code})` : <>{b.source.code} <ArrowRight className="inline size-4 text-slate-400" /> {b.destination?.code}</>}</p>
            <p className="text-xs text-slate-500">{fmtDay(b.journeyDate)} · {b.passengers} {b.type === 'PLATFORM' ? 'person(s)' : 'passenger(s)'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Amount</p>
            <p className="text-2xl font-extrabold text-brand-900">{inr(b.totalPaise)}</p>
          </div>
        </div>
        {left != null && (
          <p className={clsx('mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold', left < 120 ? 'bg-red-50 text-red-700' : 'bg-saffron-50 text-saffron-700')} aria-live="polite">
            <Timer className="size-4" /> Complete payment within {mm} — the demo hold will be released after that.
          </p>
        )}
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="mb-3 font-bold">Choose a sandbox payment method</h2>
        <PaymentMethods amountPaise={b.totalPaise} walletPaise={walletPaise} method={method} setMethod={(m) => { setMethod(m); setErrors({}); pay.reset(); }} upi={upi} setUpi={setUpi} card={card} setCard={setCard} errors={errors} />
        {walletPaise < b.totalPaise && <p className="mt-2 text-xs text-slate-500">Need more demo credits? <Link to="/wallet?topup=1" className="font-semibold text-brand-700 underline">Add money</Link></p>}
      </Card>

      {pay.isError && (
        <Alert tone="error" title="Payment not completed">
          {(pay.error as ApiError).message}. No money was moved — this is a sandbox. You can retry with another method.
        </Alert>
      )}

      <div className="sticky bottom-20 z-10 md:static">
        <Button size="lg" variant="saffron" block onClick={submit} loading={pay.isPending} icon={<Lock className="size-4" />} className="shadow-raised md:shadow-none">
          Pay {inr(b.totalPaise)} (simulated)
        </Button>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500"><ShieldCheck className="size-4" /> Demo payment button — no real transaction will take place.</p>

      {processing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur" role="status" aria-live="assertive">
          <Loader2 className="size-12 animate-spin text-brand-700" />
          <p className="text-lg font-bold">Contacting sandbox gateway…</p>
          <p className="text-sm text-slate-500">Simulating a {method === 'WALLET' ? 'wallet debit' : method === 'DEMO_UPI' ? 'UPI collect request' : 'card authorisation'}</p>
        </div>
      )}
    </div>
  );
}
