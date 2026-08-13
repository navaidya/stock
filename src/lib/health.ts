/** Financial Health score.
 *
 *  A single disclosed number summarising profitability and balance-sheet
 *  stability — nothing else. It deliberately excludes valuation, growth,
 *  price momentum, dividend policy and external ratings, so a fundamentally
 *  sound but expensive or unloved company scores the same as a cheap one
 *  (MOD-33). That is what keeps it a description of the business rather than
 *  an opinion about whether now is a good time to buy it (`SYS-5`).
 *
 *  Deterministic and pure: five fixed, published clamp ranges, no judgment
 *  applied at run time beyond the formula written here. The FAQ shows the
 *  reader the same ranges. */

/** Linear map from [min, max] to [0, 100], clamped at both ends. */
function normalize(value: number, min: number, max: number): number {
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Same, for a metric where a *lower* raw value is the healthier one. */
function normalizeInverse(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

export interface HealthInputs {
  grossMargin?: number;
  operatingMargin?: number;
  roe?: number;
  debtToEquity?: number;
  currentRatio?: number;
}

/** Every component with its clamp range, so the range lives in exactly one
 *  place and the FAQ can quote this instead of a second copy. */
export const HEALTH_COMPONENTS = [
  { key: 'grossMargin', min: 0, max: 80, inverse: false, label: 'Gross margin' },
  { key: 'operatingMargin', min: -20, max: 40, inverse: false, label: 'Operating margin' },
  // Capped at 40%: beyond that, ROE usually reflects leverage or buybacks
  // rather than more profitability, and rewarding it would score the same
  // trap our own glossary entry warns readers about (MOD-31).
  { key: 'roe', min: -20, max: 40, inverse: false, label: 'ROE' },
  { key: 'debtToEquity', min: 0, max: 3, inverse: true, label: 'Debt / equity' },
  { key: 'currentRatio', min: 0, max: 2.5, inverse: false, label: 'Current ratio' },
] as const;

/** At least this many of the five components must be present. Fewer than
 *  that and the score would be an average of almost nothing, which reads as
 *  confident while being mostly absence (MOD-32). */
export const MIN_COMPONENTS = 3;

/** 0–100, or undefined when too little went into it. A negative debt/equity
 *  or current ratio — negative equity, effectively — is excluded rather than
 *  scored, because the normalization would otherwise read it as the best
 *  possible value instead of the warning sign it actually is. */
export function computeHealthScore(inputs: HealthInputs): number | undefined {
  const scores: number[] = [];

  for (const { key, min, max, inverse } of HEALTH_COMPONENTS) {
    const raw = inputs[key as keyof HealthInputs];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    if ((key === 'debtToEquity' || key === 'currentRatio') && raw < 0) continue;
    scores.push(inverse ? normalizeInverse(raw, min, max) : normalize(raw, min, max));
  }

  if (scores.length < MIN_COMPONENTS) return undefined;
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round(average);
}
