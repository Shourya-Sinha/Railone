/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RailwayOne Pro — DEMO FARE DATASET
 *  These numbers are ILLUSTRATIVE ONLY and are NOT official Indian Railways
 *  fares. They exist purely to demonstrate server-side fare calculation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const DEMO_FARE_TABLE = {
  version: 'DEMO-FARE-2026.1',
  label: 'RailwayOne Pro demo fare dataset',
  disclaimer: 'Illustrative demo fares only. Not official Indian Railways fares.',
  currency: 'INR',
  roundToRupees: 5,
  minimumFareRupees: 10,
  /** Second class (II) ordinary base fare by distance slab. */
  secondClassOrdinarySlabs: [
    { upToKm: 10, fare: 10 },
    { upToKm: 25, fare: 10 },
    { upToKm: 50, fare: 15 },
    { upToKm: 75, fare: 20 },
    { upToKm: 100, fare: 25 },
    { upToKm: 150, fare: 35 },
    { upToKm: 200, fare: 45 },
    { upToKm: 250, fare: 55 },
    { upToKm: 300, fare: 65 },
    { upToKm: 400, fare: 85 },
    { upToKm: 500, fare: 105 },
    { upToKm: 600, fare: 120 },
    { upToKm: 800, fare: 150 },
    { upToKm: 1000, fare: 180 },
    { upToKm: 1500, fare: 240 },
    { upToKm: 2000, fare: 300 },
    { upToKm: 3000, fare: 400 },
  ],
  beyondLastSlabPer100KmRupees: 12,
  /** Flat per-passenger surcharge by train type (Superfast includes the express element). */
  trainTypeSurchargeRupees: { ORDINARY: 0, EXPRESS: 15, SUPERFAST: 30 },
  trainTypes: [
    { code: 'ORDINARY', label: 'Ordinary / Passenger / MEMU' },
    { code: 'EXPRESS', label: 'Mail / Express' },
    { code: 'SUPERFAST', label: 'Superfast' },
  ],
  passengerCategories: [
    { code: 'ADULT', label: 'Adult', description: '12 years and above', baseFareFactor: 1 },
    { code: 'CHILD', label: 'Child', description: '5 to 11 years (half base fare)', baseFareFactor: 0.5 },
  ],
  maxPassengersPerTicket: 4,
  unreservedBookingWindowDays: 1,
  platform: { perPersonRupees: 10, maxPersons: 4, validityHours: 2 },
  cancellation: { clerkagePerPassengerRupees: 15, platformTicketsCancellable: false },
  wallet: { minTopUpRupees: 100, maxTopUpRupees: 10000, maxBalanceRupees: 20000 },
} as const;

export type TrainTypeCode = keyof typeof DEMO_FARE_TABLE.trainTypeSurchargeRupees;
export const TRAIN_TYPES = Object.keys(DEMO_FARE_TABLE.trainTypeSurchargeRupees) as TrainTypeCode[];
