/** Column glossary — the content behind `/faq`.
 *
 *  A column header has room for about eight characters, which is never enough
 *  to say what a number is, and `title` text does not exist on a touch screen —
 *  where this dashboard is mostly read. So every label links here.
 *
 *  Each entry answers three things in order: what the number is, why it earns a
 *  column, and how it misleads. The third is the one worth writing. A metric
 *  that cannot mislead does not need explaining, and every metric on this
 *  dashboard can mislead — a low P/E on a collapsing business, a high yield
 *  paid for by the balance sheet, a growth rate off a quarter that flattered
 *  itself.
 *
 *  Nothing here says whether a number is good (`SYS-5`). "Below 1 means the
 *  company owes more in the next year than it holds in current assets" is a
 *  fact about the metric. "Below 1 is a red flag, avoid" would be advice.
 *
 *  Keyed by column key, and checked against the column sets in both directions
 *  (`UI-29`): a column with no entry fails the build, and so does an entry for
 *  a column that no longer exists. */

export interface GlossaryEntry {
  /** The full name the abbreviation stands for. */
  term: string;
  group: string;
  /** What the number is, in plain words. */
  what: string;
  /** Why it is on the dashboard, and how to read it. */
  why: string;
  /** The way it misleads. */
  watch?: string;
}

export const GROUPS = [
  'Identity and price',
  'Valuation',
  'Growth',
  'Quality',
  'Financial health and credit',
  'Backlog',
  'Income',
  'Classification',
] as const;

