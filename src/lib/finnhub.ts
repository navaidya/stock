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

    peTTM: pick(m, 'peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM'),
    forwardPE: pick(m, 'forwardPE', 'peForward'),
    pegTTM: pick(m, 'pegTTM', 'pegRatioTTM'),
    psTTM: pick(m, 'psTTM'),
    pbQuarterly: pick(m, 'pbQuarterly', 'pbAnnual'),
    evToFcf: pick(m, 'currentEv/freeCashFlowTTM', 'currentEv/freeCashFlowAnnual'),

    revenueGrowthYoY: pick(m, 'revenueGrowthTTMYoy', 'revenueGrowthQuarterlyYoy'),
    epsGrowthYoY: pick(m, 'epsGrowthTTMYoy', 'epsGrowthQuarterlyYoy'),

    grossMargin: pick(m, 'grossMarginTTM', 'grossMarginAnnual'),
    operatingMargin: pick(m, 'operatingMarginTTM', 'operatingMarginAnnual'),
    roe: pick(m, 'roeTTM', 'roeRfy'),

    debtToEquity: pick(m, 'totalDebt/totalEquityQuarterly', 'totalDebt/totalEquityAnnual'),
    currentRatio: pick(m, 'currentRatioQuarterly', 'currentRatioAnnual'),

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
  }

  return snapshot;
}
