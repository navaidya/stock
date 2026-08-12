# Master specification — Stock Analysis Dashboard

**Status:** active · **Last reviewed:** 2026-08-12

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
- Three static views over that data: watchlist, AI-exposure, dividends.
- Deterministic derived metrics computed from collected fields.

### Non-goals

These are excluded by design, not by omission. A change request that requires
one of them is a change to this spec, not a feature.

- **Real-time or intraday tick data.** See `SYS-3`.
- **A backend, database, or server-side API.** See `SYS-1`.
- **User accounts, multi-user support, or personalization at runtime.**
- **Portfolio tracking** — holdings, position sizes, cost basis, or P&L. See
  [040-privacy-and-secrets.md](040-privacy-and-secrets.md).
- **Recommendations, scores, or rankings by investment quality.** See `SYS-5`.
- **Backtesting, charting, or historical time-series storage.** The system
  stores one current snapshot, not a history.

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
                     │            │ (3) commit triggers deploy
                     v            v
              src/lib/data.ts ──> Astro build ──> dist/ ──> GitHub Pages
                                        ^
                          src/lib/columns.ts, format.ts (pure)
```

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

Process and conventions live in [README.md](README.md).

## 6. Conformance status

Specified behaviour that the implementation does not currently meet. This
section is the honest ledger — it is updated when a gap opens or closes, and an
empty list is the goal, not the assumption.

| ID | Gap | Impact | Status |
|---|---|---|---|
| `COL-2` | No `FINNHUB_API_KEY` secret is configured on the repository. | The collector exits 1 on every scheduled run. No data has ever been collected, so every column on the published dashboard is blank. | **Open** — needs a manual step outside the repo, and is the only remaining blocker to data appearing |
| `SEC-4` | `data/watchlist.yaml` is committed and labelled "Home page watchlist" with 15 specific tickers, and the home page describes it as "Tracked positions and watchlist". | A personal watchlist is personal information in a public repo. Already in git history, so removal requires a history rewrite. | **Open** — needs a decision |
| `COL-3`, `COL-4`, `COL-5` | The collector's pacing and failure-retention logic is not covered by any test. | The graceful-degradation behaviour that `SYS-4` depends on is asserted only by reading the code. | **Open** — verification gap, not a known defect |

## 7. Glossary

| Term | Meaning |
|---|---|
| **Snapshot** | One ticker's normalized data at one collection time — a `StockSnapshot`. |
| **Curated list** | A hand-maintained YAML file of tickers. The system has two: the watchlist and the AI universe. |
| **Collection** | One run of `scripts/collect.mjs`, producing one `data/market.json`. |
| **Hydration** | Merging a curated entry with its collected snapshot for rendering. A curated entry with no snapshot still produces a row. |
| **Primary column** | A column that stays visible on a phone without expanding the card. |
| **Stale** | Data older than 24 hours, or never collected. Surfaced in the UI, never hidden. |
| **Free tier** | Finnhub's no-cost plan: 60 calls/minute, and an unpredictable subset of metrics per symbol. |
