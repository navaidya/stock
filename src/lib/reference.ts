/** Hand-curated reference values.
 *
 *  Two of the columns on this dashboard are not on the API at any price tier.
 *  An issuer credit rating lives with the rating agency, and remaining
 *  performance obligation is a line in a quarterly filing. Both are typed by
 *  hand into `data/reference.yaml`, which makes them a different kind of value
 *  from a collected one: nothing refreshes them, so nothing catches them going
 *  stale except the `asOf` date carried alongside (MOD-24).
 *
 *  This module is the trust boundary for that file. It is as suspicious of a
 *  hand-typed rating as `finnhub.ts` is of a remote payload — a typo and a bad
 *  API response fail identically, as an em dash (MOD-19, MOD-21). */
import { normalizeRating } from './rating.ts';
import type { ReferenceEntry } from './types.ts';

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** RPO in millions. Negative is impossible for a backlog, and zero is a real
 *  answer only for a company that reports none — which is the same as absent
 *  here, so both are dropped rather than rendered as `$0M`. */
function millions(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Coerce one raw YAML entry into the fields we are willing to display. */
export function normalizeEntry(raw: unknown): ReferenceEntry {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;

  const entry: ReferenceEntry = {
    creditRating: normalizeRating(r.creditRating),
    creditRatingAgency: text(r.creditRatingAgency),
    creditRatingAsOf: text(r.creditRatingAsOf),
    rpo: millions(r.rpo),
    rpoAsOf: text(r.rpoAsOf),
    rpoSource: text(r.rpoSource),
  };

  // Drop the metadata for a value that did not survive, so a stray as-of date
  // never implies a rating that is not there.
  if (entry.creditRating === undefined) {
    delete entry.creditRatingAgency;
    delete entry.creditRatingAsOf;
  }
  if (entry.rpo === undefined) {
    delete entry.rpoAsOf;
    delete entry.rpoSource;
  }

  for (const key of Object.keys(entry) as (keyof ReferenceEntry)[]) {
    if (entry[key] === undefined) delete entry[key];
  }
  return entry;
}

/** The whole file: a map of ticker to entry. Unknown shapes yield an empty map
 *  rather than throwing — a malformed reference file must not stop the site
 *  building, for the same reason a missing market.json does not (MOD-15). */
export function normalizeReference(raw: unknown): Record<string, ReferenceEntry> {
  const source = (raw as Record<string, unknown> | null)?.reference ?? raw;
  if (!source || typeof source !== 'object') return {};

  const out: Record<string, ReferenceEntry> = {};
  for (const [ticker, value] of Object.entries(source as Record<string, unknown>)) {
    const entry = normalizeEntry(value);
    if (Object.keys(entry).length > 0) out[ticker.toUpperCase()] = entry;
  }
  return out;
}
