# 070 — Macro events

**Prefix:** `MAC` · **Status:** active · **Implements:** `SYS-1`, `SYS-2`,
`SYS-4`, `SYS-5`, `SYS-6`, `SYS-7`

Owns the `/macro` page: the recurring macroeconomic release calendar (CPI,
jobs, GDP, Fed policy, and similar), Treasury yield history, and the bond
market's historical reaction around past events. Does not own per-company data
— that is `020-data-model.md` — or anything about individual stocks.

**Implementation:** [data/macro-events.yaml](../data/macro-events.yaml),
[src/lib/macro.ts](../src/lib/macro.ts),
[src/pages/macro.astro](../src/pages/macro.astro),
[scripts/collect.mjs](../scripts/collect.mjs),
[.github/workflows/refresh-macro.yml](../.github/workflows/refresh-macro.yml)

---

## Context

Every other page on this dashboard answers "how does this company look right
now." This page answers a different question — "what regularly-scheduled
report moves the whole market next, and what happened around it last time" —
and that difference forces two departures from how the rest of the system
works.

**This is the one place the system stores history, deliberately.** Everywhere
else, `SYS-1`'s non-goal holds: one current snapshot, not a time series. That
rule exists because *this system* has no business inventing its own history
out of samples it happened to collect — a snapshot taken every few hours is not
a price history, it is a coincidence of when the cron fired. Macro series are
different: FRED and the Treasury both publish their **complete** official
history on every request, for free, with no accumulation required on this
system's part. Storing what they hand back is not this system building a time
series; it is mirroring one that already exists and is authoritative at the
source, the same trust relationship `data/reference.yaml` already has with a
credit-rating agency, just fetched instead of hand-typed. See the amended
non-goal in [SPEC.md](SPEC.md) §2.

**The reaction data is bond yields only, not equity prices, and that is a
scope decision, not an oversight.** Treasury.gov publishes the full par yield
curve history for free with no key. A genuine equity benchmark history (say,
the S&P 500 index level day by day) is not available from any endpoint this
project already has a key for — Finnhub's free tier does not carry historical
daily bars for US equities, and adding a second market-data vendor for one
chart is a cost this page has not earned yet. So "what happened after" is
answered honestly with what is actually collected: the 2-year and 10-year
Treasury yield before and after each event, not a made-up equity return.

**Every event's next date is sourced, not computed.** FRED and Treasury carry
no field for "when does the next one come out" — that only exists on each
issuing agency's own release-schedule page. So `nextRelease` on a non-FOMC
event, like the FOMC `meetingCalendar`, is hand-curated from that agency's own
published schedule (BLS for CPI/PPI/jobs, BEA for GDP/PCE, Census for retail
sales, the University of Michigan for its own survey), dated with the same
`asOf` discipline `MOD-24` already applies to `reference.yaml`. The FOMC
calendar covers a full year and self-advances; a `nextRelease` covers exactly
one upcoming date and goes stale the day after it passes, which is why it is
tracked in [SPEC.md](SPEC.md)'s conformance table as needing a periodic
hand-refresh rather than assumed to stay correct on its own — fabricating a
formulaic rule instead ("second Tuesday of the month") was rejected because
these schedules shift for holidays and do not actually follow one.

## Requirements

### Data source and collection

- **MAC-1** `MUST` `manual` — `data/macro-events.yaml` is a hand-curated list
  of tracked events: an id, a label, an issuing agency, a category, a
  human-readable release frequency, a source URL, and — for a FRED-backed
  event — the FRED series id and how to derive the displayed value from it
  (`yoy`, `mom_change`, or `level`).
- **MAC-2** `MUST` `manual` — The FOMC meeting calendar is hand-curated
  separately in the same file, sourced from the Federal Reserve's own
  published schedule, and carries an `asOf` date for when it was last checked
  against that source — the same discipline `MOD-24` already applies to
  hand-curated reference values.
- **MAC-3** `MUST` `manual` — `node scripts/collect.mjs macro` is the third
  collection target in the shared collector script: it reads
  `FRED_API_KEY` from the environment, fetches the complete observation
  history for every FRED series named in `data/macro-events.yaml`, fetches the
  current and prior year's Treasury par-yield-curve CSV, and writes
  `data/macro.json`. `scripts/collect.mjs` remains the only file that touches
  the network, for all three targets.
- **MAC-4** `MUST` `manual` — A failure fetching one FRED series does not
  block the others, and a failure fetching Treasury yields does not block the
  FRED series or vice versa — the same per-source isolation `SYS-4` already
  requires of the per-symbol collector.
