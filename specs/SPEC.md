# Master specification — Stock Analysis Dashboard

**Status:** active · **Last reviewed:** 2026-08-13

This is the root specification. It defines what the system is, the invariants
that hold across every part of it, and the index of child specs. Child specs
own the detail; this file owns the shape and the constraints that no child spec
may contradict.

If a child spec and this file disagree, this file wins and the child spec is a
bug.

---

## 1. Purpose

A personal, live-updating dashboard for stock analysis: a small set of curated
tickers, rendered with the valuation, growth, quality and income metrics needed
to form a view — read mostly on a phone, mostly outside market hours.

It answers "how do the names I follow look right now, on the numbers." It does
not answer "what should I buy."

## 2. Scope

### In scope

- Curated ticker lists maintained as source-controlled YAML.
- Scheduled collection of public market data into a committed JSON file.
- Hand-curated public reference data the API does not carry — issuer credit
  ratings, remaining performance obligation — each value dated at its source.
- Four static views over that data: watchlist, AI-exposure, dividends, and an
  S&P 500 screen, plus a glossary page explaining every column, plus a macro
  events page tracking the recurring reports and Fed decisions that move the
  whole market.
- Client-side sorting and filtering of any column on any view.
- A short machine-written brief over each collection, generated outside the
  browser — in CI, or locally by the owner.
- Deterministic derived metrics computed from collected fields.

### Non-goals

These are excluded by design, not by omission. A change request that requires
one of them is a change to this spec, not a feature.

- **Real-time or intraday tick data.** See `SYS-3`.
- **A backend, database, or server-side API.** See `SYS-1`.
- **A chatbot on the page.** Interactive conversation needs a model API key at
  request time, which means either a key in the browser (`SYS-2` forbids it) or
  a server to hold one (`SYS-1` forbids that). The daily brief in
  [060-daily-brief.md](060-daily-brief.md) is what this constraint permits: the
  model runs in CI, where the key already lives, and writes once per collection.
  A real chat is a change to `SYS-1`/`SYS-2`, not a feature request.
- **User accounts, multi-user support, or personalization at runtime.**
- **Portfolio tracking** — holdings, position sizes, cost basis, or P&L. See
  [040-privacy-and-secrets.md](040-privacy-and-secrets.md).
- **Recommendations, scores, or rankings by investment quality.** See `SYS-5`.
  Two narrow, deliberate exceptions. The Financial Health score is a single
  disclosed composite of profitability and balance-sheet stability, excluding
  valuation, growth, momentum and external ratings by construction, never
  rendered as an ordinal rank — see `030-presentation.md` `UI-45`..`UI-48`.
  Analyst ratings are the second: raw sell-side Buy/Hold/Sell counts, shown
  as third-party fact the same way a credit rating is, never averaged into a
  consensus number or synthesized by this dashboard into anything resembling
  the first exception — see `UI-51`..`UI-54`, and `020-data-model.md`'s
  "Analyst ratings" section for why this data's own well-documented bias
  makes it a case *for* extra caveats, not for silence.
- **Backtesting, charting, or historical time-series storage.** The system
  stores one current snapshot, not a history. One narrow, deliberate
  exception: `data/macro.json` mirrors the complete published history of a
  small set of official macroeconomic and Treasury-yield series, fetched
  fresh from FRED and Treasury.gov on every collection rather than
  accumulated sample by sample — the same trust relationship a reference
  value already has with its source, just fetched instead of hand-typed. See
  [070-macro-events.md](070-macro-events.md) for the reasoning and the
  constraints that keep it from becoming a general-purpose history feature.

## 3. Architecture

Static-first. Nothing executes on a server at request time.

```
data/watchlist.yaml ─┐
data/ai-universe.yaml┤
                     │   (1) scheduled GitHub Action, weekdays
                     ├──> scripts/collect.mjs ──> Finnhub API
                     │            │
                     │            │ (2) writes + commits
                     │            v
                     │    data/market.json
                     │            │
                     │            │
                     │    scripts/brief.mjs ──> Anthropic API
                     │            │  (optional; CI or local)
                     │            v
data/reference.yaml ─┤    data/brief.json
  (hand-curated)     │            │ (3) commit triggers deploy
                     v            v
              src/lib/data.ts ──> Astro build ──> dist/ ──> GitHub Pages
                                        ^
              src/lib/columns.ts, format.ts, sort.ts, rating.ts (pure)

data/sp500.yaml ──(1) separate daily GitHub Action──> scripts/collect.mjs sp500
                                                              │
                                                              v
                                                       data/sp500.json ──> (as above)

data/macro-events.yaml ─(1) separate daily GitHub Action─> scripts/collect.mjs macro ──> FRED API, Treasury.gov
  (hand-curated: FOMC dates,                                      │
   which FRED series to fetch)                                    v
                                                             data/macro.json ──> (as above)
```

