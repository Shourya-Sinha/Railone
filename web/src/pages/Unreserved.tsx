import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDownUp, ArrowRight, Check, Clock, Info, MapPin, Route, ShieldAlert, TrainFront, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { addDays, istToday } from '@/lib/date';
import { fmtDay, fmtDuration, inr, TRAIN_TYPE_LABEL } from '@/lib/format';
import { addRecentJourney } from '@/lib/recent';
import { MAX_PASSENGERS, validateJourney, validatePassengers } from '@/lib/validation';
import type { Booking, FareQuote, MockTrain, Station, TrainSearch, TrainType } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StationField } from '@/components/StationPicker';
import { FareBreakdown } from '@/components/FareBreakdown';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Segmented';
import { Counter } from '@/components/ui/Counter';
import { Checkbox } from '@/components/ui/Field';
import { Alert, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/Badge';

type Step = 'journey' | 'train' | 'passengers' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'journey', label: 'Journey' },
  { key: 'train', label: 'Train' },
  { key: 'passengers', label: 'Passengers' },
  { key: 'review', label: 'Review' },
];

function Stepper({ step, onJump }: { step: Step; onJump: (s: Step) => void }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="no-print mb-5 flex items-center gap-1" aria-label="Booking steps">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center gap-1">
          <button
            type="button"
            disabled={i > idx}
            onClick={() => onJump(s.key)}
            aria-current={i === idx ? 'step' : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:cursor-default"
          >
            <span className={clsx('flex size-8 items-center justify-center rounded-full text-sm font-bold transition', i < idx ? 'bg-emerald-600 text-white' : i === idx ? 'bg-brand-800 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-slate-500')}>
              {i < idx ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={clsx('truncate text-[11px] font-semibold', i === idx ? 'text-brand-800' : 'text-slate-500')}>{s.label}</span>
          </button>
          {i < STEPS.length - 1 && <span className={clsx('mb-5 h-0.5 flex-1 rounded', i < idx ? 'bg-emerald-500' : 'bg-slate-200')} />}
        </li>
      ))}
    </ol>
  );
}

const typeTone = (t: TrainType) => (t === 'SUPERFAST' ? 'saffron' : t === 'EXPRESS' ? 'blue' : 'slate') as 'saffron' | 'blue' | 'slate';

