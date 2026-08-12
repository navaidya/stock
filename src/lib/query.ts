/** The filter box.
 *
 *  Thirty rows and twenty-five columns is past the size where scanning works,
 *  and the question a reader actually arrives with is usually a filter rather
 *  than a sort: "which of these report this week", "which are off more than 30%
 *  and still profitable". Sorting answers one column at a time; this answers
 *  several at once.
 *
 *  The grammar is deliberately tiny — comparisons and bare words, ANDed:
 *
 *      pe < 25 yield > 2          cheap-ish and paying something
 *      earnings <= 7              reports within the week
 *      off high < -30 semis       drawdown, in one sector
 *      vol > 1.5                  trading heavier than its own quarter
 *
 *  Two properties matter more than the grammar. **A missing value never matches
 *  a comparison** (`UI-35`): `pe < 25` asks for companies with a low P/E, and a
 *  company the API returned no P/E for is not one of them — an em dash is not a
 *  small number, the same rule the sort follows. And **a query that does not
 *  parse filters nothing** (`UI-36`): an empty table is what "nothing qualifies"
 *  looks like, so a typo must never be able to produce one silently. */

import type { StockSnapshot } from './types.ts';

export type Operator = '<' | '<=' | '>' | '>=' | '=';

export interface Comparison {
  field: string;
  op: Operator;
  value: number;
}

export interface Query {
  /** Bare words, matched against ticker, name, sector and segment. */
  terms: string[];
  comparisons: Comparison[];
  /** Clauses that looked like comparisons and did not parse. */
  errors: string[];
}

/** Short names for the fields worth typing. The canonical snapshot key always
 *  works too, so anything in the FAQ is filterable whether or not it is here. */
const ALIASES: Record<string, keyof StockSnapshot> = {
  pe: 'peTTM',
  pettm: 'peTTM',
  fwdpe: 'forwardPE',
  peg: 'pegTTM',
  ps: 'psTTM',
  pb: 'pbQuarterly',
  evfcf: 'evToFcf',
  price: 'price',
  cap: 'marketCap',
  mktcap: 'marketCap',
  day: 'changePct1D',
  '1d': 'changePct1D',
  '52w': 'priceReturn52W',
  offhigh: 'pctOff52WeekHigh',
  off: 'pctOff52WeekHigh',
  growth: 'revenueGrowthYoY',
  rev: 'revenueGrowthYoY',
  eps: 'epsGrowthYoY',
  margin: 'grossMargin',
  gross: 'grossMargin',
  op: 'operatingMargin',
  roe: 'roe',
  de: 'debtToEquity',
  debt: 'debtToEquity',
  current: 'currentRatio',
  yield: 'dividendYield',
  payout: 'payoutRatio',
  fcf: 'fcfYield',
  divgrowth: 'dividendGrowth5Y',
  beta: 'beta',
  rpo: 'rpo',
  vol: 'volumeRatio10D3M',
  volume: 'volumeRatio10D3M',
  earnings: 'daysToEarnings',
  days: 'daysToEarnings',
};

/** `off high` and `mkt cap` read better than `offhigh`, so spaces inside a
 *  field name are dropped before lookup. */
function resolveField(raw: string): string | undefined {
  const key = raw.replace(/[\s_-]+/g, '').toLowerCase();
  if (key in ALIASES) return ALIASES[key];
  return CANONICAL.get(key);
}

/** Every snapshot field, by lowercased name, so `pctOff52WeekHigh` and
 *  `pctoff52weekhigh` both resolve without maintaining a second list. */
const CANONICAL = new Map<string, string>(
  (
    [
      'ticker', 'name', 'sector', 'segment', 'price', 'changePct1D', 'weekHigh52',
      'weekLow52', 'pctOff52WeekHigh', 'priceReturn52W', 'marketCap', 'beta',
      'earningsDate', 'daysToEarnings', 'avgVolume10D', 'avgVolume3M',
      'volumeRatio10D3M', 'peTTM', 'forwardPE', 'pegTTM', 'psTTM', 'pbQuarterly',
      'evToFcf', 'revenueGrowthYoY', 'epsGrowthYoY', 'grossMargin',
      'operatingMargin', 'roe', 'debtToEquity', 'currentRatio', 'dividendYield',
      'payoutRatio', 'dividendGrowth5Y', 'fcfYield', 'rpo', 'creditRating',
    ] as const
  ).map((key) => [key.toLowerCase(), key]),
);

/** A comparison clause: a field name, an operator, a number. The field may
 *  contain spaces, so the operator is what splits the clause. */
const COMPARISON = /([a-z0-9 _-]+?)\s*(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*%?/gi;

export function parseQuery(input: string): Query {
  const query: Query = { terms: [], comparisons: [], errors: [] };
  if (!input || !input.trim()) return query;

  let rest = input;
  for (const match of input.matchAll(COMPARISON)) {
    const [clause, rawField, op, rawValue] = match;
    rest = rest.replace(clause, ' ');

    // A field name may contain spaces (`off high`), and so may the text term
    // sitting in front of one (`telecom pe < 25`). The operator is what splits
    // the clause, so the words before it are ambiguous — resolve the longest
    // suffix that is a real field and hand the rest back as search terms.
    const words = rawField.trim().split(/\s+/).filter(Boolean);
    let field: string | undefined;
    let consumed = 0;
    for (let take = words.length; take > 0; take--) {
      const candidate = resolveField(words.slice(words.length - take).join(' '));
      if (candidate !== undefined) {
        field = candidate;
        consumed = take;
        break;
      }
    }

    const value = Number(rawValue);
    if (field === undefined || !Number.isFinite(value)) {
      query.errors.push(clause.trim());
      continue;
    }
    rest += ' ' + words.slice(0, words.length - consumed).join(' ');
    query.comparisons.push({ field, op: op as Operator, value });
  }

  query.terms = rest
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);

  return query;
}

function compare(value: number, op: Operator, target: number): boolean {
  switch (op) {
    case '<':
      return value < target;
    case '<=':
      return value <= target;
    case '>':
      return value > target;
    case '>=':
      return value >= target;
    case '=':
      // Tolerance rather than equality: the stored values are full-precision
      // and the reader is typing what they saw rendered to one or two places.
      return Math.abs(value - target) < 0.005;
  }
}

export function matches(snapshot: StockSnapshot, query: Query): boolean {
  const row = snapshot as unknown as Record<string, unknown>;

  for (const { field, op, value } of query.comparisons) {
    const actual = row[field];
    // Missing never matches, in either direction (UI-35).
    if (typeof actual !== 'number' || !Number.isFinite(actual)) return false;
    if (!compare(actual, op, value)) return false;
  }

  for (const term of query.terms) {
    const haystack = [snapshot.ticker, snapshot.name, snapshot.sector, snapshot.segment]
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  return true;
}

/** Row-by-row verdicts, in input order. A query with nothing parseable in it
 *  keeps every row: filtering to nothing on a typo is the failure this whole
 *  function exists to avoid (UI-36). */
export function filterRows(rows: StockSnapshot[], input: string): boolean[] {
  const query = parseQuery(input);
  if (query.comparisons.length === 0 && query.terms.length === 0) {
    return rows.map(() => true);
  }
  return rows.map((row) => matches(row, query));
}
