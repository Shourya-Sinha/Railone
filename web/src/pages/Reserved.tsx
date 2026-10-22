import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDownUp, ArrowRight, CalendarDays, Clock, Info, Radio, Search, TrainFront } from 'lucide-react';
import { api } from '@/lib/api';
import { addDays, istToday } from '@/lib/date';
import { fmtDay, fmtDuration, TRAIN_TYPE_LABEL } from '@/lib/format';
import { validateJourney } from '@/lib/validation';
import type { Station, TrainSearch } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StationField } from '@/components/StationPicker';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Segmented';
import { Alert, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';

const AVL_TONE = { AVAILABLE: 'text-emerald-700 bg-emerald-50 ring-emerald-200', RAC: 'text-amber-800 bg-amber-50 ring-amber-200', WAITLIST: 'text-red-700 bg-red-50 ring-red-200', REGRET: 'text-slate-500 bg-slate-100 ring-slate-200' };
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ReservedPage() {
  const [params, setParams] = useSearchParams();
  const today = istToday();
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDate] = useState(params.get('date') ?? addDays(today, 1));
  const [cls, setCls] = useState('ALL');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ from: string; to: string; date: string } | null>(null);

  const qFrom = params.get('from');
  const qTo = params.get('to');
  const pre = useQuery({
    queryKey: ['prefill', qFrom, qTo],
    enabled: !!(qFrom && qTo),
    queryFn: async () => {
      const [a, b] = await Promise.all([api<{ station: Station }>(`/stations/${qFrom}`), api<{ station: Station }>(`/stations/${qTo}`)]);
      return { from: a.station, to: b.station };
    },
    retry: false,
  });
  useEffect(() => {
    if (pre.data) {
      setFrom(pre.data.from);
      setTo(pre.data.to);
      setSubmitted({ from: pre.data.from.code, to: pre.data.to.code, date: params.get('date') ?? date });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pre.data]);

  const search = useQuery({
    queryKey: ['reserved', submitted],
    enabled: !!submitted,
    queryFn: () => api<TrainSearch>(`/trains/search?from=${submitted!.from}&to=${submitted!.to}&date=${submitted!.date}&mode=reserved`),
  });

  const submit = () => {
    const errs = validateJourney({ from, to, date, today, maxDaysAhead: 60 });
    setErrors(errs as Record<string, string>);
    if (Object.keys(errs).length) return;
    setSubmitted({ from: from!.code, to: to!.code, date });
    setParams({ from: from!.code, to: to!.code, date }, { replace: true });
  };

  const allClasses = Array.from(new Set((search.data?.trains ?? []).flatMap((t) => t.classes?.map((c) => c.code) ?? [])));
  const trains = (search.data?.trains ?? []).filter((t) => cls === 'ALL' || t.classes?.some((c) => c.code === cls));

  return (
    <div className="space-y-4">
      <PageHeader title="Reserved train search" subtitle="Demonstration · mock availability" />
      <Card className="p-4 md:p-6">
        <div className="relative rounded-2xl border border-slate-200">
          <div className="px-3 py-1"><StationField label="From" value={from} onChange={(s) => { setFrom(s); setErrors({}); }} error={errors.from} excludeCode={to?.code} /></div>
          <div className="mx-3 border-t border-dashed border-slate-200" />
          <div className="px-3 py-1"><StationField label="To" value={to} onChange={(s) => { setTo(s); setErrors({}); }} error={errors.to} excludeCode={from?.code} /></div>
          <button type="button" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap stations" className="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-800 shadow-md hover:bg-brand-50"><ArrowDownUp className="size-5" /></button>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><CalendarDays className="size-3.5" /> Journey date</span>
          <input type="date" value={date} min={today} max={addDays(today, 60)} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date || undefined} className="h-12 w-full rounded-xl border border-slate-300 px-3.5 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          {errors.date && <span role="alert" className="mt-1 block text-sm text-red-600">{errors.date}</span>}
        </label>
        <Button size="lg" block className="mt-5" icon={<Search className="size-5" />} onClick={submit}>Search trains</Button>
      </Card>

      {!submitted ? (
        <Alert tone="info" title="Search-only demonstration">Explore mock trains, classes, demo fares and simulated seat availability. Reserved ticket booking is intentionally not part of this prototype.</Alert>
      ) : search.isPending ? (
        <ListSkeleton rows={3} />
      ) : search.isError ? (
        <ErrorState title="Search failed" message={(search.error as Error).message} onRetry={() => void search.refetch()} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">{trains.length} mock train{trains.length !== 1 && 's'} · {search.data.from.code} → {search.data.to.code} · {fmtDay(search.data.date)}</p>
            <Badge tone="amber">Mock data</Badge>
          </div>
          {allClasses.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter by class">
              <Chip active={cls === 'ALL'} onClick={() => setCls('ALL')}>All classes</Chip>
              {allClasses.map((c) => <Chip key={c} active={cls === c} onClick={() => setCls(c)}>{c}</Chip>)}
            </div>
          )}
          {trains.length === 0 ? (
            <Card><EmptyState icon={<TrainFront className="size-7" />} title="No reserved trains on this date" body="This mock route has no trains with reserved classes running on the selected day. Try another date." /></Card>
          ) : (
            <ul className="space-y-3">
              {trains.map((t) => (
                <li key={t.number}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold"><span className="font-mono text-brand-700">{t.number}</span> · {t.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge tone={t.type === 'SUPERFAST' ? 'saffron' : 'blue'}>{TRAIN_TYPE_LABEL[t.type]}</Badge>
                          <span className="flex gap-0.5" aria-label="Days of run">
                            {DAYS.map((d, i) => <span key={i} className={clsx('text-[10px] font-bold', t.runsOn[i] ? 'text-brand-700' : 'text-slate-300')}>{d}</span>)}
                          </span>
                        </div>
                      </div>
                      <Link to={`/running-status?train=${t.number}&from=${t.fromCode}&to=${t.toCode}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"><Radio className="size-4" /> Status</Link>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div><p className="text-lg font-extrabold tabular-nums">{t.departure}</p><p className="text-[11px] text-slate-500">{t.fromCode}</p></div>
                      <div className="flex flex-1 flex-col items-center text-[11px] text-slate-500"><span className="flex items-center gap-1"><Clock className="size-3" />{fmtDuration(t.durationMin)}</span><span className="mt-1 h-px w-full bg-slate-200" /></div>
                      <div className="text-right"><p className="text-lg font-extrabold tabular-nums">{t.arrival}{t.dayOffset > 0 && <sup className="text-[10px] text-saffron-600">+{t.dayOffset}</sup>}</p><p className="text-[11px] text-slate-500">{t.toCode}</p></div>
                    </div>
                    <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
                      {t.classes?.map((c) => (
                        <div key={c.code} className={clsx('min-w-[104px] shrink-0 rounded-xl p-2.5 ring-1', cls === c.code ? 'ring-2 ring-brand-500' : 'ring-slate-200')}>
                          <p className="flex items-center justify-between text-sm font-bold">{c.code} <span className="text-xs font-semibold text-slate-600">₹{c.fareRupees}</span></p>
                          <p className="truncate text-[10px] text-slate-500">{c.label}</p>
                          <p className={clsx('mt-1.5 rounded-md px-1.5 py-0.5 text-center text-xs font-bold ring-1', AVL_TONE[c.availability.status])}>{c.availability.label}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-start gap-1.5 text-xs text-slate-500"><Info className="mt-px size-3.5 shrink-0" /> {search.data.notice} Fares are illustrative. <Link to="/unreserved" className="inline-flex items-center font-semibold text-brand-700">Try the unreserved booking demo <ArrowRight className="size-3" /></Link></p>
        </>
      )}
    </div>
  );
}
