import { describe, expect, it } from 'vitest';
import { validatePassengers, validateReservedSearchDate, validateUnreservedJourney } from '../../src/domain/journey.js';
import { generateTrains, mockAvailability, runsOnDate } from '../../src/domain/trains.js';
import { mockPnrStatus } from '../../src/domain/pnr.js';
import { mockRunningStatus } from '../../src/domain/runningStatus.js';
import { addDays, endOfIstDay, istDateString } from '../../src/lib/time.js';

const PNBE = { code: 'PNBE', name: 'Patna Junction', city: 'Patna', lat: 25.603, lng: 85.137, isPopular: true };
const HWH = { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', lat: 22.5835, lng: 88.3425, isPopular: true };
const NDLS = { code: 'NDLS', name: 'New Delhi', city: 'New Delhi', lat: 28.643, lng: 77.2194, isPopular: true };
const today = '2026-10-22';
const base = { source: PNBE, destination: HWH, journeyDate: today, today, adults: 1, children: 0 };

describe('validateUnreservedJourney', () => {
  it('accepts a valid journey for today and tomorrow', () => {
    expect(validateUnreservedJourney(base)).toEqual([]);
    expect(validateUnreservedJourney({ ...base, journeyDate: addDays(today, 1) })).toEqual([]);
  });

  it('requires both stations', () => {
    const issues = validateUnreservedJourney({ ...base, source: null, destination: undefined });
    expect(issues.map((i) => i.field)).toEqual(['source', 'destination']);
  });

  it('reports unknown station codes by name', () => {
    const [issue] = validateUnreservedJourney({ ...base, destination: null, destinationCode: 'XYZQ' });
    expect(issue!.message).toContain('XYZQ');
  });

  it('prevents identical source and destination', () => {
    const [issue] = validateUnreservedJourney({ ...base, destination: PNBE });
    expect(issue).toEqual({ field: 'destination', message: 'Departure and destination stations must be different' });
  });

  it('blocks inactive stations', () => {
    expect(validateUnreservedJourney({ ...base, source: { ...PNBE, isActive: false } })[0]!.field).toBe('source');
  });

  it('rejects past dates, far-future dates and malformed dates', () => {
    expect(validateUnreservedJourney({ ...base, journeyDate: addDays(today, -1) })[0]!.message).toMatch(/past/);
    expect(validateUnreservedJourney({ ...base, journeyDate: addDays(today, 2) })[0]!.message).toMatch(/today or tomorrow/);
    expect(validateUnreservedJourney({ ...base, journeyDate: '2026-02-30' })[0]!.message).toMatch(/valid/);
  });

  it('validates passenger combinations', () => {
    expect(validatePassengers(1, 0)).toEqual([]);
    expect(validatePassengers(2, 2)).toEqual([]);
    expect(validatePassengers(0, 0)[0]!.message).toMatch(/at least one/i);
    expect(validatePassengers(4, 1)[0]!.message).toMatch(/maximum/i);
    expect(validatePassengers(0, 1)[0]!.message).toMatch(/adult/i);
  });

  it('limits reserved search to a 60-day window', () => {
    expect(validateReservedSearchDate(addDays(today, 60), today)).toBeNull();
    expect(validateReservedSearchDate(addDays(today, 61), today)).toMatch(/60 days/);
  });
});

describe('mock trains, PNR and running status', () => {
  it('generates deterministic, labelled mock trains', () => {
    const a = generateTrains(PNBE, HWH, 570);
    const b = generateTrains(PNBE, HWH, 570);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(new Set(a.map((t) => t.number)).size).toBe(a.length);
    for (const t of a) {
      expect(t.number).toMatch(/^\d{5}$/);
      expect(t.departure).toMatch(/^\d{2}:\d{2}$/);
      expect(t.runsOn.some(Boolean)).toBe(true);
      expect(typeof runsOnDate(t, today)).toBe('boolean');
    }
  });

  it('produces availability labels', () => {
    const a = mockAvailability('12345', 'SL', today);
    expect(a.label).toMatch(/^(AVL|RAC|WL) \d+$|^REGRET$/);
  });

  it('returns null for unknown PNRs and stable data for valid ones', () => {
    const stations = [PNBE, HWH, NDLS];
    expect(mockPnrStatus('0123456789', stations, today)).toBeNull();
    expect(mockPnrStatus('12345', stations, today)).toBeNull();
    const p = mockPnrStatus('2451837690', stations, today)!;
    expect(p.mock).toBe(true);
    expect(p.passengers.length).toBeGreaterThanOrEqual(1);
    expect(mockPnrStatus('2451837690', stations, today)).toEqual(p);
  });

  it('computes running status relative to the clock', () => {
    const s = mockRunningStatus('12345', [PNBE, HWH, NDLS], { now: new Date('2026-10-22T06:00:00Z') })!;
    expect(s.mock).toBe(true);
    expect(['NOT_STARTED', 'RUNNING', 'AT_STATION', 'COMPLETED']).toContain(s.status);
    expect(s.stops[0]!.scheduledArrival).toBeNull();
    expect(s.stops.at(-1)!.scheduledDeparture).toBeNull();
  });
});

describe('IST time helpers', () => {
  it('formats dates in IST', () => {
    expect(istDateString(new Date('2026-10-21T19:00:00Z'))).toBe('2026-10-22'); // 00:30 IST
    expect(istDateString(new Date('2026-10-21T18:00:00Z'))).toBe('2026-10-21'); // 23:30 IST
  });
  it('computes the end of an IST day', () => {
    expect(endOfIstDay('2026-10-22').toISOString()).toBe('2026-10-22T18:29:59.999Z');
  });
});
