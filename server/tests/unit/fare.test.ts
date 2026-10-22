import { describe, expect, it } from 'vitest';
import { baseFareForDistance, calculatePlatformFare, calculateRefund, calculateUnreservedFare, FareInputError } from '../../src/domain/fare.js';
import { DEMO_FARE_TABLE } from '../../src/domain/fareTable.js';

describe('demo fare dataset', () => {
  it('is clearly labelled as demo data', () => {
    expect(DEMO_FARE_TABLE.version).toMatch(/^DEMO-/);
    expect(DEMO_FARE_TABLE.disclaimer.toLowerCase()).toContain('not official');
  });

  it('slabs are strictly increasing in distance and non-decreasing in fare', () => {
    const slabs = DEMO_FARE_TABLE.secondClassOrdinarySlabs;
    for (let i = 1; i < slabs.length; i++) {
      expect(slabs[i]!.upToKm).toBeGreaterThan(slabs[i - 1]!.upToKm);
      expect(slabs[i]!.fare).toBeGreaterThanOrEqual(slabs[i - 1]!.fare);
    }
  });
});

describe('baseFareForDistance', () => {
  it.each([
    [1, 10], [10, 10], [11, 10], [26, 15], [50, 15], [51, 20], [570, 120], [1000, 180], [3000, 400],
  ])('%i km → ₹%i', (km, fare) => expect(baseFareForDistance(km)).toBe(fare));

  it('extends beyond the last slab per 100 km block', () => {
    expect(baseFareForDistance(3001)).toBe(400 + 12);
    expect(baseFareForDistance(3250)).toBe(400 + 36);
  });

  it('rejects invalid distances', () => {
    expect(() => baseFareForDistance(0)).toThrow(FareInputError);
    expect(() => baseFareForDistance(-5)).toThrow(FareInputError);
    expect(() => baseFareForDistance(Number.NaN)).toThrow(FareInputError);
  });
});

describe('calculateUnreservedFare', () => {
  it('computes an ordinary adult fare with no surcharge', () => {
    const q = calculateUnreservedFare({ distanceKm: 120, trainType: 'ORDINARY', adults: 1, children: 0 });
    expect(q.perAdultPaise).toBe(3500);
    expect(q.totalPaise).toBe(3500);
    expect(q.fareTableVersion).toBe(DEMO_FARE_TABLE.version);
  });

  it('adds express and superfast surcharges per passenger', () => {
    const e = calculateUnreservedFare({ distanceKm: 570, trainType: 'EXPRESS', adults: 1, children: 0 });
    const s = calculateUnreservedFare({ distanceKm: 570, trainType: 'SUPERFAST', adults: 1, children: 0 });
    expect(e.perAdultPaise).toBe((120 + 15) * 100);
    expect(s.perAdultPaise).toBe((120 + 30) * 100);
  });

  it('charges children half the base fare (rounded up to ₹5) plus full surcharge', () => {
    const q = calculateUnreservedFare({ distanceKm: 570, trainType: 'EXPRESS', adults: 2, children: 1 });
    expect(q.perChildPaise).toBe((60 + 15) * 100);
    expect(q.totalPaise).toBe(2 * 13500 + 7500);
    expect(q.lines).toEqual([
      { label: 'Adult', quantity: 2, unitPaise: 13500, amountPaise: 27000 },
      { label: 'Child', quantity: 1, unitPaise: 7500, amountPaise: 7500 },
    ]);
  });

  it('always rounds per-passenger fares to a multiple of ₹5 and respects the minimum fare', () => {
    for (const km of [5, 17, 33, 77, 199, 333, 777, 1234, 2600]) {
      for (const t of ['ORDINARY', 'EXPRESS', 'SUPERFAST'] as const) {
        const q = calculateUnreservedFare({ distanceKm: km, trainType: t, adults: 1, children: 1 });
        expect(q.perAdultPaise % 500).toBe(0);
        expect(q.perChildPaise % 500).toBe(0);
        expect(q.perAdultPaise).toBeGreaterThanOrEqual(DEMO_FARE_TABLE.minimumFareRupees * 100);
        expect(q.perChildPaise).toBeLessThanOrEqual(q.perAdultPaise);
      }
    }
  });

  it('enforces passenger rules', () => {
    expect(() => calculateUnreservedFare({ distanceKm: 50, trainType: 'ORDINARY', adults: 0, children: 0 })).toThrow(/at least one passenger/i);
    expect(() => calculateUnreservedFare({ distanceKm: 50, trainType: 'ORDINARY', adults: 3, children: 2 })).toThrow(/maximum of 4/i);
    expect(() => calculateUnreservedFare({ distanceKm: 50, trainType: 'ORDINARY', adults: 0, children: 2 })).toThrow(/at least one adult/i);
    expect(() => calculateUnreservedFare({ distanceKm: 50, trainType: 'ORDINARY', adults: 1.5, children: 0 })).toThrow(FareInputError);
  });

  it('rejects unknown train types', () => {
    // @ts-expect-error deliberately invalid
    expect(() => calculateUnreservedFare({ distanceKm: 50, trainType: 'BULLET', adults: 1, children: 0 })).toThrow(/unknown train type/i);
  });
});

describe('platform fare & refunds', () => {
  it('charges ₹10 per person for 1–4 persons', () => {
    expect(calculatePlatformFare(1).totalPaise).toBe(1000);
    expect(calculatePlatformFare(4).totalPaise).toBe(4000);
    expect(() => calculatePlatformFare(0)).toThrow();
    expect(() => calculatePlatformFare(5)).toThrow();
  });

  it('deducts a per-passenger clerkage fee, never refunding a negative amount', () => {
    expect(calculateRefund(34500, 3)).toEqual({ refundPaise: 34500 - 4500, clerkagePaise: 4500 });
    expect(calculateRefund(1000, 1)).toEqual({ refundPaise: 0, clerkagePaise: 1000 });
  });
});
