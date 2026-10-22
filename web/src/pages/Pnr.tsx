import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, CheckCircle2, FileSearch, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import { isValidPnr } from '@/lib/validation';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';

interface PnrStatus {
  pnr: string;
  train: { number: string; name: string };
  from: { code: string; name: string };
  to: { code: string; name: string };
  boardingPoint: { code: string; name: string };
  journeyDate: string;
  departure: string;
  arrival: string;
  classCode: string;
  className: string;
  quota: string;
  chartPrepared: boolean;
  farePerPassengerRupees: number;
  passengers: { serial: number; bookingStatus: string; currentStatus: string }[];
}

const statusTone = (s: string) => (s.startsWith('CNF') ? 'text-emerald-700' : s.startsWith('RAC') ? 'text-amber-700' : s.startsWith('CAN') ? 'text-slate-500' : 'text-red-600');

export default function PnrPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('pnr') ?? '';
  const [value, setValue] = useState(initial);
  const [pnr, setPnr] = useState(isValidPnr(initial) ? initial : '');
  const [error, setError] = useState('');

  useEffect(() => { if (pnr) setParams({ pnr }, { replace: true }); }, [pnr, setParams]);

  const samples = useQuery({ queryKey: ['pnr-samples'], queryFn: () => api<{ samples: string[] }>('/pnr/samples'), staleTime: Infinity });
  const q = useQuery({ queryKey: ['pnr', pnr], enabled: !!pnr, queryFn: () => api<{ status: PnrStatus; notice: string }>(`/pnr/${pnr}`) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidPnr(value)) return setError('PNR must be exactly 10 digits');
    setError('');
    setPnr(value);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="PNR status" subtitle="Demonstration · mock reservation data" />
      <Card className="p-4 md:p-5">
        <form onSubmit={submit} noValidate>
          <label htmlFor="pnr" className="mb-1.5 block text-sm font-medium text-slate-700">10-digit PNR number</label>
          <div className="flex gap-2">
            <input id="pnr" value={value} inputMode="numeric" autoComplete="off" maxLength={10} aria-invalid={!!error || undefined} aria-describedby="pnr-help"
              onChange={(e) => { setValue(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              placeholder="e.g. 2451837690"
              className={clsx('h-12 min-w-0 flex-1 rounded-xl border px-3.5 font-mono text-lg tracking-[0.2em] focus:outline-none focus:ring-4', error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100')} />
            <Button type="submit" size="lg" icon={<Search className="size-5" />}>Check</Button>
          </div>
          {error ? <p role="alert" className="mt-1.5 text-sm text-red-600">{error}</p> : <p id="pnr-help" className="mt-1.5 text-xs text-slate-500">PNRs beginning with 0 or 9 simulate a “not found” response.</p>}
        </form>
        {samples.data && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Try:</span>
            {samples.data.samples.map((s) => <button key={s} type="button" onClick={() => { setValue(s); setPnr(s); setError(''); }} className="h-8 rounded-full bg-slate-100 px-3 font-mono font-semibold text-slate-700 hover:bg-slate-200">{s}</button>)}
          </div>
        )}
      </Card>

      {!pnr ? (
        <Card><EmptyState icon={<FileSearch className="size-7" />} title="Check a demo PNR" body="Results are generated from mock data and are not linked to any real reservation system." /></Card>
      ) : q.isPending ? (
        <Card className="space-y-3 p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></Card>
      ) : q.isError ? (
        <ErrorState title={(q.error as ApiError).status === 404 ? 'PNR not found' : 'Unable to fetch PNR'} message={(q.error as Error).message} onRetry={(q.error as ApiError).status === 404 ? undefined : () => void q.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-4 text-white md:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-brand-200">PNR {q.data.status.pnr}</p>
                <p className="mt-0.5 font-bold"><span className="font-mono">{q.data.status.train.number}</span> · {q.data.status.train.name}</p>
              </div>
              <Badge tone={q.data.status.chartPrepared ? 'green' : 'amber'}>{q.data.status.chartPrepared ? 'Chart prepared' : 'Chart not prepared'}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div><p className="text-2xl font-extrabold">{q.data.status.from.code}</p><p className="text-xs text-brand-200">{q.data.status.departure}</p></div>
              <ArrowRight className="size-5 text-saffron-400" />
              <div><p className="text-2xl font-extrabold">{q.data.status.to.code}</p><p className="text-xs text-brand-200">{q.data.status.arrival}</p></div>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 border-b border-slate-100 p-4 text-sm md:p-5">
            <div><dt className="text-[11px] font-bold uppercase text-slate-500">Date</dt><dd className="font-semibold">{fmtDay(q.data.status.journeyDate)}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase text-slate-500">Class</dt><dd className="font-semibold">{q.data.status.classCode}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase text-slate-500">Quota</dt><dd className="font-semibold">{q.data.status.quota}</dd></div>
            <div className="col-span-2"><dt className="text-[11px] font-bold uppercase text-slate-500">Boarding</dt><dd className="font-semibold">{q.data.status.boardingPoint.name}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase text-slate-500">Fare/pax</dt><dd className="font-semibold">₹{q.data.status.farePerPassengerRupees}</dd></div>
          </dl>
          <div className="p-4 md:p-5">
            <table className="w-full text-sm">
              <caption className="sr-only">Passenger status</caption>
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="pb-2 font-bold">#</th><th className="pb-2 font-bold">Booking status</th><th className="pb-2 font-bold">Current status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.status.passengers.map((p) => (
                  <tr key={p.serial}>
                    <td className="py-2.5 font-semibold">P{p.serial}</td>
                    <td className="py-2.5 font-mono text-xs">{p.bookingStatus}</td>
                    <td className={clsx('py-2.5 font-mono text-xs font-bold', statusTone(p.currentStatus))}>{p.currentStatus.startsWith('CNF') && <CheckCircle2 className="mr-1 inline size-3.5" />}{p.currentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-slate-500">{q.data.notice}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
