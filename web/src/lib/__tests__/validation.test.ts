import { describe, expect, it } from 'vitest';
import { isValidPnr, isValidTrainNumber, passwordIssues, validateJourney, validatePassengers } from '../validation';
import type { Station } from '../types';

const PNBE: Station = { code: 'PNBE', name: 'Patna Junction', city: 'Patna' };
const HWH: Station = { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata' };
const today = '2026-10-22';

describe('validateJourney (booking validation)', () => {
  it('accepts a valid journey for today and tomorrow', () => {
    expect(validateJourney({ from: PNBE, to: HWH, date: today, today })).toEqual({});
    expect(validateJourney({ from: PNBE, to: HWH, date: '2026-10-23', today })).toEqual({});
  });
  it('requires both stations', () => {
    const e = validateJourney({ from: null, to: null, date: today, today });
    expect(e.from).toMatch(/departure/i);
    expect(e.to).toMatch(/destination/i);
  });
  it('rejects identical source and destination', () => {
    expect(validateJourney({ from: PNBE, to: { ...PNBE }, date: today, today }).to).toMatch(/different/i);
  });
  it('rejects past dates and dates beyond the unreserved window', () => {
    expect(validateJourney({ from: PNBE, to: HWH, date: '2026-10-21', today }).date).toMatch(/past/i);
    expect(validateJourney({ from: PNBE, to: HWH, date: '2026-10-24', today }).date).toMatch(/today or tomorrow/i);
  });
  it('honours a wider window for reserved search', () => {
    expect(validateJourney({ from: PNBE, to: HWH, date: '2026-12-01', today, maxDaysAhead: 60 })).toEqual({});
    expect(validateJourney({ from: PNBE, to: HWH, date: '2027-01-30', today, maxDaysAhead: 60 }).date).toMatch(/within 60 days/);
  });
  it('rejects malformed dates', () => {
    expect(validateJourney({ from: PNBE, to: HWH, date: '22/10/2026', today }).date).toBeDefined();
  });
});

describe('validatePassengers', () => {
  it.each([
    [1, 0, null],
    [2, 2, null],
    [4, 0, null],
    [0, 0, /at least one passenger/i],
    [0, 2, /at least one adult/i],
    [3, 2, /maximum 4/i],
  ] as const)('%i adults + %i children', (a, c, expected) => {
    const r = validatePassengers(a, c);
    if (expected === null) expect(r).toBeNull();
    else expect(r).toMatch(expected);
  });
});

describe('format checks', () => {
  it('validates PNR and train numbers', () => {
    expect(isValidPnr('2451837690')).toBe(true);
    expect(isValidPnr('245183769')).toBe(false);
    expect(isValidPnr('24518376ab')).toBe(false);
    expect(isValidTrainNumber('12345')).toBe(true);
    expect(isValidTrainNumber('1234')).toBe(false);
  });
  it('lists password issues', () => {
    expect(passwordIssues('Demo@12345')).toEqual([]);
    expect(passwordIssues('short')).toHaveLength(2);
  });
});
