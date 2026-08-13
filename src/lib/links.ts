/** Links off the dashboard.
 *
 *  This site is a screen, not a terminal. It holds no news, no filings, no
 *  charts and no intraday data — those are all excluded by the no-backend
 *  design rather than merely unbuilt — so the honest response to "why did this
 *  move today" is a link to somewhere that can answer it, not a worse version
 *  of that answer rendered here (`UI-44`).
 *
 *  Symbols are mapped rather than pasted. Exchanges, data vendors and quote
 *  sites all spell class shares differently: `BRK.B` here, `BRK-B` on Yahoo,
 *  `BRK/B` elsewhere. Nothing in the current lists needs the mapping, which is
 *  precisely why it is written down now — the first time a ticker with a dot is
 *  added, a link built by string concatenation would 404 silently and nobody
 *  would notice until they clicked it. */

const QUOTE_BASE = 'https://finance.yahoo.com/quote/';

/** Yahoo's symbol spelling: upper case, and a dot separating a share class
 *  becomes a hyphen. Anything that is not a plausible symbol yields no link at
 *  all — a broken link is worse than none (`UI-42`). */
export function toQuoteSymbol(ticker: string | undefined): string | undefined {
  if (typeof ticker !== 'string') return undefined;
  const symbol = ticker.trim().toUpperCase().replace(/\./g, '-');
  if (!/^[A-Z0-9-]{1,10}$/.test(symbol)) return undefined;
  return symbol;
}

/** External quote page for a ticker, or undefined if the symbol is unusable. */
export function quoteUrl(ticker: string | undefined): string | undefined {
  const symbol = toQuoteSymbol(ticker);
  return symbol === undefined ? undefined : `${QUOTE_BASE}${encodeURIComponent(symbol)}`;
}

/** Where the link goes, for the label that says so out loud. */
export const QUOTE_PROVIDER = 'Yahoo Finance';
