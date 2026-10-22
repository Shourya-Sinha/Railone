import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Radio, RefreshCw, Search, TrainFront } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { isValidTrainNumber } from '@/lib/validation';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';

type T = { time: string; day: number } | null;
interface Running {
  train: { number: string; name: string; type: string };
  from: { code: string; name: string };
  to: { code: string; name: string };
  startDate: string;
  lastUpdated: string;
  status: 'NOT_STARTED' | 'RUNNING' | 'AT_STATION' | 'COMPLETED';
  text: string;
  progress: number;
  currentDelayMin: number;
  stops: { code: string; name: string; distanceKm: number; scheduledArrival: T; scheduledDeparture: T; expectedArrival: T; expectedDeparture: T; delayMin: number; platform: number; state: 'DEPARTED' | 'CURRENT' | 'UPCOMING' }[];
}

const SAMPLES = ['12345', '13021', '12801', '15273'];

export default function RunningStatusPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('train') ?? '';
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const train = isValidTrainNumber(initial) ? initial : '';
  const extra = params.get('from') && params.get('to') ? `?from=${params.get('from')}&to=${params.get('to')}` : '';

  const q = useQuery({
    queryKey: ['running', train, extra],
    enabled: !!train,
    queryFn: () => api<{ status: Running; notice: string }>(`/trains/${train}/running-status${extra}`),
    refetchInterval: 60_000,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidTrainNumber(value)) return setError('Train number must be 5 digits');
    setError('');
    setParams({ train: value });
  };

  const s = q.data?.status;
  const lastDepartedIdx = s ? s.stops.map((x) => x.state).lastIndexOf('DEPARTED') : -1;

  return (
    <div className="space-y-4">
      <PageHeader title="Train running status" subtitle="Simulated from a mock timetable" />
      <Card className="p-4 md:p-5">
        <form onSubmit={submit} noValidate>
          <label htmlFor="trainno" className="mb-1.5 block text-sm font-medium text-slate-700">Train number</label>
          <div className="flex gap-2">
            <input id="trainno" value={value} inputMode="numeric" maxLength={5} aria-invalid={!!error || undefined} onChange={(e) => { setValue(e.target.value.replace(/\D/g, '').slice(0, 5)); setError(''); }} placeholder="e.g. 12345"
              className={clsx('h-12 min-w-0 flex-1 rounded-xl border px-3.5 font-mono text-lg tracking-[0.2em] focus:outline-none focus:ring-4', error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100')} />
            <Button type="submit" size="lg" icon={<Search className="size-5" />}>Track</Button>
          </div>
          {error && <p role="alert" className="mt-1.5 text-sm text-red-600">{error}</p>}
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Try:</span>
          {SAMPLES.map((n) => <button key={n} type="button" onClick={() => { setValue(n); setParams({ train: n }); }} className="h-8 rounded-full bg-slate-100 px-3 font-mono font-semibold text-slate-700 hover:bg-slate-200">{n}</button>)}
        </div>
      </Card>

      {!train ? (
        <Card><EmptyState icon={<Radio className="size-7" />} title="Track a demo train" body="Positions are computed from a fictional schedule and the current time — not live GPS or railway data." /></Card>
      ) : q.isPending ? (
        <Card className="space-y-3 p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-3 w-full" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</Card>
      ) : q.isError ? (
        <ErrorState title="Train not found" message={(q.error as ApiError).message} onRetry={() => void q.refetch()} />
      ) : s ? (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-4 text-white md:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold"><span className="font-mono">{s.train.number}</span> · {s.train.name}</p>
                <p className="text-xs text-brand-200">{s.from.code} → {s.to.code} · started {fmtDay(s.startDate)}</p>
              </div>
              <Badge tone="amber">Simulated</Badge>
            </div>
            <p className="mt-3 text-lg font-bold">{s.text}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
              <div className="h-full rounded-full bg-saffron-400 transition-all" style={{ width: `${Math.round(s.progress * 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-brand-200">
              <span>{s.currentDelayMin > 0 ? <span className="font-semibold text-saffron-200">{s.currentDelayMin} min late</span> : 'On time'}</span>
              <button onClick={() => void q.refetch()} className="inline-flex h-8 items-center gap-1 font-semibold hover:text-white"><RefreshCw className={clsx('size-3.5', q.isFetching && 'animate-spin')} /> Updated {fmtTime(s.lastUpdated)}</button>
            </div>
          </div>
          <ol className="relative p-4 md:p-5" aria-label="Route timeline">
            {s.stops.map((st, i) => {
              const isLast = i === s.stops.length - 1;
              const passed = st.state === 'DEPARTED';
              const current = st.state === 'CURRENT' || (s.status === 'RUNNING' && i === lastDepartedIdx);
              return (
                <li key={st.code + i} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast && <span className={clsx('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5', passed ? 'bg-brand-600' : 'bg-slate-200')} aria-hidden />}
                  <span className={clsx('relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-white', current ? 'bg-saffron-500' : passed ? 'bg-brand-700' : 'border-2 border-slate-300 bg-white')}>
                    {current && <TrainFront className="size-3.5 text-white" />}
                    {current && <span className="absolute inset-0 animate-ping rounded-full bg-saffron-400 opacity-40" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={clsx('truncate font-semibold', current ? 'text-saffron-700' : passed ? 'text-slate-900' : 'text-slate-600')}>{st.name} <span className="font-mono text-xs text-slate-400">{st.code}</span></p>
                        <p className="text-[11px] text-slate-500">{st.distanceKm} km · PF {st.platform}{st.scheduledArrival && st.scheduledArrival.day > 1 ? ` · Day ${st.scheduledArrival.day}` : ''}</p>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        <p className="text-slate-500">{st.scheduledArrival?.time ?? 'Start'} / {st.scheduledDeparture?.time ?? 'End'}</p>
                        <p className={clsx('font-semibold', st.delayMin > 0 ? 'text-red-600' : 'text-emerald-700')}>
                          {(st.expectedArrival ?? st.expectedDeparture)?.time} {st.delayMin > 0 ? `(+${st.delayMin}m)` : '· on time'}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500 md:px-5">{q.data.notice} Scheduled arr/dep shown above expected times.</p>
        </Card>
      ) : null}
    </div>
  );
}
