import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { StationField } from '../StationPicker';
import { addRecentStation, getRecentStations } from '@/lib/recent';
import type { Station } from '@/lib/types';

const STATIONS: Station[] = [
  { code: 'PNBE', name: 'Patna Junction', city: 'Patna', state: 'Bihar', isPopular: true },
  { code: 'PPTA', name: 'Patliputra Junction', city: 'Patna', state: 'Bihar' },
  { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal', isPopular: true },
  { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi', isPopular: true },
];

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    let body: unknown;
    if (url.pathname === '/api/stations/popular') body = { results: STATIONS.filter((s) => s.isPopular) };
    else if (url.pathname === '/api/stations') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      body = { results: STATIONS.filter((s) => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)) };
    } else return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nf' } }), { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

function Harness({ exclude, onPick }: { exclude?: string; onPick?: (s: Station) => void }) {
  const [v, setV] = useState<Station | null>(null);
  return <StationField id="from" label="From" value={v} excludeCode={exclude} onChange={(s) => { setV(s); onPick?.(s); }} />;
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Harness {...props} /></QueryClientProvider>);
}

describe('StationPicker', () => {
  let fetchMock: ReturnType<typeof mockFetch>;
  beforeEach(() => { fetchMock = mockFetch(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it('shows popular stations with codes beside names', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /from: not selected/i }));
    const list = await screen.findByRole('listbox', { name: /popular stations/i });
    const opts = within(list).getAllByRole('option');
    expect(opts).toHaveLength(3);
    expect(opts[0]).toHaveTextContent('Patna Junction');
    expect(opts[0]).toHaveTextContent('PNBE');
  });

  it('autocompletes by name or code and selects with the keyboard', async () => {
    const onPick = vi.fn();
    setup({ onPick });
    await userEvent.click(screen.getByRole('button', { name: /from/i }));
    const input = await screen.findByRole('combobox', { name: /search stations/i });
    await userEvent.type(input, 'pat');
    const list = await screen.findByRole('listbox', { name: /matching stations/i });
    expect(within(list).getAllByRole('option')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/stations?q=pat'), expect.anything());
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ code: 'PPTA' }));
    expect(screen.getByRole('button', { name: /from: patliputra junction \(PPTA\)/i })).toBeInTheDocument();
    expect(getRecentStations()[0]!.code).toBe('PPTA');
  });

  it('handles unknown stations gracefully', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /from/i }));
    await userEvent.type(await screen.findByRole('combobox'), 'zzzz');
    expect(await screen.findByText(/no station matches “zzzz”/i)).toBeInTheDocument();
  });

  it('lists recent searches and prevents choosing the excluded station', async () => {
    addRecentStation(STATIONS[2]!);
    const onPick = vi.fn();
    setup({ exclude: 'HWH', onPick });
    await userEvent.click(screen.getByRole('button', { name: /from/i }));
    const recent = await screen.findByRole('listbox', { name: /recent stations/i });
    const opt = within(recent).getByRole('option');
    expect(opt).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(opt);
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(screen.queryByRole('listbox', { name: /recent stations/i })).not.toBeInTheDocument());
  });

  it('shows an error state when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    setup();
    await userEvent.click(screen.getByRole('button', { name: /from/i }));
    await userEvent.type(await screen.findByRole('combobox'), 'pat');
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't search stations/i);
  });
});
