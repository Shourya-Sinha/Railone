import { seeded } from './rng.js';
import { demoRailDistanceKm, viaStations } from './geo.js';
import { generateTrains, fmtHHMM, type MockTrain } from './trains.js';
import type { TrainTypeCode } from './fareTable.js';
import { addDays, istDateString, istMinutesOfDay } from '../lib/time.js';

interface St { code: string; name: string; city: string; lat: number; lng: number; isPopular?: boolean }

export const TRAIN_NO_RE = /^\d{5}$/;

function typeFromNumber(n: string): TrainTypeCode {
  if (n.startsWith('12') || n.startsWith('22')) return 'SUPERFAST';
  if (n.startsWith('5') || n.startsWith('6') || n.startsWith('0')) return 'ORDINARY';
  return 'EXPRESS';
}

/** Deterministic MOCK running status — computed from a fictional schedule and the current clock. */
export function mockRunningStatus(
  trainNumber: string,
  allStations: readonly St[],
  opts: { from?: St | null; to?: St | null; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const r = seeded(`rs:${trainNumber}`);
  let src: St | undefined;
  let dst: St | undefined;
  let train: Pick<MockTrain, 'number' | 'name' | 'type' | 'departure'> | undefined;

  if (opts.from && opts.to) {
    const dist = demoRailDistanceKm(opts.from, opts.to);
    const t = generateTrains(opts.from, opts.to, dist).find((x) => x.number === trainNumber);
    if (t) { src = opts.from; dst = opts.to; train = t; }
  }
  if (!train) {
    const pool = allStations.filter((s) => s.isPopular);
    const usable = pool.length >= 2 ? pool : allStations;
    if (usable.length < 2) return null;
    src = r.pick(usable);
    dst = r.pick(usable);
    for (let i = 0; i < 60 && (src.code === dst.code || demoRailDistanceKm(src, dst) < 250 || demoRailDistanceKm(src, dst) > 1700); i++) {
      dst = r.pick(usable);
    }
    const type = typeFromNumber(trainNumber);
    const NAMES = ['Suryoday', 'Deccan Star', 'Indigo Arrow', 'Monsoon', 'Saffron Line', 'Navyug', 'Kesari', 'Marigold', 'Sapphire'];
    train = {
      number: trainNumber,
      type,
      name: type === 'ORDINARY' ? `${src.city}–${dst.city} Passenger` : `${r.pick(NAMES)} ${type === 'SUPERFAST' ? 'SF Express' : 'Express'}`,
      departure: fmtHHMM(r.int(0, 287) * 5),
    };
  }
  const s = src!;
  const d = dst!;
  const speed = train.type === 'SUPERFAST' ? 68 : train.type === 'EXPRESS' ? 54 : 40;
  const totalKm = demoRailDistanceKm(s, d);
  const maxVia = Math.max(2, Math.min(9, Math.round(totalKm / (train.type === 'ORDINARY' ? 40 : 140))));
  const route = [s, ...viaStations(s, d, allStations, maxVia, 1.15), d];

  // Build the fictional timetable (minutes relative to departure from origin)
  let cum = 0;
  let t = 0;
  const depMin = Number(train.departure.slice(0, 2)) * 60 + Number(train.departure.slice(3));
  const baseDelay = r.chance(0.3) ? 0 : r.int(3, 55);
  const stops = route.map((st, i) => {
    const seg = i === 0 ? 0 : demoRailDistanceKm(route[i - 1]!, st);
    cum += seg;
    const arr = i === 0 ? null : t + (seg / speed) * 60;
    const halt = i === 0 || i === route.length - 1 ? 0 : r.int(2, train!.type === 'ORDINARY' ? 3 : 5);
    const dep = i === route.length - 1 ? null : (arr ?? 0) + halt;
    t = dep ?? arr ?? t;
    const delay = Math.round(baseDelay * (0.4 + (0.6 * i) / Math.max(1, route.length - 1)));
    return { st, distanceKm: cum, arr, dep, delay, platform: r.int(1, 8) };
  });
  const durationMin = stops[stops.length - 1]!.arr ?? 0;

  // Which run is "current"? Today's, unless yesterday's run is still en route.
  const nowMin = istMinutesOfDay(now);
  const today = istDateString(now);
  let elapsed = nowMin - depMin;
  let startDate = today;
  if (elapsed < 0 && nowMin + 1440 - depMin < durationMin + baseDelay + 30) {
    elapsed = nowMin + 1440 - depMin;
    startDate = addDays(today, -1);
  }

  let lastDepartedIdx = -1;
  let atStationIdx = -1;
  stops.forEach((x, i) => {
    const expArr = x.arr == null ? null : x.arr + x.delay;
    const expDep = x.dep == null ? null : x.dep + x.delay;
    if (expDep != null && elapsed >= expDep) lastDepartedIdx = i;
    else if (expArr != null && elapsed >= expArr) atStationIdx = i;
  });

  const fmt = (rel: number | null) => (rel == null ? null : { time: fmtHHMM(depMin + rel), day: 1 + Math.floor((depMin + rel) / 1440) });
  const last = stops.length - 1;
  let status: 'NOT_STARTED' | 'RUNNING' | 'AT_STATION' | 'COMPLETED';
  let text: string;
  if (atStationIdx === last) {
    status = 'COMPLETED';
    text = `Reached ${d.name}${stops[last]!.delay ? ` (${stops[last]!.delay} min late)` : ' on time'}`;
  } else if (atStationIdx >= 0) {
    status = 'AT_STATION';
    text = `At ${stops[atStationIdx]!.st.name}, platform ${stops[atStationIdx]!.platform}`;
  } else if (lastDepartedIdx >= 0) {
    status = 'RUNNING';
    const delay = stops[lastDepartedIdx]!.delay;
    text = `Departed ${stops[lastDepartedIdx]!.st.name} · ${delay ? `${delay} min late` : 'on time'}`;
  } else {
    status = 'NOT_STARTED';
    text = `Yet to start from ${s.name} at ${train.departure}`;
  }

  const currentIdx = status === 'AT_STATION' || status === 'COMPLETED' ? atStationIdx : lastDepartedIdx;
  const progress = status === 'COMPLETED' ? 1 : status === 'NOT_STARTED' ? 0 : Math.min(1, Math.max(0, elapsed / (durationMin + baseDelay)));

  return {
    mock: true,
    train: { number: train.number, name: train.name, type: train.type },
    from: { code: s.code, name: s.name },
    to: { code: d.code, name: d.name },
    startDate,
    lastUpdated: now.toISOString(),
    status,
    text,
    progress,
    currentDelayMin: currentIdx >= 0 ? stops[currentIdx]!.delay : 0,
    stops: stops.map((x, i) => ({
      code: x.st.code,
      name: x.st.name,
      distanceKm: x.distanceKm,
      scheduledArrival: fmt(x.arr),
      scheduledDeparture: fmt(x.dep),
      expectedArrival: fmt(x.arr == null ? null : x.arr + x.delay),
      expectedDeparture: fmt(x.dep == null ? null : x.dep + x.delay),
      delayMin: x.delay,
      platform: x.platform,
      state: i <= lastDepartedIdx ? 'DEPARTED' : i === atStationIdx ? 'CURRENT' : 'UPCOMING',
    })),
  };
}
