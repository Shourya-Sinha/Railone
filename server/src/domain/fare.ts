import { DEMO_FARE_TABLE as T, type TrainTypeCode } from './fareTable.js';

export interface FareLine {
  label: string;
  quantity: number;
  unitPaise: number;
  amountPaise: number;
}

export interface FareQuote {
  fareTableVersion: string;
  disclaimer: string;
  distanceKm?: number;
  trainType?: TrainTypeCode;
  classCode: string;
  baseAdultRupees?: number;
  surchargeRupees?: number;
  perAdultPaise: number;
  perChildPaise: number;
  adults: number;
  children: number;
  lines: FareLine[];
  totalPaise: number;
}

export class FareInputError extends Error {}

export const roundUpTo = (value: number, step: number) => Math.ceil(value / step) * step;

/** Second-class ordinary base fare (rupees) for a distance using the demo slab table. */
export function baseFareForDistance(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) throw new FareInputError('Distance must be a positive number');
  const slabs = T.secondClassOrdinarySlabs;
  const slab = slabs.find((s) => distanceKm <= s.upToKm);
  if (slab) return slab.fare;
  const last = slabs[slabs.length - 1]!;
  const extraBlocks = Math.ceil((distanceKm - last.upToKm) / 100);
  return last.fare + extraBlocks * T.beyondLastSlabPer100KmRupees;
}

export function assertPassengers(adults: number, children: number) {
  if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 0 || children < 0) {
    throw new FareInputError('Passenger counts must be non-negative whole numbers');
  }
  if (adults + children < 1) throw new FareInputError('At least one passenger is required');
  if (adults + children > T.maxPassengersPerTicket) {
    throw new FareInputError(`A maximum of ${T.maxPassengersPerTicket} passengers is allowed per ticket`);
  }
  if (adults < 1) throw new FareInputError('Children must travel with at least one adult');
}

/** Server-side unreserved (UTS-style) fare calculation using the DEMO fare table. */
export function calculateUnreservedFare(input: {
  distanceKm: number;
  trainType: TrainTypeCode;
  adults: number;
  children: number;
}): FareQuote {
  const { distanceKm, trainType, adults, children } = input;
  assertPassengers(adults, children);
  if (!(trainType in T.trainTypeSurchargeRupees)) throw new FareInputError('Unknown train type');

  const base = baseFareForDistance(distanceKm);
  const surcharge = T.trainTypeSurchargeRupees[trainType];
  const step = T.roundToRupees;

  const perAdult = Math.max(T.minimumFareRupees, roundUpTo(base + surcharge, step));
  const perChild = Math.max(step, roundUpTo(base * 0.5, step) + surcharge);

  const lines: FareLine[] = [];
  if (adults > 0) lines.push({ label: 'Adult', quantity: adults, unitPaise: perAdult * 100, amountPaise: perAdult * 100 * adults });
  if (children > 0) lines.push({ label: 'Child', quantity: children, unitPaise: perChild * 100, amountPaise: perChild * 100 * children });

  return {
    fareTableVersion: T.version,
    disclaimer: T.disclaimer,
    distanceKm,
    trainType,
    classCode: 'II',
    baseAdultRupees: base,
    surchargeRupees: surcharge,
    perAdultPaise: perAdult * 100,
    perChildPaise: perChild * 100,
    adults,
    children,
    lines,
    totalPaise: lines.reduce((s, l) => s + l.amountPaise, 0),
  };
}

export function calculatePlatformFare(persons: number): FareQuote {
  if (!Number.isInteger(persons) || persons < 1 || persons > T.platform.maxPersons) {
    throw new FareInputError(`Platform tickets can be booked for 1 to ${T.platform.maxPersons} persons`);
  }
  const unit = T.platform.perPersonRupees * 100;
  return {
    fareTableVersion: T.version,
    disclaimer: T.disclaimer,
    classCode: 'PF',
    perAdultPaise: unit,
    perChildPaise: unit,
    adults: persons,
    children: 0,
    lines: [{ label: 'Platform visitor', quantity: persons, unitPaise: unit, amountPaise: unit * persons }],
    totalPaise: unit * persons,
  };
}

/** Demo cancellation refund: total minus a per-passenger clerkage fee. */
export function calculateRefund(totalPaise: number, passengers: number): { refundPaise: number; clerkagePaise: number } {
  const clerkagePaise = Math.min(totalPaise, T.cancellation.clerkagePerPassengerRupees * 100 * passengers);
  return { refundPaise: totalPaise - clerkagePaise, clerkagePaise };
}
