import { describe, expect, it } from 'vitest';
import { QUOTE_PROVIDER, quoteUrl, toQuoteSymbol } from '../src/lib/links.ts';
import { aiColumns, dividendColumns, homeColumns } from '../src/lib/columns.ts';
import { loadUniverse, loadWatchlist } from '../src/lib/data.ts';

describe('external quote links', () => {
  it('[UI-42] links every ticker to a quote page for that symbol', () => {
    expect(quoteUrl('NVDA')).toBe('https://finance.yahoo.com/quote/NVDA');
  });

  it('[UI-42] maps a class share to the destination spelling rather than pasting it', () => {
    // BRK.B here is BRK-B there. Concatenating the raw symbol 404s silently.
    expect(toQuoteSymbol('BRK.B')).toBe('BRK-B');
    expect(quoteUrl('BRK.B')).toBe('https://finance.yahoo.com/quote/BRK-B');
    expect(quoteUrl(' brk.b ')).toBe('https://finance.yahoo.com/quote/BRK-B');
  });

  it('[UI-42] produces no link at all for an unusable symbol', () => {
    for (const junk of ['', '   ', 'not a ticker', 'AAPL/../evil', 'TOOLONGSYMBOL', undefined]) {
      expect(quoteUrl(junk as string | undefined), String(junk)).toBeUndefined();
    }
  });

  it('[UI-42] every ticker in both curated lists yields a link', () => {
    const tickers = [...loadWatchlist(), ...loadUniverse().universe].map((e) => e.ticker);
    expect(tickers.length).toBeGreaterThan(0);
    for (const ticker of tickers) {
      expect(quoteUrl(ticker), `${ticker} has no quote link`).toMatch(
        /^https:\/\/finance\.yahoo\.com\/quote\/[A-Z0-9-]+$/,
      );
    }
  });

  it('[UI-42] the ticker column carries the link on every page', () => {
    for (const columns of [homeColumns, aiColumns, dividendColumns]) {
      const ticker = columns.find((c) => c.key === 'ticker')!;
      expect(ticker.href).toBeTypeOf('function');
      expect(ticker.href!({ ticker: 'NVDA', name: 'NVIDIA' })).toBe(
        'https://finance.yahoo.com/quote/NVDA',
      );
      // A row with no usable symbol renders as plain text, not a broken link.
      expect(ticker.href!({ ticker: '', name: 'Nothing' })).toBeUndefined();
    }
  });

  it('[UI-44] names the destination so the link is not a mystery', () => {
    expect(QUOTE_PROVIDER).toBe('Yahoo Finance');
    const ticker = homeColumns.find((c) => c.key === 'ticker')!;
    expect(ticker.help).toContain(QUOTE_PROVIDER);
  });
});
