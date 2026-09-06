import { toNum } from './finnhub.ts';
import type { MacroSeriesPoint, MacroYieldPoint } from './types.ts';

export interface FredObservation {
  date?: unknown;
  value?: unknown;
}

/** FRED encodes a missing observation as the literal string `"."`, not an
 *  empty value or a `null`. `toNum` already drops anything that fails to
 *  parse as a finite number, so a `"."` observation is dropped here the same
 *  way a malformed one would be — this function just documents why (MAC-5,
 *  SYS-7): nothing here ever substitutes a zero for a value FRED did not
 *  report. */
export function mapFredObservations(observations: unknown): MacroSeriesPoint[] {
  if (!Array.isArray(observations)) return [];
  const points: MacroSeriesPoint[] = [];
  for (const obs of observations as FredObservation[]) {
    const value = toNum(obs?.value);
    if (value === undefined || typeof obs?.date !== 'string') continue;
    points.push({ date: obs.date, value });
  }
  return points;
}

/** Year-over-year percent change for a monthly index-level series (CPI, core
 *  PCE, PPI). Compares each point to the point twelve entries earlier in the
 *  *same* series, not a fixed calendar offset (MAC-6) — a gap in what FRED
 *  actually published must not silently compare against the wrong month. */
export function yearOverYear(points: MacroSeriesPoint[]): MacroSeriesPoint[] {
  return points.slice(12).map((point, i) => ({
    date: point.date,
    value: ((point.value - points[i].value) / points[i].value) * 100,
  }));
}

/** Month-over-month change for a cumulative level series (nonfarm payrolls,
 *  in thousands): the number the headline jobs report actually leads with is
 *  "+180k jobs," not the nine-digit running total (MAC-7). */
export function monthOverMonthChange(points: MacroSeriesPoint[]): MacroSeriesPoint[] {
  return points.slice(1).map((point, i) => ({
    date: point.date,
    value: point.value - points[i].value,
  }));
}

export type Derivation = 'yoy' | 'mom_change' | 'level';

/** Applies the derivation named in data/macro-events.yaml to a raw mirrored
 *  series. `level` is the identity — some series (unemployment rate, the fed
 *  funds rate, GDP) are already the number the report leads with. */
export function deriveSeries(points: MacroSeriesPoint[], derive: Derivation): MacroSeriesPoint[] {
  if (derive === 'yoy') return yearOverYear(points);
  if (derive === 'mom_change') return monthOverMonthChange(points);
  return points;
}

/** The most recent point in a series, or undefined for an empty one. Points
 *  are assumed sorted ascending by date, which is how FRED returns them and
 *  how the collector writes them back out. */
export function latest(points: MacroSeriesPoint[]): MacroSeriesPoint | undefined {
  return points.length > 0 ? points[points.length - 1] : undefined;
}

type YieldKey = Exclude<keyof MacroYieldPoint, 'date'>;

/** Treasury's CSV header text for each maturity this page shows. Matched by
 *  name, not position (MAC-8) — Treasury has inserted a new maturity column
 *  before (the 1.5-month bill, added 2025), and a position-based parse would
 *  silently misalign every column that came after it. */
const TREASURY_COLUMNS: Array<[string, YieldKey]> = [
  ['1 Mo', 'y1mo'],
  ['3 Mo', 'y3mo'],
  ['6 Mo', 'y6mo'],
  ['1 Yr', 'y1yr'],
  ['2 Yr', 'y2yr'],
  ['5 Yr', 'y5yr'],
  ['10 Yr', 'y10yr'],
  ['30 Yr', 'y30yr'],
];

function splitCsvLine(line: string): string[] {
  // Every field in this particular CSV is a plain date or number — no
  // quoting, no embedded commas — so a straight split is exact, not a
  // simplification of a general CSV parser.
  return line.split(',').map((cell) => cell.trim());
}

/** `9/5/2026` → `2026-09-05`. Treasury's CSV dates are US month/day/year,
 *  not zero-padded. */
function treasuryDateToIso(cell: string | undefined): string | undefined {
  if (typeof cell !== 'string') return undefined;
  const m = cell.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** Parses Treasury.gov's daily par-yield-curve CSV export. */
export function parseTreasuryYieldCsv(csv: string): MacroYieldPoint[] {
  const lines = csv
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  const dateCol = header.indexOf('Date');
  if (dateCol === -1) return [];

  const points: MacroYieldPoint[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const date = treasuryDateToIso(cells[dateCol]);
    if (!date) continue;

    const point: MacroYieldPoint = { date };
    for (const [label, key] of TREASURY_COLUMNS) {
      const idx = header.indexOf(label);
      if (idx === -1) continue;
      const value = toNum(cells[idx]);
      if (value !== undefined) point[key] = value;
    }
    points.push(point);
  }
  // Treasury lists newest first; this page reads oldest-to-newest throughout.
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

function addCalendarDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** The earliest meeting date on or after `today` — the "next" FOMC meeting,
 *  computed at build time rather than stored, the same way `daysToEarnings`
 *  is (`MOD-28`): "next" is only true on the day it was worked out. */
export function nextMeetingDate(dates: string[], today: string): string | undefined {
  return [...dates].sort().find((d) => d >= today);
}

/** Past meeting dates, most recent first — what the bond-reaction table
 *  walks over. */
export function pastMeetingDates(dates: string[], today: string): string[] {
  return [...dates]
    .filter((d) => d < today)
    .sort((a, b) => b.localeCompare(a));
}

/** Renders a macro value for its declared unit. `% YoY` and `%` get a signed
 *  percentage; `thousands, MoM` gets a signed "k" count (the number a jobs
 *  report headline actually leads with); anything else is a plain number
 *  with its unit appended. Missing is the em dash, never a zero (`SYS-7`). */
export function formatMacroValue(value: number | undefined, unit: string | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (unit?.includes('%')) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }
  if (unit?.startsWith('thousands')) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${Math.round(value).toLocaleString()}k`;
  }
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit ? `${formatted} ${unit}` : formatted;
}

export interface YieldReaction {
  eventDate: string;
  before2yr?: number;
  after2yr?: number;
  change2yr?: number;
  before10yr?: number;
  after10yr?: number;
  change10yr?: number;
}

/** The 2yr/10yr Treasury yield just before a date, and just after it, found
 *  by walking sorted dates rather than a fixed array offset (MAC-9) — a
 *  weekend or holiday means "N days later" is not a fixed number of rows.
 *  Either side renders undefined, not a change against a wrong or absent
 *  value, when the series does not cover it (MAC-10, SYS-7). */
export function yieldReactionAround(
  points: MacroYieldPoint[],
  eventDate: string,
  afterDays: number,
): YieldReaction {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let before: MacroYieldPoint | undefined;
  for (const p of sorted) {
    if (p.date > eventDate) break;
    before = p;
  }
  const afterThreshold = addCalendarDays(eventDate, afterDays);
  const after = sorted.find((p) => p.date >= afterThreshold);

  const change = (a: number | undefined, b: number | undefined): number | undefined =>
    a !== undefined && b !== undefined ? b - a : undefined;

  return {
    eventDate,
    before2yr: before?.y2yr,
    after2yr: after?.y2yr,
    change2yr: change(before?.y2yr, after?.y2yr),
    before10yr: before?.y10yr,
    after10yr: after?.y10yr,
    change10yr: change(before?.y10yr, after?.y10yr),
  };
}
