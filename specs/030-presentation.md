# 030 — Presentation

**Prefix:** `UI` · **Status:** active · **Implements:** `SYS-3`, `SYS-5`, `SYS-7`

Owns the pages, what each one shows and why, the responsive behaviour, and the
empty states.

**Implementation:** [src/pages/](../src/pages/),
[src/components/StockTable.astro](../src/components/StockTable.astro),
[src/layouts/Base.astro](../src/layouts/Base.astro),
[src/lib/columns.ts](../src/lib/columns.ts),
[src/lib/sort.ts](../src/lib/sort.ts),
[src/lib/glossary.ts](../src/lib/glossary.ts)

---

## Context

This dashboard is read on a phone, at 390px, usually outside market hours. That
single fact drives the layout: a twenty-column table cannot be made legible at
that width by CSS alone, so there are two markups rather than one responsive
table, and each page has to decide which five metrics are worth seeing before a
tap.

The pages differ in their columns on purpose. P/E is meaningless for a company
reinvesting everything into growth; payout ratio is meaningless for a company
that pays no dividend. Showing every metric on every page would bury the few
that matter for the question that page answers.

Two consequences of the column set being wide follow from that same fact.
**Sorting** is how a twenty-column table becomes answerable — "which of these is
furthest off its high" is a question about one column, and it is a fair question
because it names its metric (`UI-9`). Sorting is client-side and additive: the
prerendered order is meaningful on its own, so the page is complete before any
script runs. **A glossary** is the other consequence: a label short enough to fit
a column header is rarely self-explanatory, and `title` text does not exist on a
phone, so every label links to a page that says what the number is and how it
misleads.

## Requirements

### Pages

- **UI-1** `MUST` `build` — Four static pages: `/` (watchlist), `/ai` (AI
  exposure), `/dividends`, `/faq`. All are prerendered; none fetches at runtime.
- **UI-2** `MUST` `build` — Every page builds and renders with no
  `data/market.json` present, showing rows with empty metrics (see `MOD-15`).
- **UI-8** `MUST` `build` — Every page displays the data's age, derived from
  `generatedAt`, including the "never collected" case. The reader must always
  be able to tell how old the numbers are (`SYS-3`).

### Column sets

- **UI-10** `MUST` `manual` — Each page defines its own column set. Home is a
  balanced value/growth/quality/health view; AI leads on revenue growth, gross
  margin and sales multiples because those names are often high-multiple or
  pre-profit; dividends leads on payout ratio and FCF yield because yield alone
  is a trap — a high yield usually means the price fell for a reason.
- **UI-11** `MUST` `manual` — Every column marked `primary` must be meaningful
  without its neighbours, since primary columns are read alone on a phone.
- **UI-12** `SHOULD` `manual` — A column whose meaning is not obvious from its
  label carries `help` text, surfaced on hover and in the expanded card.

### Sorting

- **UI-21** `MUST` `test` — Every column on every page can be sorted ascending
  and descending by its own value.
- **UI-22** `MUST` `test` — Rows with a missing value sort last in **both**
  directions. An em dash is not a small number, and must never take the top of
  a column sorted ascending.
- **UI-23** `MUST` `test` — Sorting is stable: rows holding equal values keep
  their existing relative order, so a second sort does not scramble the first.
- **UI-24** `MUST` `test` — A column sorts on the snapshot field named by its
  key, or on an explicit `sort` accessor where one is declared — never on the
  rendered string. `$1.20T` must order above `$900M`, and `AA-` above `BBB`.
- **UI-25** `MUST` `manual` — Each column header carries an up and a down arrow
  control. The active one is visually distinct, and the sorted header reports
  `aria-sort` as `ascending` or `descending`.
- **UI-26** `MUST` `manual` — The card layout carries an equivalent sort control
  — a column selector plus the same two arrows — because it has no headers to
  put arrows on. Sorting a card list reorders it identically to the table.
- **UI-27** `MUST` `manual` — Sorting is client-side and progressive. With no
  JavaScript the page renders in its prerendered order, which is meaningful on
  its own, and no control is left in a broken state.

### Filtering

- **UI-34** `MUST` `test` — The filter accepts `field op value` comparisons over
  any numeric column, and bare words matching ticker, name, sector or segment.
  Several clauses in one query are ANDed.
- **UI-35** `MUST` `test` — A row whose value for a compared field is missing
  never matches that comparison, in either direction. `pe < 25` must not match
  a company the API had no P/E for (`SYS-7`).
- **UI-36** `MUST` `test` — An unparseable clause filters nothing out and is
  reported. A typo must never silently produce an empty table, which reads
  identically to "nothing qualifies".
- **UI-37** `MUST` `manual` — Filtering is client-side and progressive: with no
  JavaScript the control is hidden and every row renders.
- **UI-38** `MUST` `manual` — The control states how many rows of how many are
  showing, so a filter is never invisible.
