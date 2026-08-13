import { isoDate } from './dates.ts';
import { computeHealthScore } from './health.ts';
import type { StockSnapshot } from './types.ts';

/** Pure mapping from Finnhub's raw responses to our snapshot shape.
 *
 *  Kept free of network calls so it can be unit-tested against fixtures — per
 *  CLAUDE.md, cloud sessions have no API key and must still be able to run the
 *  full test suite.
 *
 *  Finnhub key names are inconsistent across symbols and have changed over
 *  time, so every field is looked up through a list of candidates and falls
 *  back to undefined rather than throwing. */

export interface FinnhubQuote {
  c?: number; // current price
  dp?: number; // percent change today
}

export interface FinnhubProfile {
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number; // in millions
}

export interface FinnhubMetricResponse {
  metric?: Record<string, unknown>;
}

export interface FinnhubEarningsResponse {
  earningsCalendar?: Array<{
    date?: string;
    hour?: string;
    quarter?: number;
    year?: number;
  }>;
}

/** Milliseconds to wait after finishing one symbol, given how many calls that
 *  symbol cost. The free tier allows 60 calls a minute, and the calls for a
 *  symbol are issued in parallel — so the budget is spent per symbol, not per
 *  request, and the gap has to cover all of them (COL-3). */
export const MS_PER_CALL = 1100;

export function symbolDelayMs(callsPerSymbol: number): number {
  const calls = Number.isFinite(callsPerSymbol) && callsPerSymbol > 0 ? callsPerSymbol : 1;
  return Math.ceil(calls) * MS_PER_CALL;
}

/** Finnhub's three codes for when in the trading day a company reports. Spelled
 *  out because `bmo` on a dashboard is one more thing to look up. */
const EARNINGS_HOURS: Record<string, string> = {
  bmo: 'before open',
  amc: 'after close',
  dmh: 'during hours',
};

/** The next scheduled report on or after `today`, or the earliest future-dated
 *  entry when no reference date is given. The calendar is queried with a
 *  forward window, but a past date arriving anyway must not be shown as the
 *  next one — "reports tomorrow" and "reported last month" are opposite
 *  readings of the same cell (MOD-26). */
export function nextEarnings(
  earnings: FinnhubEarningsResponse | undefined,
  today?: string,
): { date?: string; hour?: string } {
  // isoDate rather than a shape check: `2026-13-45` is the right shape and not
  // a date, and a calendar entry that cannot be a day must not become one.
  const from = isoDate(today);
  const entries = (earnings?.earningsCalendar ?? [])
    .map((e) => ({ ...e, date: isoDate(e?.date) }))
    .filter((e): e is { date: string; hour?: string } => e.date !== undefined)
    .filter((e) => (from ? e.date >= from : true))
    .sort((a, b) => a.date.localeCompare(b.date));

  const next = entries[0];
  if (!next) return {};
  return {
    date: next.date,
    hour: EARNINGS_HOURS[String(next.hour).toLowerCase()],
  };
}

/** Coerce to a finite number, or undefined. Finnhub returns null, empty
 *  strings, and occasionally NaN for metrics it has no value for. */
