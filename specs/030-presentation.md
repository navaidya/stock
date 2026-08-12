# 030 — Presentation

**Prefix:** `UI` · **Status:** active · **Implements:** `SYS-3`, `SYS-5`, `SYS-7`

Owns the pages, what each one shows and why, the responsive behaviour, and the
empty states.

**Implementation:** [src/pages/](../src/pages/),
[src/components/StockTable.astro](../src/components/StockTable.astro),
[src/layouts/Base.astro](../src/layouts/Base.astro),
[src/lib/columns.ts](../src/lib/columns.ts)

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

## Requirements

### Pages

- **UI-1** `MUST` `build` — Three static pages: `/` (watchlist), `/ai` (AI
  exposure), `/dividends`. All are prerendered; none fetches at runtime.
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

**`UI-20` is currently violated in copy.** The home page subtitle reads "Tracked
positions and watchlist." Nothing renders position data — the page is safe — but
the wording implies the list is a portfolio, which is precisely the inference
`SEC-4` is meant to prevent.
