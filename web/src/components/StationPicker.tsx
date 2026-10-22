import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Clock, MapPin, Search, SearchX, Star, X } from 'lucide-react';
import { api } from '@/lib/api';
import { addRecentStation, clearRecentStations, getRecentStations } from '@/lib/recent';
import type { Station } from '@/lib/types';
import { useDebounce } from '@/hooks/useDebounce';
import { Sheet } from './ui/Sheet';
import { Skeleton } from './ui/feedback';

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-saffron-100 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Full-screen (mobile) / modal (desktop) station search with autocomplete, recents and popular stations. */
export function StationPickerSheet({ open, onClose, onSelect, title, excludeCode }: { open: boolean; onClose: () => void; onSelect: (s: Station) => void; title: string; excludeCode?: string }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Station[]>([]);
  const debounced = useDebounce(q.trim(), 160);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setRecent(getRecentStations());
    }
  }, [open]);

  const search = useQuery({
    queryKey: ['stations', debounced],
    queryFn: ({ signal }) => api<{ results: Station[] }>(`/stations?q=${encodeURIComponent(debounced)}&limit=12`, { signal }),
    enabled: open && debounced.length > 0,
    staleTime: 5 * 60_000,
  });
  const popular = useQuery({
    queryKey: ['stations', 'popular'],
    queryFn: () => api<{ results: Station[] }>('/stations/popular'),
    enabled: open,
    staleTime: 30 * 60_000,
  });

  const results = useMemo(() => (debounced ? search.data?.results ?? [] : []), [debounced, search.data]);
  useEffect(() => { setActive(0); }, [debounced]);

  const choose = (s: Station) => {
    if (s.code === excludeCode) return;
    addRecentStation(s);
    onSelect(s);
    onClose();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const s = results[active]; if (s) choose(s); }
  };

  const Row = ({ s, idx, icon }: { s: Station; idx?: number; icon: React.ReactNode }) => {
    const disabled = s.code === excludeCode;
    return (
      <li
        id={idx != null ? `${listId}-${idx}` : undefined}
        role="option"
        aria-selected={idx === active}
        aria-disabled={disabled || undefined}
        onClick={() => choose(s)}
        onMouseEnter={() => idx != null && setActive(idx)}
        className={clsx('flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2', idx === active && idx != null && 'bg-brand-50', disabled && 'cursor-not-allowed opacity-45')}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900"><Highlight text={s.name} q={debounced} /></span>
          <span className="block truncate text-xs text-slate-500">{s.city}{s.state ? `, ${s.state}` : ''}{disabled ? ' · already selected' : ''}</span>
        </span>
        <span className="rounded-md bg-brand-800 px-2 py-1 font-mono text-xs font-bold tracking-wide text-white"><Highlight text={s.code} q={debounced} /></span>
      </li>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} fullHeight>
      <div className="sticky top-0 z-10 -mx-1 bg-white px-1 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Station name, city or code (e.g. PNBE)"
            aria-label="Search stations"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-11 text-[15px] focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
          {q && (
            <button type="button" onClick={() => { setQ(''); inputRef.current?.focus(); }} className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-600" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {debounced ? (
        search.isPending ? (
          <div className="space-y-2" role="status" aria-label="Searching stations">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : search.isError ? (
          <p role="alert" className="py-8 text-center text-sm text-red-600">Couldn't search stations. Check your connection.</p>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <SearchX className="mb-3 size-10 text-slate-300" />
            <p className="font-semibold text-slate-800">No station matches “{debounced}”</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">Check the spelling, or try the city name or station code. This demo uses a limited sample dataset.</p>
          </div>
        ) : (
          <ul id={listId} role="listbox" aria-label="Matching stations" className="space-y-0.5">
            {results.map((s, i) => <Row key={s.code} s={s} idx={i} icon={<MapPin className="size-4" />} />)}
          </ul>
        )
      ) : (
        <div className="space-y-5">
          {recent.length > 0 && (
            <section>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent searches</h3>
                <button type="button" className="h-8 text-xs font-semibold text-brand-700" onClick={() => { clearRecentStations(); setRecent([]); }}>Clear</button>
              </div>
              <ul role="listbox" aria-label="Recent stations" className="space-y-0.5">
                {recent.map((s) => <Row key={s.code} s={s} icon={<Clock className="size-4" />} />)}
              </ul>
            </section>
          )}
          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Popular stations</h3>
            {popular.isPending ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : (
              <ul role="listbox" aria-label="Popular stations" className="space-y-0.5">
                {(popular.data?.results ?? []).map((s) => <Row key={s.code} s={s} icon={<Star className="size-4" />} />)}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

/** Tappable field that opens the station picker. */
export function StationField({ label, value, onChange, error, excludeCode, placeholder = 'Select station', id }: { label: string; value: Station | null; onChange: (s: Station) => void; error?: string; excludeCode?: string; placeholder?: string; id?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-invalid={!!error || undefined}
        aria-label={`${label}: ${value ? `${value.name} (${value.code})` : 'not selected'}`}
        className={clsx('flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-slate-50', error && 'bg-red-50/60')}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
          {value ? (
            <span className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900">{value.code}</span>
              <span className="truncate text-sm text-slate-600">{value.name}</span>
            </span>
          ) : (
            <span className="mt-0.5 block text-lg font-semibold text-slate-400">{placeholder}</span>
          )}
        </span>
      </button>
      {error && <p role="alert" className="px-1 text-sm text-red-600">{error}</p>}
      <StationPickerSheet open={open} onClose={() => setOpen(false)} onSelect={onChange} title={`Select ${label.toLowerCase()} station`} excludeCode={excludeCode} />
    </div>
  );
}
