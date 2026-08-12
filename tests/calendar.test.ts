import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapToSnapshot, nextEarnings, symbolDelayMs } from '../src/lib/finnhub.ts';
import { daysUntil, isoDate, shortDate, todayISO } from '../src/lib/dates.ts';
import { hydrate } from '../src/lib/data.ts';
import type { MarketData } from '../src/lib/types.ts';

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/finnhub-nvda.json'), 'utf8'),
);

const map = (today?: string) =>
  mapToSnapshot({
    ticker: 'NVDA',
    name: 'NVIDIA',
    quote: fixture.quote,
    profile: fixture.profile,
    metrics: fixture.metrics,
    earnings: fixture.earnings,
    today,
  });

const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe('collector pacing', () => {
  it('[COL-3] waits long enough per symbol to stay under 60 calls a minute', () => {
    for (const calls of [1, 3, 4, 6]) {
      const delay = symbolDelayMs(calls);
      const callsPerMinute = (calls / delay) * 60_000;
      expect(callsPerMinute, `${calls} calls per symbol`).toBeLessThanOrEqual(60);
    }
  });

  it('[COL-3] scales the wait with the number of calls a symbol costs', () => {
    expect(symbolDelayMs(4)).toBeGreaterThan(symbolDelayMs(3));
    // Nonsense in must not produce a zero wait, which would be a request flood.
    for (const junk of [0, -1, NaN, undefined as unknown as number]) {
      expect(symbolDelayMs(junk), String(junk)).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe('earnings date', () => {
  it('[MOD-25] takes the scheduled date as an ISO string', () => {
    expect(map('2026-01-01').earningsDate).toBe('2026-02-25');
  });

  it('[MOD-25] drops a date that is not an ISO date', () => {
    expect(nextEarnings({ earningsCalendar: [{ date: '25/02/2026' }] }).date).toBeUndefined();
    expect(nextEarnings({ earningsCalendar: [{ date: '2026-13-45' }] }).date).toBeUndefined();
    expect(nextEarnings({ earningsCalendar: [{}] }).date).toBeUndefined();
    expect(nextEarnings(undefined).date).toBeUndefined();
  });

  it('[MOD-26] takes the soonest date on or after the collection date', () => {
    // The fixture holds a past report, the next one, and the one after.
    expect(map('2026-01-01').earningsDate).toBe('2026-02-25');
    expect(map('2026-02-25').earningsDate).toBe('2026-02-25');
    expect(map('2026-02-26').earningsDate).toBe('2026-05-20');
  });

  it('[MOD-26] reports no date when every entry is in the past', () => {
    expect(map('2027-01-01').earningsDate).toBeUndefined();
  });

  it('[MOD-27] spells out when in the day the company reports', () => {
    expect(map('2026-01-01').earningsHour).toBe('after close');
    expect(nextEarnings({ earningsCalendar: [{ date: '2026-02-25', hour: 'bmo' }] }).hour).toBe(
      'before open',
    );
    expect(nextEarnings({ earningsCalendar: [{ date: '2026-02-25', hour: 'dmh' }] }).hour).toBe(
      'during hours',
    );
  });

  it('[MOD-27] drops an hour code it does not recognise', () => {
    expect(
      nextEarnings({ earningsCalendar: [{ date: '2026-02-25', hour: 'whenever' }] }).hour,
    ).toBeUndefined();
  });

  it('[MOD-6] strips the earnings date for a fund, which does not report', () => {
    const etf = mapToSnapshot({
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      isEtf: true,
      earnings: fixture.earnings,
      today: '2026-01-01',
    });
    expect(etf.earningsDate).toBeUndefined();
  });
});

describe('days to earnings', () => {
  it('[MOD-28] counts whole days from the date passed in', () => {
    expect(daysUntil('2026-02-25', at('2026-02-22'))).toBe(3);
    expect(daysUntil('2026-02-25', at('2026-02-24'))).toBe(1);
  });

  it('[MOD-28] is zero on the day itself, and undefined once past', () => {
    expect(daysUntil('2026-02-25', at('2026-02-25'))).toBe(0);
    expect(daysUntil('2026-02-25', at('2026-02-26'))).toBeUndefined();
  });

  it('[MOD-28] counts the calendar day, not elapsed hours', () => {
    // Late in the evening the day before is still "tomorrow", not "today".
    expect(daysUntil('2026-02-25', Date.parse('2026-02-24T23:30:00Z'))).toBe(1);
    expect(daysUntil('2026-02-25', Date.parse('2026-02-25T00:05:00Z'))).toBe(0);
  });

  it('[MOD-28] returns undefined for a missing or malformed date', () => {
    expect(daysUntil(undefined, at('2026-02-22'))).toBeUndefined();
    expect(daysUntil('soon', at('2026-02-22'))).toBeUndefined();
    expect(daysUntil('2026-02-25', NaN)).toBeUndefined();
  });

  it('[MOD-28] is derived at hydration from the clock it is given', () => {
    const market: MarketData = {
      generatedAt: '2026-02-22T12:00:00Z',
      failed: [],
      stocks: { AAA: { ticker: 'AAA', name: 'Alpha', earningsDate: '2026-02-25' } },
    };
    const rows = hydrate([{ ticker: 'AAA', name: 'Alpha' }], market, {}, at('2026-02-22'));
    expect(rows[0].daysToEarnings).toBe(3);

    const later = hydrate([{ ticker: 'AAA', name: 'Alpha' }], market, {}, at('2026-03-01'));
    expect(later[0].daysToEarnings).toBeUndefined();
    expect(later[0].earningsDate).toBe('2026-02-25');
  });
});

describe('date formatting', () => {
  it('[MOD-25] renders an ISO date unambiguously', () => {
    expect(shortDate('2026-02-25')).toBe('25 Feb');
    expect(shortDate('2026-12-01')).toBe('1 Dec');
    expect(shortDate('nonsense')).toBeUndefined();
    expect(shortDate(undefined)).toBeUndefined();
  });

  it('[MOD-25] validates an ISO date without reformatting it', () => {
    expect(isoDate('2026-02-25')).toBe('2026-02-25');
    expect(isoDate('2026-2-5')).toBeUndefined();
    expect(isoDate(20260225)).toBeUndefined();
  });

  it('[MOD-25] gives the collector today as an ISO date', () => {
    expect(todayISO(at('2026-02-25'))).toBe('2026-02-25');
  });
});

describe('trading activity', () => {
  it('[MOD-29] divides the 10-day average volume by the 3-month average', () => {
    const snap = map('2026-01-01');
    expect(snap.avgVolume10D).toBe(265.4);
    expect(snap.avgVolume3M).toBe(199.1);
    expect(snap.volumeRatio10D3M).toBeCloseTo(265.4 / 199.1, 6);
  });

  it('[MOD-29] computes nothing without a positive 3-month baseline', () => {
    const withMetric = (metric: Record<string, unknown>) =>
      mapToSnapshot({ ticker: 'AAA', name: 'Alpha', metrics: { metric } }).volumeRatio10D3M;

    expect(withMetric({ '10DayAverageTradingVolume': 10 })).toBeUndefined();
    expect(
      withMetric({ '10DayAverageTradingVolume': 10, '3MonthAverageTradingVolume': 0 }),
    ).toBeUndefined();
    expect(
      withMetric({ '10DayAverageTradingVolume': 10, '3MonthAverageTradingVolume': -5 }),
    ).toBeUndefined();
    expect(withMetric({ '3MonthAverageTradingVolume': 10 })).toBeUndefined();
  });
});
