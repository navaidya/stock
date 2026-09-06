/** Finnhub collector.
 *
 *  Runs in GitHub Actions on a schedule, writes data/market.json, and commits
 *  it. The Astro build reads that JSON — there is no runtime API call and no
 *  server, per CLAUDE.md.
 *
 *  Degrades gracefully by design: one symbol failing must never block the
 *  others, and a run where everything fails must retain the previous data
 *  rather than publishing an empty dashboard.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { mapToSnapshot, symbolDelayMs } from '../src/lib/finnhub.ts';
import { todayISO } from '../src/lib/dates.ts';
import { deriveSeries, mapFredObservations, parseTreasuryYieldCsv } from '../src/lib/macro.ts';

const ROOT = process.cwd();
const DATA = join(ROOT, 'data');
const API = 'https://finnhub.io/api/v1';

// A third collection target reusing the same script and network boundary
// (COL-21, MAC-3): `npm run collect:sp500` / `collect:macro` pass the target
// name here. One file, not three, so there is still exactly one place that
// touches the network (SYS-1 architecture boundary).
const TARGET = ['sp500', 'macro'].includes(process.argv[2]) ? process.argv[2] : 'default';
const OUT = join(DATA, TARGET === 'sp500' ? 'sp500.json' : TARGET === 'macro' ? 'macro.json' : 'market.json');

// The macro target calls FRED and Treasury.gov, not Finnhub, and needs
// FRED_API_KEY instead of FINNHUB_API_KEY.
const KEY = process.env.FINNHUB_API_KEY;
if (TARGET !== 'macro' && !KEY) {
  console.error('FINNHUB_API_KEY is not set. Copy .env.example to .env for local runs,');
  console.error('or add the secret to the repository for CI.');
  process.exit(1);
}

// Free tier allows 60 calls/minute. The calls for one symbol go out in
// parallel, so the wait afterwards has to cover all of them — a flat gap
// between symbols would spend the budget several times over (COL-3).
const CALLS_PER_SYMBOL = 4;
const DELAY_MS = symbolDelayMs(CALLS_PER_SYMBOL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('token', KEY);

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429) throw new Error('rate limited');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function readTickers() {
  if (TARGET === 'sp500') {
    const sp500 = parse(readFileSync(join(DATA, 'sp500.yaml'), 'utf8'))?.sp500 ?? [];
    // Every current index constituent is a company, not a fund.
    return sp500.map((e) => ({ ticker: e.ticker, name: e.name, sector: e.sector, isEtf: false }));
  }

  const watchlist = parse(readFileSync(join(DATA, 'watchlist.yaml'), 'utf8'))?.watchlist ?? [];
  const universe = parse(readFileSync(join(DATA, 'ai-universe.yaml'), 'utf8'))?.universe ?? [];

  // The two lists overlap (NVDA, AVGO, ANET). Collect each symbol once.
  const seen = new Map();
  for (const e of [...watchlist, ...universe]) {
    if (!seen.has(e.ticker)) {
      seen.set(e.ticker, {
        ticker: e.ticker,
        name: e.name,
        sector: e.sector,
        segment: e.segment,
        isEtf: e.sector === 'etf',
      });
    }
  }
  return [...seen.values()];
}

function loadPrevious() {
  if (!existsSync(OUT)) return { generatedAt: '', failed: [], stocks: {} };
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    return { generatedAt: '', failed: [], stocks: {} };
  }
}

// Far enough ahead to catch the next report for any symbol, since a quarter is
// about 90 days and dates are confirmed only a few weeks out.
const EARNINGS_WINDOW_DAYS = 120;

/** The earnings calendar, over a forward window from today (COL-18).
 *
 *  Failure here is swallowed on purpose (COL-19). This is the endpoint most
 *  likely to be withdrawn from the free tier, and an earnings date is worth
 *  much less than the price and fundamentals that would be lost with it if one
 *  403 failed the whole symbol. */
async function collectEarnings(ticker, today) {
  const to = todayISO(Date.parse(`${today}T00:00:00Z`) + EARNINGS_WINDOW_DAYS * 86_400_000);
  try {
    return await get('/calendar/earnings', { symbol: ticker, from: today, to });
  } catch (err) {
    console.warn(`\n  ${ticker}: no earnings calendar (${err.message})`);
    return undefined;
  }
}

async function collectOne(entry, today) {
  const [quote, profile, metrics, earnings] = await Promise.all([
    get('/quote', { symbol: entry.ticker }),
    get('/stock/profile2', { symbol: entry.ticker }),
    get('/stock/metric', { symbol: entry.ticker, metric: 'all' }),
    collectEarnings(entry.ticker, today),
  ]);
  return mapToSnapshot({ ...entry, quote, profile, metrics, earnings, today });
}

