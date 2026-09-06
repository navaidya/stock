import { describe, expect, it } from 'vitest';
import { aiColumns, dividendColumns, homeColumns } from '../src/lib/columns.ts';
import { GROUPS, glossary } from '../src/lib/glossary.ts';

const columnKeys = new Set(
  [...homeColumns, ...aiColumns, ...dividendColumns].map((c) => c.key),
);

describe('column glossary', () => {
  it('[UI-29] explains every column shown on any page', () => {
    const missing = [...columnKeys].filter((key) => !glossary[key]);
    expect(missing, 'columns with no FAQ entry').toEqual([]);
  });

  it('[UI-29] has no entry for a column that no longer exists', () => {
    const orphans = Object.keys(glossary).filter((key) => !columnKeys.has(key));
    expect(orphans, 'FAQ entries for columns nothing renders').toEqual([]);
  });

  it('[UI-29] gives every entry a term, a group, and both explanations', () => {
    for (const [key, entry] of Object.entries(glossary)) {
      expect(entry.term, key).toBeTruthy();
      expect(entry.what, key).toBeTruthy();
      expect(entry.why, key).toBeTruthy();
      expect(GROUPS, key).toContain(entry.group);
    }
  });
});

describe('analyst ratings glossary entry [UI-53, UI-54]', () => {
  const entry = glossary.analystRatings;

  it('exists and states the herding and investment-banking-conflict bias', () => {
    expect(entry, 'no glossary entry for analystRatings').toBeTruthy();
    const text = `${entry.what} ${entry.why} ${entry.watch ?? ''}`.toLowerCase();
    expect(text).toContain('sell');
    expect(text).toMatch(/investment.bank/);
    expect(text).toMatch(/bias/);
  });

  it('[UI-54] never adds this dashboard\'s own recommendation vocabulary', () => {
    const text = `${entry.what} ${entry.why} ${entry.watch ?? ''}`.toLowerCase();
    for (const directive of [
      'you should buy', 'you should sell', 'we recommend', 'best stock', 'top pick', 'invest now',
    ]) {
      expect(text, directive).not.toContain(directive);
    }
    expect(text, 'should state this is not the dashboard\'s opinion').toMatch(
      /not this dashboard.s opinion|not a recommendation/,
    );
  });

  it('[UI-51] states the counts are never averaged or reduced to a consensus number', () => {
    const text = `${entry.what} ${entry.why} ${entry.watch ?? ''}`.toLowerCase();
    expect(text).toMatch(/never averaged|not averaged/);
  });
});