export const glossary: Record<string, GlossaryEntry> = {
  ticker: {
    term: 'Ticker symbol',
    group: 'Identity and price',
    what: 'The symbol the company trades under on its listed exchange.',
    why: 'The key everything else on the row is collected against.',
    watch:
      'ADRs — TSM, ASML — are receipts for shares listed elsewhere. Their figures are converted, and their local listing can move overnight while the ADR is closed.',
  },
  price: {
    term: 'Last price',
    group: 'Identity and price',
    what: 'The last trade price at the moment data was collected.',
    why: 'The anchor for every ratio on the row: each valuation multiple is this number over something.',
    watch:
      'It is a snapshot, not a live quote. Collection runs a few times a day, so during market hours this is minutes-to-hours old — the age is stated at the top of every page.',
  },
  changePct1D: {
    term: 'One-day change',
    group: 'Identity and price',
    what: 'Percent change from the previous session close to the collected price.',
    why: 'The fastest read on whether something happened today worth reading about.',
    watch:
      'A single day is mostly noise. It is here to prompt a question, not to answer one.',
  },
  priceReturn52W: {
    term: '52-week price return',
    group: 'Identity and price',
    what: 'Percent change in the share price over the last 52 weeks.',
    why: 'The trailing return, which puts a single day in proportion.',
    watch:
      'Price only — dividends are excluded, so a high payer looks worse here than a shareholder actually did. It also depends entirely on where the window starts.',
  },
  pctOff52WeekHigh: {
    term: 'Percent off the 52-week high',
    group: 'Identity and price',
    what: 'How far below the highest price of the last 52 weeks the current price sits. Always zero or negative; zero means at the high.',
    why: 'The drawdown from peak, which is a different question from the trailing return — a name can be up 40% over a year and still be 30% off its high.',
    watch:
      'It says nothing about value. A stock can be 60% off its high and still expensive, and sitting at its high is not by itself a reason for anything.',
  },
  marketCap: {
    term: 'Market capitalisation',
    group: 'Identity and price',
    what: 'Share price times shares outstanding — what the equity is priced at in total.',
    why: 'The scale of the company, and the denominator that makes a headline number meaningful. A $10B contract means different things at $50B and at $3T.',
    watch:
      'It is the equity only. A heavily indebted company is being bought for more than its market cap, which is what enterprise value counts instead.',
  },

  earningsDate: {
    term: 'Next scheduled earnings date',
    group: 'Identity and price',
    what: 'The date the company is next expected to report results, with the days remaining as of the last time this page was built. Where the schedule says so, it also notes whether the report lands before the open or after the close.',
    why: 'The one thing on this dashboard that is known in advance. Every other column describes what has already happened; this says when the next thing happens — and most of what moves a position in a given quarter moves it on this date.',
    watch:
      'Dates are estimates until the company confirms them, and they move. The countdown was computed when the page was last built, so if the age stamp at the top says a day old, the countdown is a day stale too. An ETF has no earnings date, and a fund never will.',
  },
  volumeRatio10D3M: {
    term: '10-day average volume over 3-month average volume',
    group: 'Identity and price',
    what: 'Average daily share volume over the last ten trading days, divided by the average over the last three months. 1.00× means the last two weeks traded at the quarter’s normal pace; 1.50× means half again as much.',
    why: 'Attention, measured. Sustained heavy volume says something changed — a guidance revision, a contract, an index event — and it usually shows up here before it shows up in the fundamentals, which are quarterly.',
    watch:
      'This is not intraday relative volume. It cannot tell you that today is busy, only that the last two weeks have been, because the free data tier carries no intraday volume at all. It is also direction-blind: heavy volume accompanies falls as readily as rises, so this column says look, not which way.',
  },
  peTTM: {
    term: 'Price / earnings, trailing twelve months',
    group: 'Valuation',
    what: 'Price divided by the last four quarters of earnings per share.',
    why: 'The most quoted valuation multiple, and a reasonable first comparison between two profitable companies in the same business.',
    watch:
      'Backward-looking, and meaningless where earnings are near zero, negative, or distorted by a one-off — a write-down can send a P/E to 300 with nothing having changed. Two P/Es are only comparable within an industry.',
  },
  forwardPE: {
    term: 'Forward price / earnings',
    group: 'Valuation',
    what: 'Price divided by forecast earnings per share for the coming period.',
    why: 'What the market is paying for the year ahead rather than the year behind. Where growth is fast this is often the only P/E that means anything.',
    watch:
      'Built on analyst estimates, which are opinions, tend to start optimistic, and get revised. Frequently unavailable on the free data tier.',
  },
  pegTTM: {
    term: 'PEG ratio',
    group: 'Valuation',
    what: 'The P/E divided by an earnings growth rate.',
    why: 'Puts a high multiple in the context of the growth being bought — a P/E of 40 reads differently at 10% growth than at 50%.',
    watch:
      'Two uncertain numbers stacked. The growth rate used varies by source, so the same company shows a different PEG in different places, and it is nonsense wherever earnings are negative.',
  },
  psTTM: {
    term: 'Price / sales',
    group: 'Valuation',
    what: 'Market cap divided by trailing twelve-month revenue.',
    why: 'Works where P/E does not — pre-profit, or a year where earnings are distorted. Revenue is the hardest line to manipulate.',
    watch:
      'Ignores whether the revenue makes money. A 70%-margin software company and a 5%-margin distributor cannot be compared on this at all.',
  },
  pbQuarterly: {
    term: 'Price / book value',
    group: 'Valuation',
    what: 'Market cap divided by shareholders equity from the latest balance sheet.',
    why: 'Meaningful where the balance sheet is the business — banks, insurers, asset-heavy industrials.',
    watch:
      'Nearly meaningless for software and pharma, where the value is brands, code and research that accounting never capitalised. A high P/B there is a measure of accounting, not of expensiveness.',
  },
  evToFcf: {
    term: 'Enterprise value / free cash flow',
    group: 'Valuation',
    what: 'Market cap plus net debt, divided by cash generated after capital spending.',
    why: 'The multiple hardest to dress up: it counts debt as part of the price and cash as the return, and free cash flow resists the accounting choices earnings allow.',
    watch:
      'Volatile for companies in a heavy investment cycle. A year of large capex — a data-centre buildout — depresses free cash flow and inflates this ratio without anything having gone wrong.',
  },

  revenueGrowthYoY: {
    term: 'Revenue growth, year over year',
    group: 'Growth',
    what: 'Revenue against the same period a year earlier, as a percentage.',
    why: 'Demand, before any accounting choice touches it. For a company reinvesting everything, this is the number that matters most.',
    watch:
      'Year-ago comparisons flatter and punish arbitrarily: a weak quarter last year makes this year look transformative. Acquisitions show up here as growth that was bought, not built.',
  },
  epsGrowthYoY: {
    term: 'Earnings per share growth, year over year',
    group: 'Growth',
    what: 'Earnings per share against the same period a year earlier.',
    why: 'Per share, so it captures buybacks and dilution — the difference between the company earning more and each share owning more of it.',
    watch:
      'Amplifies everything. A small change in margin becomes a large change in EPS, and growth off a near-zero base produces percentages that mean nothing.',
  },

  grossMargin: {
    term: 'Gross margin',
    group: 'Quality',
    what: 'Revenue minus the direct cost of producing it, as a percentage of revenue.',
    why: 'The cleanest read on pricing power. It moves when a company can charge more or when supply tightens, and it moves before anything else does.',
    watch:
      'Structural by industry — a retailer and a software company are not on the same scale. The direction over several quarters says more than the level.',
  },
  operatingMargin: {
    term: 'Operating margin',
    group: 'Quality',
    what: 'Profit after operating costs — R&D, sales, overhead — as a percentage of revenue.',
    why: 'What is left once the company has paid for running itself. Gross margin shows what it can charge; this shows what it keeps.',
    watch:
      'A company deliberately spending into growth shows a thin operating margin by choice. Low is not automatically weak.',
  },
  roe: {
    term: 'Return on equity',
    group: 'Quality',
    what: 'Net income as a percentage of shareholders equity.',
    why: 'How much profit the business produces on the capital shareholders have in it.',
    watch:
      'Leverage inflates it: borrowing shrinks equity, which raises ROE without the business improving. A very high ROE next to high debt is usually the balance sheet talking. Buybacks do the same thing.',
  },

  debtToEquity: {
    term: 'Debt / equity',
    group: 'Financial health and credit',
    what: 'Total debt divided by shareholders equity.',
    why: 'How much of the company is financed by lenders rather than owners.',
    watch:
      'Not comparable across industries — utilities run high by design, and a company that has bought back a lot of stock can show a startling ratio with a sound balance sheet, because buybacks reduce equity.',
  },
  currentRatio: {
    term: 'Current ratio',
    group: 'Financial health and credit',
    what: 'Current assets divided by current liabilities.',
    why: 'Whether what the company holds in the near term covers what it owes in the near term.',
    watch:
      'A crude test. It counts inventory that may not sell, and a very high ratio can mean cash sitting idle rather than strength.',
  },
  creditRating: {
    term: 'Long-term issuer credit rating',
    group: 'Financial health and credit',
    what: "A rating agency's stated opinion of the issuer's ability to meet its long-term obligations, from AAA down to D. BBB- and above is investment grade; below that is high yield.",
    why: 'A view of the balance sheet from people paid to be paranoid about it, and a view that has consequences — dropping below investment grade forces some funds to sell and raises the cost of every future borrowing.',
    watch:
      'It rates the debt, not the equity. Agencies are late by design and move in notches long after the market has repriced. This column is hand-curated from public rating actions, not collected — each value carries an as-of date below, and none of the seeded values has been verified against a primary source yet.',
  },

  rpo: {
    term: 'Remaining performance obligation',
    group: 'Backlog',
    what: 'Contracted revenue not yet recognised — work a company is under contract to deliver and has not yet billed as revenue. Reported in the revenue recognition note each quarter.',
    why: 'Forward visibility that revenue does not give. A cloud provider signing multi-year capacity contracts shows the demand in RPO quarters before it reaches the income statement.',
    watch:
      'Contracts, not cash. RPO can be concentrated in a few customers, stretch over many years at an unstated pace, and — depending on the terms — be cancellable. A large number says what has been signed, not what will be collected or when. Most companies do not report it at all, which is why this column is mostly empty; hand-curated, with as-of dates below.',
  },

  dividendYield: {
    term: 'Dividend yield',
    group: 'Income',
    what: 'Indicated annual dividend as a percentage of the current price.',
    why: 'The income the shares pay at what they cost today.',
    watch:
      'It rises when the price falls, so the highest yields on any screen are frequently the companies the market expects to cut. Yield is the output of two numbers, and the one moving is usually the price.',
  },
  payoutRatio: {
    term: 'Payout ratio',
    group: 'Income',
    what: 'The share of earnings paid out as dividends.',
    why: 'The first test of whether a dividend is affordable. Above 100% the company is paying out more than it earned.',
    watch:
      'Measured against earnings, which include non-cash charges. A depreciation-heavy business can show a payout ratio above 100% and cover the dividend comfortably in cash — which is why FCF yield sits next to it.',
  },
  fcfYield: {
    term: 'Free cash flow yield',
    group: 'Income',
    what: 'Free cash flow per share as a percentage of the share price — the inverse of price to free cash flow.',
    why: 'What the business actually generates in cash, against what it costs. A dividend covered by earnings but not by free cash flow is being funded from the balance sheet.',
    watch:
      'Shown only where free cash flow is positive: a company burning cash has no meaningful yield, and the arithmetic would otherwise produce a plausible-looking negative percentage. Heavy investment years depress it without anything being wrong.',
  },
  dividendGrowth5Y: {
    term: 'Five-year dividend growth rate',
    group: 'Income',
    what: 'The annualised rate at which the dividend has grown over five years.',
    why: 'A record of intent. Companies treat their dividend as a promise, so a long record of increases says something about how management sees the payout.',
    watch:
      'Entirely backward-looking. It cannot see the cut that comes next quarter, and a single large increase years ago can carry the whole average.',
  },

  beta: {
    term: 'Beta',
    group: 'Classification',
    what: 'How much the share price has moved relative to the broad market. 1.0 moves with it; 2.0 has moved roughly twice as hard in both directions.',
    why: 'Sets expectations for how a position will feel. Much of the AI list runs well above 1.',
    watch:
      'Backward-looking and unstable — it is measured over a past window and changes as that window moves. It measures volatility, not the chance of being wrong.',
  },
  segment: {
    term: 'AI supply-chain segment',
    group: 'Classification',
    what: 'Where a company sits in the physical AI buildout: compute, foundry, memory, storage, networking, power, cooling.',
    why: 'A hand-maintained classification of business exposure, ordered to follow the supply chain from silicon to the electricity that runs it.',
    watch:
      'It classifies exposure, not quality, and it is not a recommendation list. Exposure also shifts quickly, and a company can straddle two segments while appearing under one.',
  },
};
