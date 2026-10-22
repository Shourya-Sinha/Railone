import { beforeEach, describe, expect, it } from 'vitest';
import { addRecentJourney, addRecentStation, clearRecentStations, getRecentJourneys, getRecentStations } from '../recent';

const st = (code: string) => ({ code, name: `${code} Junction`, city: code });

describe('recent station searches', () => {
  beforeEach(() => localStorage.clear());

  it('stores most-recent first and de-duplicates', () => {
    addRecentStation(st('PNBE'));
    addRecentStation(st('HWH'));
    addRecentStation(st('PNBE'));
    expect(getRecentStations().map((s) => s.code)).toEqual(['PNBE', 'HWH']);
  });
  it('caps the list', () => {
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) addRecentStation(st(c));
    expect(getRecentStations()).toHaveLength(6);
    expect(getRecentStations()[0]!.code).toBe('H');
  });
  it('survives corrupted storage', () => {
    localStorage.setItem('rw1.recentStations', '{not json');
    expect(getRecentStations()).toEqual([]);
    localStorage.setItem('rw1.recentStations', JSON.stringify([{ foo: 1 }, st('NDLS')]));
    expect(getRecentStations().map((s) => s.code)).toEqual(['NDLS']);
  });
  it('clears', () => {
    addRecentStation(st('PNBE'));
    clearRecentStations();
    expect(getRecentStations()).toEqual([]);
  });
  it('tracks recent journeys uniquely by pair', () => {
    addRecentJourney({ from: st('PNBE'), to: st('HWH') });
    addRecentJourney({ from: st('HWH'), to: st('PNBE') });
    addRecentJourney({ from: st('PNBE'), to: st('HWH') });
    expect(getRecentJourneys().map((j) => `${j.from.code}-${j.to.code}`)).toEqual(['PNBE-HWH', 'HWH-PNBE']);
  });
});
