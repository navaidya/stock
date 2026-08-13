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
