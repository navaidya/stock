import { describe, expect, it } from 'vitest';
import { compareValues, sortOrder, sortRows, sortValueOf } from '../src/lib/sort.ts';
import { aiColumns, dividendColumns, homeColumns, type Column } from '../src/lib/columns.ts';
import type { StockSnapshot } from '../src/lib/types.ts';

const snapshot = (s: Partial<StockSnapshot>): StockSnapshot => ({
  ticker: 'AAA',
  name: 'Alpha',
  ...s,
});

const allColumns: Column[] = [...homeColumns, ...aiColumns, ...dividendColumns];

describe('sortable columns', () => {
  it('[UI-21] every column on every page produces an order in both directions', () => {
    const rows = [
      snapshot({ ticker: 'AAA', peTTM: 30, price: 10, creditRating: 'BBB', segment: 'compute' }),
      snapshot({ ticker: 'BBB', peTTM: 10, price: 90, creditRating: 'AA-', segment: 'memory' }),
      snapshot({ ticker: 'CCC' }),
    ];

    for (const column of allColumns) {
      for (const direction of ['asc', 'desc'] as const) {
        const sorted = sortRows(rows, column, direction);
        expect(sorted, `${column.key} ${direction}`).toHaveLength(rows.length);
        // A sort is a permutation: every row survives it exactly once.
        expect(new Set(sorted.map((r) => r.ticker)).size).toBe(rows.length);
      }
    }
  });

  it('[UI-21] orders numbers ascending and descending', () => {
    const column = homeColumns.find((c) => c.key === 'peTTM')!;
    const rows = [snapshot({ ticker: 'A', peTTM: 30 }), snapshot({ ticker: 'B', peTTM: 10 })];
    expect(sortRows(rows, column, 'asc').map((r) => r.ticker)).toEqual(['B', 'A']);
    expect(sortRows(rows, column, 'desc').map((r) => r.ticker)).toEqual(['A', 'B']);
  });

  it('[UI-22] sorts missing values last in both directions', () => {
    const column = homeColumns.find((c) => c.key === 'peTTM')!;
    const rows = [
      snapshot({ ticker: 'NONE' }),
      snapshot({ ticker: 'HIGH', peTTM: 40 }),
      snapshot({ ticker: 'LOW', peTTM: 5 }),
    ];
    expect(sortRows(rows, column, 'asc').map((r) => r.ticker)).toEqual(['LOW', 'HIGH', 'NONE']);
    expect(sortRows(rows, column, 'desc').map((r) => r.ticker)).toEqual(['HIGH', 'LOW', 'NONE']);
  });

  it('[UI-22] treats null, NaN and blank strings as missing, not as small', () => {
    for (const missing of [null, undefined, NaN, Infinity, '', '  ']) {
      expect(compareValues(missing, 1, 'asc')).toBeGreaterThan(0);
      expect(compareValues(missing, 1, 'desc')).toBeGreaterThan(0);
      expect(compareValues(1, missing, 'asc')).toBeLessThan(0);
      expect(compareValues(1, missing, 'desc')).toBeLessThan(0);
    }
    expect(compareValues(undefined, null, 'asc')).toBe(0);
  });

  it('[UI-22] keeps a zero above a missing value, since zero is a real number', () => {
    expect(compareValues(0, undefined, 'asc')).toBeLessThan(0);
    expect(compareValues(0, undefined, 'desc')).toBeLessThan(0);
  });

  it('[UI-23] is stable: equal values keep their original order', () => {
    const values = [5, 1, 5, 1, 5];
    expect(sortOrder(values, 'asc')).toEqual([1, 3, 0, 2, 4]);
    expect(sortOrder(values, 'desc')).toEqual([0, 2, 4, 1, 3]);
  });

  it('[UI-23] sorting the same column twice changes nothing', () => {
    const column = homeColumns.find((c) => c.key === 'marketCap')!;
    const rows = [
      snapshot({ ticker: 'A', marketCap: 900 }),
      snapshot({ ticker: 'B', marketCap: 1_200_000 }),
      snapshot({ ticker: 'C' }),
    ];
    const once = sortRows(rows, column, 'desc');
    expect(sortRows(once, column, 'desc')).toEqual(once);
  });

  it('[UI-24] sorts on the value, not the rendered string', () => {
    const column = homeColumns.find((c) => c.key === 'marketCap')!;
    const big = snapshot({ ticker: 'BIG', marketCap: 1_200_000 }); // renders $1.20T
    const small = snapshot({ ticker: 'SMALL', marketCap: 900 }); // renders $900M
    // As text, "$1.20T" sorts below "$900M". As a value it does not.
    expect(sortRows([small, big], column, 'desc').map((r) => r.ticker)).toEqual(['BIG', 'SMALL']);
  });

  it('[UI-24] reads the snapshot field named by the column key by default', () => {
    const column = homeColumns.find((c) => c.key === 'roe')!;
    expect(column.sort).toBeUndefined();
    expect(sortValueOf(column, snapshot({ roe: 12.5 }))).toBe(12.5);
    expect(sortValueOf(column, snapshot({}))).toBeUndefined();
  });

  it('[UI-24] sorts credit ratings by the agency scale, not alphabetically', () => {
    const column = homeColumns.find((c) => c.key === 'creditRating')!;
    const rows = [
      snapshot({ ticker: 'BBB-RATED', creditRating: 'BBB' }),
      snapshot({ ticker: 'AA-RATED', creditRating: 'AA-' }),
      snapshot({ ticker: 'A-RATED', creditRating: 'A' }),
      snapshot({ ticker: 'UNRATED' }),
    ];
    // Alphabetically 'A' < 'AA-' < 'BBB'. By credit quality AA- outranks A.
    expect(sortRows(rows, column, 'asc').map((r) => r.ticker)).toEqual([
      'AA-RATED',
      'A-RATED',
      'BBB-RATED',
      'UNRATED',
    ]);
  });

  it('[UI-24] compares text columns case-insensitively', () => {
    const column = homeColumns.find((c) => c.key === 'ticker')!;
    const rows = [snapshot({ ticker: 'b' }), snapshot({ ticker: 'A' })];
    expect(sortRows(rows, column, 'asc').map((r) => r.ticker)).toEqual(['A', 'b']);
  });
});
