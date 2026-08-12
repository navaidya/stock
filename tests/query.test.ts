import { describe, expect, it } from 'vitest';
import { filterRows, matches, parseQuery } from '../src/lib/query.ts';
import type { StockSnapshot } from '../src/lib/types.ts';

const snap = (s: Partial<StockSnapshot>): StockSnapshot => ({
  ticker: 'AAA',
  name: 'Alpha Corp',
  ...s,
});

const rows: StockSnapshot[] = [
  snap({ ticker: 'CHEAP', name: 'Cheap Co', sector: 'telecom', peTTM: 12, dividendYield: 6 }),
  snap({ ticker: 'RICH', name: 'Rich Co', sector: 'semiconductors', peTTM: 60, dividendYield: 0.1 }),
  snap({ ticker: 'NOPE', name: 'No Data Co', sector: 'telecom' }),
];

const keep = (input: string) =>
  rows.filter((_, i) => filterRows(rows, input)[i]).map((r) => r.ticker);

describe('filter query', () => {
  it('[UI-34] compares a numeric field', () => {
    expect(keep('pe < 25')).toEqual(['CHEAP']);
    expect(keep('pe > 25')).toEqual(['RICH']);
  });

  it('[UI-34] ANDs several clauses', () => {
    expect(keep('pe < 25 yield > 2')).toEqual(['CHEAP']);
    expect(keep('pe < 25 yield > 10')).toEqual([]);
  });

  it('[UI-34] matches bare words against ticker, name and sector', () => {
    expect(keep('rich')).toEqual(['RICH']);
    expect(keep('telecom')).toEqual(['CHEAP', 'NOPE']);
    expect(keep('co')).toEqual(['CHEAP', 'RICH', 'NOPE']);
  });

  it('[UI-34] combines a comparison with a text term', () => {
    expect(keep('telecom pe < 25')).toEqual(['CHEAP']);
  });

  it('[UI-34] accepts aliases, canonical field names, and spaced names', () => {
    for (const field of ['pe', 'peTTM', 'pettm', 'PE']) {
      expect(parseQuery(`${field} < 25`).comparisons[0]?.field, field).toBe('peTTM');
    }
    expect(parseQuery('off high < -20').comparisons[0]?.field).toBe('pctOff52WeekHigh');
    expect(parseQuery('mkt cap > 1000').comparisons[0]?.field).toBe('marketCap');
  });

  it('[UI-34] accepts every comparison operator, and a trailing percent sign', () => {
    const rowsPe = [snap({ ticker: 'A', peTTM: 10 }), snap({ ticker: 'B', peTTM: 20 })];
    const pick = (q: string) =>
      rowsPe.filter((_, i) => filterRows(rowsPe, q)[i]).map((r) => r.ticker);
    expect(pick('pe <= 10')).toEqual(['A']);
    expect(pick('pe >= 20')).toEqual(['B']);
    expect(pick('pe = 20')).toEqual(['B']);
    expect(pick('pe > 15%')).toEqual(['B']);
  });

  it('[UI-35] never matches a comparison when the value is missing', () => {
    // NOPE has no P/E. It is not "cheap", and it is not "expensive" either.
    expect(keep('pe < 1000')).toEqual(['CHEAP', 'RICH']);
    expect(keep('pe > -1000')).toEqual(['CHEAP', 'RICH']);
    expect(matches(snap({ peTTM: undefined }), parseQuery('pe < 10'))).toBe(false);
    expect(matches(snap({ peTTM: NaN }), parseQuery('pe < 10'))).toBe(false);
  });

  it('[UI-36] keeps every row when nothing in the query parsed', () => {
    expect(keep('zzz < 5')).toEqual(['CHEAP', 'RICH', 'NOPE']);
    expect(parseQuery('zzz < 5').errors).toEqual(['zzz < 5']);
  });

  it('[UI-36] applies the clauses that did parse and reports the ones that did not', () => {
    expect(keep('pe < 25 zzz > 3')).toEqual(['CHEAP']);
    expect(parseQuery('pe < 25 zzz > 3').errors).toEqual(['zzz > 3']);
  });

  it('[UI-36] treats an empty or whitespace query as no filter', () => {
    expect(keep('')).toEqual(['CHEAP', 'RICH', 'NOPE']);
    expect(keep('   ')).toEqual(['CHEAP', 'RICH', 'NOPE']);
    expect(parseQuery('').errors).toEqual([]);
  });

  it('[UI-34] filters on the earnings countdown, which is why it exists', () => {
    const soon = [
      snap({ ticker: 'SOON', daysToEarnings: 3 }),
      snap({ ticker: 'LATER', daysToEarnings: 40 }),
      snap({ ticker: 'UNKNOWN' }),
    ];
    const shown = soon.filter((_, i) => filterRows(soon, 'earnings <= 7')[i]);
    expect(shown.map((r) => r.ticker)).toEqual(['SOON']);
  });
});
