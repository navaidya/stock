# How spec-driven development works in this repo

The specs in this directory are the source of truth for behaviour. Code is the
implementation of a spec; tests are the evidence that the implementation matches
it. When behaviour and spec disagree, one of them is a bug — and which one is a
decision to make deliberately, not to discover later.

This document is the process. [SPEC.md](SPEC.md) is the system.

---

## 1. Why bother, given this is a one-person project

Two specific reasons, both practical:

- **Most sessions start cold.** Work happens from a phone, from a laptop, and
  from cloud sessions with no credentials. A spec is the context that does not
  have to be re-derived from reading twenty files, and it is the thing an agent
  can be pointed at instead of guessing.
- **Push equals deploy.** There is no review step between a commit and the live
  site. A written requirement with a test behind it is the only durable check on
  a change made in a hurry.

The cost of this only pays off if the spec cannot silently drift. That is what
section 4 is for.

## 2. Requirement format

Every requirement is a single line, in a `## Requirements` section, in this
exact shape:

```
- **MOD-4** `MUST` `test` — pctOff52WeekHigh is zero or negative, computed only
  when both a price and a positive 52-week high are present.
```

| Part | Rule |
|---|---|
| **ID** | `<PREFIX>-<number>`, bold. Prefix is the child spec's, from the index in [SPEC.md](SPEC.md). **IDs are permanent.** Never renumber, never reuse. A withdrawn requirement is marked `WITHDRAWN` in place, not deleted. |
| **Level** | `MUST`, `SHOULD`, or `MAY`, in backticks. RFC 2119 meanings. |
| **Verification** | How this is checked, in backticks. One of the four below. |
| **Text** | After an em dash. One requirement per line — if it needs "and", it is probably two requirements. Testable and specific: "renders an em dash", not "handles missing data well". |

### Verification tags

| Tag | Means | Enforced by |
|---|---|---|
| `test` | A unit test asserts this | `scripts/check-specs.mjs` — **fails the build** if no test cites the ID |
| `build` | `astro check` or a successful build proves it | The build itself |
| `ci` | A workflow enforces it | GitHub Actions |
| `manual` | A human check, or a property no automated check covers yet | Nothing — treat as a standing invitation to promote it to `test` |

Choose the tag that reflects how the requirement is verified **today**, not how
you wish it were. Marking something `test` because it ought to be tested breaks
the build, which is the point: the tag is a claim, and the checker calls it.

## 3. Linking tests to requirements

A test cites the requirement it proves by putting the ID in its name:

```ts
it('[MOD-4] computes percent off the 52-week high as a negative number', () => {
```

One test may cite several IDs; several tests may cite one ID. The checker only
asks that every `MUST` + `test` requirement is cited somewhere under `tests/`.

## 4. The traceability gate

```bash
npm run spec:check
```

Runs as the first half of `npm test`, so it runs locally, on every push, and in
the deploy workflow. It fails on:

1. **An uncovered requirement** — `MUST` + `test` with no test citing its ID.
2. **An orphan citation** — a test citing an ID that no spec defines, which is
   what a renamed or deleted requirement looks like.
3. **A duplicate ID** — the same ID defined in two places.
4. **A malformed requirement line** — something that looks like a requirement
   but does not parse, so it cannot silently go unchecked.

This is the whole mechanism. It is deliberately small: it does not verify that a
test is *good*, only that the claimed link exists in both directions. That is
enough to stop the common failure, which is a spec quietly describing a system
that stopped existing months ago.

## 5. The workflow

For any behaviour change:

1. **Write the spec change first.** New requirement, or an edit to an existing
   one. If it is a new area, copy [_template.md](_template.md).
2. **Decide the level and verification tag.** If it is `MUST` + `test`, the
   build now fails until step 4 exists. Good.
3. **Confirm the intent** before implementing, if the change alters an existing
   requirement or touches a `SYS-*` invariant. Adding a new requirement inside
   an existing area does not need a round trip.
4. **Write the failing test**, citing the ID.
5. **Implement** until it passes.
6. **Run the gate:** `npm test && npm run build`. Both must pass.
7. **Commit spec, test, and code together.** A spec change in its own commit is
   a spec that was never implemented; code in its own commit is a spec that
   silently drifted. One commit, so the diff shows the requirement and its
   implementation side by side.

For a pure refactor with no behaviour change: no spec change, and the existing
tests must pass untouched. If a refactor requires editing a test assertion, it
is a behaviour change — go back to step 1.

### When the spec is wrong

Specs are wrong all the time. The rule is only that they are corrected
deliberately:

- Edit the requirement text in place if the intent is unchanged.
- Mark it `WITHDRAWN` and add a new ID if the intent changed. Keep the old line
  so that git history and the reasoning stay legible.
- Update the **Conformance status** table in [SPEC.md](SPEC.md) when a gap opens
  or closes.

Never weaken a requirement to make a build pass. That is the same failure as
weakening a test to make a push succeed, which `CLAUDE.md` already forbids.

## 6. Working with an agent

Point at the spec, not at the files:

> Implement `COL-6`. The requirement and the failure mode are in
> `specs/010-data-collection.md` and the conformance table in `specs/SPEC.md`.

And to record new work:

> Add a requirement to `specs/030-presentation.md` for sector grouping on the
> home page, then implement it.

The gate makes this self-correcting: an agent that implements without citing the
requirement fails `spec:check`, and an agent that writes a requirement without
implementing it fails the same check from the other side.

## 7. Layout

```
specs/
  README.md                  this file — process
  SPEC.md                    master spec — scope, invariants, index, conformance
  _template.md               starting point for a new child spec
  010-data-collection.md     COL
  020-data-model.md          MOD
  030-presentation.md        UI
  040-privacy-and-secrets.md SEC
  050-delivery.md            DEL
```

Numbers are spaced by ten so a new spec can slot between two existing ones
without renumbering. The number is part of the filename only — requirement IDs
use the prefix, so a file can be renamed without invalidating any citation.
