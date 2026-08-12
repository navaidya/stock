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
