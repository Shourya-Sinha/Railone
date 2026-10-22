import { seeded } from './rng.js';
import type { TrainTypeCode } from './fareTable.js';

/**
 * MOCK train generator. Produces stable, realistic-looking but entirely fictional
 * schedules for any station pair. No live railway data is used.
 */
export interface MockTrain {
  number: string;
  name: string;
  type: TrainTypeCode;
  fromCode: string;
  toCode: string;
  departure: string; // HH:MM
  arrival: string; // HH:MM
  durationMin: number;
  dayOffset: number; // arrival day relative to departure day
  runsOn: boolean[]; // Sun..Sat
  stops: number;
  avgSpeedKmph: number;
  reservedClasses: string[];
}

const NAME_POOL = [
  'Suryoday', 'Chandrika', 'Deccan Star', 'Coastal Breeze', 'Indigo Arrow', 'Monsoon', 'Nilgiri Mist', 'Saffron Line',
  'Vindhya Link', 'Ganga Kinara', 'Lotus', 'Peacock', 'Himsagar Link', 'Sapphire', 'Pragati Path', 'Navyug',
  'Ekta', 'Sangam Link', 'Kesari', 'Marigold', 'Aravalli Arrow', 'Shivalik Link', 'Konkan Breeze', 'Malwa Star',
];

const SPEED: Record<TrainTypeCode, number> = { ORDINARY: 38, EXPRESS: 52, SUPERFAST: 66 };

export const fmtHHMM = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function generateTrains(
  src: { code: string; city: string },
  dst: { code: string; city: string },
  distanceKm: number,
): MockTrain[] {
  const r = seeded(`trains:${src.code}:${dst.code}`);
  const count = r.int(4, 7);
  const trains: MockTrain[] = [];
  const usedNumbers = new Set<string>();

  for (let i = 0; i < count; i++) {
    let type: TrainTypeCode;
    const roll = r.next();
    if (distanceKm < 150) type = roll < 0.55 ? 'ORDINARY' : roll < 0.85 ? 'EXPRESS' : 'SUPERFAST';
    else if (distanceKm < 600) type = roll < 0.2 ? 'ORDINARY' : roll < 0.65 ? 'EXPRESS' : 'SUPERFAST';
    else type = roll < 0.05 ? 'ORDINARY' : roll < 0.5 ? 'EXPRESS' : 'SUPERFAST';
    // guarantee variety: first train is always express-class or better, one ordinary for short hops
    if (i === 0) type = distanceKm < 150 ? 'ORDINARY' : 'SUPERFAST';
    if (i === 1) type = 'EXPRESS';

    let number = '';
    do {
      number = type === 'SUPERFAST' ? `12${r.int(100, 999)}` : type === 'EXPRESS' ? `1${r.int(3, 8)}${r.int(100, 999)}` : `${r.pick(['5', '6'])}${r.int(3000, 9999)}`;
    } while (usedNumbers.has(number));
    usedNumbers.add(number);

    const name =
      type === 'ORDINARY'
        ? `${src.city}–${dst.city} ${r.pick(['MEMU', 'Passenger', 'DEMU'])}`
        : `${r.pick(NAME_POOL)} ${type === 'SUPERFAST' ? 'SF Express' : 'Express'}`;

    const speed = Math.round(SPEED[type] * (0.88 + r.next() * 0.24));
    const stops = Math.max(1, Math.round(distanceKm / (type === 'ORDINARY' ? 12 : type === 'EXPRESS' ? 55 : 90)));
    const durationMin = Math.max(20, Math.round((distanceKm / speed) * 60 + stops * (type === 'ORDINARY' ? 1.5 : 3)));
    const depMin = r.int(0, 287) * 5;
    const daily = r.chance(type === 'ORDINARY' ? 0.95 : 0.6);
    const runsOn = Array.from({ length: 7 }, () => daily || r.chance(0.5));
    if (!runsOn.some(Boolean)) runsOn[r.int(0, 6)] = true;

    const reservedClasses =
      type === 'ORDINARY' ? [] : type === 'SUPERFAST' ? (r.chance(0.3) ? ['CC', 'EC'] : ['SL', '3E', '3A', '2A', '1A'].filter((c, idx) => idx < 3 || r.chance(0.6))) : ['2S', 'SL', '3A', '2A'].filter((c, idx) => idx > 0 && idx < 3 ? true : r.chance(0.6));

    trains.push({
      number,
      name,
      type,
      fromCode: src.code,
      toCode: dst.code,
      departure: fmtHHMM(depMin),
      arrival: fmtHHMM(depMin + durationMin),
      durationMin,
      dayOffset: Math.floor((depMin + durationMin) / 1440),
      runsOn,
      stops,
      avgSpeedKmph: speed,
      reservedClasses: reservedClasses.length ? reservedClasses : type === 'ORDINARY' ? [] : ['SL', '3A'],
    });
  }
  return trains.sort((a, b) => a.departure.localeCompare(b.departure));
}

export function runsOnDate(train: MockTrain, dateStr: string): boolean {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return train.runsOn[dow] ?? true;
}

// ── Reserved class availability & demo fares ───────────────────────────────
export const RESERVED_CLASS_INFO: Record<string, { label: string; perKm: number; reservation: number; sf: number; capacity: number }> = {
  '2S': { label: 'Second Sitting', perKm: 0.28, reservation: 15, sf: 15, capacity: 108 },
  SL: { label: 'Sleeper', perKm: 0.55, reservation: 20, sf: 30, capacity: 72 },
  '3E': { label: 'AC 3 Economy', perKm: 1.2, reservation: 40, sf: 45, capacity: 83 },
  '3A': { label: 'AC 3 Tier', perKm: 1.35, reservation: 40, sf: 45, capacity: 64 },
  '2A': { label: 'AC 2 Tier', perKm: 1.95, reservation: 50, sf: 45, capacity: 48 },
  '1A': { label: 'AC First Class', perKm: 3.3, reservation: 60, sf: 75, capacity: 18 },
  CC: { label: 'AC Chair Car', perKm: 1.15, reservation: 40, sf: 45, capacity: 78 },
  EC: { label: 'Executive Chair Car', perKm: 2.3, reservation: 60, sf: 75, capacity: 56 },
};

export type AvailabilityStatus = 'AVAILABLE' | 'RAC' | 'WAITLIST' | 'REGRET';

export function mockAvailability(trainNumber: string, cls: string, dateStr: string) {
  const r = seeded(`avl:${trainNumber}:${cls}:${dateStr}`);
  const roll = r.next();
  let status: AvailabilityStatus;
  let count = 0;
  if (roll < 0.45) { status = 'AVAILABLE'; count = r.int(1, RESERVED_CLASS_INFO[cls]?.capacity ?? 60); }
  else if (roll < 0.62) { status = 'RAC'; count = r.int(1, 30); }
  else if (roll < 0.94) { status = 'WAITLIST'; count = r.int(1, 180); }
  else status = 'REGRET';
  const label = status === 'AVAILABLE' ? `AVL ${count}` : status === 'RAC' ? `RAC ${count}` : status === 'WAITLIST' ? `WL ${count}` : 'REGRET';
  return { status, count, label };
}

export function mockReservedFareRupees(cls: string, distanceKm: number, type: TrainTypeCode): number {
  const info = RESERVED_CLASS_INFO[cls];
  if (!info) return 0;
  const minKm = cls === 'SL' ? 200 : cls === '2S' ? 0 : 100;
  const base = info.perKm * Math.max(distanceKm, minKm);
  const total = base + info.reservation + (type === 'SUPERFAST' ? info.sf : 0);
  return Math.ceil(total / 5) * 5;
}
