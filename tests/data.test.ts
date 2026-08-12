import { describe, expect, it } from 'vitest';
import { freshness, hydrate, loadUniverse, loadWatchlist } from '../src/lib/data.ts';
import { payingDividend } from '../src/lib/columns.ts';
import type { MarketData } from '../src/lib/types.ts';

const empty: MarketData = { generatedAt: '', failed: [], stocks: {} };

describe('watchlist and universe data files', () => {
  it('parse and are non-empty', () => {
    expect(loadWatchlist().length).toBeGreaterThan(0);
    expect(loadUniverse().universe.length).toBeGreaterThan(0);
  });

  it('have no duplicate tickers', () => {
    for (const list of [loadWatchlist(), loadUniverse().universe]) {
      const tickers = list.map((e) => e.ticker);
      expect(new Set(tickers).size).toBe(tickers.length);
    }
  });

  it('only reference declared segments', () => {
    const { segments, universe } = loadUniverse();
    for (const entry of universe) {
      expect(Object.keys(segments)).toContain(entry.segment);
    }
  });

  it('carry no position data, since the repository is public', () => {
    const banned = ['shares', 'quantity', 'costBasis', 'cost_basis', 'avgPrice', 'pnl'];
    for (const entry of loadWatchlist() as unknown as Record<string, unknown>[]) {
      for (const key of banned) expect(entry[key]).toBeUndefined();
    }
  });
});

describe('hydrate', () => {
  it('keeps a row visible when no data was collected for it', () => {
    const rows = hydrate([{ ticker: 'AAA', name: 'Alpha' }], empty);
    expect(rows).toHaveLength(1);
    expect(rows[0].price).toBeUndefined();
    expect(rows[0].errors).toContain('no data');
  });

  it('merges collected metrics onto the curated entry', () => {
    const market: MarketData = {
      generatedAt: '2026-08-12T12:00:00Z',
      failed: [],
      stocks: { AAA: { ticker: 'AAA', name: 'stale name', price: 10 } },
    };
    const rows = hydrate([{ ticker: 'AAA', name: 'Alpha' }], market);
    expect(rows[0].price).toBe(10);
    // The curated name wins over whatever the API returned.
    expect(rows[0].name).toBe('Alpha');
  });
});

describe('freshness', () => {
  it('flags data that has never been collected', () => {
    expect(freshness('').stale).toBe(true);
  });

  it('flags unparseable timestamps rather than showing NaN', () => {
    expect(freshness('not a date').stale).toBe(true);
  });

  it('treats data older than a day as stale', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3_600_000).toISOString();
    const result = freshness(twoDaysAgo);
    expect(result.stale).toBe(true);
    expect(result.label).toContain('2d');
  });

  it('does not flag a recent refresh', () => {
    const recent = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(freshness(recent).stale).toBe(false);
  });
});

describe('payingDividend', () => {
  it('excludes non-payers and missing data', () => {
    expect(payingDividend({ ticker: 'A', name: 'A', dividendYield: 2.4 })).toBe(true);
    expect(payingDividend({ ticker: 'B', name: 'B', dividendYield: 0 })).toBe(false);
    expect(payingDividend({ ticker: 'C', name: 'C' })).toBe(false);
  });
});
