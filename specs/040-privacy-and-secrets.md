# 040 — Privacy and secrets

**Prefix:** `SEC` · **Status:** active · **Implements:** `SYS-2`

Owns what may and may not be committed to this repository, and how credentials
are handled.

**Implementation:** [.gitignore](../.gitignore), [.env.example](../.env.example),
[CLAUDE.md](../CLAUDE.md), `tests/data.test.ts`

---

## Context

`navaidya/stock` is a **public** repository. Everything committed is
world-readable, and permanent once indexed — a later deletion does not undo
publication. That asymmetry is why the rules here are absolute rather than
best-effort: a mistake in this area cannot be fixed by a follow-up commit.

The non-obvious part is that a watchlist is itself personal information. Prices
and fundamentals are public facts about companies; *the set of tickers a
particular person follows* is a fact about that person, and combined with a
public repo under their own name it is attributable. This is the requirement
most likely to be violated by accident, because a ticker list does not look
sensitive the way a balance does.

## Requirements

### Financial privacy

- **SEC-1** `MUST` `test` — No committed data file contains position fields:
  share counts, quantities, cost basis, average price, or P&L, under any
  spelling.
- **SEC-7** `MUST` `manual` — No holdings, position sizes, account balances, or
  realized/unrealized P&L appear anywhere in the repository — not in source,
  not in `data/`, not in fixtures, not in tests, and not in commit messages.
- **SEC-3** `MUST` `manual` — `data/` contains only public market data: prices,
  volumes, fundamentals, news. Nothing derived from a personal portfolio.
- **SEC-4** `MUST` `manual` — A personal watchlist lives in gitignored local
  config. Only a small, generic ticker list is committed, for tests and demos.
- **SEC-8** `MUST` `manual` — A feature needing portfolio data loads it at
  runtime from a gitignored file, and the approach is confirmed before anything
  that persists it is written.

### Credentials

- **SEC-2** `MUST` `manual` — No API key appears in the repository, ever — not
  in source, not in `data/`, not in `.mcp.json`, not in a test fixture.
- **SEC-9** `MUST` `manual` — Real keys live in GitHub Actions secrets for the
  collector and in a local gitignored `.env` for development. `.env.example`
  documents the required names with empty values.
- **SEC-5** `MUST` `manual` — If a `.mcp.json` exists it references environment
  variables rather than inline secrets, and it is gitignored. MCP is a
  development-time tool only; the deployed dashboard has no MCP client.
- **SEC-6** `MUST` `build` — No secret reaches the built client output. Since
  the collector runs only in Actions and the site is fully static, no code path
  exists that could embed one — a change that creates such a path is a change
  to `SYS-2`.

### Testability without credentials

- **SEC-10** `MUST` `manual` — Every API call sits behind a thin, mockable
  boundary, so logic stays testable with no credentials present. A session
  started from claude.ai runs in a sandbox with no `.env`; any code path
  requiring a key can be written and reasoned about there, but not executed.

## Known gaps

**`SEC-4` is currently violated.** `data/watchlist.yaml` is committed, is
labelled "Home page watchlist", and contains 15 specific tickers; the home page
describes it as "Tracked positions and watchlist" (`UI-20`). `.gitignore`
already reserves `watchlist.local.*` for the intended pattern.

Two of the entries carry transcription notes referring to a "holding", which
suggests the list originated from a real portfolio rather than a demo set.

This needs a decision, and the options are not equivalent:

1. **Leave it.** The list is already public and already indexed. Accept it and
   amend `SEC-4` to reflect the real intent, so the spec stops claiming a rule
   the repo does not follow.
2. **Replace it going forward.** Move the real list to `watchlist.local.yaml`,
   commit a generic list, and have the collector prefer the local file when
   present. Removes it from `HEAD` but not from history.
3. **Rewrite history.** Options 2 plus a filter of the file out of every
   commit and a force-push. Only this actually removes it from the public
   record, and even then it does not reach anything already cloned, cached, or
   indexed.

Option 2 is the pragmatic middle and the natural default; option 3 is the only
one that honours `SEC-4` as written. The choice belongs to the repository owner.
