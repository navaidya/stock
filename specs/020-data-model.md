# 020 — Data model and normalization

**Prefix:** `MOD` · **Status:** active · **Implements:** `SYS-4`, `SYS-6`, `SYS-7`

Owns the snapshot schema, the mapping from raw Finnhub responses into it, the
derived metrics, and the formatting of values for display.

**Implementation:** [src/lib/types.ts](../src/lib/types.ts),
[src/lib/finnhub.ts](../src/lib/finnhub.ts),
[src/lib/data.ts](../src/lib/data.ts),
[src/lib/format.ts](../src/lib/format.ts),
[src/lib/rating.ts](../src/lib/rating.ts)

---

## Context

This is the layer that turns an inconsistent third-party payload into something
the pages can render without defensive code in every template. Two properties
drive its whole design:

**Absence is a first-class value.** The free tier omits metrics unpredictably,
so "we don't have this number" is the normal case, not an error. It propagates
as `undefined` from mapping through to an em dash on screen, and it is never
collapsed into a zero — a zero is a number a reader might act on (`SYS-7`).

**It is pure.** No network, no clock beyond `freshness`, no I/O in the mapping
path. That is what lets the full suite run in a cloud session with no API key,
and it is why the fixture in `tests/fixtures/` is the only input the mapper is
ever tested against.

## Requirements

### Schema

- **MOD-1** `MUST` `test` — Every metric field on `StockSnapshot` is optional.
  An unavailable metric is `undefined` — never `0`, `null`, `NaN`, or a
  placeholder string.
- **MOD-16** `MUST` `build` — `ticker` and `name` are the only required fields
  on a snapshot. A snapshot with nothing else is valid and renderable.
- **MOD-17** `MUST` `manual` — `MarketData` is `{ generatedAt, failed, stocks }`.
  `generatedAt` is an ISO 8601 string, empty when never collected.

### Coercion

- **MOD-2** `MUST` `test` — `toNum` accepts finite numbers and numeric strings,
  and returns `undefined` for `null`, `undefined`, empty or whitespace-only
  strings, non-numeric strings, `NaN`, and `Infinity`.
- **MOD-3** `MUST` `test` — `pick` returns the value of the first candidate key
  that yields a finite number, and treats `0` as a present value rather than a
  missing one.
- **MOD-18** `MUST` `manual` — Metrics are read through candidate key lists
  rather than single keys, because Finnhub key names vary by symbol and have
  changed over time. An unrecognised shape falls back to `undefined` rather
  than throwing.
- **MOD-7** `MUST` `test` — `mapToSnapshot` is pure: it performs no network or
  filesystem access and is fully exercised from fixture JSON.

### Derived metrics

Derived values are computed, not fetched, so their guard conditions are the
specification — the arithmetic is the easy part.

- **MOD-4** `MUST` `test` — `pctOff52WeekHigh` is zero or negative, computed as
  `(price - high) / high * 100`, and only when a price and a **positive**
  52-week high are both present.
- **MOD-5** `MUST` `test` — `fcfYield` is `100 / pfcfShareTTM`, computed only
  when `pfcfShareTTM` is strictly positive. A company burning cash has no
  meaningful FCF yield, and `1 / negative` would render as a plausible-looking
  negative percentage.
- **MOD-6** `MUST` `test` — For an entry marked `isEtf`, company-only metrics
  are stripped: P/E, forward P/E, PEG, P/S, gross and operating margin, ROE,
  revenue and EPS growth, D/E, current ratio, EV/FCF, and FCF yield. Finnhub
  returns nonsense for these on a fund rather than omitting them.

### Calendar and activity

The two fields that answer "what should I look at today" rather than "what is
this worth". Both are shaped by what the free tier will give: the earnings
calendar is available, intraday volume is not.

- **MOD-25** `MUST` `test` — `earningsDate` is the next scheduled report date as
  an ISO `YYYY-MM-DD` string. A value that is not one is dropped.
- **MOD-26** `MUST` `test` — Where the calendar carries several dates, the
  soonest on or after the collection date is taken. A calendar holding only past
  dates yields no earnings date rather than the most recent one.
- **MOD-27** `MUST` `test` — `earningsHour` is normalized to `before open`,
  `after close`, or `during hours`; any other value is dropped.