The S&P 500 target shares the collector script and every pure module above; it
differs only in its ticker set, its output file, and its slower schedule
(`COL-21`, `COL-22`) — see `010-data-collection.md`. The macro target differs
more: it calls FRED and Treasury.gov instead of Finnhub, and it is the one
place `data/` holds a real history rather than a snapshot — see
`070-macro-events.md`.

Three boundaries matter:

1. **Network boundary** — only `scripts/collect.mjs` touches the network, and
   only inside GitHub Actions. The built site makes no API calls.
2. **Purity boundary** — everything under `src/lib/` is pure and synchronous.
   `finnhub.ts` maps raw responses to snapshots without fetching, so the full
   test suite runs with no API key. This is what makes cloud sessions viable.
3. **Trust boundary** — everything crossing in from Finnhub is untrusted. It is
   coerced through `toNum`/`pick` into a known shape before anything renders it.

## 4. System invariants

These hold everywhere. Each child spec inherits them.

- **SYS-1** `MUST` `manual` — The system has no backend, no database, and no
  server-side API. Every deployed artifact is a static file.
- **SYS-2** `MUST` `manual` — No paid or rate-limited API is called from the
  browser with an embedded key. A key shipped to the client is a public key.
- **SYS-3** `MUST` `manual` — No feature may assume a refresh floor faster than
  tens of minutes. GitHub Actions cron is best-effort and routinely delayed;
  the UI states data age rather than implying freshness.
- **SYS-4** `MUST` `manual` — Degrade gracefully. One failing source must never
  block other sources or erase previously collected data.
- **SYS-5** `MUST` `manual` — Nothing the system produces is investment advice.
  It presents data and deterministic computed metrics. It must not generate
  buy/sell recommendations, nor rank names by investment attractiveness.
- **SYS-6** `MUST` `manual` — All remote API responses are untrusted: validate
  shape before use, normalize to plain text, never render raw remote HTML.
- **SYS-7** `MUST` `manual` — A missing value is rendered as missing. The system
  must never substitute a zero, a default, or an interpolation for a number it
  does not have, because a reader may act on a number.

## 5. Child specs

| Spec | Area | ID prefix | Owns |
|---|---|---|---|
| [010-data-collection.md](010-data-collection.md) | Collection | `COL` | Collector behaviour, scheduling, failure semantics, commit-back |
| [020-data-model.md](020-data-model.md) | Data model | `MOD` | Snapshot schema, normalization, derived metrics, formatting |
| [030-presentation.md](030-presentation.md) | Presentation | `UI` | Pages, column sets, responsive behaviour, empty states |
| [040-privacy-and-secrets.md](040-privacy-and-secrets.md) | Privacy | `SEC` | Public-repo constraints, secret handling |
| [050-delivery.md](050-delivery.md) | Delivery | `DEL` | Build, test gate, deploy, dependency policy |
| [060-daily-brief.md](060-daily-brief.md) | Daily brief | `BRF` | Model-written summary: generation, prohibitions, failure semantics |
| [070-macro-events.md](070-macro-events.md) | Macro events | `MAC` | Macro release calendar, Treasury yield history, bond-market reaction |

Process and conventions live in [README.md](README.md).

## 6. Conformance status

Specified behaviour that the implementation does not currently meet. This
section is the honest ledger — it is updated when a gap opens or closes, and an
empty list is the goal, not the assumption.

