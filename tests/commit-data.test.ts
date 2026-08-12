import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Exercises scripts/commit-data.sh against a real git repository.
 *
 *  The bug this covers was invisible to any test that mocked git: the old
 *  inline command was valid shell that ran cleanly and did nothing, because
 *  `git diff` ignores untracked files. Only real git reproduces it, so this
 *  drives an actual repo in a temp directory. */

const SCRIPT = join(process.cwd(), 'scripts/commit-data.sh');

let repo: string;

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function runScript(...args: string[]): string {
  return execFileSync('bash', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });
}

function writeMarketData(generatedAt: string): void {
  writeFileSync(
    join(repo, 'data/market.json'),
    JSON.stringify({ generatedAt, failed: [], stocks: { NVDA: { ticker: 'NVDA' } } }),
  );
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'commit-data-'));
  execSync('git init -q .', { cwd: repo });
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(repo, 'data'));
  writeFileSync(join(repo, 'README.md'), 'seed\n');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'seed');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('commit-data.sh', () => {
  it('[COL-6] commits market.json on the first run, when it is still untracked', () => {
    writeMarketData('2026-08-12T14:35:00Z');

    runScript();

    // The regression: this used to be 1, because nothing was ever committed.
    expect(git('rev-list', '--count', 'HEAD')).toBe('2');
    expect(git('log', '-1', '--pretty=%s')).toBe('chore: refresh market data');
    expect(git('ls-files', 'data/market.json')).toBe('data/market.json');
    expect(git('status', '--porcelain')).toBe('');
  });

  it('[COL-6] commits an update once the file is already tracked', () => {
    writeMarketData('2026-08-12T14:35:00Z');
    runScript();

    writeMarketData('2026-08-12T18:35:00Z');
    runScript();

    expect(git('rev-list', '--count', 'HEAD')).toBe('3');
    expect(git('show', 'HEAD:data/market.json')).toContain('18:35:00Z');
  });

  it('[COL-14] makes no commit when the data is unchanged', () => {
    writeMarketData('2026-08-12T14:35:00Z');
    runScript();
    const before = git('rev-parse', 'HEAD');

    const output = runScript();

    expect(git('rev-parse', 'HEAD')).toBe(before);
    expect(output).toContain('nothing to commit');
  });

  it('[COL-15] commits only the data file, leaving other changes alone', () => {
    writeMarketData('2026-08-12T14:35:00Z');
    // Something else the job touched — npm rewriting a lockfile, say. The old
    // `git commit -am` would have swept this into the data commit.
    writeFileSync(join(repo, 'README.md'), 'modified by the job\n');

    runScript();

    expect(git('show', '--name-only', '--pretty=format:', 'HEAD').trim()).toBe('data/market.json');
    expect(git('status', '--porcelain')).toContain('README.md');
  });

  it('[COL-16] fails loudly when collection produced no file', () => {
    expect(() => runScript()).toThrow();
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  });
});

describe('commit-data.sh --optional', () => {
  it('[COL-20] skips a missing optional file instead of failing the run', () => {
    const output = runScript('data/brief.json', 'chore: refresh daily brief', '--optional');

    expect(output).toContain('skipping');
    // Nothing committed, and — the point — nothing thrown: a repository with no
    // model key must still complete a refresh.
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('[COL-20] commits the optional file when it does exist', () => {
    writeFileSync(join(repo, 'data/brief.json'), JSON.stringify({ text: 'A note.' }));

    runScript('data/brief.json', 'chore: refresh daily brief', '--optional');

    expect(git('rev-list', '--count', 'HEAD')).toBe('2');
    expect(git('log', '-1', '--pretty=%s')).toBe('chore: refresh daily brief');
    expect(git('ls-files', 'data/brief.json')).toBe('data/brief.json');
  });

  it('[COL-16] still fails on a missing file when it is not marked optional', () => {
    expect(() => runScript('data/brief.json', 'chore: refresh daily brief')).toThrow();
    expect(git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('[COL-15] commits only the named file, leaving the other output alone', () => {
    writeMarketData('2026-08-12T14:35:00Z');
    writeFileSync(join(repo, 'data/brief.json'), JSON.stringify({ text: 'A note.' }));

    runScript('data/brief.json', 'chore: refresh daily brief', '--optional');

    expect(git('ls-files', 'data/market.json')).toBe('');
    expect(git('status', '--porcelain')).toContain('data/market.json');
  });
});