- **MOD-28** `MUST` `test` — `daysToEarnings` is computed from `earningsDate`
  against an explicit clock passed in, is `0` on the day itself, and is
  `undefined` for a date already past. Nothing in `src/lib/` reads the clock
  implicitly except `freshness`.
- **MOD-29** `MUST` `test` — `volumeRatio10D3M` is the 10-day average daily
  volume over the 3-month average, computed only when the 3-month average is
  strictly positive.
- **MOD-30** `MUST` `manual` — `volumeRatio10D3M` is a two-week trend against a
  quarter baseline, and is never labelled or described as intraday relative
  volume. The free tier has no intraday volume, and a ratio that looks like one
  would be read as one.

### Hydration

- **MOD-9** `MUST` `test` — A curated entry with no collected snapshot still
  produces a row, with every metric absent and an explicit `no data` error. A
  tracked name must be visibly present-but-empty, never silently missing.
- **MOD-8** `MUST` `test` — Where a curated entry and a collected snapshot both
  carry a name or sector, the curated value wins.
- **MOD-15** `MUST` `build` — `loadMarketData` returns an empty `MarketData`
  when `data/market.json` is absent or unparseable. The site must build on a
  fresh clone before the collector has ever run, otherwise the first deploy
  fails and nobody can see the dashboard at all.

### Reference data

Not everything worth a column is on the API. Issuer credit ratings live with the
rating agencies, and remaining performance obligation is a line in a filing, not
a metric endpoint. Both are hand-curated in `data/reference.yaml` — which makes
them a different kind of value from a collected one, and the requirements below
exist to keep that difference visible rather than blurred.

- **MOD-19** `MUST` `test` — `creditRating` is a long-term issuer credit rating
  held as a string. A value that is not on a recognised scale is dropped, not
  displayed: an unparseable rating is no rating.
- **MOD-20** `MUST` `test` — `ratingRank` orders ratings from `AAA` best to `D`
  worst as a single ordinal, accepts S&P/Fitch and Moody's notation
  case-insensitively, and returns `undefined` for anything unrecognised. Ratings
  sort by credit quality, never alphabetically.
- **MOD-21** `MUST` `test` — `rpo` is remaining performance obligation in
  millions of USD — the same unit as `marketCap`, so one formatter serves both.
  A value that is not a finite non-negative number is dropped.
- **MOD-22** `MUST` `test` — Reference values merge onto a snapshot during
  hydration and never overwrite a collected field. The collector is the
  authority for anything it collects.
- **MOD-23** `MUST` `test` — A ticker with no reference entry hydrates
  unchanged, with the reference fields absent rather than empty.
- **MOD-24** `MUST` `manual` — Every reference value carries an `asOf` date and
  a source, because nothing refreshes it. A hand-curated number with no date is
  indistinguishable from a stale one.

### Freshness

- **MOD-10** `MUST` `test` — `freshness` reports: never collected → stale;
  an unparseable timestamp → stale; older than 24h → stale with a day count;
  within the last hour → not stale. Age is surfaced, never hidden (`SYS-3`).

### Formatting

- **MOD-11** `MUST` `test` — Every formatter renders `undefined` as the em dash
  `—`, and renders a genuine `0` as `0`. The distinction between "no value" and
  "zero" survives all the way to the screen.
- **MOD-12** `MUST` `test` — `marketCap` takes millions, as Finnhub returns it,
  and scales to `$NNNM` / `$NN.NB` / `$N.NNT`.
- **MOD-13** `MUST` `test` — `trend` returns `none` for a missing value and
  `flat` for zero, so a missing value is never coloured as flat.
- **MOD-14** `MUST` `test` — `signedPct` prefixes positive values with `+`.

## Notes

`priceReturn52W` and `pctOff52WeekHigh` measure different things and both earn
their place: the first is the trailing return, the second is the drawdown from
peak. A name can be up strongly over 52 weeks while sitting 30% off its high.

Adding a metric means: a field on `StockSnapshot`, a `pick` with its candidate
keys in `mapToSnapshot`, a fixture value, a test citing a new `MOD` ID, and a
column entry in the relevant page's column set (see
[030-presentation.md](030-presentation.md)). Skipping the fixture is how an
untested mapping reaches production.