- **MAC-5** `MUST` `test` — FRED's missing-observation marker (the literal
  string `"."`) is dropped, never coerced to `0` or `NaN` (`SYS-7`).

### Derived values

- **MAC-6** `MUST` `test` — A series declared `derive: yoy` is converted from
  a monthly index level to a year-over-year percent change by comparing each
  point to the point twelve entries earlier in the same series — not a fixed
  calendar offset, so a gap in the published series cannot silently compare
  against the wrong month.
- **MAC-7** `MUST` `test` — A series declared `derive: mom_change` is
  converted from a cumulative level (e.g. total nonfarm payrolls) to the
  change from the prior month — the number the headline report actually leads
  with, not the running total.
- **MAC-8** `MUST` `test` — The Treasury yield CSV is parsed by matching
  column header text ("10 Yr", "2 Yr", …), not column position — Treasury has
  inserted a new maturity column before (the 1.5-month bill, 2025), and a
  position-based parse would silently misalign every column after an
  insertion like that.

### Bond reaction

- **MAC-9** `MUST` `test` — For a given event date, the 2-year and 10-year
  Treasury yield "before" is the latest yield point on or before that date,
  and "after" is the earliest yield point at least a stated number of
  calendar days after it — found by walking sorted dates, not by a fixed
  array offset, since weekends and holidays mean "N days later" is not a
  fixed number of rows in the series.
- **MAC-10** `MUST` `test` — Where either the "before" or "after" yield point
  is unavailable, the reaction for that event renders as missing rather than
  a change computed against a wrong or absent value (`SYS-7`).

### Presentation

- **MAC-11** `MUST` `build` — `/macro` is a fifth static page, prerendered,
  fetching nothing at runtime, following the same pattern as every other page
  (`UI-1`).
- **MAC-12** `MUST` `manual` — Each event shows its label, agency, category,
  frequency, and last reported date and value. An event with a hand-curated
  next date — the FOMC meeting calendar, or a non-FOMC event's `nextRelease`
  — shows it; an event with neither (the fed funds rate, a daily reading with
  no single release day) states only the frequency rather than asserting a
  next date it does not actually know (`SYS-7`).
- **MAC-13** `MUST` `manual` — The current Treasury yield curve (all
  maturities collected) renders as one snapshot, separate from the
  per-event bond reaction table.
- **MAC-14** `MUST` `manual` — The bond-yield reaction table states plainly
  that it covers Treasury yields only, not equity prices, and is a historical
  fact about what happened, not a prediction or a recommendation (`SYS-5`).
- **MAC-15** `MUST` `build` — The page builds and renders with no
  `data/macro.json` present, the same way every other page tolerates a
  fresh clone before the collector has ever run (`UI-2`, `MOD-15`).
- **MAC-16** `MUST` `test` — Each non-FOMC event shows its last five reported
  points, not only the latest one — one point is a fact, five is enough to
  see a direction, and a reader asking "is this getting better or worse"
  should not have to leave the page to find out.
- **MAC-17** `MUST` `manual` — A non-FOMC event's `nextRelease` — the single
  next known date and the `asOf` it was checked against the issuing agency's
  own schedule — is hand-curated in `data/macro-events.yaml`, the same
  discipline `MAC-2` already applies to the FOMC calendar. A series with no
  fixed announced release day (the fed funds rate) carries no `nextRelease`
  rather than an invented one.
- **MAC-18** `MUST` `test` — Every event carries a non-empty `about` field: a
  one-line, plain-English statement of what the number measures and which
  direction means what — descriptive ("prices are rising faster"), never
  directive ("you should sell"). Same recommendation-vocabulary boundary
  `UI-48` holds the Health score to (`SYS-5`).

## Known gaps

**Equity-side reaction is not covered.** See "Context" above — the free data
this project already has access to does not include historical daily equity
benchmark prices, so "what happened to stocks" after an event is not answered
on this page. Adding it is a real feature, not a bug fix, and needs its own
spec decision if a suitable free data source is found.

**A non-FOMC `nextRelease` date is a single hand-typed value, not a
self-advancing calendar.** Unlike the FOMC's full-year list, each of these
covers exactly one upcoming date and goes stale the day after it passes —
see `MAC-17` and the `SPEC.md` conformance table entry tracking the need for
a periodic hand-refresh against each agency's own schedule.

## Notes

Adding a new FRED-backed event means: an entry in `data/macro-events.yaml`
with its FRED series id and derivation, a fixture observation array in
`tests/fixtures/`, and nothing else — the collector, the derivation functions,
and the page all read the event list rather than hardcoding a name.
