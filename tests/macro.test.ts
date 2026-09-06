import { describe, expect, it } from 'vitest';
import {
  deriveSeries,
  formatMacroValue,
  lastN,
  latest,
  mapFredObservations,
  monthOverMonthChange,
  nextMeetingDate,
  parseTreasuryYieldCsv,
  pastMeetingDates,
  yearOverYear,
  yieldReactionAround,
} from '../src/lib/macro.ts';

describe('mapFredObservations [MAC-5]', () => {
  it('drops the "." missing-observation marker rather than coercing it', () => {
    const points = mapFredObservations([
      { date: '2026-01-01', value: '3.2' },
      { date: '2026-02-01', value: '.' },
      { date: '2026-03-01', value: '3.4' },
    ]);
    expect(points).toEqual([
      { date: '2026-01-01', value: 3.2 },
      { date: '2026-03-01', value: 3.4 },
    ]);
  });

  it('tolerates a non-array input rather than throwing', () => {
    expect(mapFredObservations(undefined)).toEqual([]);
    expect(mapFredObservations(null)).toEqual([]);
  });

  it('drops an entry with a non-string date', () => {
    const points = mapFredObservations([{ date: null, value: '1' }]);
    expect(points).toEqual([]);
  });
});

describe('yearOverYear [MAC-6]', () => {
  it('compares each point to the one twelve entries earlier in the same series', () => {
    // 13 consecutive months, Jan 2026 through Jan 2027, rising by 1 each month.
    const points = Array.from({ length: 13 }, (_, i) => {
      const month = (i % 12) + 1;
      const year = 2026 + Math.floor(i / 12);
      return { date: `${year}-${String(month).padStart(2, '0')}-01`, value: 100 + i };
    });
    const yoy = yearOverYear(points);
    expect(yoy).toHaveLength(1);
    // (112 - 100) / 100 * 100 = 12%
    expect(yoy[0].value).toBeCloseTo(12, 5);
    expect(yoy[0].date).toBe('2027-01-01');
  });

  it('returns nothing for a series shorter than 13 points', () => {
    expect(yearOverYear([{ date: '2026-01-01', value: 1 }])).toEqual([]);
  });
});

describe('monthOverMonthChange [MAC-7]', () => {
  it('reports the change from the prior point, not the running level', () => {
    const points = [
      { date: '2026-01-01', value: 158000 },
      { date: '2026-02-01', value: 158180 },
    ];
    const change = monthOverMonthChange(points);
    expect(change).toEqual([{ date: '2026-02-01', value: 180 }]);
  });
});

describe('deriveSeries', () => {
  const points = [
    { date: '2026-01-01', value: 100 },
    { date: '2026-02-01', value: 105 },
  ];

  it('"level" is the identity', () => {
    expect(deriveSeries(points, 'level')).toEqual(points);
  });

  it('dispatches to yoy and mom_change', () => {
    expect(deriveSeries(points, 'mom_change')).toEqual([{ date: '2026-02-01', value: 5 }]);
    expect(deriveSeries(points, 'yoy')).toEqual([]); // fewer than 13 points
  });
});

describe('latest', () => {
  it('is the last point, assuming ascending order', () => {
    expect(latest([{ date: '2026-01-01', value: 1 }, { date: '2026-02-01', value: 2 }])?.value).toBe(2);
  });

  it('is undefined for an empty series', () => {
    expect(latest([])).toBeUndefined();
  });
});

describe('lastN [MAC-16]', () => {
  const points = Array.from({ length: 8 }, (_, i) => ({ date: `2026-0${i + 1}-01`, value: i }));

  it('returns the last n points, oldest first', () => {
    expect(lastN(points, 5)).toEqual(points.slice(3));
  });

  it('returns everything, not an error, when n exceeds the series length', () => {
    expect(lastN(points, 100)).toEqual(points);
  });

  it('returns an empty array for an empty series', () => {
    expect(lastN([], 5)).toEqual([]);
  });
});

