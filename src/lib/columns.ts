import type { StockSnapshot } from './types.ts';
import {
  EMPTY,
  marketCap,
  money,
  num,
  pct,
  ratio,
  signedPct,
  text,
  trend,
} from './format.ts';
import { shortDate } from './dates.ts';
import { QUOTE_PROVIDER, quoteUrl } from './links.ts';
import { ratingRank } from './rating.ts';

/** Column definitions per page.
 *
 *  Each page gets a different set on purpose: P/E is meaningless for a company
 *  reinvesting everything into growth, and payout ratio is meaningless for one
 *  that pays no dividend. Showing every metric everywhere would bury the few
 *  that matter for that view.
 *
 *  `primary: true` marks the columns that stay visible on a phone. Everything
 *  else moves behind the expand control — a 20-column table is unreadable at
 *  390px, which is the width this dashboard is mostly read at. */

export interface Column {
  /** Also the sort key and the `/faq#col-<key>` anchor. Where it names a
   *  snapshot field — which it does for every column bar the exceptions that
   *  declare `sort` — that field is what the column sorts on. */
  key: string;
  label: string;
  /** Longer explanation shown on hover and in the expanded card. The full
   *  explanation lives in the glossary, which every label links to. */
  help?: string;
  primary?: boolean;
  render: (s: StockSnapshot) => string;
  /** Orderable value, where it differs from the field named by `key`. A credit
   *  rating displays as `AA-` and orders by its position on the scale. */
  sort?: (s: StockSnapshot) => number | string | undefined;
  /** Makes the cell an external link. Returning undefined renders plain text,
   *  so a row with an unusable symbol simply has no link. */
  href?: (s: StockSnapshot) => string | undefined;
  trend?: (s: StockSnapshot) => ReturnType<typeof trend>;
  align?: 'left' | 'right';
}

/** Issuer credit quality, as one agency states it. Shared by the pages that
 *  care about balance sheets: the home view, and the dividend view where a
 *  stretched balance sheet threatens the payout before anything else shows. */
const creditRatingColumn: Column = {
  key: 'creditRating',
  label: 'Credit',
  help: 'Long-term issuer credit rating. Hand-curated and dated — see the FAQ',
  align: 'left',
  render: (s) => text(s.creditRating),
  // Sorts by position on the scale, not alphabetically: ascending puts AAA
  // first and unrated names last.
  sort: (s) => ratingRank(s.creditRating),
};

/** The one thing on this dashboard that is known in advance. Everything else
 *  describes what has already happened; this says when the next thing happens.
 *  Shown as the date plus a countdown, because "24 Feb" needs a mental
 *  subtraction and "3d" does not. */
const earningsColumn: Column = {
  key: 'earningsDate',
  label: 'Earnings',
  help: 'Next scheduled earnings date, with days remaining as of the last build',
  align: 'left',
  render: (s) => {
    const date = shortDate(s.earningsDate);
    if (!date) return EMPTY;
    if (s.daysToEarnings === undefined) return date;
    const away =
      s.daysToEarnings === 0 ? 'today' : s.daysToEarnings === 1 ? 'tomorrow' : `${s.daysToEarnings}d`;
    return `${date} · ${away}`;
  },
  // Sorts on the ISO date, where lexicographic order is chronological order.
  sort: (s) => s.earningsDate,
};

/** Trading activity, two weeks against a quarter. Deliberately not called
 *  "relative volume": that means today against average, which needs intraday
 *  volume the free tier does not carry (MOD-30). */
const volumeColumn: Column = {
  key: 'volumeRatio10D3M',
  label: 'Vol 10D/3M',
  help: '10-day average daily volume over the 3-month average. Above 1 means the last two weeks have been busier than the quarter. Not intraday relative volume',
  render: (s) => ratio(s.volumeRatio10D3M),
};

const identity: Column[] = [
  {
    key: 'ticker',
    label: 'Ticker',
    help: `Opens this symbol on ${QUOTE_PROVIDER} — news, filings and intraday, none of which live here`,
    primary: true,
    align: 'left',
    render: (s) => s.ticker,
    href: (s) => quoteUrl(s.ticker),
  },
  {
    key: 'price',
    label: 'Price',
    primary: true,
    render: (s) => money(s.price),
  },
  {
    key: 'changePct1D',
    label: '1D',
    help: 'Change since the previous close',
    primary: true,
    render: (s) => signedPct(s.changePct1D),
    trend: (s) => trend(s.changePct1D),
  },
  {
    key: 'priceReturn52W',
    label: '52W',
    help: 'Price return over the last 52 weeks',
    render: (s) => signedPct(s.priceReturn52W, 1),
    trend: (s) => trend(s.priceReturn52W),
  },
  {
    key: 'pctOff52WeekHigh',
    label: 'Off high',
    help: 'How far below the 52-week high — the quickest read on whether a name is extended or breaking down',
    primary: true,
    render: (s) => signedPct(s.pctOff52WeekHigh, 1),
    trend: (s) => trend(s.pctOff52WeekHigh),
  },
  {
    key: 'marketCap',
    label: 'Mkt cap',
    render: (s) => marketCap(s.marketCap),
  },
  // Primary on every page: it is the one column that says when to look again.
  { ...earningsColumn, primary: true },
];

