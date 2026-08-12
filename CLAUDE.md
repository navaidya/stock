# Stock Analysis Dashboard — Project Instructions

## What this is

A personal live-updating dashboard for stock analysis. Static-first: Astro,
TypeScript, and JSON data files, deployed to GitHub Pages. Same architecture as
the `learning` repo — no backend, no database, no server-side API.

## This project is spec-driven — read the spec first

`specs/` is the source of truth for behaviour. **Start there, not in the source
files.** `specs/SPEC.md` is the master spec: scope, non-goals, system-wide
invariants, the child spec index, and a live table of known gaps.
`specs/README.md` is the process.

The rules that matter for any change:

- **Spec first.** A behaviour change starts by writing or editing a requirement,
  then a test citing its ID, then the implementation. Commit all three together.
- **Requirement IDs are permanent** (`MOD-4`, `COL-6`, …). Never renumber or
  reuse one. Withdraw in place; do not delete.
- **`npm run spec:check` is a build gate**, and runs as part of `npm test`. It
  fails if a `MUST` requirement tagged `test` has no test citing its ID, if a
  test cites an ID no spec defines, or if an ID is defined twice.
- **Never weaken a requirement to make the gate pass.** That is the same failure
  as weakening a test to make a push succeed. If the spec is wrong, change it
  deliberately and say so.
- **Update the conformance table** in `specs/SPEC.md` in the same commit that
  opens or closes a gap.

The rest of this file is context and constraint. Where it and a spec overlap,
the spec carries the requirement ID and the testable wording.

## How "live" data works

Data is refreshed by a **scheduled GitHub Actions collector**, not by a running
server and not by MCP:

1. A cron workflow runs a Node collector script.
2. The collector calls stock APIs using credentials from GitHub Actions secrets.
3. It writes plain JSON into `data/`.
4. It commits the JSON, which triggers the Pages deploy and rebuilds the site.

Consequences that must not be designed around:

- **Refresh floor is minutes, not seconds.** GitHub Actions cron is scheduled on
  a best-effort basis and is routinely delayed under load. This design suits
  hourly or end-of-day analysis. It cannot deliver real-time tick data — that
  would require a backend, which is out of scope.
- Never call a paid or rate-limited API from the browser with an embedded key.
  A key shipped to the client is a public key.
- If the browser must fetch live quotes directly, use only an endpoint whose key
  is safe to expose publicly, or one that needs no key at all. Otherwise route
  it through the collector.

## MCP servers

MCP servers are a **development-time** tool: they let Claude query market data
while building and analyzing with you. They are not a runtime component of the
deployed dashboard, which has no MCP client.

Never commit MCP credentials. If a `.mcp.json` is added, it must reference
environment variables rather than inline secrets.

## This repository is PUBLIC

`navaidya/stock` is a public repository, so everything committed is
world-readable and effectively permanent once indexed. Never commit personal
financial information:

- No holdings, position sizes, share counts, cost basis, account balances, or
  realized/unrealized P&L — not in source, not in `data/`, not in fixtures, not
  in test files, and not in commit messages.
- A **watchlist is personal information too**: the set of tickers someone
  follows is revealing. Keep any personal watchlist in gitignored local config
  and commit only a small generic ticker list for tests and demos.
- Collected market data in `data/` must contain only public market data —
  prices, volumes, fundamentals, news — never anything derived from a personal
  portfolio.
- If a feature needs portfolio data, load it at runtime from a gitignored file
  and stop to confirm the approach before writing anything that persists it.

## Secrets

- No API keys in the repository, ever — not in source, not in `data/`, not in
  `.mcp.json`. `.env` is gitignored; commit `.env.example` with empty values to
  document what is required.
- Real keys live in GitHub Actions secrets for the collector, and in a local
  `.env` for development.
- **Cloud sessions have no secrets.** A session started from claude.ai runs in a
  sandbox with no `.env`, so any code path that needs a key cannot be executed
  there — only written and reasoned about. Keep API calls behind a thin, mockable
  boundary so logic stays testable without credentials.

## Data handling

- Treat all remote API responses as untrusted: validate shape before use,
  normalize to plain text, and never render raw remote HTML.
- Keep calculations in focused, deterministic TypeScript modules under `src/lib/`
  and unit-test them against fixture JSON, never against the live API.
- Degrade gracefully: one source failing must never block others or erase
  previously-collected data. If every source fails, retain prior data and exit
  successfully rather than writing an empty result.
- Nothing here is investment advice. The dashboard presents data and computed
  metrics; it must not generate buy/sell recommendations.

## Quality and workflow

- Reproduce the environment with `npm ci`, never a bare `npm install` that would
  drift `package-lock.json`.
- Run `npm test` and `npm run build` before proposing a change as complete.
- Do not add dependencies without explicit approval. Keep them minimal.
- **Always commit and push when work is done**, including when the session was
  prompted from a phone. Do not leave finished work sitting uncommitted.
- Because a push to `main` deploys straight to Pages with no review step,
  `npm test` and `npm run build` must both pass *before* pushing. That gate is
  the only thing between a phone prompt and the live site — never push past a
  failing test, and never weaken a test to make a push succeed.
- If tests or the build fail and cannot be fixed, commit the work on a branch
  instead and say so plainly, rather than pushing a broken `main`.
