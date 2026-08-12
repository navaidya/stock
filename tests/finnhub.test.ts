import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapToSnapshot, pick, toNum } from '../src/lib/finnhub.ts';

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/finnhub-nvda.json'), 'utf8'),
);

describe('toNum', () => {
  it('[MOD-2] accepts numbers and numeric strings', () => {
    expect(toNum(1.5)).toBe(1.5);
    expect(toNum('2.5')).toBe(2.5);
  });

  it('[MOD-2] rejects the shapes Finnhub uses for missing data', () => {
    expect(toNum(null)).toBeUndefined();
    expect(toNum(undefined)).toBeUndefined();
    expect(toNum('')).toBeUndefined();
    expect(toNum('   ')).toBeUndefined();
    expect(toNum('n/a')).toBeUndefined();
    expect(toNum(Number.NaN)).toBeUndefined();
    expect(toNum(Infinity)).toBeUndefined();
  });
});

describe('pick', () => {
  it('[MOD-3] falls through to the next candidate key', () => {
    expect(pick({ a: null, b: 3 }, 'a', 'b')).toBe(3);
  });

  it('[MOD-3] returns undefined when no candidate has a value', () => {
    expect(pick({ a: null }, 'a', 'missing')).toBeUndefined();
    expect(pick(undefined, 'a')).toBeUndefined();
  });

  it('[MOD-3] does not treat zero as missing', () => {
    expect(pick({ a: 0 }, 'a')).toBe(0);
  });
});

// The whole block runs from fixture JSON with no network access, which is the
// evidence for MOD-7.
describe('mapToSnapshot [MOD-7]', () => {
  const snap = mapToSnapshot({
    ticker: 'NVDA',
    name: 'NVIDIA',
    sector: 'semiconductors',
    quote: fixture.quote,
    profile: fixture.profile,
    metrics: fixture.metrics,
  });

  it('maps price and fundamentals', () => {
    expect(snap.price).toBe(182.45);
    expect(snap.changePct1D).toBe(1.83);
    expect(snap.peTTM).toBe(48.3);
    expect(snap.grossMargin).toBe(74.9);
    expect(snap.debtToEquity).toBe(0.12);
    expect(snap.marketCap).toBe(4432000);
  });

  it('[MOD-4] computes percent off the 52-week high as a negative number', () => {
    // 182.45 against a 212.19 high
    expect(snap.pctOff52WeekHigh).toBeCloseTo(-14.02, 1);
  });

  it('[MOD-5] derives FCF yield as the reciprocal of price to FCF per share', () => {
    expect(snap.fcfYield).toBeCloseTo(1.818, 2);
  });

  it('[MOD-1] leaves unavailable metrics undefined rather than zero', () => {
    // Not in the fixture, as on the free tier.
    expect(snap.forwardPE).toBeUndefined();
    expect(snap.pegTTM).toBeUndefined();
  });

  it('[MOD-1] survives a response with no metrics at all', () => {
    const bare = mapToSnapshot({ ticker: 'XYZ', name: 'Test' });
    expect(bare.ticker).toBe('XYZ');
    expect(bare.price).toBeUndefined();
    expect(bare.pctOff52WeekHigh).toBeUndefined();
    expect(bare.fcfYield).toBeUndefined();
  });

  it('[MOD-5] does not invent an FCF yield from negative cash flow', () => {
    const burning = mapToSnapshot({
      ticker: 'BURN',
      name: 'Cash Burner',
      metrics: { metric: { pfcfShareTTM: -12 } },
    });
    expect(burning.fcfYield).toBeUndefined();
  });

  it('[MOD-6] strips company-only metrics for an ETF', () => {
    const etf = mapToSnapshot({
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      isEtf: true,
      quote: { c: 512.3, dp: 0.4 },
      metrics: { metric: { peTTM: 26.1, grossMarginTTM: 0, roeTTM: 0, beta: 1.0 } },
    });
    expect(etf.price).toBe(512.3);
    expect(etf.beta).toBe(1.0);
    expect(etf.peTTM).toBeUndefined();
    expect(etf.grossMargin).toBeUndefined();
    expect(etf.roe).toBeUndefined();
  });
});
