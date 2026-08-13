import { describe, expect, it } from 'vitest';
import { computeHealthScore, HEALTH_COMPONENTS, MIN_COMPONENTS } from '../src/lib/health.ts';
import { glossary } from '../src/lib/glossary.ts';
import { mapToSnapshot } from '../src/lib/finnhub.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/finnhub-nvda.json'), 'utf8'),
);

describe('computeHealthScore [MOD-31]', () => {
  it('averages the five components on their fixed 0-100 ranges', () => {
    // Midpoint of every range should land almost exactly on 50.
    const score = computeHealthScore({
      grossMargin: 40, // midpoint of 0-80
      operatingMargin: 10, // midpoint of -20-40
      roe: 10, // midpoint of -20-40
      debtToEquity: 1.5, // midpoint of 0-3, inverted
      currentRatio: 1.25, // midpoint of 0-2.5
    });
    expect(score).toBe(50);
  });

  it('clamps at both ends of each range rather than extrapolating', () => {
    const best = computeHealthScore({
      grossMargin: 200, // far past 80
      operatingMargin: 200,
      roe: 200,
      debtToEquity: -5, // past the "0 is best" end — see negative guard below
      currentRatio: 100,
    });
    // debtToEquity negative is excluded (see next test), so this averages the
    // other four, all clamped to 100.
    expect(best).toBe(100);

    const worst = computeHealthScore({
      grossMargin: -50,
      operatingMargin: -50,
      roe: -50,
      debtToEquity: 10,
      currentRatio: -10,
    });
    expect(worst).toBe(0);
  });

  it('[MOD-31] caps ROE at 40% so leverage-driven ROE stops helping past that', () => {
    const capped = computeHealthScore({ grossMargin: 40, operatingMargin: 10, roe: 40 });
    const beyond = computeHealthScore({ grossMargin: 40, operatingMargin: 10, roe: 400 });
    expect(capped).toBe(beyond);
  });

  it('[MOD-31] rewards a lower debt/equity, not a higher one', () => {
    const lowDebt = computeHealthScore({ grossMargin: 50, operatingMargin: 20, debtToEquity: 0 });
    const highDebt = computeHealthScore({ grossMargin: 50, operatingMargin: 20, debtToEquity: 3 });
    expect(lowDebt!).toBeGreaterThan(highDebt!);
  });

  it('[MOD-32] requires at least three of five components', () => {
    expect(computeHealthScore({ grossMargin: 50, operatingMargin: 20 })).toBeUndefined();
    expect(
      computeHealthScore({ grossMargin: 50, operatingMargin: 20, roe: 20 }),
    ).not.toBeUndefined();
    expect(computeHealthScore({})).toBeUndefined();
  });

  it('[MOD-32] excludes a negative debt/equity or current ratio rather than scoring it as best', () => {
    // Without the guard, a negative value would clamp to 0 on the raw scale
    // and invert to 100 — read as the healthiest possible balance sheet,
    // exactly backwards from what negative equity actually signals.
    const withNegativeDebt = computeHealthScore({
      grossMargin: 40,
      operatingMargin: 10,
      roe: 10,
      debtToEquity: -1,
    });
    // Only 3 real components (grossMargin, operatingMargin, roe) contribute;
    // debtToEquity is dropped, not scored.
    expect(withNegativeDebt).toBe(50);
  });

  it('never returns a value outside 0-100', () => {
    for (let i = 0; i < 20; i++) {
      const score = computeHealthScore({
        grossMargin: Math.random() * 400 - 200,
        operatingMargin: Math.random() * 400 - 200,
        roe: Math.random() * 400 - 200,
        debtToEquity: Math.random() * 20 - 10,
        currentRatio: Math.random() * 20 - 10,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe('healthScore via mapToSnapshot [MOD-7]', () => {
  it('is computed for a normal company from fixture data', () => {
    const snap = mapToSnapshot({
      ticker: 'NVDA',
      name: 'NVIDIA',
      quote: fixture.quote,
      profile: fixture.profile,
      metrics: fixture.metrics,
    });
    expect(snap.healthScore).toBeTypeOf('number');
    expect(snap.healthScore!).toBeGreaterThanOrEqual(0);
    expect(snap.healthScore!).toBeLessThanOrEqual(100);
  });

  it('[MOD-6, MOD-33] is never computed for an ETF', () => {
    const snap = mapToSnapshot({
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      isEtf: true,
      quote: fixture.quote,
      profile: fixture.profile,
      metrics: fixture.metrics,
    });
    expect(snap.healthScore).toBeUndefined();
  });
});

describe('FAQ disclosure stays in sync with the formula [UI-46]', () => {
  it('quotes the exact clamp ranges and the minimum-components rule', () => {
    const entry = glossary.healthScore;
    expect(entry, 'no glossary entry for healthScore').toBeTruthy();
    for (const { min, max } of HEALTH_COMPONENTS) {
      expect(entry.what, `range ${min}-${max}`).toMatch(new RegExp(`${min}.{0,3}${max}`));
    }
    // "3" alone would coincidentally match the "0-3" debt/equity range above,
    // so check the actual rule in words rather than a bare digit.
    expect(MIN_COMPONENTS).toBe(3);
    expect(entry.what.toLowerCase()).toContain('at least three of the five');
  });

  it('[UI-48] never phrases itself as a directive to act, and does disclaim buying', () => {
    // UI-48 bans recommendation vocabulary but explicitly requires the FAQ to
    // say this is not advice about whether now is a good time to buy — so the
    // word "buy" must appear only inside that disclaimer, never as a directive.
    const entry = glossary.healthScore;
    const text = `${entry.what} ${entry.why} ${entry.watch ?? ''}`.toLowerCase();
    for (const directive of [
      'buy this', 'buy now', 'you should buy', 'great buy', 'strong buy',
      'best stock', 'top pick', 'invest now', 'sell this', 'sell now',
    ]) {
      expect(text, directive).not.toContain(directive);
    }
    expect(text, 'should state it is not advice about buying').toMatch(
      /not.{0,40}(a good time to buy|advice|recommendation)/,
    );
  });
});
