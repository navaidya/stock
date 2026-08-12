/** Column sorting.
 *
 *  Pure, and deliberately shared between the build and the browser: the same
 *  functions order the prerendered rows and reorder them on a click, so a sort
 *  cannot mean one thing on the server and another on the client.
 *
 *  Two rules carry all the weight:
 *
 *  **Missing sorts last, both ways** (UI-22). An em dash is not a small number.
 *  Sorting P/E ascending to find the cheapest name must not put every company
 *  the API had no P/E for at the top — that is the reading error this dashboard
 *  is most likely to cause, because the rows look like data.
 *
 *  **Compare values, not the rendered string** (UI-24). `$1.20T` sorts below
 *  `$900M` as text, and `AA-` sorts below `BBB`. So the sort key comes from the
 *  snapshot field, or from a column's explicit accessor where the displayed
 *  form and the orderable form differ — as they do for a credit rating. */
import type { Column } from './columns.ts';
import type { StockSnapshot } from './types.ts';

export type SortDirection = 'asc' | 'desc';

/** Null is included because these values survive a JSON round trip on the way
 *  to the browser, and `undefined` does not. Both mean "no value". */
export type SortValue = number | string | null | undefined;

function isMissing(v: SortValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'number') return !Number.isFinite(v);
  return v.trim() === '';
}

/** The orderable value behind a cell. Defaults to the snapshot field matching
 *  the column key, which is true of every column whose display is a plain
 *  formatting of one field. */
export function sortValueOf(column: Column, s: StockSnapshot): SortValue {
  if (column.sort) return column.sort(s);
  const raw = (s as unknown as Record<string, unknown>)[column.key];
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  return undefined;
}

/** Comparator honouring direction, with missing values pinned last regardless
 *  of it — which is why direction is applied to the comparison rather than by
 *  reversing the result array. */
export function compareValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  const aMissing = isMissing(a);
  const bMissing = isMissing(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  let cmp: number;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
  }
  return direction === 'asc' ? cmp : -cmp;
}

/** Row indices in sorted order. Stable: equal values fall back to the original
 *  position, so sorting by one column twice is idempotent and sorting by a
 *  second column preserves the first as a tiebreak. */
export function sortOrder(values: SortValue[], direction: SortDirection): number[] {
  return values
    .map((value, index) => ({ value, index }))
    .sort((x, y) => compareValues(x.value, y.value, direction) || x.index - y.index)
    .map(({ index }) => index);
}

/** Convenience for the build side and for tests: rows sorted by one column. */
export function sortRows(
  rows: StockSnapshot[],
  column: Column,
  direction: SortDirection,
): StockSnapshot[] {
  const values = rows.map((row) => sortValueOf(column, row));
  return sortOrder(values, direction).map((index) => rows[index]);
}
