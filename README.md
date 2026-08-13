# Stock Analysis Dashboard

A personal, static dashboard over a curated list of tickers: valuation, growth,
quality and income metrics, a filter box, and an optional machine-written note
over each collection. No backend, no database — a scheduled job collects data
into JSON, commits it, and the site rebuilds.

Read on a phone, mostly outside market hours. It answers *how do the names I
follow look right now, on the numbers*. It does not answer *what should I buy*,
and by design it never will — see [`specs/SPEC.md`](specs/SPEC.md) §2.

## Pages

| Page | What it answers |
|---|---|
| `/` | The watchlist: a balanced value / growth / quality / health view, plus the brief |
| `/ai` | AI-exposure, grouped along the supply chain from silicon to power |
| `/dividends` | Payers only, highest yield first, with the columns that say whether it is sustainable |
| `/faq` | What every column means, how it misleads, and where the numbers come from |

Every column sorts, both directions, from the arrows in its header — or from the
control above the cards on a phone. Missing values sort last either way.

## The filter box

Above each table. Comparisons and bare words, combined with AND:

```
pe < 25 yield > 2            cheap-ish and paying something
earnings <= 7                reporting inside the week
off high < -30 semiconductors   drawdown, in one sector
vol > 1.5                    trading heavier than its own quarter
```

Field names are the short ones listed in the FAQ, or any snapshot key. Two rules
worth knowing: a row with **no value** for a compared field never matches, so
`pe < 25` excludes companies with no P/E rather than treating an em dash as
zero; and a clause that does not parse is **ignored and reported**, because a
typo silently emptying the table looks exactly like an honest "nothing
qualifies".

Entirely client-side. No key, no network, no cost.

## Running it locally

```bash
npm ci            # restore exactly what the lockfile pins — never bare `npm install`
npm run dev       # local dev server
npm test          # spec traceability gate, then the unit tests
npm run build     # astro check, then a static build into dist/
```

Both data commands load a gitignored `.env` automatically when one exists:

```bash
cp .env.example .env    # then fill in what you want to use
npm run collect         # fetch market data  -> data/market.json
npm run brief           # write the summary  -> data/brief.json   (optional)
```

`npm run collect` needs `FINNHUB_API_KEY` (free tier). Without it the collector
exits non-zero and writes nothing, and every column on the site stays blank.

`npm run brief` needs `ANTHROPIC_API_KEY`. Without it the script writes nothing,
exits 0, and the site renders with no brief — collection and deployment are
unaffected.

## Where keys live

Two options, and the published site is identical either way:

- **GitHub Actions secrets** — the scheduled job refreshes data and brief on its
  own. A secret is stored encrypted by GitHub, injected only into the step that
  asks for it, and never written into any committed file; the workflow refers to
  it by name.
- **A local `.env`** — run `npm run collect` / `npm run brief` yourself and
  commit the JSON they write. No key is ever handed to GitHub.

**No API key belongs in this repository, on either path.** It is public: `.env`
is gitignored, `.env.example` documents the names with empty values, and nothing
under `data/` or `src/` may contain a credential. Same rule for personal
financial data — no holdings, position sizes, cost basis, or P&L anywhere,
including commit messages.

## How the data gets there

```
data/watchlist.yaml   ─┐
data/ai-universe.yaml ─┤ scheduled GitHub Action, weekdays
                       ├─> scripts/collect.mjs ──> Finnhub  ──> data/market.json
                       │   scripts/brief.mjs   ──> Anthropic ──> data/brief.json
data/reference.yaml   ─┤   (hand-curated: credit ratings, RPO)
                       v
                src/lib/data.ts ──> Astro build ──> dist/ ──> GitHub Pages
```

The refresh floor is minutes to hours, not seconds: GitHub cron is best-effort
and routinely delayed. Every page states the age of its data rather than
implying freshness. This suits end-of-day reading; it is not a quote screen.

## This repository is spec-driven

[`specs/`](specs/) is the source of truth for behaviour — **start there, not in
the source files.** [`specs/SPEC.md`](specs/SPEC.md) is the master spec: scope,
non-goals, system invariants, the child-spec index, and a live table of known
gaps. [`specs/README.md`](specs/README.md) is the process.

A behaviour change is a requirement, then a test citing its ID, then the
implementation — committed together. `npm run spec:check` runs as part of
`npm test` and fails the build if a `MUST` requirement tagged `test` has no test
citing it, if a test cites an ID no spec defines, or if an ID is defined twice.

## Known gaps

The honest ones live in the conformance table in
[`specs/SPEC.md`](specs/SPEC.md) §6. The one that matters today:

- **The seeded credit ratings and RPO figures in `data/reference.yaml` are
  unverified** — written from recall, each carrying an as-of date, none checked
  against an agency page or a filing. Verify before relying on them.

## Deployment

`main` deploys straight to GitHub Pages via `.github/workflows/deploy.yml`,
which runs `npm ci`, `npm test`, `npm run build` and uploads `dist/`. There is
no review step, which is why the gate must pass before any push.

**The repository's Pages source must be set to "GitHub Actions"** (Settings →
Pages → Build and deployment). If it is set to "deploy from a branch" instead,
GitHub additionally runs its own built-in Jekyll workflow against the same
site, and the two race — the last one to finish wins. In that mode a root
`README.md` is published as the homepage in place of the dashboard, which is
exactly what happened on 2026-08-13. The symptom to recognise: a workflow named
*pages build and deployment* appearing in the Actions list. Under the correct
setting it does not exist.

## Not investment advice

The dashboard presents collected data and deterministic metrics computed from
it. It produces no recommendations, scores, ratings, or rankings by investment
quality, and the brief is instructed not to either. Figures may be delayed and
are not guaranteed accurate.
