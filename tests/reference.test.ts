import { describe, expect, it } from 'vitest';
import { isInvestmentGrade, normalizeRating, ratingRank } from '../src/lib/rating.ts';
import { normalizeEntry, normalizeReference } from '../src/lib/reference.ts';
import { hydrate, loadReference } from '../src/lib/data.ts';
import type { MarketData } from '../src/lib/types.ts';

const empty: MarketData = { generatedAt: '', failed: [], stocks: {} };

describe('credit ratings', () => {
  it('[MOD-19] keeps a rating on the scale and drops one that is not', () => {
    expect(normalizeRating('BBB+')).toBe('BBB+');
    expect(normalizeRating(' aa- ')).toBe('AA-');
    for (const junk of ['NR', 'not rated', 'A++', 'BBBB', '', 'AAA-', 42, null, undefined]) {
      expect(normalizeRating(junk), String(junk)).toBeUndefined();
    }
  });

  it("[MOD-19] stores Moody's notation in the canonical S&P spelling", () => {
    expect(normalizeRating('Baa1')).toBe('BBB+');
    expect(normalizeRating('Aaa')).toBe('AAA');
  });

  it('[MOD-20] ranks ratings from AAA best to D worst', () => {
    expect(ratingRank('AAA')).toBe(1);
    expect(ratingRank('AA-')).toBeLessThan(ratingRank('A')!);
    expect(ratingRank('A')).toBeLessThan(ratingRank('BBB')!);
    expect(ratingRank('BBB')).toBeLessThan(ratingRank('BB+')!);
    expect(ratingRank('BB+')).toBeLessThan(ratingRank('D')!);
  });

  it('[MOD-20] treats the two notations as the same notch, case-insensitively', () => {
    expect(ratingRank('Aa3')).toBe(ratingRank('AA-'));
    expect(ratingRank('baa2')).toBe(ratingRank('BBB'));
  });

  it('[MOD-20] returns undefined for anything unrecognised, so it sorts as missing', () => {
    for (const junk of ['NR', 'unrated', '', 7, undefined]) {
      expect(ratingRank(junk), String(junk)).toBeUndefined();
    }
  });

  it('[MOD-20] puts the investment-grade line at BBB-', () => {
    expect(isInvestmentGrade('BBB-')).toBe(true);
    expect(isInvestmentGrade('BB+')).toBe(false);
    expect(isInvestmentGrade('NR')).toBeUndefined();
  });
});

describe('reference file normalization', () => {
  it('[MOD-19] drops a rating off the scale rather than displaying it', () => {
    expect(normalizeEntry({ creditRating: 'A' }).creditRating).toBe('A');
    expect(normalizeEntry({ creditRating: 'NR' }).creditRating).toBeUndefined();
  });

  it('[MOD-19] drops the agency and date when the rating itself did not survive', () => {
    const entry = normalizeEntry({
      creditRating: 'gibberish',
      creditRatingAgency: 'S&P',
      creditRatingAsOf: '2026-08-12',
    });
    expect(entry).toEqual({});
  });

  it('[MOD-21] accepts RPO in millions and drops anything that is not a positive number', () => {
    expect(normalizeEntry({ rpo: 600000 }).rpo).toBe(600000);
    for (const junk of [0, -5, 'lots', NaN, Infinity, null, undefined]) {
      expect(normalizeEntry({ rpo: junk }).rpo, String(junk)).toBeUndefined();
    }
  });

  it('[MOD-21] drops the RPO date and source when the figure did not survive', () => {
    expect(normalizeEntry({ rpo: -1, rpoAsOf: '2026-05-31', rpoSource: 'nowhere' })).toEqual({});
  });

  it('[MOD-21] survives a malformed file rather than throwing', () => {
    expect(normalizeReference(null)).toEqual({});
    expect(normalizeReference('nonsense')).toEqual({});
    expect(normalizeReference({ reference: { AAA: 'not an object' } })).toEqual({});
  });

  it('[MOD-24] the committed reference file dates every value it carries', () => {
    for (const [ticker, entry] of Object.entries(loadReference())) {
      if (entry.creditRating) {
        expect(entry.creditRatingAsOf, `${ticker} rating`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.creditRatingAgency, `${ticker} rating`).toBeTruthy();
      }
      if (entry.rpo) {
        expect(entry.rpoAsOf, `${ticker} rpo`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.rpoSource, `${ticker} rpo`).toBeTruthy();
      }
    }
  });

  it('[SEC-1] the reference file carries no position data', () => {
    const banned = ['shares', 'quantity', 'costBasis', 'cost_basis', 'avgPrice', 'pnl'];
    for (const entry of Object.values(loadReference()) as Record<string, unknown>[]) {
      for (const key of banned) expect(entry[key]).toBeUndefined();
    }
  });
});

describe('hydrating reference values', () => {
  it('[MOD-22] merges curated values onto a collected snapshot', () => {
    const market: MarketData = {
      generatedAt: '2026-08-12T12:00:00Z',
      failed: [],
      stocks: { AAA: { ticker: 'AAA', name: 'Alpha', price: 10 } },
    };
    const rows = hydrate([{ ticker: 'AAA', name: 'Alpha' }], market, {
      AAA: { creditRating: 'A+', rpo: 60000 },
    });
    expect(rows[0].price).toBe(10);
    expect(rows[0].creditRating).toBe('A+');
    expect(rows[0].rpo).toBe(60000);
  });

  it('[MOD-22] never overwrites a collected field with a curated one', () => {
    const market: MarketData = {
      generatedAt: '2026-08-12T12:00:00Z',
      failed: [],
      stocks: { AAA: { ticker: 'AAA', name: 'Alpha', price: 10 } },
    };
    const rows = hydrate([{ ticker: 'AAA', name: 'Alpha' }], market, {
      AAA: { price: 999 } as never,
    });
    expect(rows[0].price).toBe(10);
  });

  it('[MOD-22] still applies curated values to a row with no collected data', () => {
    const rows = hydrate([{ ticker: 'AAA', name: 'Alpha' }], empty, {
      AAA: { creditRating: 'BBB' },
    });
    expect(rows[0].creditRating).toBe('BBB');
    expect(rows[0].errors).toContain('no data');
  });

  it('[MOD-23] leaves a ticker with no reference entry untouched', () => {
    const rows = hydrate([{ ticker: 'ZZZ', name: 'Zeta' }], empty, { AAA: { creditRating: 'A' } });
    expect(rows[0].creditRating).toBeUndefined();
    expect(rows[0].rpo).toBeUndefined();
    expect('creditRating' in rows[0]).toBe(false);
  });
});
