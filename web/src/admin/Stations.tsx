import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Checkbox, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/feedback';
import { AdminPageTitle, DataTable, FilterSelect, Toolbar, useAdminList, type Column } from './shared';

type AdminStation = { id: number; code: string; name: string; city: string; state: string; zone: string; lat: number; lng: number; isPopular: boolean; isActive: boolean };
type Form = { code: string; name: string; city: string; state: string; zone: string; lat: string; lng: string; isPopular: boolean; isActive: boolean };
const EMPTY: Form = { code: '', name: '', city: '', state: '', zone: '', lat: '', lng: '', isPopular: false, isActive: true };

function validate(f: Form, isNew: boolean) {
  const e: Record<string, string> = {};
  if (isNew && !/^[A-Za-z]{1,5}$/.test(f.code.trim())) e.code = 'Code must be 1–5 letters';
  if (f.name.trim().length < 2) e.name = 'Enter the station name';
  if (f.city.trim().length < 2) e.city = 'Enter the city';
  if (f.state.trim().length < 2) e.state = 'Enter the state';
  if (f.zone.trim().length < 2 || f.zone.trim().length > 6) e.zone = 'Zone code, e.g. ECR';
  const lat = Number(f.lat), lng = Number(f.lng);
  if (f.lat === '' || !Number.isFinite(lat) || lat < 6 || lat > 37.5) e.lat = 'Latitude within India (6–37.5)';
  if (f.lng === '' || !Number.isFinite(lng) || lng < 68 || lng > 97.5) e.lng = 'Longitude within India (68–97.5)';
  return e;
}

export default function StationsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { query, q, setQ, filters, setFilter, setPage } = useAdminList<{ stations: AdminStation[]; zones: string[] }>('stations', ['zone', 'active', 'popular']);
  const [editing, setEditing] = useState<AdminStation | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = (s: AdminStation | 'new') => {
    setEditing(s); setErrors({}); save.reset();
    setForm(s === 'new' ? EMPTY : { ...s, lat: String(s.lat), lng: String(s.lng) });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), city: form.city.trim(), state: form.state.trim(), zone: form.zone.trim().toUpperCase(), lat: Number(form.lat), lng: Number(form.lng), isPopular: form.isPopular, isActive: form.isActive };
      return editing === 'new' ? api('/admin/stations', { body: { ...body, code: form.code.trim().toUpperCase() } }) : api(`/admin/stations/${(editing as AdminStation).id}`, { method: 'PATCH', body });
    },
    onSuccess: () => { toast(editing === 'new' ? 'Station added to dataset' : 'Station updated'); setEditing(null); qc.invalidateQueries({ queryKey: ['admin', 'stations'] }); },
    onError: (e) => e instanceof ApiError && setErrors(e.fieldErrors),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); const errs = validate(form, editing === 'new'); setErrors(errs); if (!Object.keys(errs).length) save.mutate(); };
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const cols: Column<AdminStation>[] = [
    { key: 'code', header: 'Code', cell: (s) => <span className="inline-flex min-w-12 justify-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-800">{s.code}</span> },
    { key: 'name', header: 'Station', cell: (s) => <div><p className="font-semibold text-slate-900">{s.name}</p><p className="text-xs text-slate-500">{s.city}, {s.state}</p></div> },
    { key: 'zone', header: 'Zone', cell: (s) => s.zone },
    { key: 'geo', header: 'Lat / Lng', cell: (s) => <span className="font-mono text-xs text-slate-600">{s.lat.toFixed(3)}, {s.lng.toFixed(3)}</span> },
    { key: 'flags', header: 'Flags', cell: (s) => <div className="flex gap-1">{s.isPopular && <Badge tone="saffron">Popular</Badge>}<Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></div> },
    { key: 'act', header: '', className: 'text-right', cell: (s) => <button type="button" onClick={() => open(s)} aria-label={`Edit ${s.name}`} className="inline-flex size-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50"><Pencil className="size-4" /></button> },
  ];
  const zones = query.data?.zones ?? [];
  return (
    <div>
      <AdminPageTitle title="Stations" subtitle="Sample station dataset used for search, routes and demo fares" action={<Button icon={<Plus className="size-4" />} onClick={() => open('new')}>Add station</Button>} />
      <Toolbar q={q} setQ={setQ} placeholder="Search code, name, city or state">
        <FilterSelect label="Zone" value={filters.zone!} onChange={(v) => setFilter('zone', v)} options={zones.map((z) => [z, z])} />
        <FilterSelect label="Active" value={filters.active!} onChange={(v) => setFilter('active', v)} options={[['true', 'Active'], ['false', 'Inactive']]} />
        <FilterSelect label="Popular" value={filters.popular!} onChange={(v) => setFilter('popular', v)} options={[['true', 'Popular'], ['false', 'Not popular']]} />
      </Toolbar>
      <DataTable columns={cols} rows={query.data?.stations} loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} meta={query.data?.meta} onPage={setPage} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add station' : `Edit ${form.code}`} footer={<Button block size="lg" loading={save.isPending} onClick={submit as never}>Save station</Button>}>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField label="Station code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) })} error={errors.code} disabled={editing !== 'new'} hint={editing !== 'new' ? 'Codes are immutable' : undefined} />
          <TextField label="Zone" value={form.zone} onChange={set('zone')} error={errors.zone} />
          <div className="sm:col-span-2"><TextField label="Station name" value={form.name} onChange={set('name')} error={errors.name} /></div>
          <TextField label="City" value={form.city} onChange={set('city')} error={errors.city} />
          <TextField label="State" value={form.state} onChange={set('state')} error={errors.state} />
          <TextField label="Latitude" inputMode="decimal" value={form.lat} onChange={set('lat')} error={errors.lat} />
          <TextField label="Longitude" inputMode="decimal" value={form.lng} onChange={set('lng')} error={errors.lng} />
          <Checkbox checked={form.isPopular} onChange={(v) => setForm({ ...form, isPopular: v })}>Show in popular stations</Checkbox>
          <Checkbox checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })}>Active (searchable)</Checkbox>
          {save.isError && !Object.keys(errors).length && <div className="sm:col-span-2"><Alert tone="error">{(save.error as Error).message}</Alert></div>}
          <button type="submit" hidden />
        </form>
      </Sheet>
    </div>
  );
}
