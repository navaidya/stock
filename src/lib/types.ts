/** One month's sell-side analyst recommendation counts — raw and unweighted,
 *  never combined into a single sentiment number (MOD-34). See
 *  src/lib/finnhub.ts's `latestRecommendation`. */
export interface AnalystRatings {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

/** A single stock's data after normalization. Every metric is optional: the
 *  free Finnhub tier does not return all of them for all symbols, and a missing
 *  metric must render as an em dash rather than break the page. */
export interface StockSnapshot {
  ticker: string;
  name: string;
  sector?: string;
  segment?: string;
  /** ETFs have no meaningful P/E, margins, or ROE — pages must skip those. */
  isEtf?: boolean;

  // Price and context
  price?: number;
  changePct1D?: number;
  weekHigh52?: number;
  weekLow52?: number;
  /** Negative number: how far below the 52-week high, as a percentage. */
  pctOff52WeekHigh?: number;
  priceReturn52W?: number;
  marketCap?: number;
  beta?: number;

  // Calendar and activity — what to look at today, rather than what it is worth
  /** Next scheduled report date, `YYYY-MM-DD`. */
  earningsDate?: string;
  /** `before open`, `after close`, or `during hours`. */
  earningsHour?: string;
  /** Days from the render date to `earningsDate`; 0 on the day itself. */
  daysToEarnings?: number;
  /** Average daily volume over 10 days and 3 months, in millions of shares. */
  avgVolume10D?: number;
  avgVolume3M?: number;
  /** 10-day average volume over the 3-month average. NOT intraday relative
   *  volume, which the data source does not provide. */
  volumeRatio10D3M?: number;

  // Valuation
  peTTM?: number;
  forwardPE?: number;
  pegTTM?: number;
  psTTM?: number;
  pbQuarterly?: number;
  evToFcf?: number;

  // Growth
  revenueGrowthYoY?: number;
  epsGrowthYoY?: number;

  // Quality
  grossMargin?: number;
  operatingMargin?: number;
  roe?: number;

  // Financial health
  debtToEquity?: number;
  currentRatio?: number;
  /** 0–100. A disclosed, deterministic composite of profitability and
   *  balance-sheet stability only — no valuation, growth, momentum or
   *  dividend policy. Undefined for ETFs and for a name with too few of its
   *  five components present (MOD-31, MOD-32). Never a ranking, never advice
   *  about whether to buy (`SYS-5`) — see src/lib/health.ts. */
  healthScore?: number;

  // Income
  dividendYield?: number;
  payoutRatio?: number;
  dividendGrowth5Y?: number;
  fcfYield?: number;

  /** Raw sell-side analyst rating counts for the most recent month Finnhub
   *  has data for — never averaged or weighted into one number, never a
   *  ranking, and undefined for ETFs and for a name with no coverage
   *  (MOD-34, MOD-35). This is third-party data shown as a fact, the same
   *  as a credit rating, and it carries the same caveat obligation a credit
   *  rating does not: analyst ratings are themselves buy/sell
   *  recommendations, so the FAQ must disclose the well-documented biases in
   *  this data before a reader treats a wall of "Buy" as a verdict (MOD-36,
   *  `SYS-5`). */
  analystRatings?: AnalystRatings;

  // Reference: hand-curated, not collected. See data/reference.yaml.
  /** Long-term issuer credit rating, canonical S&P/Fitch spelling. */
  creditRating?: string;
  creditRatingAgency?: string;
  creditRatingAsOf?: string;
  /** Remaining performance obligation, in millions of USD — as marketCap is. */
  rpo?: number;
  rpoAsOf?: string;
  rpoSource?: string;

  /** Non-fatal problems collecting this symbol, surfaced in the UI. */
  errors?: string[];
}

export interface MarketData {
  generatedAt: string;
  /** Symbols that failed entirely, kept so a partial run is visible. */
  failed: string[];
  stocks: Record<string, StockSnapshot>;
}

export interface WatchlistEntry {
  ticker: string;
  name: string;
  sector?: string;
}

/** One ticker's hand-curated reference values. Every field is optional: this
 *  file is filled in as figures are verified, not all at once. */
export interface ReferenceEntry {
  creditRating?: string;
  creditRatingAgency?: string;
  creditRatingAsOf?: string;
  rpo?: number;
  rpoAsOf?: string;
  rpoSource?: string;
}

export interface UniverseEntry {
  ticker: string;
  name: string;
  segment: string;
  why?: string;
}

/** One tracked macro event, as hand-curated in data/macro-events.yaml
 *  (`MAC-1`, `MAC-2`, `MAC-17`). `fredSeries` is `null` for the one event
 *  with no FRED series — FOMC, which carries its own hand-curated
 *  `meetingCalendar` instead. */
export interface MacroEvent {
  id: string;
  label: string;
  agency: string;
  category: string;
  frequency: string;
  fredSeries: string | null;
  derive?: 'yoy' | 'mom_change' | 'level';
  unit?: string;
  sourceUrl: string;
  note?: string;
  /** The single next known release date, read off the issuing agency's own
   *  published schedule — not computed or guessed from the frequency text
   *  (MAC-17). Goes stale after that date passes and needs hand-refreshing
   *  against the source, the same discipline `MOD-24` applies to
   *  reference.yaml. Absent for a series with no fixed announced schedule. */
  nextRelease?: { date: string; asOf: string };
  meetingCalendar?: { asOf: string; dates: string[] };
  /** One-line, plain-English explanation of what the number measures and
   *  which direction means what — descriptive, never a recommendation
   *  (MAC-18, same UI-45/SYS-5 boundary the Health score holds to). Every
   *  event has one. */
  about: string;
}

/** One point in a mirrored macro or Treasury-yield series — see
 *  `src/lib/macro.ts`. */
export interface MacroSeriesPoint {
  date: string;
  value: number;
}

export interface MacroYieldPoint {
  date: string;
  y1mo?: number;
  y3mo?: number;
  y6mo?: number;
  y1yr?: number;
  y2yr?: number;
  y5yr?: number;
  y10yr?: number;
  y30yr?: number;
}

/** `data/macro.json` — mirrored history from FRED and Treasury.gov, the one
 *  deliberate exception to "one snapshot, not a history" (`070-macro-events.md`). */
export interface MacroData {
  generatedAt: string;
  failed: string[];
  series: Record<string, MacroSeriesPoint[]>;
  yields: MacroYieldPoint[];
}