/** Home: a balanced view of quality, value, growth and health. */
export const homeColumns: Column[] = [
  ...identity,
  {
    key: 'peTTM',
    label: 'P/E',
    help: 'Price to trailing twelve-month earnings',
    primary: true,
    render: (s) => num(s.peTTM, 1),
  },
  {
    key: 'forwardPE',
    label: 'Fwd P/E',
    help: 'Price to forecast earnings. Often unavailable on the free data tier',
    render: (s) => num(s.forwardPE, 1),
  },
  {
    key: 'pegTTM',
    label: 'PEG',
    help: 'P/E divided by growth. Puts a high P/E in context',
    render: (s) => num(s.pegTTM, 2),
  },
  {
    key: 'psTTM',
    label: 'P/S',
    help: 'Price to sales. Useful when earnings are small or negative',
    render: (s) => num(s.psTTM, 1),
  },
  {
    key: 'pbQuarterly',
    label: 'P/B',
    help: 'Price to book value',
    render: (s) => num(s.pbQuarterly, 1),
  },
  {
    key: 'evToFcf',
    label: 'EV/FCF',
    help: 'Enterprise value to free cash flow. Harder to massage than earnings',
    render: (s) => num(s.evToFcf, 1),
  },
  {
    key: 'revenueGrowthYoY',
    label: 'Rev growth',
    help: 'Revenue growth year over year',
    primary: true,
    render: (s) => pct(s.revenueGrowthYoY),
    trend: (s) => trend(s.revenueGrowthYoY),
  },
  {
    key: 'epsGrowthYoY',
    label: 'EPS growth',
    help: 'Earnings per share growth year over year',
    render: (s) => pct(s.epsGrowthYoY),
    trend: (s) => trend(s.epsGrowthYoY),
  },
  {
    key: 'grossMargin',
    label: 'Gross mgn',
    help: 'The cleanest read on pricing power',
    render: (s) => pct(s.grossMargin),
  },
  {
    key: 'operatingMargin',
    label: 'Op mgn',
    render: (s) => pct(s.operatingMargin),
  },
  {
    key: 'roe',
    label: 'ROE',
    help: 'Return on equity',
    render: (s) => pct(s.roe),
  },
  {
    key: 'debtToEquity',
    label: 'D/E',
    help: 'Total debt to equity',
    render: (s) => num(s.debtToEquity, 2),
  },
  {
    key: 'currentRatio',
    label: 'Current',
    help: 'Current assets to current liabilities. Below 1 is worth a look',
    render: (s) => num(s.currentRatio, 2),
  },
  creditRatingColumn,
  volumeColumn,
  {
    key: 'dividendYield',
    label: 'Yield',
    render: (s) => pct(s.dividendYield, 2),
  },
];

/** AI: these names are often high-multiple or pre-profit, so valuation leans on
 *  sales multiples and the emphasis moves to growth and volatility. */
export const aiColumns: Column[] = [
  ...identity,
  {
    key: 'segment',
    label: 'Segment',
    primary: true,
    align: 'left',
    render: (s) => s.segment ?? EMPTY,
  },
  {
    key: 'revenueGrowthYoY',
    label: 'Rev growth',
    help: 'Revenue growth year over year — the metric that matters most here',
    primary: true,
    render: (s) => pct(s.revenueGrowthYoY),
    trend: (s) => trend(s.revenueGrowthYoY),
  },
  {
    key: 'grossMargin',
    label: 'Gross mgn',
    help: 'Rising gross margin in this segment usually signals tight supply',
    primary: true,
    render: (s) => pct(s.grossMargin),
  },
  {
    key: 'psTTM',
    label: 'P/S',
    help: 'Price to sales. More usable than P/E when earnings are thin',
    render: (s) => num(s.psTTM, 1),
  },
  {
    key: 'peTTM',
    label: 'P/E',
    render: (s) => num(s.peTTM, 1),
  },
  {
    key: 'forwardPE',
    label: 'Fwd P/E',
    render: (s) => num(s.forwardPE, 1),
  },
  {
    key: 'operatingMargin',
    label: 'Op mgn',
    render: (s) => pct(s.operatingMargin),
  },
  {
    key: 'beta',
    label: 'Beta',
    help: 'Volatility relative to the market. These names run hot',
    render: (s) => num(s.beta, 2),
  },
  // The AI buildout is being financed with debt as much as with cash flow, so
  // who is investment grade and who is not is part of reading this page.
  creditRatingColumn,
  volumeColumn,
];

/** Dividends: yield alone is a trap — a high yield usually means the price
 *  fell for a reason. The safety columns matter more than the yield column. */
export const dividendColumns: Column[] = [
  ...identity,
  {
    key: 'dividendYield',
    label: 'Yield',
    help: 'Indicated annual dividend yield',
    primary: true,
    render: (s) => pct(s.dividendYield, 2),
  },
  {
    key: 'payoutRatio',
    label: 'Payout',
    help: 'Share of earnings paid out. Above 100% means paying more than it earns',
    primary: true,
    render: (s) => pct(s.payoutRatio),
  },
  {
    key: 'fcfYield',
    label: 'FCF yield',
    help: 'Free cash flow as a percentage of price. A dividend paid out of earnings but not free cash flow is funded by the balance sheet',
    primary: true,
    render: (s) => pct(s.fcfYield, 2),
  },
  {
    key: 'dividendGrowth5Y',
    label: 'Div growth 5Y',
    help: 'Five-year dividend growth rate',
    render: (s) => pct(s.dividendGrowth5Y),
    trend: (s) => trend(s.dividendGrowth5Y),
  },
  {
    key: 'debtToEquity',
    label: 'D/E',
    help: 'Leverage. A stretched balance sheet threatens the dividend first',
    render: (s) => num(s.debtToEquity, 2),
  },
  creditRatingColumn,
  {
    key: 'peTTM',
    label: 'P/E',
    render: (s) => num(s.peTTM, 1),
  },
  {
    key: 'operatingMargin',
    label: 'Op mgn',
    render: (s) => pct(s.operatingMargin),
  },
];

/** Only names that actually pay something belong on the dividend page. */
export function payingDividend(s: StockSnapshot): boolean {
  return typeof s.dividendYield === 'number' && s.dividendYield > 0;
}
