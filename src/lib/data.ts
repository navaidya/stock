import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { normalizeStoredBrief, type StoredBrief } from './brief.ts';
import { daysUntil } from './dates.ts';
import { normalizeReference } from './reference.ts';
import type {
  MarketData,
  ReferenceEntry,
  StockSnapshot,
  UniverseEntry,
  WatchlistEntry,
} from './types.ts';

const ROOT = process.cwd();
const DATA = join(ROOT, 'data');

export function loadWatchlist(): WatchlistEntry[] {
  const raw = parse(readFileSync(join(DATA, 'watchlist.yaml'), 'utf8'));
  return raw?.watchlist ?? [];
}

export function loadUniverse(): { segments: Record<string, string>; universe: UniverseEntry[] } {
  const raw = parse(readFileSync(join(DATA, 'ai-universe.yaml'), 'utf8'));
  return { segments: raw?.segments ?? {}, universe: raw?.universe ?? [] };
}

/** The full S&P 500 constituent list for the /sp500 screening page. Public
 *  index membership, not a personal list — see data/sp500.yaml's header. */
export function loadSp500(): WatchlistEntry[] {
  const raw = parse(readFileSync(join(DATA, 'sp500.yaml'), 'utf8'));
  return raw?.sp500 ?? [];
}

/** Hand-curated values the API does not carry — credit ratings, RPO. Optional
 *  in the same way market.json is: absent or malformed yields an empty map and
 *  the columns render as em dashes. */
export function loadReference(): Record<string, ReferenceEntry> {
  const path = join(DATA, 'reference.yaml');
  if (!existsSync(path)) return {};
  try {
    return normalizeReference(parse(readFileSync(path, 'utf8')));
  } catch {
    return {};
  }
}

/** The machine-written brief over the last collection, when one exists.
 *  Absent, malformed, or empty all mean the same thing here: no brief, and a
 *  page that renders without one rather than around a hole (BRF-2). */
export function loadBrief(): StoredBrief | undefined {
  const path = join(DATA, 'brief.json');
  if (!existsSync(path)) return undefined;
  try {
    return normalizeStoredBrief(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return undefined;
  }
}

/** Collected market data. Missing entirely on a fresh clone before the
 *  collector has ever run, so the site must build without it — otherwise the
 *  first deploy fails and nobody can see the dashboard at all.
 *
 *  `file` selects the collection target — `market.json` (default) or
 *  `sp500.json`, written by the matching `scripts/collect.mjs` target. */
export function loadMarketData(file: string = 'market.json'): MarketData {
  const path = join(DATA, file);
  if (!existsSync(path)) {
    return { generatedAt: '', failed: [], stocks: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return {
      generatedAt: parsed.generatedAt ?? '',
      failed: parsed.failed ?? [],
      stocks: parsed.stocks ?? {},
    };
  } catch {
    return { generatedAt: '', failed: [], stocks: {} };
  }
}

/** Merge the curated list with collected data. A symbol with no collected data
 *  still appears, with every metric blank — the reader should see that a name
 *  is being tracked but has no data, not silently lose the row. */
export function hydrate(
  entries: Array<WatchlistEntry | UniverseEntry>,
  market: MarketData,
  reference: Record<string, ReferenceEntry> = {},
  now: number = Date.now(),
): StockSnapshot[] {
  const countdown = (s: StockSnapshot): StockSnapshot => {
    // Computed at build, not stored: "in 3 days" is only true on the day it was
    // worked out, and this page is rebuilt every time data lands.
    const days = daysUntil(s.earningsDate, now);
    return days === undefined ? s : { ...s, daysToEarnings: days };
  };

  return entries.map((entry) => {
    const collected = market.stocks[entry.ticker];
    const segment = 'segment' in entry ? entry.segment : undefined;
    const sector = 'sector' in entry ? entry.sector : undefined;
    // Reference values go on first, so anything the collector actually returned
    // wins over a hand-typed one. The collector is the authority for what it
    // collects; the reference file only fills what it cannot reach.
    const ref = reference[entry.ticker] ?? {};
    if (!collected) {
      return { ticker: entry.ticker, name: entry.name, sector, segment, ...ref, errors: ['no data'] };
    }
    return countdown({
      ...ref,
      ...collected,
      name: entry.name,
      sector: sector ?? collected.sector,
      segment,
    });
  });
}

export function freshness(generatedAt: string): { label: string; stale: boolean } {
  if (!generatedAt) return { label: 'never collected', stale: true };
  const then = new Date(generatedAt).getTime();
  if (Number.isNaN(then)) return { label: 'unknown', stale: true };
  const hours = (Date.now() - then) / 3_600_000;
  if (hours < 1) return { label: 'updated less than an hour ago', stale: false };
  if (hours < 24) return { label: `updated ${Math.round(hours)}h ago`, stale: false };
  const days = Math.round(hours / 24);
  return { label: `updated ${days}d ago`, stale: true };
}
