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

  // Income
  dividendYield?: number;
  payoutRatio?: number;
  dividendGrowth5Y?: number;
  fcfYield?: number;

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

export interface UniverseEntry {
  ticker: string;
  name: string;
  segment: string;
  why?: string;
}