| ID | Gap | Impact | Status |
|---|---|---|---|
| `COL-4`, `COL-5`, `COL-11` | The collector's failure-retention logic is not covered by any test, because the run loop does its own I/O at module scope. | The graceful-degradation behaviour that `SYS-4` depends on is asserted only by reading the code. | **Open** — verification gap, not a known defect. `COL-3` left this list when the pacing arithmetic moved into a tested pure function |
| `BRF-2` | No `ANTHROPIC_API_KEY` secret is configured, so no brief is generated. | The home page renders without a brief, which is the specified degraded state rather than a defect. | **Open by choice** — closes when the secret is added; costs nothing until then |
| `MOD-24` | The seed values in `data/reference.yaml` were written from an agent's recall of public filings and rating actions, not read off a primary source. Each carries an `asOf` date and a source note, but none has been checked against it. | The credit rating column shows these as facts on the dashboard; RPO is no longer a column but is still shown, per-ticker, in the FAQ's curated-values table. A wrong rating is precisely the substituted value `SYS-7` exists to prevent. | **Open** — every seeded value needs verification against the issuer's rating page or filing; the mechanism is correct, the data is provisional |
| `MAC-2` | The FOMC meeting calendar in `data/macro-events.yaml` was entered from a web search against the Fed's published schedule, not fetched live. | The next-meeting date on `/macro` could be wrong if the Fed rescheduled a meeting after this was written. | **Open** — check the `asOf` date against `federalreserve.gov/monetarypolicy/fomccalendars.htm` periodically; low risk, the Fed rarely moves a published date |
| `MAC-17` | Every non-FOMC event's `nextRelease` is a single hand-typed date, sourced from that agency's own schedule at its `asOf` date, and goes stale the day after it passes rather than self-advancing the way the FOMC calendar does. | The "Next" line on `/macro` for CPI, PPI, jobs, GDP, PCE, retail sales, or consumer sentiment reads as last-known rather than always-current once that date is in the past. | **Open by design** — needs a hand-refresh against each agency's release-schedule page roughly monthly; not automatable without a paid economic-calendar API |
| — | `/macro`'s bond-reaction table has no equity-side counterpart — see `070-macro-events.md` "Known gaps." | A reader cannot see "what stocks did" around a macro event on this page, only what Treasury yields did. | **Open by choice** — no free data source for historical daily equity benchmark prices is wired up; not a defect in what is built |

## 7. Glossary

| Term | Meaning |
|---|---|
| **Snapshot** | One ticker's normalized data at one collection time — a `StockSnapshot`. |
| **Curated list** | A hand-maintained YAML file of tickers. The system has two: the watchlist and the AI universe. |
| **Collection** | One run of `scripts/collect.mjs`, producing one `data/market.json`. |
| **Hydration** | Merging a curated entry with its collected snapshot for rendering. A curated entry with no snapshot still produces a row. |
| **Primary column** | A column that stays visible on a phone without expanding the card. |
| **Reference value** | A hand-curated public fact the API does not carry — a credit rating, an RPO figure — dated at its source in `data/reference.yaml`. |
| **S&P 500 screen** | The `/sp500` page: all current index constituents (`data/sp500.yaml`), same columns as the home page, refreshed on its own slower schedule (`COL-22`). A screen of the index, not a recommendation list. |
| **RPO** | Remaining performance obligation: contracted revenue not yet recognised. A backlog figure, disclosed quarterly in the filings. |
| **Brief** | The machine-written summary of one collection, in `data/brief.json`. Describes the data; never advises. |
| **Financial Health score** | A 0–100 composite of profitability and balance-sheet stability only — see `src/lib/health.ts` and `020-data-model.md` `MOD-31`..`MOD-33`. The one exception to the no-composite-scores rule; never a ranking, never advice. |
| **Analyst ratings** | Raw sell-side Strong Buy/Buy/Hold/Sell/Strong Sell counts for the most recent month covered, shown as third-party fact — never averaged into a consensus number. The second, differently-shaped exception to the no-recommendations rule; see `020-data-model.md` `MOD-34`..`MOD-36` and `030-presentation.md` `UI-51`..`UI-54`. |
| **Stale** | Data older than 24 hours, or never collected. Surfaced in the UI, never hidden. |
| **Free tier** | Finnhub's no-cost plan: 60 calls/minute, and an unpredictable subset of metrics per symbol. |
| **Macro event** | A recurring scheduled economic release or Fed decision tracked on `/macro` — see `070-macro-events.md` `MAC-1`, `MAC-2`. |
| **Bond reaction** | The change in the 2-year and 10-year Treasury yield around a past macro event's date, computed from mirrored Treasury history. A historical fact, not a prediction (`MAC-14`). |
