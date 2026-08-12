import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { MarketData, StockSnapshot, UniverseEntry, WatchlistEntry } from './types.ts';

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

/** Collected market data. Missing entirely on a fresh clone before the
 *  collector has ever run, so the site must build without it — otherwise the
 *  first deploy fails and nobody can see the dashboard at all. */
export function loadMarketData(): MarketData {
  const path = join(DATA, 'market.json');
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
): StockSnapshot[] {
  return entries.map((entry) => {
    const collected = market.stocks[entry.ticker];
    const segment = 'segment' in entry ? entry.segment : undefined;
    const sector = 'sector' in entry ? entry.sector : undefined;
    if (!collected) {
      return { ticker: entry.ticker, name: entry.name, sector, segment, errors: ['no data'] };
    }
    return { ...collected, name: entry.name, sector: sector ?? collected.sector, segment };
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