export function toNum(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** First candidate key that yields a finite number. */
export function pick(
  metric: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  if (!metric) return undefined;
  for (const key of keys) {
    const value = toNum(metric[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

export interface MapInput {
  ticker: string;
  name: string;
  sector?: string;
  segment?: string;
  isEtf?: boolean;
  quote?: FinnhubQuote;
  profile?: FinnhubProfile;
  metrics?: FinnhubMetricResponse;
  earnings?: FinnhubEarningsResponse;
  /** Collection date as `YYYY-MM-DD`. Passed in rather than read from a clock,
   *  so the mapping stays pure and testable (MOD-7). */
  today?: string;
}

export function mapToSnapshot(input: MapInput): StockSnapshot {
  const { ticker, quote, profile, metrics } = input;
  const m = metrics?.metric;

  const price = toNum(quote?.c);
  const weekHigh52 = pick(m, '52WeekHigh');

  // Expressed as a negative percentage; 0 means sitting at the high.
  const pctOff52WeekHigh =
    price !== undefined && weekHigh52 !== undefined && weekHigh52 > 0
      ? ((price - weekHigh52) / weekHigh52) * 100
      : undefined;

  // FCF yield is the reciprocal of price-to-FCF-per-share. Guard against a
  // zero or negative denominator: a company burning cash has no meaningful
  // yield, and 1/negative would render as a plausible-looking negative number.
  const pfcfShare = pick(m, 'pfcfShareTTM');
  const fcfYield =
    pfcfShare !== undefined && pfcfShare > 0 ? (1 / pfcfShare) * 100 : undefined;

  // Trading activity over the last two weeks against the last quarter. Not
  // intraday relative volume — the free tier has no intraday volume at all, and
  // this must never be presented as though it did (MOD-30).
  const avgVolume10D = pick(m, '10DayAverageTradingVolume');
  const avgVolume3M = pick(m, '3MonthAverageTradingVolume');
  const volumeRatio10D3M =
    avgVolume10D !== undefined && avgVolume3M !== undefined && avgVolume3M > 0
      ? avgVolume10D / avgVolume3M
      : undefined;

  const earnings = nextEarnings(input.earnings, input.today);

  const grossMargin = pick(m, 'grossMarginTTM', 'grossMarginAnnual');
  const operatingMargin = pick(m, 'operatingMarginTTM', 'operatingMarginAnnual');
  const roe = pick(m, 'roeTTM', 'roeRfy');
  const debtToEquity = pick(m, 'totalDebt/totalEquityQuarterly', 'totalDebt/totalEquityAnnual');
  const currentRatio = pick(m, 'currentRatioQuarterly', 'currentRatioAnnual');
  const healthScore = input.isEtf
    ? undefined
    : computeHealthScore({ grossMargin, operatingMargin, roe, debtToEquity, currentRatio });

  const snapshot: StockSnapshot = {
    ticker,
    name: input.name || profile?.name || ticker,
    sector: input.sector ?? profile?.finnhubIndustry,
    segment: input.segment,
    isEtf: input.isEtf,

    price,
    changePct1D: toNum(quote?.dp),
    weekHigh52,
    weekLow52: pick(m, '52WeekLow'),
    pctOff52WeekHigh,
    priceReturn52W: pick(m, '52WeekPriceReturnDaily'),
    marketCap: toNum(profile?.marketCapitalization),
    beta: pick(m, 'beta'),

    avgVolume10D,
    avgVolume3M,
    volumeRatio10D3M,
    earningsDate: earnings.date,
    earningsHour: earnings.hour,

    peTTM: pick(m, 'peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM'),
    forwardPE: pick(m, 'forwardPE', 'peForward'),
    pegTTM: pick(m, 'pegTTM', 'pegRatioTTM'),
    psTTM: pick(m, 'psTTM'),
    pbQuarterly: pick(m, 'pbQuarterly', 'pbAnnual'),
    evToFcf: pick(m, 'currentEv/freeCashFlowTTM', 'currentEv/freeCashFlowAnnual'),

    revenueGrowthYoY: pick(m, 'revenueGrowthTTMYoy', 'revenueGrowthQuarterlyYoy'),
    epsGrowthYoY: pick(m, 'epsGrowthTTMYoy', 'epsGrowthQuarterlyYoy'),

    grossMargin,
    operatingMargin,
    roe,

    debtToEquity,
    currentRatio,
    healthScore,

    dividendYield: pick(m, 'dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'),
    payoutRatio: pick(m, 'payoutRatioTTM', 'payoutRatioAnnual'),
    dividendGrowth5Y: pick(m, 'dividendGrowthRate5Y'),
    fcfYield,
  };

  // ETFs report a handful of these as nonsense rather than omitting them.
  // Strip the ones that cannot apply so the UI shows an em dash instead of a
  // number a reader might act on.
  if (input.isEtf) {
    delete snapshot.peTTM;
    delete snapshot.forwardPE;
    delete snapshot.pegTTM;
    delete snapshot.psTTM;
    delete snapshot.grossMargin;
    delete snapshot.operatingMargin;
    delete snapshot.roe;
    delete snapshot.revenueGrowthYoY;
    delete snapshot.epsGrowthYoY;
    delete snapshot.debtToEquity;
    delete snapshot.currentRatio;
    delete snapshot.evToFcf;
    delete snapshot.fcfYield;
    // A fund does not report earnings. Its holdings do.
    delete snapshot.earningsDate;
    delete snapshot.earningsHour;
  }

  return snapshot;
}
