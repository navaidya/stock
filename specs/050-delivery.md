# 050 — Delivery

**Prefix:** `DEL` · **Status:** active

Owns the build, the quality gate, the deploy, and the dependency policy.

**Implementation:** [.github/workflows/deploy.yml](../.github/workflows/deploy.yml),
[package.json](../package.json), [scripts/check-specs.mjs](../scripts/check-specs.mjs)

---

## Context

A push to `main` deploys straight to GitHub Pages with no review step. There is
no staging environment and no approval gate. `npm test` and `npm run build` are
therefore not hygiene — they are the entire distance between a prompt typed on a
phone and the live site.

Everything in this spec follows from that: the gate must run locally and in CI,
must be fast enough that nobody is tempted to skip it, and must never be
weakened to make a push succeed.

## Requirements

### The gate

- **DEL-1** `MUST` `ci` — `npm test` and `npm run build` both pass before any
  push to `main`. A failing gate means the work goes on a branch instead.
- **DEL-7** `MUST` `manual` — A test is never weakened, skipped, or deleted to
  make a push succeed. If a test is wrong, the requirement it cites is wrong,
  and that is a spec change (see [README.md](README.md) §5).
- **DEL-2** `MUST` `ci` — The deploy workflow runs `npm ci`, then `npm test`,
  then `npm run build`, then uploads `dist/` to Pages. A test failure blocks the
  deploy.
- **DEL-8** `MUST` `build` — `npm run build` runs `astro check` before building
  and fails on any type error.

### Traceability

- **DEL-5** `MUST` `ci` — Every `MUST` requirement tagged `test` is referenced
  by at least one test, every requirement ID cited in a test is defined in a
  spec, and no ID is defined twice. Enforced by `npm run spec:check`, which runs
  as part of `npm test`.
- **DEL-6** `MUST` `manual` — A behaviour change commits its spec change, its
  test, and its implementation together. A spec change alone is a requirement
  that was never built; code alone is a spec that has silently drifted.
- **DEL-9** `MUST` `manual` — The **Conformance status** table in
  [SPEC.md](SPEC.md) is updated in the same commit that opens or closes a gap.

### Dependencies

- **DEL-3** `MUST` `manual` — Dependencies are restored with `npm ci`, never a
  bare `npm install`, which would drift `package-lock.json`.
- **DEL-4** `MUST` `manual` — No dependency is added without explicit approval.
  The dependency set stays minimal.
- **DEL-10** `SHOULD` `manual` — Tooling written for this repo uses the Node
  standard library, so the quality gate itself adds no dependencies.

### Environment

- **DEL-11** `MUST` `ci` — CI runs Node 22.
- **DEL-12** `MUST` `manual` — Work is committed and pushed when done, including
  when the session was prompted from a phone. Finished work is not left
  uncommitted.

## Commands

```bash
npm ci             # restore exactly what the lockfile pins
npm run dev        # local dev server
npm run spec:check # traceability gate alone
npm test           # spec:check, then the unit tests
npm run build      # astro check, then a static build into dist/
npm run collect    # one collection run; requires FINNHUB_API_KEY
```
