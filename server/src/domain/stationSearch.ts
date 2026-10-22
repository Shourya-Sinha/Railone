export interface SearchableStation {
  code: string;
  name: string;
  city: string;
  state: string;
  isPopular?: boolean;
  isActive?: boolean;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Rank stations for an autocomplete query.
 *  100 exact code · 90 code prefix · 80 name prefix · 70 city prefix
 *  60 word prefix · 40 substring. Popular stations get a small boost.
 */
export function scoreStation(st: SearchableStation, rawQuery: string): number {
  const q = norm(rawQuery);
  if (!q) return 0;
  const code = st.code.toLowerCase();
  const name = norm(st.name);
  const city = norm(st.city);
  let score = 0;
  if (code === q.replace(/ /g, '')) score = 100;
  else if (code.startsWith(q)) score = 90;
  else if (name.startsWith(q)) score = 80;
  else if (city.startsWith(q)) score = 70;
  else if (name.split(' ').some((w) => w.startsWith(q)) || city.split(' ').some((w) => w.startsWith(q))) score = 60;
  else if (name.includes(q) || city.includes(q) || norm(st.state).startsWith(q)) score = 40;
  if (score > 0 && st.isPopular) score += 3;
  return score;
}

export function searchStations<T extends SearchableStation>(stations: readonly T[], query: string, limit = 10): T[] {
  return stations
    .filter((s) => s.isActive !== false)
    .map((s) => ({ s, score: scoreStation(s, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name))
    .slice(0, Math.max(1, Math.min(limit, 50)))
    .map((x) => x.s);
}
