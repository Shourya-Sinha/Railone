import type { Station } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * In-memory read-through cache of the station table for fast autocomplete.
 * Invalidated whenever an administrator edits the dataset.
 */
let cache: { all: Station[]; byCode: Map<string, Station>; loadedAt: Date } | null = null;

export async function loadStations() {
  if (cache) return cache;
  const all = await prisma.station.findMany({ orderBy: { name: 'asc' } });
  cache = { all, byCode: new Map(all.map((s) => [s.code, s])), loadedAt: new Date() };
  return cache;
}

export function invalidateStations() {
  cache = null;
}

export async function getStation(code: string | undefined | null) {
  if (!code) return null;
  const { byCode } = await loadStations();
  return byCode.get(code.trim().toUpperCase()) ?? null;
}

export async function activeStations() {
  return (await loadStations()).all.filter((s) => s.isActive);
}

export const stationCacheInfo = () => ({ size: cache?.all.length ?? 0, loadedAt: cache?.loadedAt ?? null });

export const stationDTO = (s: Station) => ({
  code: s.code, name: s.name, city: s.city, state: s.state, zone: s.zone, isPopular: s.isPopular,
});
