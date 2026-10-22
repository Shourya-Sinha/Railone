import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, Wallet as WalletIcon, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { fmtDateTime, inr, METHOD_LABEL } from '@/lib/format';
import type { PageMeta, PaymentMethod, Transaction } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/PageHeader';
import { buildPayment, PaymentMethods } from '@/components/PaymentMethods';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Alert, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';

type WalletResp = { balancePaise: number; transactions: Transaction[]; meta: PageMeta };
const PRESETS = [200, 500, 1000, 2000];
const TYPE_LABEL: Record<Transaction['type'], string> = { BOOKING_PAYMENT: 'Ticket payment', REFUND: 'Cancellation refund', WALLET_TOPUP: 'Wallet top-up' };

function TxnRow({ t }: { t: Transaction }) {
  const credit = t.type !== 'BOOKING_PAYMENT';
  const failed = t.status === 'FAILED';
  const Icon = failed ? XCircle : t.type === 'REFUND' ? RotateCcw : credit ? ArrowDownLeft : ArrowUpRight;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl', failed ? 'bg-red-50 text-red-600' : credit ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700')}><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{TYPE_LABEL[t.type]}{failed && <span className="ml-1.5 text-xs font-bold text-red-600">FAILED</span>}</p>
        <p className="truncate text-xs text-slate-500">
          {fmtDateTime(t.createdAt)} · {String(t.meta?.instrument ?? METHOD_LABEL[t.method])}
          {t.booking && <> · <Link to={`/tickets/${t.booking.id}`} className="font-medium text-brand-700">{t.booking.bookingRef}</Link></>}
        </p>
        {failed && t.failureReason && <p className="truncate text-xs text-red-600">{t.failureReason}</p>}
      </div>
      <div className="text-right">
        <p className={clsx('font-bold tabular-nums', failed ? 'text-slate-400 line-through' : credit ? 'text-emerald-700' : 'text-slate-900')}>{credit ? '+' : '−'}{inr(t.amountPaise)}</p>
        {t.balanceAfterPaise != null && !failed && <p className="text-[11px] text-slate-400">Bal {inr(t.balanceAfterPaise)}</p>}
      </div>
    </li>
  );
}

export default function WalletPage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const [type, setType] = useState<'' | Transaction['type']>('');
  const [open, setOpen] = useState(params.get('topup') === '1');
  const [amount, setAmount] = useState('500');
  const [method, setMethod] = useState<PaymentMethod>('DEMO_UPI');
  const [upi, setUpi] = useState('success@demoupi');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (!open && params.get('topup')) setParams({}, { replace: true }); }, [open, params, setParams]);

  const q = useInfiniteQuery({
    queryKey: ['wallet', 'list', type],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<WalletResp>(`/wallet?page=${pageParam}&pageSize=10${type ? `&type=${type}` : ''}`),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });

  const topup = useMutation({
    mutationFn: (body: unknown) => api<{ balancePaise: number; txnRef: string }>('/wallet/topup', { body }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      refresh();
      setOpen(false);
      toast(`Demo credits added · balance ${inr(r.balancePaise)}`);
    },
    onError: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  });

  const submit = () => {
    const amt = Number(amount);
    const errs: Record<string, string> = {};
    if (!Number.isInteger(amt) || amt < 100 || amt > 10000) errs.amount = 'Enter a whole amount between ₹100 and ₹10,000';
    const { payment, errors: pe } = buildPayment(method, upi, card);
    Object.assign(errs, pe);
    setErrors(errs);
    if (!Object.keys(errs).length && payment) topup.mutate({ amountRupees: amt, payment });
  };

  const balance = q.data?.pages[0]?.balancePaise;
  const txns = q.data?.pages.flatMap((p) => p.transactions) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Demo wallet" subtitle="Sandbox credits · no real money" back={false} />
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-5 text-white shadow-raised">
        <svg aria-hidden className="absolute -right-10 -top-10 size-48 text-white/[0.06]" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="12" /></svg>
        <p className="flex items-center gap-2 text-sm text-brand-100"><WalletIcon className="size-4" /> Available demo balance</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">{balance == null ? '—' : inr(balance, { decimals: true })}</p>
        <p className="mt-1 text-xs text-brand-200">Demo credits have no monetary value and cannot be withdrawn.</p>
        <Button variant="saffron" className="mt-4" icon={<Plus className="size-4" />} onClick={() => { topup.reset(); setErrors({}); setOpen(true); }}>Add demo money</Button>
      </div>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Transaction history</h2>
        <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter transactions">
          {([['', 'All'], ['BOOKING_PAYMENT', 'Payments'], ['REFUND', 'Refunds'], ['WALLET_TOPUP', 'Top-ups']] as const).map(([v, l]) => <Chip key={v} active={type === v} onClick={() => setType(v)}>{l}</Chip>)}
        </div>
        {q.isPending ? (
          <ListSkeleton rows={4} />
        ) : q.isError ? (
          <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
        ) : txns.length === 0 ? (
          <Card><EmptyState icon={<WalletIcon className="size-7" />} title="No transactions" body="Simulated payments, refunds and top-ups will appear here." /></Card>
        ) : (
          <Card className="px-4">
            <ul className="divide-y divide-slate-100">{txns.map((t) => <TxnRow key={t.id} t={t} />)}</ul>
            {q.hasNextPage && <div className="border-t border-slate-100 py-3 text-center"><Button variant="ghost" size="sm" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load more</Button></div>}
          </Card>
        )}
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add demo money" footer={<Button block size="lg" variant="saffron" loading={topup.isPending} onClick={submit}>Add ₹{Number(amount) || 0} (simulated)</Button>}>
        <label htmlFor="amt" className="mb-1.5 block text-sm font-medium text-slate-700">Amount</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center text-xl font-bold text-slate-400">₹</span>
          <input id="amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} aria-invalid={!!errors.amount || undefined} className="h-14 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-2xl font-extrabold focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </div>
        {errors.amount && <p role="alert" className="mt-1.5 text-sm text-red-600">{errors.amount}</p>}
        <div className="mt-3 flex flex-wrap gap-2">{PRESETS.map((p) => <Chip key={p} active={amount === String(p)} onClick={() => setAmount(String(p))}>₹{p.toLocaleString('en-IN')}</Chip>)}</div>
        <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-700">Pay using (sandbox)</h3>
        <PaymentMethods allowWallet={false} amountPaise={Number(amount) * 100} walletPaise={0} method={method} setMethod={(m) => { setMethod(m); setErrors({}); }} upi={upi} setUpi={setUpi} card={card} setCard={setCard} errors={errors} />
        {topup.isError && <Alert tone="error" className="mt-3">{(topup.error as ApiError).message}</Alert>}
      </Sheet>
    </div>
  );
}
