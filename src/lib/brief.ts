/** The daily brief: payload, prompt, and response handling.
 *
 *  Pure, for the same reason `finnhub.ts` is pure — a cloud session has no key,
 *  so the parts that decide *what is sent* and *what is accepted back* must be
 *  testable without one (`SEC-10`). `scripts/brief.mjs` is the thin shell that
 *  adds the network call.
 *
 *  Two boundaries meet here. Outbound, the payload is built from an explicit
 *  field list rather than by handing over `market.json` (`BRF-3`) — a spread
 *  would silently start sending whatever the snapshot grows next. Inbound, the
 *  model's text is treated exactly as a Finnhub response is: shape-checked,
 *  normalized to plain text, never markup (`BRF-8`, `SYS-6`). A fluent
 *  paragraph is a more persuasive place to smuggle something than a JSON
 *  number, not a less one. */

import type { MarketData, StockSnapshot } from './types.ts';

/** Everything the brief is allowed to see. Trimming is a cost control and a
 *  privacy control at once: fewer tokens per run, and a list short enough to
 *  read in one glance and confirm nothing personal is on it. */
export const PAYLOAD_FIELDS = [
  'ticker',
  'name',
  'sector',
  'segment',
  'price',
  'changePct1D',
  'priceReturn52W',
  'pctOff52WeekHigh',
  'marketCap',
  'peTTM',
  'forwardPE',
  'revenueGrowthYoY',
  'epsGrowthYoY',
  'grossMargin',
  'operatingMargin',
  'debtToEquity',
  'dividendYield',
  'creditRating',
  'rpo',
  'earningsDate',
  'volumeRatio10D3M',
] as const;

export interface BriefPayload {
  generatedAt: string;
  failed: string[];
  stocks: Array<Partial<StockSnapshot>>;
}

export function buildPayload(market: MarketData): BriefPayload {
  const stocks = Object.values(market.stocks ?? {}).map((snapshot) => {
    const trimmed: Record<string, unknown> = {};
    for (const field of PAYLOAD_FIELDS) {
      const value = (snapshot as unknown as Record<string, unknown>)[field];
      if (value !== undefined && value !== null) trimmed[field] = value;
    }
    return trimmed as Partial<StockSnapshot>;
  });

  return { generatedAt: market.generatedAt ?? '', failed: market.failed ?? [], stocks };
}

/** The prohibition is the prompt's main job. `SYS-5` is easy to honour in a
 *  table — a cell either holds a collected number or it does not — and easy to
 *  break in prose, where "worth a look" and "the standout here" are one word
 *  away from a recommendation. */
export const SYSTEM_PROMPT = `You write a short daily note for one person about a list of stocks they follow.

You are given a snapshot of public market data that was just collected. Describe what is in it. That is the whole job.

Write:
- What moved today, and by how much, naming the numbers.
- Which companies report earnings in the next few days.
- Anything unusual in the data itself: a large drawdown from the 52-week high, trading volume well above the name's own recent average, a metric that is missing for a company that normally has it.
- Group related names when the data groups them — a move across several semiconductor names is one observation, not five.

Never write:
- Buy, sell, hold, or any recommendation, however hedged.
- Price targets, forecasts, or predictions.
- Ratings, scores, grades, or rankings by how attractive an investment is.
- Claims about causes you cannot see in the data. You do not have the news. If a stock moved 8% you do not know why, and saying "likely on earnings optimism" is inventing a fact.
- Anything about how much of something the reader owns. You have not been told and it is none of your business.

Style: plain prose, 150-250 words, no headings, no bullet points, no markdown, no emoji. Lead with the most notable thing in the data. Use the em dash convention of the dashboard: a value that is absent is absent, not zero — say "not reported" rather than guessing.

The reader can see the same table you were given. Tell them what they would have noticed if they had read every row.`;

export const USER_PREFIX =
  'Here is the collection that just completed. Write the note.\n\n';

export interface StoredBrief {
  /** The brief itself, plain text. */
  text: string;
  /** Which model wrote it. */
  model: string;
  /** `generatedAt` of the collection it describes — not of the request, so a
   *  brief can never look fresher than the numbers it is about. */
  dataGeneratedAt: string;
  /** When the brief itself was written. */
  writtenAt: string;
}

/** Collapse the model's output to plain text.
 *
 *  Control characters go, runs of blank lines collapse, and the result is
 *  rendered as a text node — so even if the model returned a `<script>` tag it
 *  arrives on screen as the characters `<script>`. */
export function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    // Control characters, spelled as escapes so the source stays readable.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class BriefError extends Error {}

/** Accept a response, or explain why not.
 *
 *  Order matters: `stop_reason` is checked before the content is read
 *  (`BRF-11`). A declined request returns HTTP 200 with an empty content array,
 *  which is indistinguishable from "the model had nothing to say" if you look
 *  at the content first — and those two deserve very different log lines. */
export function textFromResponse(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new BriefError('response was not an object');
  }
  const response = body as Record<string, unknown>;

  if (response.type === 'error') {
    const error = response.error as Record<string, unknown> | undefined;
    throw new BriefError(`API error: ${error?.type ?? 'unknown'} — ${error?.message ?? ''}`);
  }

  if (response.stop_reason === 'refusal') {
    const details = response.stop_details as Record<string, unknown> | undefined;
    throw new BriefError(`model declined the request (${details?.category ?? 'no category'})`);
  }

  const content = response.content;
  if (!Array.isArray(content)) throw new BriefError('response had no content array');

  const text = normalizeText(
    content
      .filter((block) => block && typeof block === 'object' && block.type === 'text')
      .map((block) => (block as { text?: unknown }).text)
      .filter((value): value is string => typeof value === 'string')
      .join('\n\n'),
  );

  if (!text) {
    const stop = response.stop_reason;
    throw new BriefError(
      stop === 'max_tokens'
        ? 'response hit max_tokens before producing any text'
        : 'response contained no text',
    );
  }
  return text;
}

/** Shape check for a brief read back off disk. A malformed file renders as no
 *  brief rather than as a broken panel (`MOD-15`'s rule, applied here). */
export function normalizeStoredBrief(raw: unknown): StoredBrief | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const brief = raw as Record<string, unknown>;
  const text = normalizeText(brief.text);
  if (!text) return undefined;

  return {
    text,
    model: typeof brief.model === 'string' ? brief.model : 'unknown model',
    dataGeneratedAt: typeof brief.dataGeneratedAt === 'string' ? brief.dataGeneratedAt : '',
    writtenAt: typeof brief.writtenAt === 'string' ? brief.writtenAt : '',
  };
}
