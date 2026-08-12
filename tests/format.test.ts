import { describe, expect, it } from 'vitest';
import { EMPTY, marketCap, money, num, pct, signedPct, trend } from '../src/lib/format.ts';

describe('formatters', () => {
  it('render an em dash for missing values rather than 0 or NaN', () => {
    expect(num(undefined)).toBe(EMPTY);
    expect(pct(undefined)).toBe(EMPTY);
    expect(money(undefined)).toBe(EMPTY);
    expect(marketCap(undefined)).toBe(EMPTY);
    expect(signedPct(undefined)).toBe(EMPTY);
  });

  it('still render a real zero', () => {
    expect(num(0)).toBe('0.00');
    expect(pct(0)).toBe('0.0%');
    expect(signedPct(0)).toBe('0.00%');
  });

  it('signs positive changes explicitly', () => {
    expect(signedPct(1.834)).toBe('+1.83%');
    expect(signedPct(-1.834)).toBe('-1.83%');
  });
});

describe('marketCap', () => {
  it('scales from millions to billions and trillions', () => {
    expect(marketCap(850)).toBe('$850M');
    expect(marketCap(42_500)).toBe('$42.5B');
    expect(marketCap(4_432_000)).toBe('$4.43T');
  });
});

describe('trend', () => {
  it('distinguishes missing from flat', () => {
    expect(trend(undefined)).toBe('none');
    expect(trend(0)).toBe('flat');
    expect(trend(1)).toBe('up');
    expect(trend(-1)).toBe('down');
  });
});
