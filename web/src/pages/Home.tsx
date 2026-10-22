import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowDownUp, ArrowRight, Bell, CalendarDays, ChevronRight, CreditCard, DoorOpen, FileSearch, HelpCircle, History, LifeBuoy,
  MessageSquare, Plus, Radio, Search, ShieldAlert, Smartphone, Ticket, TrainFront, Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { addDays, istToday } from '@/lib/date';
import { fmtDay, inr, initials } from '@/lib/format';
import { addRecentJourney, getRecentJourneys, type RecentJourney } from '@/lib/recent';
import { isValidPnr, isValidTrainNumber, validateJourney } from '@/lib/validation';
import type { Booking, PageMeta, Station } from '@/lib/types';
import { StationField } from '@/components/StationPicker';
import { BookingListItem } from '@/components/BookingListItem';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip, Segmented } from '@/components/ui/Segmented';
import { Alert, EmptyState, ListSkeleton, ErrorState } from '@/components/ui/feedback';

type Mode = 'UNRESERVED' | 'RESERVED' | 'PLATFORM';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const SERVICES = [
  { to: '/unreserved', label: 'Unreserved', sub: 'Journey ticket', icon: TrainFront, tone: 'bg-brand-50 text-brand-700' },
  { to: '/platform', label: 'Platform', sub: 'Visitor pass', icon: DoorOpen, tone: 'bg-saffron-50 text-saffron-600' },
  { to: '/reserved', label: 'Reserved', sub: 'Train search', icon: Search, tone: 'bg-indigo-50 text-indigo-700' },
  { to: '/pnr', label: 'PNR status', sub: 'Mock enquiry', icon: FileSearch, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/running-status', label: 'Running', sub: 'Train status', icon: Radio, tone: 'bg-rose-50 text-rose-600' },
  { to: '/tickets', label: 'My tickets', sub: 'Active & past', icon: Ticket, tone: 'bg-sky-50 text-sky-700' },
  { to: '/history', label: 'History', sub: 'All bookings', icon: History, tone: 'bg-violet-50 text-violet-700' },
  { to: '/help', label: 'Help', sub: 'Support & FAQ', icon: HelpCircle, tone: 'bg-slate-100 text-slate-700' },
];

export function HomePage() {
  const { user, unread } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const today = istToday();
  const [mode, setMode] = useState<Mode>('UNRESERVED');
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recentJourneys, setRecentJourneys] = useState<RecentJourney[]>([]);
  const [quick, setQuick] = useState<'PNR' | 'TRAIN'>('PNR');
  const [quickVal, setQuickVal] = useState('');
  const [quickErr, setQuickErr] = useState('');
  const [swapSpin, setSwapSpin] = useState(false);

  useEffect(() => { setRecentJourneys(getRecentJourneys()); }, []);
  useEffect(() => { setErrors({}); }, [mode]);
  useEffect(() => { if (mode === 'UNRESERVED' && date > addDays(today, 1)) setDate(today); }, [mode, date, today]);

  const bookings = useQuery({ queryKey: ['bookings', 'recent'], queryFn: () => api<{ bookings: Booking[]; meta: PageMeta }>('/bookings?pageSize=3') });
  const wallet = useQuery({ queryKey: ['wallet', 'summary'], queryFn: () => api<{ balancePaise: number }>('/wallet?pageSize=1') });

  const swap = () => { setFrom(to); setTo(from); setSwapSpin((s) => !s); setErrors({}); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'PLATFORM') {
      if (!from) return setErrors({ from: 'Select a station' });
      return nav(`/platform?station=${from.code}`);
    }
    const errs = validateJourney({ from, to, date, today, maxDaysAhead: mode === 'UNRESERVED' ? 1 : 60 });
    setErrors(errs as Record<string, string>);
    if (Object.keys(errs).length) return;
    addRecentJourney({ from: from!, to: to! });
    nav(`/${mode === 'UNRESERVED' ? 'unreserved' : 'reserved'}?from=${from!.code}&to=${to!.code}&date=${date}`);
  };

  const quickSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = quickVal.replace(/\D/g, '');
    if (quick === 'PNR') {
      if (!isValidPnr(v)) return setQuickErr('PNR must be 10 digits');
      nav(`/pnr?pnr=${v}`);
    } else {
      if (!isValidTrainNumber(v)) return setQuickErr('Train number must be 5 digits');
      nav(`/running-status?train=${v}`);
    }
  };

  const dateChips = mode === 'UNRESERVED' ? [today, addDays(today, 1)] : [today, addDays(today, 1), addDays(today, 2)];

  return (
    <div className="-mx-4 md:mx-0">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-4 pb-24 pt-5 text-white md:rounded-3xl md:px-8 md:pt-7">
        <svg aria-hidden className="absolute -right-16 -top-20 size-72 text-white/[0.05]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="24" /></svg>
        <div className="relative flex items-center justify-between gap-3">
          <Link to="/profile" className="flex items-center gap-3" aria-label="Open profile">
            <span className="flex size-11 items-center justify-center rounded-full bg-saffron-500 text-base font-bold text-white ring-2 ring-white/25">{initials(user?.name ?? 'U')}</span>
            <span>
              <span className="block text-xs text-brand-200">{greeting()},</span>
              <span className="block text-lg font-bold leading-tight">{user?.name.split(' ')[0]}</span>
            </span>
          </Link>
          <Link to="/notifications" className="relative flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/15" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-saffron-500 ring-2 ring-brand-900" />}
          </Link>
        </div>
        <p className="relative mt-5 text-sm text-brand-100">Where are you headed today?</p>
      </section>

      <div className="relative -mt-20 space-y-6 px-4 md:px-0">
        {(loc.state as { denied?: boolean } | null)?.denied && <Alert tone="warning" title="Administrator access required">Your account does not have permission to open the admin dashboard.</Alert>}

        {/* Booking card */}
        <Card className="p-4 shadow-raised md:p-6">
          <Segmented<Mode>
            label="Ticket type"
            value={mode}
            onChange={setMode}
            options={[{ value: 'UNRESERVED', label: 'Unreserved' }, { value: 'RESERVED', label: 'Reserved' }, { value: 'PLATFORM', label: 'Platform' }]}
          />
          <form onSubmit={submit} noValidate className="mt-4">
            {mode === 'PLATFORM' ? (
              <div className="rounded-2xl border border-slate-200 px-3 py-1">
                <StationField label="Station" value={from} onChange={(s) => { setFrom(s); setErrors({}); }} error={errors.from} />
              </div>
            ) : (
              <div className="relative rounded-2xl border border-slate-200">
                <div className="px-3 py-1"><StationField label="From" value={from} onChange={(s) => { setFrom(s); setErrors({}); }} error={errors.from} excludeCode={to?.code} /></div>
                <div className="mx-3 border-t border-dashed border-slate-200" />
                <div className="px-3 py-1"><StationField label="To" value={to} onChange={(s) => { setTo(s); setErrors({}); }} error={errors.to} excludeCode={from?.code} /></div>
                <button type="button" onClick={swap} aria-label="Swap stations" className="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-800 shadow-md transition hover:bg-brand-50">
                  <ArrowDownUp className={clsx('size-5 transition-transform duration-300', swapSpin && 'rotate-180')} />
                </button>
              </div>
            )}

            {mode !== 'PLATFORM' && (
              <fieldset className="mt-4">
                <legend className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><CalendarDays className="size-3.5" /> Journey date</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {dateChips.map((d, i) => (
                    <Chip key={d} active={date === d} onClick={() => setDate(d)}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDay(d)}</Chip>
                  ))}
                  {mode === 'RESERVED' && (
                    <label className="relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                      <CalendarDays className="size-4" />
                      {dateChips.includes(date) ? 'Pick date' : fmtDay(date)}
                      <input type="date" aria-label="Pick journey date" min={today} max={addDays(today, 60)} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                    </label>
                  )}
                </div>
                {errors.date && <p role="alert" className="mt-1.5 text-sm text-red-600">{errors.date}</p>}
                {mode === 'UNRESERVED' && <p className="mt-2 text-xs text-slate-500">Unreserved demo tickets are available for today or tomorrow.</p>}
              </fieldset>
            )}

            <Button type="submit" variant="saffron" size="lg" block className="mt-5" icon={mode === 'RESERVED' ? <Search className="size-5" /> : <Ticket className="size-5" />}>
              {mode === 'UNRESERVED' ? 'Search trains & book ticket' : mode === 'RESERVED' ? 'Search trains' : 'Book platform ticket'}
            </Button>
          </form>

          {mode !== 'PLATFORM' && recentJourneys.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Recent searches</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {recentJourneys.map((j) => (
                  <button key={j.from.code + j.to.code} type="button" onClick={() => { setFrom(j.from); setTo(j.to); setErrors({}); }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                    {j.from.code} <ArrowRight className="size-3.5 text-slate-400" /> {j.to.code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Services */}
        <section aria-labelledby="svc">
          <SectionTitle id="svc">Services</SectionTitle>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {SERVICES.map(({ to: href, label, sub, icon: Icon, tone }) => (
              <Link key={href} to={href} className="group flex flex-col items-center rounded-2xl bg-white px-1 py-3 text-center shadow-card ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:ring-brand-200">
                <span className={clsx('mb-2 flex size-11 items-center justify-center rounded-xl transition group-hover:scale-105', tone)}><Icon className="size-[22px]" /></span>
                <span className="text-[12.5px] font-semibold leading-tight text-slate-800">{label}</span>
                <span className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{sub}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick status check */}
          <Card className="p-4 md:p-5">
            <SectionTitle>PNR & train status</SectionTitle>
            <Segmented size="sm" label="Status type" value={quick} onChange={(v) => { setQuick(v); setQuickErr(''); setQuickVal(''); }} options={[{ value: 'PNR', label: 'PNR status' }, { value: 'TRAIN', label: 'Running status' }]} />
            <form onSubmit={quickSubmit} noValidate className="mt-3 flex gap-2">
              <div className="flex-1">
                <input
                  value={quickVal}
                  onChange={(e) => { setQuickVal(e.target.value.replace(/\D/g, '').slice(0, quick === 'PNR' ? 10 : 5)); setQuickErr(''); }}
                  inputMode="numeric"
                  aria-label={quick === 'PNR' ? '10-digit PNR number' : '5-digit train number'}
                  aria-invalid={!!quickErr || undefined}
                  placeholder={quick === 'PNR' ? 'Enter 10-digit PNR' : 'Enter 5-digit train no.'}
                  className={clsx('h-11 w-full rounded-xl border px-3.5 font-mono tracking-wider focus:outline-none focus:ring-4', quickErr ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100')}
                />
              </div>
              <Button type="submit" aria-label="Check status"><ArrowRight className="size-5" /></Button>
            </form>
            {quickErr ? <p role="alert" className="mt-1.5 text-sm text-red-600">{quickErr}</p> : <p className="mt-1.5 text-xs text-slate-500">Mock data · try PNR 2451837690 or train 12345</p>}
          </Card>

          {/* Wallet & payments */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-brand-800 to-brand-600 p-4 text-white md:p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-medium text-brand-100"><Wallet className="size-4" /> Demo wallet balance</p>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Sandbox</span>
              </div>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{wallet.isPending ? '—' : inr(wallet.data?.balancePaise ?? 0)}</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
              {[
                { to: '/wallet?topup=1', label: 'Add money', icon: Plus },
                { to: '/wallet', label: 'Transactions', icon: History },
                { to: '/help#payments', label: 'Pay options', icon: CreditCard },
              ].map(({ to: href, label, icon: Icon }) => (
                <Link key={label} to={href} className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Icon className="size-5 text-brand-700" /> {label}
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent bookings */}
        <section aria-labelledby="recent">
          <SectionTitle id="recent" action={<Link to="/history" className="inline-flex h-9 items-center gap-0.5 text-sm font-semibold text-brand-700">View all <ChevronRight className="size-4" /></Link>}>
            Recent demo bookings
          </SectionTitle>
          {bookings.isPending ? (
            <ListSkeleton rows={2} />
          ) : bookings.isError ? (
            <ErrorState message="Couldn't load your bookings." onRetry={() => void bookings.refetch()} />
          ) : bookings.data.bookings.length === 0 ? (
            <Card><EmptyState icon={<Ticket className="size-7" />} title="No bookings yet" body="Your demo tickets will appear here once you book." action={<Button onClick={() => nav('/unreserved')}>Book a demo ticket</Button>} /></Card>
          ) : (
            <div className="space-y-2.5">{bookings.data.bookings.map((b) => <BookingListItem key={b.id} b={b} />)}</div>
          )}
        </section>

        {/* Help & support */}
        <section aria-labelledby="help">
          <SectionTitle id="help">Help & support</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {[
              { to: '/help', icon: LifeBuoy, title: 'FAQs & demo guide', body: 'How booking, refunds and the demo wallet work' },
              { to: '/help#contact', icon: MessageSquare, title: 'Contact demo support', body: 'Raise a request — stored in the demo database' },
              { to: '/profile#install', icon: Smartphone, title: 'Install the app', body: 'Add RailwayOne Pro to your Android home screen' },
            ].map(({ to: href, icon: Icon, title, body }) => (
              <Link key={title} to={href} className="flex items-center gap-3 p-4 hover:bg-slate-50">
                <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon className="size-5" /></span>
                <span className="flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{body}</span></span>
                <ChevronRight className="size-4 text-slate-300" />
              </Link>
            ))}
          </Card>
          <p className="mt-4 flex items-start gap-2 px-1 text-xs text-slate-500">
            <ShieldAlert className="size-4 shrink-0 text-saffron-600" />
            RailwayOne Pro is an original demonstration app. It does not connect to any railway system, and nothing booked here is valid for travel.
          </p>
        </section>
      </div>
    </div>
  );
}
