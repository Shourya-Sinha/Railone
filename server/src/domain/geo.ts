export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rail tracks are not straight lines; apply a demo route factor. */
export const RAIL_ROUTE_FACTOR = 1.22;
export const MIN_DEMO_DISTANCE_KM = 5;

/** Approximate DEMO rail distance between two stations (km, integer). */
export function demoRailDistanceKm(a: GeoPoint, b: GeoPoint): number {
  return Math.max(MIN_DEMO_DISTANCE_KM, Math.round(haversineKm(a, b) * RAIL_ROUTE_FACTOR));
}

/**
 * Pick intermediate "via" stations that lie roughly on the straight line between
 * source and destination. Purely illustrative — not a real route.
 */
export function viaStations<T extends GeoPoint & { code: string; isPopular?: boolean }>(
  src: T,
  dst: T,
  all: readonly T[],
  max = 3,
  tolerance = 1.08,
): T[] {
  const direct = haversineKm(src, dst);
  if (direct < 40) return [];
  const minGap = Math.max(12, direct * 0.06);
  const candidates = all
    .filter((s) => s.code !== src.code && s.code !== dst.code)
    .map((s) => ({ s, a: haversineKm(src, s), b: haversineKm(s, dst) }))
    .filter(({ a, b }) => a + b <= direct * tolerance && a > minGap && b > minGap)
    .sort((x, y) => x.a - y.a);
  if (candidates.length <= max) return candidates.map((c) => c.s);
  // choose evenly spaced candidates, avoiding near-duplicates in the same city
  const picked: typeof candidates = [];
  for (let i = 0; i < max; i++) {
    const target = (direct * (i + 1)) / (max + 1);
    const best = candidates
      .filter((c) => !picked.includes(c) && picked.every((p) => Math.abs(p.a - c.a) > minGap))
      .sort((x, y) => Math.abs(x.a - target) - Math.abs(y.a - target) - (x.s.isPopular ? 5 : 0) + (y.s.isPopular ? 5 : 0))[0];
    if (best) picked.push(best);
  }
  return picked.sort((x, y) => x.a - y.a).map((c) => c.s);
}