export default function UnreservedPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const today = istToday();
  const [step, setStep] = useState<Step>('journey');
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [train, setTrain] = useState<MockTrain | null>(null);
  const [typeFilter, setTypeFilter] = useState<TrainType | 'ALL'>('ALL');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [agree, setAgree] = useState(false);
  const [agreeErr, setAgreeErr] = useState('');

  // Prefill from query string (e.g. from the home screen)
  const qFrom = params.get('from');
  const qTo = params.get('to');
  const qDate = params.get('date');
  const prefill = useQuery({
    queryKey: ['prefill', qFrom, qTo],
    enabled: !!(qFrom && qTo),
    queryFn: async () => {
      const [a, b] = await Promise.all([api<{ station: Station }>(`/stations/${qFrom}`), api<{ station: Station }>(`/stations/${qTo}`)]);
      return { from: a.station, to: b.station };
    },
    retry: false,
  });
  useEffect(() => {
    if (!prefill.data) return;
    setFrom(prefill.data.from);
    setTo(prefill.data.to);
    const d = qDate && validateJourney({ from: prefill.data.from, to: prefill.data.to, date: qDate, today }).date === undefined ? qDate : today;
    setDate(d);
    if (Object.keys(validateJourney({ from: prefill.data.from, to: prefill.data.to, date: d, today })).length === 0) setStep('train');
  }, [prefill.data, qDate, today]);

  const search = useQuery({
    queryKey: ['trains', from?.code, to?.code, date],
    enabled: step !== 'journey' && !!from && !!to,
    queryFn: () => api<TrainSearch>(`/trains/search?from=${from!.code}&to=${to!.code}&date=${date}&mode=unreserved`),
  });

  const paxError = validatePassengers(adults, children);
  const quote = useQuery({
    queryKey: ['quote', from?.code, to?.code, date, train?.type, adults, children],
    enabled: (step === 'passengers' || step === 'review') && !!train && !paxError,
    queryFn: () => api<{ quote: FareQuote }>('/fares/quote', { body: { type: 'UNRESERVED', from: from!.code, to: to!.code, journeyDate: date, trainType: train!.type, adults, children } }),
    placeholderData: (prev) => prev,
  });

  const create = useMutation({
    mutationFn: () => api<{ booking: Booking }>('/bookings/unreserved', { body: { from: from!.code, to: to!.code, journeyDate: date, trainType: train!.type, trainNumber: train!.number, adults, children } }),
    onSuccess: (r) => nav(`/checkout/${r.booking.id}`),
  });

  const trains = useMemo(() => (search.data?.trains ?? []).filter((t) => typeFilter === 'ALL' || t.type === typeFilter), [search.data, typeFilter]);

  const goTrains = () => {
    const errs = validateJourney({ from, to, date, today });
    setErrors(errs as Record<string, string>);
    if (Object.keys(errs).length) return;
    addRecentJourney({ from: from!, to: to! });
    setTrain(null);
    setStep('train');
  };

  const confirm = () => {
    if (!agree) return setAgreeErr('Please confirm you understand this is a demo ticket');
    create.mutate();
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  useEffect(() => { scrollTop(); }, [step]);

  return (
    <div>
      <PageHeader title="Unreserved ticket" subtitle="Demo general-class journey ticket" />
      <Stepper step={step} onJump={setStep} />

      {step === 'journey' && (
        <div className="space-y-4">
          {prefill.isError && <Alert tone="warning">One of the stations in the link is not in our sample dataset. Please choose again.</Alert>}
          <Card className="p-4 md:p-6">
            <div className="relative rounded-2xl border border-slate-200">
              <div className="px-3 py-1"><StationField id="from" label="From" value={from} onChange={(s) => { setFrom(s); setErrors({}); }} error={errors.from} excludeCode={to?.code} /></div>
              <div className="mx-3 border-t border-dashed border-slate-200" />
              <div className="px-3 py-1"><StationField id="to" label="To" value={to} onChange={(s) => { setTo(s); setErrors({}); }} error={errors.to} excludeCode={from?.code} /></div>
              <button type="button" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap stations" className="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-800 shadow-md hover:bg-brand-50">
                <ArrowDownUp className="size-5" />
              </button>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Journey date</legend>
              <div className="flex gap-2">
                <Chip active={date === today} onClick={() => setDate(today)}>Today · {fmtDay(today)}</Chip>
                <Chip active={date === addDays(today, 1)} onClick={() => setDate(addDays(today, 1))}>Tomorrow</Chip>
              </div>
              {errors.date && <p role="alert" className="mt-1.5 text-sm text-red-600">{errors.date}</p>}
            </fieldset>
            <Button size="lg" block className="mt-6" onClick={goTrains} icon={<TrainFront className="size-5" />}>Find trains on this route</Button>
          </Card>
          <Alert tone="info" title="How demo unreserved tickets work">
            Pick a route, choose a mock train, add up to {MAX_PASSENGERS} passengers and pay with sandbox money. The fare is calculated on the server using a clearly-labelled demo fare table.
          </Alert>
        </div>
      )}

      {step === 'train' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-extrabold">{from?.code} <ArrowRight className="inline size-4 text-slate-400" /> {to?.code}</p>
                <p className="truncate text-xs text-slate-500">{from?.name} to {to?.name} · {fmtDay(date)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setStep('journey')}>Modify</Button>
            </div>
            {search.data && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <span className="flex items-center gap-1"><Route className="size-4 text-brand-600" /> ~{search.data.distanceKm} km (demo)</span>
                {search.data.via.length > 0 && <span className="flex items-center gap-1"><MapPin className="size-4 text-brand-600" /> via {search.data.via.map((v) => v.code).join(' · ')}</span>}
                <Badge tone="amber">Mock schedule</Badge>
              </div>
            )}
          </Card>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter by train type">
            {(['ALL', 'ORDINARY', 'EXPRESS', 'SUPERFAST'] as const).map((t) => (
              <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{t === 'ALL' ? 'All trains' : TRAIN_TYPE_LABEL[t]}</Chip>
            ))}
          </div>

          {search.isPending ? (
            <ListSkeleton rows={4} />
          ) : search.isError ? (
            <ErrorState title="Couldn't load trains" message={(search.error as Error).message} onRetry={() => void search.refetch()} />
          ) : trains.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-500">No {typeFilter !== 'ALL' && TRAIN_TYPE_LABEL[typeFilter]} trains on this mock route. Try another filter.</Card>
          ) : (
            <ul className="space-y-2.5" role="radiogroup" aria-label="Select a train">
              {trains.map((t) => {
                const sel = train?.number === t.number;
                return (
                  <li key={t.number}>
                    <button type="button" role="radio" aria-checked={sel} onClick={() => setTrain(t)} className={clsx('w-full rounded-2xl bg-white p-4 text-left shadow-card ring-1 transition', sel ? 'ring-2 ring-brand-600' : 'ring-slate-200/60 hover:ring-brand-200')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900"><span className="font-mono text-brand-700">{t.number}</span> · {t.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={typeTone(t.type)}>{TRAIN_TYPE_LABEL[t.type]}</Badge>
                            <span className="text-xs text-slate-500">{t.stops} stop{t.stops > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <span className={clsx('flex size-6 shrink-0 items-center justify-center rounded-full border-2', sel ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300')}>{sel && <Check className="size-3.5" />}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div><p className="text-lg font-extrabold tabular-nums">{t.departure}</p><p className="text-[11px] text-slate-500">{t.fromCode}</p></div>
                        <div className="flex flex-1 flex-col items-center text-[11px] text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {fmtDuration(t.durationMin)}</span>
                          <span className="mt-1 h-px w-full bg-slate-200" />
                        </div>
                        <div className="text-right"><p className="text-lg font-extrabold tabular-nums">{t.arrival}{t.dayOffset > 0 && <sup className="ml-0.5 text-[10px] text-saffron-600">+{t.dayOffset}</sup>}</p><p className="text-[11px] text-slate-500">{t.toCode}</p></div>
                        <div className="ml-2 border-l border-slate-100 pl-3 text-right">
                          <p className="text-[11px] text-slate-500">Adult</p>
                          <p className="font-bold text-brand-900">{inr(t.unreservedFarePaise ?? 0)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-center text-[11px] text-slate-500">{search.data?.notice}</p>
          <div className="sticky bottom-20 z-10 md:static">
            <Button size="lg" block disabled={!train} onClick={() => setStep('passengers')} className="shadow-raised md:shadow-none">
              {train ? `Continue with ${train.number}` : 'Select a train to continue'}
            </Button>
          </div>
        </div>
      )}

      {step === 'passengers' && train && (
        <div className="space-y-4">
          <Card className="p-4 md:p-5">
            <h2 className="flex items-center gap-2 font-bold"><Users className="size-5 text-brand-700" /> Passengers</h2>
            <p className="text-xs text-slate-500">Up to {MAX_PASSENGERS} passengers per demo ticket · Second class (II)</p>
            <div className="mt-2 divide-y divide-slate-100">
              <Counter label="Adult" description="12 years and above" value={adults} onChange={setAdults} min={0} max={MAX_PASSENGERS} disableInc={adults + children >= MAX_PASSENGERS} />
              <Counter label="Child" description="5–11 years · half base fare" value={children} onChange={setChildren} min={0} max={MAX_PASSENGERS} disableInc={adults + children >= MAX_PASSENGERS} />
            </div>
            {paxError && <p role="alert" className="mt-2 text-sm text-red-600">{paxError}</p>}
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><Info className="mt-px size-3.5 shrink-0" /> Children under 5 travel free and don't need a ticket in this demo. Senior-citizen concessions are not offered on unreserved tickets.</p>
          </Card>
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 font-bold">Fare summary</h2>
            {paxError ? (
              <p className="text-sm text-slate-500">Fix passenger details to see the fare.</p>
            ) : quote.isPending ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-7 w-1/2" /></div>
            ) : quote.isError ? (
              <Alert tone="error">{(quote.error as Error).message}</Alert>
            ) : (
              <div className={clsx(quote.isFetching && 'opacity-60 transition')}><FareBreakdown quote={quote.data.quote} /></div>
            )}
          </Card>
          <div className="sticky bottom-20 z-10 md:static">
            <Button size="lg" block disabled={!!paxError || !quote.data} onClick={() => setStep('review')} className="shadow-raised md:shadow-none">Review booking</Button>
          </div>
        </div>
      )}

      {step === 'review' && train && quote.data && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900 md:px-5">Confirm your demo journey</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 md:p-5">
              <div className="col-span-2">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Route</dt>
                <dd className="mt-0.5 text-lg font-extrabold">{from?.code} <ArrowRight className="inline size-4 text-slate-400" /> {to?.code}</dd>
                <dd className="text-xs text-slate-500">{from?.name} → {to?.name} · ~{search.data?.distanceKm} km</dd>
              </div>
              <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ticket type</dt><dd className="mt-0.5 font-semibold">Unreserved · II</dd></div>
              <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Journey date</dt><dd className="mt-0.5 font-semibold">{fmtDay(date)}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Train (mock)</dt><dd className="mt-0.5 font-semibold">{train.number} · {TRAIN_TYPE_LABEL[train.type]}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Passengers</dt><dd className="mt-0.5 font-semibold">{adults} Adult{adults !== 1 && 's'}{children > 0 && `, ${children} Child${children > 1 ? 'ren' : ''}`}</dd></div>
            </dl>
            <div className="border-t border-slate-100 p-4 md:p-5"><FareBreakdown quote={quote.data.quote} /></div>
          </Card>
          <Card className="border-l-4 border-red-500 p-4">
            <p className="flex items-center gap-2 font-bold text-red-700"><ShieldAlert className="size-5" /> Demo only — not valid for travel</p>
            <p className="mt-1 text-sm text-slate-600">This prototype issues simulated tickets with a simulated QR code. Payment uses sandbox money only. Never present this ticket to railway staff.</p>
            <div className="mt-3"><Checkbox checked={agree} onChange={(v) => { setAgree(v); setAgreeErr(''); }} error={agreeErr}>I understand this is a demo ticket and not a real railway ticket.</Checkbox></div>
          </Card>
          {create.isError && <Alert tone="error" title="Couldn't create booking">{(create.error as ApiError).message}</Alert>}
          <div className="sticky bottom-20 z-10 md:static">
            <Button size="lg" variant="saffron" block loading={create.isPending} onClick={confirm} className="shadow-raised md:shadow-none">
              Confirm & proceed to pay {inr(quote.data.quote.totalPaise)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
