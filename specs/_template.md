# NNN — Area name

**Prefix:** `ABC` · **Status:** draft · **Implements:** `SYS-n`, `SYS-m`

One or two sentences on what this spec owns — and, just as usefully, what it
does not, so the boundary with neighbouring specs is explicit.

**Implementation:** [path/to/file.ts](../path/to/file.ts)

---

## Context

Why this area is the way it is. This section is for the reasoning that would
otherwise be lost: the constraint that forced a design, the alternative that was
rejected, the non-obvious fact about the data source.

Requirements say *what*. This says *why*, and it is the part that stops a future
change from cheerfully undoing a deliberate decision.

## Requirements

Group under sub-headings when there are more than about eight. One requirement
per line, in this exact shape — the checker parses it:

- **ABC-1** `MUST` `test` — A single, testable statement of required behaviour.
- **ABC-2** `MUST` `build` — Something a successful build or `astro check`
  proves.
- **ABC-3** `SHOULD` `manual` — A property checked by a human, or one no
  automated check covers yet.
- **ABC-4** `MAY` `ci` — Optional behaviour, enforced by a workflow.

Rules, in short — the full version is in [README.md](README.md) §2:

- IDs are permanent. Never renumber, never reuse. Withdraw in place by marking
  the line `WITHDRAWN` rather than deleting it.
- Level is `MUST` / `SHOULD` / `MAY`; verification is `test` / `build` / `ci` /
  `manual`.
- Tag `test` only when a test actually cites the ID. The checker fails the build
  otherwise, which is the point.
- One requirement per line. If it needs an "and", it is probably two.
- Be specific enough to fail: "renders an em dash", not "handles missing data".

## Known gaps

Where the implementation does not currently meet this spec, what the impact is,
and what the fix would be. Delete the section if there are none.

Mirror anything material into the **Conformance status** table in
[SPEC.md](SPEC.md), which is the single place to see every open gap at once.

## Notes

Anything that helps the next person: how to extend this area, the pitfalls, the
things that look wrong but are deliberate. Optional.
