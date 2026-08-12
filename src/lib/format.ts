/** Display helpers. Every one must survive undefined, because the free API tier
 *  omits metrics unpredictably and a blank cell is better than a broken page. */

export const EMPTY = '—';

function isNum(v: number | undefined | null): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function num(v: number | undefined, digits = 2): string {
  return isNum(v) ? v.toFixed(digits) : EMPTY;
}

export function pct(v: number | undefined, digits = 1): string {
  return isNum(v) ? `${v.toFixed(digits)}%` : EMPTY;
}

export function money(v: number | undefined): string {
  return isNum(v) ? `$${v.toFixed(2)}` : EMPTY;
}

/** Market cap arrives from Finnhub in millions. */
export function marketCap(millions: number | undefined): string {
  if (!isNum(millions)) return EMPTY;
  const m = millions;
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(2)}T`;
  if (m >= 1_000) return `$${(m / 1_000).toFixed(1)}B`;
  return `$${m.toFixed(0)}M`;
}

/** Sign class for colouring deltas. Never returns a colour for undefined, so a
 *  missing value is not mistaken for flat. */
export function trend(v: number | undefined): 'up' | 'down' | 'flat' | 'none' {
  if (!isNum(v)) return 'none';
  if (v > 0) return 'up';
  if (v < 0) return 'down';
  return 'flat';
}

export function signedPct(v: number | undefined, digits = 2): string {
  if (!isNum(v)) return EMPTY;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}
