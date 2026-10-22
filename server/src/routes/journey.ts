import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../middleware/validate.js';
import { AppError, invalidJourney, notFound } from '../lib/errors.js';
import { istDateString } from '../lib/time.js';
import { demoRailDistanceKm, viaStations } from '../domain/geo.js';
import { generateTrains, mockAvailability, mockReservedFareRupees, RESERVED_CLASS_INFO, runsOnDate } from '../domain/trains.js';
import { calculatePlatformFare, calculateUnreservedFare, FareInputError } from '../domain/fare.js';
import { DEMO_FARE_TABLE } from '../domain/fareTable.js';
import { validateReservedSearchDate } from '../domain/journey.js';
import { mockPnrStatus, PNR_RE, SAMPLE_PNRS } from '../domain/pnr.js';
import { mockRunningStatus, TRAIN_NO_RE } from '../domain/runningStatus.js';
import { activeStations, getStation, stationDTO } from '../services/stationCache.js';
import { quoteUnreserved } from '../services/bookingService.js';

const TrainTypeEnum = z.enum(['ORDINARY', 'EXPRESS', 'SUPERFAST']);
const Code = z.string().trim().toUpperCase().min(1, 'Station is required').max(8);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ── Public reference data ────────────────────────────────────────────────────
export const faresPublicRouter = Router();
faresPublicRouter.get('/table', (_req, res) => res.json({ fareTable: DEMO_FARE_TABLE }));

// ── Authenticated journey tools (all MOCK data) ──────────────────────────────
export const journeyRouter = Router();

const SearchQuery = z.object({ from: Code, to: Code, date: DateStr.optional(), mode: z.enum(['unreserved', 'reserved']).default('unreserved') });

journeyRouter.get('/trains/search', async (req, res) => {
  const q = parse(SearchQuery, req.query);
  const [src, dst] = await Promise.all([getStation(q.from), getStation(q.to)]);
  const fields = [];
  if (!src || !src.isActive) fields.push({ field: 'from', message: `Unknown departure station "${q.from}"` });
  if (!dst || !dst.isActive) fields.push({ field: 'to', message: `Unknown destination station "${q.to}"` });
  if (src && dst && src.code === dst.code) fields.push({ field: 'to', message: 'Departure and destination stations must be different' });
  if (fields.length) throw invalidJourney(fields[0]!.message, { fields });

  const date = q.date ?? istDateString();
  if (q.mode === 'reserved') {
    const err = validateReservedSearchDate(date, istDateString());
    if (err) throw invalidJourney(err, { fields: [{ field: 'date', message: err }] });
  }
  const distanceKm = demoRailDistanceKm(src!, dst!);
  const all = await activeStations();
  const trains = generateTrains(src!, dst!, distanceKm);

  const result =
    q.mode === 'reserved'
      ? trains
          .filter((t) => t.reservedClasses.length > 0 && runsOnDate(t, date))
          .map((t) => ({
            ...t,
            classes: t.reservedClasses.map((c) => ({
              code: c, label: RESERVED_CLASS_INFO[c]?.label ?? c, fareRupees: mockReservedFareRupees(c, distanceKm, t.type), availability: mockAvailability(t.number, c, date),
            })),
          }))
      : trains.map((t) => ({
          ...t,
          unreservedFarePaise: calculateUnreservedFare({ distanceKm, trainType: t.type, adults: 1, children: 0 }).totalPaise,
        }));

  res.json({
    mock: true,
    notice: 'Mock schedule generated for demonstration. Not live railway data.',
    from: stationDTO(src!),
    to: stationDTO(dst!),
    date,
    distanceKm,
    via: viaStations(src!, dst!, all, 3).map((s) => ({ code: s.code, name: s.name })),
    trains: result,
  });
});

const QuoteBody = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('UNRESERVED'),
    from: Code,
    to: Code,
    journeyDate: DateStr,
    trainType: TrainTypeEnum,
    adults: z.number().int().min(0).max(4),
    children: z.number().int().min(0).max(4),
  }),
  z.object({ type: z.literal('PLATFORM'), station: Code, persons: z.number().int().min(1).max(4) }),
]);

/** Server-side fare quote using the DEMO fare dataset. */
journeyRouter.post('/fares/quote', async (req, res) => {
  const body = parse(QuoteBody, req.body);
  if (body.type === 'PLATFORM') {
    const st = await getStation(body.station);
    if (!st || !st.isActive) throw invalidJourney(`Unknown station "${body.station}"`);
    res.json({ quote: calculatePlatformFare(body.persons), station: stationDTO(st) });
    return;
  }
  try {
    const { quote, source, destination, distanceKm } = await quoteUnreserved(body);
    res.json({ quote, from: stationDTO(source), to: stationDTO(destination), distanceKm });
  } catch (e) {
    if (e instanceof FareInputError) throw invalidJourney(e.message);
    throw e;
  }
});

journeyRouter.get('/pnr/samples', (_req, res) => res.json({ samples: SAMPLE_PNRS }));

journeyRouter.get('/pnr/:pnr', async (req, res) => {
  const pnr = String(req.params.pnr).replace(/\D/g, '');
  if (!PNR_RE.test(pnr)) throw new AppError(400, 'VALIDATION_ERROR', 'PNR must be exactly 10 digits', { fields: [{ field: 'pnr', message: 'PNR must be exactly 10 digits' }] });
  const stations = (await activeStations()).filter((s) => s.isPopular);
  const status = mockPnrStatus(pnr, stations, istDateString());
  if (!status) throw notFound('PNR (demo data). It may be flushed or invalid');
  res.json({ status, notice: 'Mock PNR data for demonstration. No live reservation system is queried.' });
});

const RunningQuery = z.object({ from: Code.optional(), to: Code.optional() });
journeyRouter.get('/trains/:number/running-status', async (req, res) => {
  const number = String(req.params.number);
  if (!TRAIN_NO_RE.test(number)) throw new AppError(400, 'VALIDATION_ERROR', 'Train number must be 5 digits', { fields: [{ field: 'number', message: 'Train number must be 5 digits' }] });
  const q = parse(RunningQuery, req.query);
  const [from, to] = await Promise.all([getStation(q.from), getStation(q.to)]);
  const status = mockRunningStatus(number, await activeStations(), { from, to });
  if (!status) throw notFound('Train');
  res.json({ status, notice: 'Simulated running status computed from a mock timetable. Not live train tracking.' });
});
