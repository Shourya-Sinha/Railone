import { seeded } from './rng.js';
import { demoRailDistanceKm } from './geo.js';
import { generateTrains, mockReservedFareRupees, RESERVED_CLASS_INFO } from './trains.js';
import { addDays, dayDiff } from '../lib/time.js';

interface St { code: string; name: string; city: string; lat: number; lng: number }

const COACH_PREFIX: Record<string, [string, number]> = {
  SL: ['S', 10], '3A': ['B', 6], '3E': ['M', 3], '2A': ['A', 3], '1A': ['H', 1], CC: ['C', 8], EC: ['E', 2], '2S': ['D', 8],
};
const BERTHS_SLEEPER = ['LB', 'MB', 'UB', 'SL', 'SU'];
const SEATS_CHAIR = ['WS', 'MS', 'AS'];

export const PNR_RE = /^\d{10}$/;
export const SAMPLE_PNRS = ['2451837690', '4120985563', '8347201196'];

/** Deterministic MOCK PNR enquiry. Returns null for "not found" (PNRs beginning 0 or 9). */
export function mockPnrStatus(pnr: string, stations: readonly St[], today: string) {
  if (!PNR_RE.test(pnr)) return null;
  if (pnr[0] === '0' || pnr[0] === '9') return null;
  const r = seeded(`pnr:${pnr}`);
  if (stations.length < 2) return null;

  let src = r.pick(stations);
  let dst = r.pick(stations);
  for (let i = 0; i < 40 && (src.code === dst.code || demoRailDistanceKm(src, dst) < 200); i++) {
    src = r.pick(stations);
    dst = r.pick(stations);
  }
  const distanceKm = demoRailDistanceKm(src, dst);
  const trains = generateTrains(src, dst, distanceKm).filter((t) => t.reservedClasses.length > 0);
  const train = r.pick(trains);
  const cls = r.pick(train.reservedClasses);
  const journeyDate = addDays(today, r.int(-2, 30));
  const chartPrepared = dayDiff(today, journeyDate) <= 0;
  const [prefix, coaches] = COACH_PREFIX[cls] ?? ['D', 4];
  const isChair = ['CC', 'EC', '2S'].includes(cls);
  const paxCount = r.int(1, 4);
  const coach = `${prefix}${r.int(1, coaches)}`;
  const firstBerth = r.int(1, 60);

  const passengers = Array.from({ length: paxCount }, (_, i) => {
    const roll = r.next();
    const seat = `${coach}/${firstBerth + i}/${isChair ? r.pick(SEATS_CHAIR) : r.pick(BERTHS_SLEEPER)}`;
    let booking: string;
    let current: string;
    if (roll < 0.5) { booking = `CNF/${seat}`; current = 'CNF'; }
    else if (roll < 0.7) {
      const rac = r.int(1, 40);
      booking = `RAC/${rac}`;
      current = r.chance(0.5) ? `CNF/${seat}` : `RAC/${Math.max(1, rac - r.int(0, rac - 1))}`;
    } else {
      const wl = r.int(5, 120);
      booking = `GNWL/${wl}`;
      const cur = wl - r.int(0, wl);
      current = cur <= 0 || r.chance(0.3) ? `CNF/${seat}` : chartPrepared && r.chance(0.5) ? 'CAN/MOD' : `WL/${cur}`;
    }
    return { serial: i + 1, bookingStatus: booking, currentStatus: current };
  });

  return {
    pnr,
    mock: true,
    train: { number: train.number, name: train.name, type: train.type },
    from: { code: src.code, name: src.name },
    to: { code: dst.code, name: dst.name },
    boardingPoint: { code: src.code, name: src.name },
    journeyDate,
    departure: train.departure,
    arrival: train.arrival,
    classCode: cls,
    className: RESERVED_CLASS_INFO[cls]?.label ?? cls,
    quota: r.pick(['GN', 'GN', 'GN', 'TQ', 'LD']),
    chartPrepared,
    farePerPassengerRupees: mockReservedFareRupees(cls, distanceKm, train.type),
    passengers,
  };
}
