import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { scoreStation, searchStations } from '../../src/domain/stationSearch.js';
import { demoRailDistanceKm, haversineKm, viaStations } from '../../src/domain/geo.js';

const dataset = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/stations.sample.json'), 'utf8')) as {
  stations: { code: string; name: string; city: string; state: string; zone: string; lat: number; lng: number; isPopular?: boolean }[];
};
const S = dataset.stations;
const byCode = (c: string) => S.find((s) => s.code === c)!;

describe('station dataset', () => {
  it('has unique, upper-case codes and sane coordinates', () => {
    const codes = new Set(S.map((s) => s.code));
    expect(codes.size).toBe(S.length);
    for (const s of S) {
      expect(s.code).toMatch(/^[A-Z]{1,5}$/);
      expect(s.lat).toBeGreaterThan(6);
      expect(s.lat).toBeLessThan(37.5);
      expect(s.lng).toBeGreaterThan(68);
      expect(s.lng).toBeLessThan(97.5);
    }
  });
  it('includes popular stations', () => expect(S.filter((s) => s.isPopular).length).toBeGreaterThanOrEqual(10));
});

describe('station search / autocomplete', () => {
  it('ranks an exact code match first', () => {
    expect(searchStations(S, 'pnbe')[0]!.code).toBe('PNBE');
    expect(searchStations(S, 'NDLS')[0]!.code).toBe('NDLS');
  });

  it('matches by station-name prefix', () => {
    expect(searchStations(S, 'howr')[0]!.code).toBe('HWH');
  });

  it('matches by city and returns every station in that city', () => {
    const codes = searchStations(S, 'patna', 10).map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['PNBE', 'RJPB', 'PPTA', 'DNR']));
  });

  it('matches word prefixes inside multi-word names', () => {
    expect(searchStations(S, 'nizam').map((s) => s.code)).toContain('NZM');
  });

  it('is case/punctuation insensitive', () => {
    expect(searchStations(S, '  Pt. Deen ')[0]!.code).toBe('DDU');
  });

  it('handles unknown stations gracefully with an empty list', () => {
    expect(searchStations(S, 'atlantis')).toEqual([]);
    expect(searchStations(S, '')).toEqual([]);
  });

  it('excludes inactive stations and honours the limit', () => {
    const list = [
      { code: 'AAA', name: 'Alpha', city: 'X', state: 'Y', isActive: false },
      { code: 'AAB', name: 'Alpha Two', city: 'X', state: 'Y' },
    ];
    expect(searchStations(list, 'alpha').map((s) => s.code)).toEqual(['AAB']);
    expect(searchStations(S, 'a', 3)).toHaveLength(3);
  });

  it('scores code > name > substring', () => {
    const st = { code: 'GAYA', name: 'Gaya Junction', city: 'Gaya', state: 'Bihar' };
    expect(scoreStation(st, 'gaya')).toBeGreaterThan(scoreStation(st, 'junc'));
    expect(scoreStation(st, 'zzz')).toBe(0);
  });
});

describe('demo geography', () => {
  it('computes plausible distances', () => {
    const d = haversineKm(byCode('NDLS'), byCode('CSMT'));
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1200);
    expect(demoRailDistanceKm(byCode('PNBE'), byCode('RJPB'))).toBeGreaterThanOrEqual(5);
  });

  it('chooses via stations that lie between source and destination', () => {
    const src = byCode('PNBE');
    const dst = byCode('HWH');
    const via = viaStations(src, dst, S, 3);
    expect(via.length).toBeGreaterThan(0);
    const direct = haversineKm(src, dst);
    for (const v of via) expect(haversineKm(src, v) + haversineKm(v, dst)).toBeLessThanOrEqual(direct * 1.08 + 0.001);
  });
});
