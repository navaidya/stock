/** Calendar arithmetic for the earnings column.
 *
 *  The clock is always passed in. `freshness` is the one function in this
 *  directory allowed to read the time itself; everything else takes `now` as an
 *  argument, so a test can assert what "in 3 days" means without waiting three
 *  days for it to stop being true (MOD-28).
 *
 *  Whole days are counted in UTC from midnight to midnight, deliberately. An
 *  earnings date is a calendar date, not an instant — a report scheduled for
 *  the 24th is "tomorrow" all day on the 23rd, in whatever timezone the reader
 *  happens to be in, and counting elapsed hours would make it flip early for
 *  half of them. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function midnightUTC(iso: string): number | undefined {
  if (!ISO_DATE.test(iso)) return undefined;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(time) ? undefined : time;
}

/** An ISO date string, or undefined if it is not one. Used to keep a malformed
 *  date out of the snapshot rather than onto the screen (MOD-25). */
export function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return undefined;
  return midnightUTC(value) === undefined ? undefined : value;
}

/** Whole days from `now` to an ISO date. Zero on the day itself, undefined for
 *  a date already past — a countdown to something that has happened is not a
 *  countdown, and a negative number in that cell would read as a date. */
export function daysUntil(iso: string | undefined, now: number): number | undefined {
  if (iso === undefined) return undefined;
  const target = midnightUTC(iso);
  if (target === undefined || !Number.isFinite(now)) return undefined;

  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const days = Math.round((target - today) / DAY_MS);
  return days < 0 ? undefined : days;
}

/** `2026-02-24` → `24 Feb`. Short enough for a column, unambiguous in a way
 *  that 02/24 is not outside the US. */
export function shortDate(iso: string | undefined): string | undefined {
  if (isoDate(iso) === undefined) return undefined;
  const [, month, day] = (iso as string).split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

/** The collection date as `YYYY-MM-DD`, for the collector to hand to the pure
 *  mapping layer. */
export function todayISO(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