- **UI-39** `MUST` `manual` — Filtering and sorting compose: filtering hides
  rows from the current order rather than resetting it.

### Column glossary

- **UI-28** `MUST` `build` — `/faq` documents every column that any page shows,
  each under a stable `#col-<key>` anchor.
- **UI-29** `MUST` `test` — Every column key used by any page has a glossary
  entry, and every glossary entry is used by at least one column. A column with
  no explanation, and an explanation of a column that no longer exists, are both
  failures.
- **UI-30** `MUST` `manual` — Every column label, in the table header and in the
  expanded card, links to its `/faq` entry.
- **UI-31** `MUST` `manual` — The FAQ states where the data comes from, how
  often it refreshes, what an em dash means, that hand-curated reference values
  carry an as-of date, and that nothing on the site is advice (`SYS-5`).

### Daily-read columns

Most columns answer "what is this worth", which changes slowly. These two answer
"what should I look at today", and earn their place on that basis alone.

- **UI-32** `MUST` `manual` — The next earnings date is a primary column on the
  home page, showing the date and the days remaining. It is the single event
  most likely to move a position this week, and it is knowable in advance.
- **UI-33** `MUST` `manual` — The volume column is labelled as a 10-day average
  against a 3-month average, and the FAQ says plainly that it is not intraday
  relative volume (`MOD-30`).

### Leaving the dashboard

- **UI-42** `MUST` `test` — Every ticker links to an external quote page for that
  symbol. The symbol is mapped to the destination's convention rather than
  pasted in — a class share written `BRK.B` here is `BRK-B` there, and a link
  that 404s is worse than no link.
- **UI-43** `MUST` `manual` — The link opens in a new tab with
  `rel="noopener noreferrer"`, is visually distinguishable from plain text, and
  on the card layout does not also toggle the card open.
- **UI-44** `MUST` `manual` — The destination is stated, not disguised. This
  dashboard is a screen, not a terminal: it deliberately holds no news, filings,
  charts or intraday data, and the link is the acknowledgement of that boundary
  rather than an attempt to paper over it.

### Responsive behaviour

- **UI-3** `MUST` `manual` — Below 768px the card layout is shown and the table
  is hidden; at 768px and above the reverse. Exactly one is ever displayed.
- **UI-4** `MUST` `manual` — On the card layout, the ticker, company name and
  every `primary` column are visible without expanding. Non-primary columns are
  behind the expand control.
- **UI-13** `MUST` `manual` — The desktop table scrolls horizontally inside its
  own container. The page body never scrolls horizontally.
- **UI-14** `SHOULD` `manual` — Numeric columns use tabular figures and are
  right-aligned, so magnitudes line up down a column.

### Values and empty states

- **UI-15** `MUST` `manual` — A missing metric renders as an em dash. No cell
  ever shows `0`, `NaN`, `null`, or an empty string for absent data (`MOD-11`).
- **UI-16** `MUST` `manual` — A value's colour encodes direction only for
  values that have one. A missing value is never coloured as flat (`MOD-13`).
- **UI-17** `MUST` `manual` — Per-symbol collection errors are surfaced on the
  row rather than swallowed.
- **UI-18** `MUST` `manual` — A page or section with no rows shows an
  explanatory empty state, not a bare heading over nothing.

### The daily brief

- **UI-40** `MUST` `manual` — The home page renders the brief when one exists,
  labelled as machine-generated and carrying its own timestamp. With no brief
  the page renders nothing in its place — never an empty panel.
- **UI-41** `MUST` `manual` — The brief is visually subordinate to the table.
  The numbers are the dashboard; the brief is a note about them.

### Page-specific

- **UI-5** `MUST` `test` — The dividends page includes only names with a
  dividend yield strictly greater than zero. Non-payers and names with no yield
  data are excluded.
- **UI-6** `MUST` `manual` — The dividends page is sorted by yield descending,
  and draws from both curated lists deduplicated by ticker.
- **UI-7** `MUST` `manual` — The AI page groups rows by declared segment,
  ordered to follow the physical AI supply chain — compute, foundry, memory,
  storage, networking, power, cooling. A segment with no rows is omitted.
- **UI-19** `MUST` `manual` — The AI page states that it is a classification of
  business exposure, not a recommendation list.

### Editorial constraints

- **UI-9** `MUST` `manual` — No page renders a buy/sell recommendation, a
  composite score, a rating, or any ordering that implies investment quality
  (`SYS-5`). Sorting by a single stated metric — yield, market cap — is
  presenting data and is permitted; sorting by an aggregate "attractiveness" is
  not.
- **UI-20** `MUST` `manual` — No page displays holdings, position sizes, cost
  basis, or P&L, and no page copy implies the lists represent owned positions
  (see [040-privacy-and-secrets.md](040-privacy-and-secrets.md)).

## Known gaps

None open. `UI-20` was violated in copy — the home page subtitle read "Tracked
positions and watchlist", implying a portfolio the page does not and must not
contain. The subtitle now says what the list actually is.
