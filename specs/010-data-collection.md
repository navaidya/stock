# 010 — Data collection

**Prefix:** `COL` · **Status:** active · **Implements:** `SYS-2`, `SYS-3`, `SYS-4`, `SYS-6`

Owns how market data gets from Finnhub into `data/market.json`, and what happens
when that goes wrong.

**Implementation:** [scripts/collect.mjs](../scripts/collect.mjs),
[.github/workflows/refresh-data.yml](../.github/workflows/refresh-data.yml)

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
- **COL-3** `MUST` `manual` — Requests are paced at least 1000ms apart to stay
  within the free tier's 60 calls/minute, given three calls per symbol.
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
- **COL-6** `MUST` `ci` — A successful collection is committed and pushed to
  `main`, **including the first run, when `data/market.json` is not yet
  tracked by git.** The commit-back is what triggers the deploy; a collection
  that is not committed did not happen.
- **COL-14** `MUST` `ci` — A run that produces no change to `data/market.json`
  completes successfully without creating an empty commit.

## Known gaps

**`COL-6` is currently violated.** The workflow step is:

```sh
git diff --quiet -- data/market.json || git commit -am 'chore: refresh market data'
```

`git diff --quiet` ignores untracked files and exits 0, so on the first run the
`||` short-circuits and no commit is made. `git commit -am` would not stage an
untracked file in any case. The result is a green run that discards its own
output, permanently — because the file never becomes tracked, every subsequent
run repeats the same failure.

The fix is to stage explicitly and test the index rather than the worktree:

```sh
git add data/market.json
git diff --cached --quiet || git commit -m 'chore: refresh market data'
```

**`COL-2` is currently unmet:** no `FINNHUB_API_KEY` secret is configured on the
repository, so every scheduled run exits 1. This requires a manual step outside
the repo and cannot be fixed by a commit.

**`COL-3`, `COL-4`, `COL-5` and `COL-11` are unverified.** The collector's
pacing and retention logic has no test coverage, because `scripts/collect.mjs`
performs its own I/O and network calls at module scope. Promoting these to
`test` requires extracting the run loop into an injectable function — a fetcher
and a clock passed in — which is the natural next refactor for this area.