const FRED_KEY = process.env.FRED_API_KEY;
const FRED_API = 'https://api.stlouisfed.org/fred';

async function getFredObservations(seriesId) {
  const url = new URL(`${FRED_API}/series/observations`);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', FRED_KEY);
  url.searchParams.set('file_type', 'json');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return body.observations;
}

// Treasury's yield-curve export is one file per calendar year. Two years
// covers a full 12 months of history even collected on January 1st.
async function getTreasuryYieldCsv(year) {
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/` +
    `daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve` +
    `&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Collects the macro event series (MAC-3). Every FRED series and the
 *  Treasury yield fetch are isolated from each other (MAC-4, SYS-4): one
 *  failing leaves that series/the yields absent from the output rather than
 *  aborting the run or blocking anything else. */
async function mainMacro() {
  if (!FRED_KEY) {
    console.error('FRED_API_KEY is not set. Copy .env.example to .env for local runs,');
    console.error('or add the secret to the repository for CI.');
    process.exit(1);
  }

  const events = parse(readFileSync(join(DATA, 'macro-events.yaml'), 'utf8'))?.events ?? [];
  const series = {};
  const failed = [];

  for (const event of events) {
    if (!event.fredSeries) continue; // fomc has a hand-curated calendar, no FRED series
    try {
      const observations = mapFredObservations(await getFredObservations(event.fredSeries));
      series[event.id] = deriveSeries(observations, event.derive ?? 'level');
      process.stdout.write('.');
    } catch (err) {
      failed.push(event.id);
      console.warn(`\n  ${event.id} (${event.fredSeries}): ${err.message}`);
      process.stdout.write('x');
    }
  }
  console.log('');

  const thisYear = new Date().getFullYear();
  let yields = [];
  try {
    // Parsed and concatenated as points, not as raw CSV text: Treasury has
    // changed the column set before (the 1.5-month bill, added 2025), so two
    // years' files are not guaranteed to share one header.
    const [prior, current] = await Promise.all([
      getTreasuryYieldCsv(thisYear - 1),
      getTreasuryYieldCsv(thisYear),
    ]);
    yields = [...parseTreasuryYieldCsv(prior), ...parseTreasuryYieldCsv(current)];
    // A parsed date with no maturity fields at all means the header text
    // Treasury sent did not match anything in TREASURY_COLUMNS — a silent
    // failure mode otherwise indistinguishable from "no yields today." Warn
    // loudly with the actual header so a format change is caught, not missed.
    const yieldless = yields.filter((y) => Object.keys(y).length === 1).length;
    if (yields.length > 0 && yieldless === yields.length) {
      console.warn(`Treasury yields: every point parsed with no maturity columns matched.`);
      console.warn(`  current-year header: ${current.split('\n')[0]}`);
    }
  } catch (err) {
    failed.push('treasuryYields');
    console.warn(`Treasury yields: ${err.message}`);
  }

  if (Object.keys(series).length === 0 && yields.length === 0) {
    console.error('Every macro source failed. Not overwriting data/macro.json.');
    process.exit(existsSync(OUT) ? 0 : 1);
  }

  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), failed, series, yields }, null, 2) + '\n',
  );
  console.log(`Wrote ${Object.keys(series).length} series and ${yields.length} yield points to data/macro.json`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

async function main() {
  if (TARGET === 'macro') return mainMacro();

  const entries = readTickers();
  const previous = loadPrevious();
  const stocks = {};
  const failed = [];

  const today = todayISO(Date.now());
  console.log(`Collecting ${entries.length} symbols at ${DELAY_MS}ms per symbol...`);

  for (const entry of entries) {
    try {
      stocks[entry.ticker] = await collectOne(entry, today);
      process.stdout.write('.');
    } catch (err) {
      failed.push(entry.ticker);
      // Keep the last good snapshot so one bad symbol does not blank a row.
      const stale = previous.stocks?.[entry.ticker];
      if (stale) stocks[entry.ticker] = { ...stale, errors: [`stale: ${err.message}`] };
      process.stdout.write('x');
    }
    await sleep(DELAY_MS);
  }

  console.log('');

  if (Object.keys(stocks).length === 0) {
    console.error('Every symbol failed. Retaining previous data rather than writing an empty file.');
    process.exit(previous.generatedAt ? 0 : 1);
  }

  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), failed, stocks }, null, 2) + '\n',
  );

  console.log(`Wrote ${Object.keys(stocks).length} symbols to data/market.json`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
