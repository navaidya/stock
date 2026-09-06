import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  analystCoverage,
  analystRatings,
  marketCap,
  money,
  num,
  pct,
  signedPct,
  trend,
} from '../src/lib/format.ts';

describe('formatters', () => {
  it('[MOD-11] render an em dash for missing values rather than 0 or NaN', () => {
    expect(num(undefined)).toBe(EMPTY);
    expect(pct(undefined)).toBe(EMPTY);
    expect(money(undefined)).toBe(EMPTY);
    expect(marketCap(undefined)).toBe(EMPTY);
    expect(signedPct(undefined)).toBe(EMPTY);
  });

  it('[MOD-11] still render a real zero', () => {
    expect(num(0)).toBe('0.00');
    expect(pct(0)).toBe('0.0%');
    expect(signedPct(0)).toBe('0.00%');
  });

  it('[MOD-14] signs positive changes explicitly', () => {
    expect(signedPct(1.834)).toBe('+1.83%');
    expect(signedPct(-1.834)).toBe('-1.83%');
  });
});

describe('marketCap', () => {
  it('[MOD-12] scales from millions to billions and trillions', () => {
    expect(marketCap(850)).toBe('$850M');
    expect(marketCap(42_500)).toBe('$42.5B');
    expect(marketCap(4_432_000)).toBe('$4.43T');
  });
});

describe('trend', () => {
  it('[MOD-13] distinguishes missing from flat', () => {
    expect(trend(undefined)).toBe('none');
    expect(trend(0)).toBe('flat');
    expect(trend(1)).toBe('up');
    expect(trend(-1)).toBe('down');
  });
});

describe('analystRatings [UI-51]', () => {
  it('joins non-zero buckets in Strong Buy..Strong Sell order', () => {
    expect(analystRatings({ period: '2026-08-01', strongBuy: 22, buy: 19, hold: 1, sell: 0, strongSell: 0 })).toBe(
      '22SB · 19B · 1H',
    );
  });

  it('omits zero-count buckets rather than printing "0"', () => {
    const text = analystRatings({ period: '2026-08-01', strongBuy: 0, buy: 5, hold: 0, sell: 0, strongSell: 0 });
    expect(text).toBe('5B');
    expect(text).not.toContain('0');
  });

  it('renders "0 analysts" when every bucket is genuinely zero, not an em dash', () => {
    // Distinct from "no data" (EMPTY) — this is a real, reported absence of coverage.
    expect(analystRatings({ period: '2026-08-01', strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 })).toBe(
      '0 analysts',
    );
  });

  it('[MOD-36, SYS-7] renders an em dash for undefined, never a fabricated count', () => {
    expect(analystRatings(undefined)).toBe(EMPTY);
  });
});

describe('analystCoverage [UI-52]', () => {
  it('sums all five buckets as a coverage-breadth number, not a sentiment score', () => {
    expect(analystCoverage({ period: '2026-08-01', strongBuy: 22, buy: 19, hold: 1, sell: 2, strongSell: 1 })).toBe(
      45,
    );
  });

  it('is undefined for undefined input, so it sorts last like any other missing value', () => {
    expect(analystCoverage(undefined)).toBeUndefined();
  });
});
