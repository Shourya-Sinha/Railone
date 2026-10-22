import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock, DoorOpen, Info } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Booking, FareQuote, Station } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { StationField } from '@/components/StationPicker';
import { FareBreakdown } from '@/components/FareBreakdown';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Counter } from '@/components/ui/Counter';
import { Checkbox } from '@/components/ui/Field';
import { Alert, Skeleton } from '@/components/ui/feedback';

export default function PlatformPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [station, setStation] = useState<Station | null>(null);
  const [persons, setPersons] = useState(1);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const code = params.get('station');
  const pre = useQuery({ queryKey: ['station', code], enabled: !!code, queryFn: () => api<{ station: Station }>(`/stations/${code}`), retry: false });
  useEffect(() => { if (pre.data) setStation(pre.data.station); }, [pre.data]);

  const quote = useQuery({
    queryKey: ['pf-quote', station?.code, persons],
    enabled: !!station,
    queryFn: () => api<{ quote: FareQuote }>('/fares/quote', { body: { type: 'PLATFORM', station: station!.code, persons } }),
    placeholderData: (p) => p,
  });
  const create = useMutation({
    mutationFn: () => api<{ booking: Booking }>('/bookings/platform', { body: { station: station!.code, persons } }),
    onSuccess: (r) => nav(`/checkout/${r.booking.id}`),
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!station) e.station = 'Select a station';
    if (!agree) e.agree = 'Please confirm you understand this is a demo ticket';
    setErrors(e);
    if (!Object.keys(e).length) create.mutate();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Platform ticket" subtitle="Demo visitor pass for a station" />
      <Card className="p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 px-3 py-1">
          <StationField label="Station" value={station} onChange={(s) => { setStation(s); setErrors({}); }} error={errors.station} />
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          <Counter label="Persons" description="Maximum 4 per demo ticket" value={persons} onChange={setPersons} min={1} max={4} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <p className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-3 text-slate-600"><Clock className="size-4 text-brand-600" /> Valid for 2 hours after payment</p>
          <p className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-3 text-slate-600"><DoorOpen className="size-4 text-brand-600" /> Not cancellable (demo rule)</p>
        </div>
      </Card>
      {station && (
        <Card className="p-4 md:p-5">
          <h2 className="mb-3 font-bold">Fare summary</h2>
          {quote.isPending ? <Skeleton className="h-16 w-full" /> : quote.isError ? <Alert tone="error">{(quote.error as Error).message}</Alert> : <FareBreakdown quote={quote.data.quote} compact />}
        </Card>
      )}
      <Card className="p-4">
        <Checkbox checked={agree} onChange={(v) => { setAgree(v); setErrors((e) => ({ ...e, agree: '' })); }} error={errors.agree || undefined}>
          I understand this demo platform ticket is <strong>not valid</strong> for entry to any real railway station.
        </Checkbox>
      </Card>
      {create.isError && <Alert tone="error">{(create.error as ApiError).message}</Alert>}
      <Button size="lg" variant="saffron" block loading={create.isPending} onClick={submit}>Proceed to pay{quote.data ? ` ₹${quote.data.quote.totalPaise / 100}` : ''}</Button>
      <p className="flex items-start gap-1.5 text-xs text-slate-500"><Info className="mt-px size-3.5 shrink-0" /> Demo fare ₹10 per person from the demo fare dataset.</p>
    </div>
  );
}
