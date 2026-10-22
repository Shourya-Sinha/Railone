import type { Station } from './types';

const STATIONS_KEY = 'rw1.recentStations';
const JOURNEYS_KEY = 'rw1.recentJourneys';

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function getRecentStations(): Station[] {
  return read<Station>(STATIONS_KEY).filter((s) => s && typeof s.code === 'string');
}

/** Most-recent-first, de-duplicated, capped at 6. */
export function addRecentStation(s: Station, max = 6): Station[] {
  const next = [{ code: s.code, name: s.name, city: s.city }, ...getRecentStations().filter((x) => x.code !== s.code)].slice(0, max);
  localStorage.setItem(STATIONS_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentStations() {
  localStorage.removeItem(STATIONS_KEY);
}

export interface RecentJourney { from: Station; to: Station }
export function getRecentJourneys(): RecentJourney[] {
  return read<RecentJourney>(JOURNEYS_KEY).filter((j) => j?.from?.code && j?.to?.code);
}
export function addRecentJourney(j: RecentJourney, max = 4) {
  const next = [j, ...getRecentJourneys().filter((x) => !(x.from.code === j.from.code && x.to.code === j.to.code))].slice(0, max);
  localStorage.setItem(JOURNEYS_KEY, JSON.stringify(next));
}
