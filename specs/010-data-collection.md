# 010 — Data collection

**Prefix:** `COL` · **Status:** active · **Implements:** `SYS-2`, `SYS-3`, `SYS-4`, `SYS-6`

Owns how market data gets from Finnhub into `data/market.json`, and what happens
when that goes wrong.

**Implementation:** [scripts/collect.mjs](../scripts/collect.mjs),
[scripts/commit-data.sh](../scripts/commit-data.sh),
[.github/workflows/refresh-data.yml](../.github/workflows/refresh-data.yml),
[.github/workflows/refresh-sp500.yml](../.github/workflows/refresh-sp500.yml),
[data/sp500.yaml](../data/sp500.yaml)

---

## Context

The refresh floor is minutes, not seconds, and that is a consequence of having
no backend rather than a limitation to engineer around (`SYS-3`). GitHub Actions
cron is best-effort and routinely delayed under load. This design suits hourly
and end-of-day analysis.

The free Finnhub tier shapes most of the rest: 60 calls/minute, and an
unpredictable subset of metrics returned per symbol. Fields are missing without
warning and key names have changed over time, so the collector treats a missing
metric as normal rather than exceptional.

## Requirements

### Execution model

- **COL-1** `MUST` `ci` — Collection runs only inside GitHub Actions, on a cron
  schedule or manual dispatch. The deployed site never calls the API.
- **COL-2** `MUST` `manual` — The collector reads `FINNHUB_API_KEY` from the
  environment. With no key it exits non-zero and writes nothing.
- **COL-3** `MUST` `test` — The collector paces itself to no more than 60 API
  calls per minute: it sleeps at least 1000ms **per call it makes for a symbol**
  before starting the next one. Pacing per symbol rather than per request is the
  correction to an earlier reading of this requirement — the calls for one
  symbol are issued in parallel, so a flat 1100ms gap between symbols was three
  calls per 1.1s, nearly three times the limit.
- **COL-18** `MUST` `manual` — The next earnings date comes from the earnings
  calendar endpoint, queried per symbol over a forward window that starts on the
  collection date, so a past report is never returned as the next one.
- **COL-19** `MUST` `manual` — A failure of the earnings calendar call alone
  degrades to no earnings date for that symbol. It must not fail the symbol:
  the calendar is the one endpoint here that free-tier access has historically
  been withdrawn from, and losing it must not blank a row's price and
  fundamentals.
- **COL-9** `SHOULD` `ci` — The schedule is weekdays at 14:35, 18:35 and 21:15
  UTC: twice during US market hours and once after the close.

### Ticker set

- **COL-7** `MUST` `manual` — The collected set is the union of
  `data/watchlist.yaml` and `data/ai-universe.yaml`, deduplicated by ticker.
  A ticker in both lists is fetched once.
- **COL-8** `MUST` `test` — Both curated files parse, are non-empty, contain no
  duplicate tickers within a file, and reference only segments declared in the
  same file's `segments` map.
- **COL-10** `MUST` `manual` — An entry with `sector: etf` is marked `isEtf` so
  the data model can strip metrics that do not apply to a fund (see `MOD-6`).

### S&P 500 target

A second, much larger ticker set for the `/sp500` screening page. It reuses
every part of the pipeline above — the same fetch, pacing, coercion and
failure semantics — rather than duplicating them, because the risk with a
second collector is drift between the two, not extra code.

- **COL-21** `MUST` `manual` — `node scripts/collect.mjs sp500` collects
  `data/sp500.yaml` (all current S&P 500 constituents) into `data/sp500.json`,
  sharing `symbolDelayMs` pacing, `mapToSnapshot` coercion, and the per-symbol
  failure handling with the default target. `scripts/collect.mjs` remains the
  only file that touches the network for either target.
- **COL-22** `MUST` `manual` — The S&P 500 target refreshes on its own
  schedule (`refresh-sp500.yml`), separate from `refresh-data.yml`, because
  roughly 500 symbols takes on the order of 35-40 minutes at the free-tier
  pace (`COL-3`) — folding it into the three-times-daily refresh would
  stretch every scheduled run to match its slowest target.
- **COL-23** `MUST` `test` — `data/sp500.yaml` parses, is non-empty, and
  contains no duplicate tickers, mirroring `COL-8` for the third curated
  list.

### Failure semantics

These are the concrete form of `SYS-4`. The governing idea: a bad run must never
be worse than no run.

- **COL-4** `MUST` `manual` — A symbol whose fetch fails is recorded in
  `failed`, and retains its previous snapshot tagged with a `stale: <reason>`
  error rather than being dropped or blanked.
- **COL-5** `MUST` `manual` — If every symbol fails, the previous
  `data/market.json` is retained rather than overwritten with an empty result.
  The run exits 0 when previous data exists, and non-zero only when there is no
  previous data to fall back on.
- **COL-11** `MUST` `manual` — A failure collecting one symbol never aborts the
  remaining symbols.
- **COL-12** `MUST` `manual` — Every field arriving from the API is coerced
  through the normalization layer before being written. The collector never
  writes a raw API response to disk (`SYS-6`).

### Output and commit-back

- **COL-13** `MUST` `manual` — Output is `data/market.json`: an object with
  `generatedAt` (ISO 8601), `failed` (array of tickers), and `stocks` (map of
  ticker to snapshot).
- **COL-6** `MUST` `test` — A successful collection is committed and pushed to
  `main`, **including the first run, when `data/market.json` is not yet
  tracked by git.** The commit-back is what triggers the deploy; a collection
  that is not committed did not happen.
- **COL-14** `MUST` `test` — A run that produces no change to `data/market.json`
  completes successfully without creating an empty commit.
- **COL-15** `MUST` `test` — Each commit contains only the file it was asked to
  commit. Any other file the job happened to modify is left uncommitted. The
  refresh job makes one such commit per output file — `data/market.json`, then
  `data/brief.json` — rather than sweeping the worktree.
- **COL-16** `MUST` `test` — If the collector produced no output file, the
  commit step fails loudly rather than reporting success. A green run that
  committed nothing is the failure mode this whole area is built to prevent.
- **COL-20** `MUST` `test` — A file the run legitimately may not produce — the
  brief, when no model key is configured — is committed with `--optional`, which
  turns a missing file into a skip rather than a failure. The distinction
  between "should exist and does not" (`COL-16`) and "may not exist" lives in
  the flag, not in untested workflow YAML.
- **COL-17** `MUST` `test` — The refresh workflow invokes the deploy workflow
  explicitly after pushing, and builds `main` rather than the calling run's
  SHA. It must not rely on the deploy workflow's `push` trigger: GitHub does
  not trigger workflows from a push made with the default `GITHUB_TOKEN`, so
  collected data would be committed and never built.

## Known gaps

**`COL-4`, `COL-5` and `COL-11` are unverified.** The collector's retention
logic has no test coverage, because `scripts/collect.mjs` performs its own I/O
and network calls at module scope. Promoting these to `test` requires extracting
the run loop into an injectable function — a fetcher and a clock passed in —
which is the natural next refactor for this area.

`COL-3` was in that list until the pacing arithmetic moved into
`symbolDelayMs()` in `src/lib/finnhub.ts`, where it is unit-tested. The rest of
the loop still is not, and `COL-18` and `COL-19` join it: that a failing
calendar call degrades rather than failing the symbol is asserted by reading the
code.
