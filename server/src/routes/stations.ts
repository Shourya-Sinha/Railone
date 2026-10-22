import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../middleware/validate.js';
import { notFound } from '../lib/errors.js';
import { searchStations } from '../domain/stationSearch.js';
import { activeStations, getStation, stationDTO } from '../services/stationCache.js';

export const stationsRouter = Router();

const SearchQuery = z.object({
  q: z.string().trim().max(60).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** GET /api/stations?q=pat — autocomplete by name, city or code. */
stationsRouter.get('/', async (req, res) => {
  const { q, limit } = parse(SearchQuery, req.query);
  const all = await activeStations();
  const results = q ? searchStations(all, q, limit) : all.slice(0, limit);
  res.json({ query: q, results: results.map(stationDTO), dataset: 'sample' });
});

stationsRouter.get('/popular', async (_req, res) => {
  const all = await activeStations();
  res.json({ results: all.filter((s) => s.isPopular).map(stationDTO) });
});

stationsRouter.get('/:code', async (req, res) => {
  const st = await getStation(String(req.params.code));
  if (!st || !st.isActive) throw notFound('Station');
  res.json({ station: stationDTO(st) });
});
