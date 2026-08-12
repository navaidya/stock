/** Long-term issuer credit ratings.
 *
 *  Ratings are strings that must sort by credit quality, not alphabetically:
 *  `AA-` is stronger than `BBB`, and `A` is stronger than both, which no string
 *  comparison will ever tell you (MOD-20). So every recognised rating maps to a
 *  single ordinal — 1 is the strongest — and the sort uses that.
 *
 *  Both notations are accepted because the two scales are the same scale with
 *  different spelling: S&P and Fitch write `AA-`, Moody's writes `Aa3`, and a
 *  reader who curated one file from two agencies' websites should not have to
 *  translate. An unrecognised string is not coerced to the nearest match — it
 *  is dropped, because a guessed rating is worse than no rating (MOD-19). */

/** Strongest to weakest. Index + 1 is the rank; paired entries are the same
 *  notch in the two notations. `NR` is deliberately absent: "not rated" is a
 *  missing value, not a low one. */
const SCALE: string[][] = [
  ['AAA', 'Aaa'],
  ['AA+', 'Aa1'],
  ['AA', 'Aa2'],
  ['AA-', 'Aa3'],
  ['A+', 'A1'],
  ['A', 'A2'],
  ['A-', 'A3'],
  ['BBB+', 'Baa1'],
  ['BBB', 'Baa2'],
  ['BBB-', 'Baa3'],
  ['BB+', 'Ba1'],
  ['BB', 'Ba2'],
  ['BB-', 'Ba3'],
  ['B+', 'B1'],
  ['B', 'B2'],
  ['B-', 'B3'],
  ['CCC+', 'Caa1'],
  ['CCC', 'Caa2'],
  ['CCC-', 'Caa3'],
  ['CC', 'Ca'],
  ['C', 'C'],
  ['D', 'RD'],
];

const RANKS = new Map<string, number>();
SCALE.forEach((notations, i) => {
  for (const notation of notations) RANKS.set(notation.toUpperCase(), i + 1);
});

/** Everything at or above this rank is investment grade — the `BBB-`/`Baa3`
 *  line, which is the one distinction in the whole scale that changes who is
 *  allowed to hold the debt. */
export const INVESTMENT_GRADE_FLOOR = RANKS.get('BBB-') as number;

/** The rating in its canonical S&P/Fitch spelling, or undefined if it is not on
 *  the scale. Whitespace and case are forgiving; everything else is not. */
export function normalizeRating(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const key = value.trim().toUpperCase();
  const rank = RANKS.get(key);
  if (rank === undefined) return undefined;
  return SCALE[rank - 1][0];
}

/** Ordinal for sorting: 1 is `AAA`, higher is weaker credit. Undefined for
 *  anything not on the scale, so it sorts as missing rather than as junk. */
export function ratingRank(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  return RANKS.get(value.trim().toUpperCase());
}

export function isInvestmentGrade(value: unknown): boolean | undefined {
  const rank = ratingRank(value);
  return rank === undefined ? undefined : rank <= INVESTMENT_GRADE_FLOOR;
}
