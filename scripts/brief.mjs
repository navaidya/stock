/** Daily brief generator.
 *
 *  Runs in GitHub Actions immediately after the collector, reads the market
 *  data that was just written, asks a model to describe it, and writes
 *  data/brief.json for the build to render (BRF-1).
 *
 *  Everything that decides *what is sent* and *what is accepted back* lives in
 *  src/lib/brief.ts, where it is unit-tested without a key. This file is the
 *  network call and the file I/O around it.
 *
 *  It is additive by construction. No key, no data, a refused request, a bad
 *  response — every one of those exits 0 leaving the previous brief in place
 *  (BRF-2, BRF-5). The dashboard is the product; this is a note stapled to it,
 *  and a note failing to write must never fail a data refresh.
 *
 *  Runs the same in CI and on a laptop: `npm run brief` loads a gitignored .env
 *  when one exists, so an owner who would rather not hand a model key to GitHub
 *  can generate the brief locally and commit the result (BRF-12). No key is
 *  committed on either path.
 *
 *  Raw HTTP rather than the Anthropic SDK on purpose: CLAUDE.md forbids adding
 *  a dependency without explicit approval, and one POST does not justify
 *  asking. If the SDK is ever approved, this is the only file that changes.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildPayload, SYSTEM_PROMPT, USER_PREFIX, textFromResponse } from '../src/lib/brief.ts';

const ROOT = process.cwd();
const DATA = join(ROOT, 'data');
const MARKET = join(DATA, 'market.json');
const OUT = join(DATA, 'brief.json');

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.BRIEF_MODEL || 'claude-opus-5';

// Room for the note plus the thinking that precedes it — max_tokens caps both
// together, and a brief truncated mid-sentence is worse than none (BRF-9).
const MAX_TOKENS = 4000;

/** Exit 0 and change nothing. Every failure in this script takes this path. */
function skip(reason) {
  console.log(`No brief written: ${reason}`);
  process.exit(0);
}

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  skip(
    'ANTHROPIC_API_KEY is not set. Put it in a local .env (loaded automatically, ' +
      'gitignored) or in the repository\'s Actions secrets — either enables the brief.',
  );
}

if (!existsSync(MARKET)) skip('data/market.json does not exist yet.');

let market;
try {
  market = JSON.parse(readFileSync(MARKET, 'utf8'));
} catch (err) {
  skip(`data/market.json did not parse (${err.message}).`);
}

const payload = buildPayload(market);
if (payload.stocks.length === 0) skip('the collection contains no symbols.');

const request = {
  model: MODEL,
  max_tokens: MAX_TOKENS,
  // Effort low: this is a summary of a table, not a reasoning problem, and
  // thinking tokens bill as output. Thinking stays on — disabling it is the
  // more expensive lever in every sense.
  output_config: { effort: 'low' },
  system: SYSTEM_PROMPT,
  messages: [
    { role: 'user', content: USER_PREFIX + JSON.stringify(payload, null, 1) },
  ],
};

const response = await fetch(API, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': KEY,
  },
  body: JSON.stringify(request),
}).catch((err) => {
  skip(`request failed (${err.message}).`);
});

let body;
try {
  body = await response.json();
} catch (err) {
  skip(`HTTP ${response.status}: response was not JSON (${err.message}).`);
}

if (!response.ok) {
  const message = body?.error?.message ?? 'no message';
  skip(`HTTP ${response.status}: ${message}`);
}

let text;
try {
  // Checks stop_reason before reading content: a decline is not an empty
  // answer, and the two need different log lines (BRF-11).
  text = textFromResponse(body);
} catch (err) {
  skip(err.message);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      text,
      model: body.model ?? MODEL,
      dataGeneratedAt: payload.generatedAt,
      writtenAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);

const usage = body.usage ?? {};
console.log(
  `Wrote data/brief.json — ${text.length} chars, ` +
    `${usage.input_tokens ?? '?'} in / ${usage.output_tokens ?? '?'} out.`,
);