describe('parseTreasuryYieldCsv [MAC-8]', () => {
  // Treasury quotes every maturity header ("1 Mo", "10 Yr", ...) but leaves
  // Date bare — confirmed from a live collection run's diagnostic output
  // after an unquoted fixture masked the bug entirely (every column but
  // Date silently matched nothing, and only the date-only points shipped).
  const csv = [
    'Date,"1 Mo","2 Mo","3 Mo","1 Yr","2 Yr","5 Yr","10 Yr","30 Yr"',
    '9/4/2026,4.10,4.08,4.05,3.90,3.60,4.00,4.25,4.60',
    '9/5/2026,4.12,4.09,4.06,3.92,3.62,4.02,4.27,4.62',
  ].join('\n');

  it('parses by header name and converts dates to ISO', () => {
    const points = parseTreasuryYieldCsv(csv);
    expect(points).toEqual([
      { date: '2026-09-04', y1mo: 4.1, y3mo: 4.05, y1yr: 3.9, y2yr: 3.6, y5yr: 4, y10yr: 4.25, y30yr: 4.6 },
      { date: '2026-09-05', y1mo: 4.12, y3mo: 4.06, y1yr: 3.92, y2yr: 3.62, y5yr: 4.02, y10yr: 4.27, y30yr: 4.62 },
    ]);
  });

  it('[regression] parses Treasury\'s actual current header verbatim, quotes and all', () => {
    // The exact header text a live run logged, including the 1.5-month bill
    // (added 2025) and every maturity this project does not track.
    const real = [
      'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"',
      '9/4/2026,4.10,4.11,4.08,4.05,4.02,3.95,3.90,3.60,3.50,4.00,4.15,4.25,4.45,4.60',
    ].join('\n');
    expect(parseTreasuryYieldCsv(real)).toEqual([
      { date: '2026-09-04', y1mo: 4.1, y3mo: 4.05, y6mo: 3.95, y1yr: 3.9, y2yr: 3.6, y5yr: 4, y10yr: 4.25, y30yr: 4.6 },
    ]);
  });

  it('is unaffected by an inserted column it does not recognise', () => {
    // Simulates Treasury adding a maturity this project does not track yet.
    const withExtraColumn = [
      'Date,"1.5 Month","1 Mo","2 Yr","10 Yr"',
      '9/4/2026,4.11,4.10,3.60,4.25',
    ].join('\n');
    expect(parseTreasuryYieldCsv(withExtraColumn)).toEqual([
      { date: '2026-09-04', y1mo: 4.1, y2yr: 3.6, y10yr: 4.25 },
    ]);
  });

  it('sorts oldest to newest regardless of input order', () => {
    const reversed = [
      'Date,"10 Yr"',
      '9/5/2026,4.27',
      '9/4/2026,4.25',
    ].join('\n');
    expect(parseTreasuryYieldCsv(reversed).map((p) => p.date)).toEqual(['2026-09-04', '2026-09-05']);
  });

  it('returns nothing for a header with no Date column, or too few lines', () => {
    expect(parseTreasuryYieldCsv('"1 Mo","2 Mo"\n1,2')).toEqual([]);
    expect(parseTreasuryYieldCsv('Date,"10 Yr"')).toEqual([]);
    expect(parseTreasuryYieldCsv('')).toEqual([]);
  });
});

describe('nextMeetingDate and pastMeetingDates', () => {
  const dates = ['2026-01-28', '2026-03-18', '2026-06-17', '2026-09-16', '2026-12-09'];

  it('finds the earliest date on or after today', () => {
    expect(nextMeetingDate(dates, '2026-09-06')).toBe('2026-09-16');
    expect(nextMeetingDate(dates, '2026-09-16')).toBe('2026-09-16');
  });

  it('is undefined once every date is past', () => {
    expect(nextMeetingDate(dates, '2027-01-01')).toBeUndefined();
  });

  it('lists past dates most-recent-first', () => {
    expect(pastMeetingDates(dates, '2026-09-06')).toEqual(['2026-06-17', '2026-03-18', '2026-01-28']);
  });
});

describe('formatMacroValue [SYS-7]', () => {
  it('renders a percent unit as a signed percentage', () => {
    expect(formatMacroValue(3.2, '% YoY')).toBe('+3.2%');
    expect(formatMacroValue(-0.4, '% YoY')).toBe('-0.4%');
  });

  it('renders a thousands unit as a signed "k" count', () => {
    expect(formatMacroValue(180, 'thousands, MoM')).toBe('+180k');
    expect(formatMacroValue(-22, 'thousands, MoM')).toBe('-22k');
  });

  it('renders a missing value as an em dash, never a zero', () => {
    expect(formatMacroValue(undefined, '%')).toBe('—');
  });

  it('appends any other unit to a plain number', () => {
    expect(formatMacroValue(29779, '$B, nominal, annualized')).toBe('29,779 $B, nominal, annualized');
  });
});

describe('yieldReactionAround [MAC-9, MAC-10]', () => {
  const yields = [
    { date: '2026-09-10', y2yr: 3.6, y10yr: 4.2 },
    { date: '2026-09-16', y2yr: 3.62, y10yr: 4.25 }, // event date itself
    { date: '2026-09-18', y2yr: 3.5, y10yr: 4.1 },
    { date: '2026-09-22', y2yr: 3.45, y10yr: 4.05 },
  ];

  it('takes "before" as the latest point on or before the event date', () => {
    const r = yieldReactionAround(yields, '2026-09-16', 3);
    expect(r.before2yr).toBe(3.62);
    expect(r.before10yr).toBe(4.25);
  });

  it('takes "after" as the earliest point at least N calendar days later', () => {
    const r = yieldReactionAround(yields, '2026-09-16', 3);
    // threshold is 2026-09-19; first point on/after that is 2026-09-22
    expect(r.after2yr).toBe(3.45);
    expect(r.change2yr).toBeCloseTo(3.45 - 3.62, 10);
  });

  it('leaves the reaction undefined on the side with no data, rather than a wrong change', () => {
    const r = yieldReactionAround(yields, '2026-01-01', 3); // before any collected point
    expect(r.before2yr).toBeUndefined();
    expect(r.change2yr).toBeUndefined();
    // after side still resolves, since points exist later than the threshold
    expect(r.after2yr).toBe(3.6);
  });

  it('is unaffected by input order', () => {
    const shuffled = [...yields].reverse();
    expect(yieldReactionAround(shuffled, '2026-09-16', 3)).toEqual(yieldReactionAround(yields, '2026-09-16', 3));
  });
});
