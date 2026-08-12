/** Spec traceability gate.
 *
 *  Specs under specs/ are the source of truth for behaviour (DEL-5). This script
 *  is the only thing stopping them from drifting into fiction: it checks that
 *  the links between requirements and tests exist in both directions.
 *
 *  It fails on:
 *    1. an uncovered requirement — MUST + `test` that no test cites
 *    2. an orphan citation      — a test citing an ID no spec defines
 *    3. a duplicate ID          — the same ID defined twice
 *    4. a malformed line        — looks like a requirement but does not parse,
 *                                 and so would otherwise go silently unchecked
 *
 *  It deliberately does not judge whether a test is any good. It only asserts
 *  the claimed link is real, which is enough to catch the common failure: a
 *  spec confidently describing a system that stopped existing months ago.
 *
 *  Node standard library only, per DEL-10.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SPEC_DIR = join(ROOT, 'specs');
const TEST_DIR = join(ROOT, 'tests');

/** Process docs, not specs: README carries example requirement lines inside
 *  code fences, and the template is a skeleton with placeholder IDs. */
const NOT_A_SPEC = new Set(['README.md']);
const isTemplate = (name) => name.startsWith('_');

const LEVELS = ['MUST', 'SHOULD', 'MAY'];
const VERIFICATIONS = ['test', 'build', 'ci', 'manual'];

/** - **ABC-1** `MUST` `test` — text */
const REQUIREMENT = new RegExp(
  String.raw`^\s*[-*]\s+\*\*([A-Z]{2,5}-\d+)\*\*\s+` +
    String.raw`\x60(${LEVELS.join('|')})\x60\s+` +
    String.raw`\x60(${VERIFICATIONS.join('|')})\x60\s+` +
    String.raw`[—-]\s+\S`,
);

/** A withdrawn requirement stays in place so history and reasoning survive. */
const WITHDRAWN = /^\s*[-*]\s+\*\*([A-Z]{2,5}-\d+)\*\*\s+\x60WITHDRAWN\x60/;

/** Anything that opens like a requirement. Used to catch near-misses. */
const LOOKS_LIKE = /^\s*[-*]\s+\*\*([A-Z]{2,5}-\d+)\*\*/;

const CITATION = /\b([A-Z]{2,5}-\d+)\b/g;

function walk(dir, predicate) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(walk(path, predicate));
    else if (predicate(name)) out.push(path);
  }
  return out;
}

/** Requirement lines, minus anything inside a fenced code block — fences are
 *  where documentation shows what a requirement looks like. */
function requirementLines(text) {
  const out = [];
  let fenced = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*\x60\x60\x60/.test(line)) fenced = !fenced;
    else if (!fenced) out.push({ line, number: i + 1 });
  });
  return out;
}

function collectRequirements() {
  const requirements = new Map();
  const problems = [];

  const files = readdirSync(SPEC_DIR)
    .filter((n) => n.endsWith('.md') && !NOT_A_SPEC.has(n) && !isTemplate(n))
    .sort();

  if (files.length === 0) problems.push('No spec files found under specs/.');

  for (const name of files) {
    const path = join(SPEC_DIR, name);
    for (const { line, number } of requirementLines(readFileSync(path, 'utf8'))) {
      if (!LOOKS_LIKE.test(line)) continue;

      const withdrawn = WITHDRAWN.exec(line);
      const match = REQUIREMENT.exec(line);

      if (!withdrawn && !match) {
        problems.push(
          `${name}:${number} — malformed requirement. Expected ` +
            '`- **ID** `LEVEL` `VERIFICATION` — text`, got:\n      ' +
            line.trim(),
        );
        continue;
      }

      const [id, level, verification] = withdrawn
        ? [withdrawn[1], 'WITHDRAWN', 'none']
        : [match[1], match[2], match[3]];

      const existing = requirements.get(id);
      if (existing) {
        problems.push(
          `${id} is defined twice: ${existing.file}:${existing.line} and ${name}:${number}. ` +
            'IDs are permanent and unique — never reuse one.',
        );
        continue;
      }

      requirements.set(id, { id, level, verification, file: name, line: number });
    }
  }

  return { requirements, problems };
}

function collectCitations() {
  const citations = new Map();
  const files = walk(TEST_DIR, (n) => /\.(ts|tsx|js|mjs)$/.test(n));

  for (const path of files) {
    const rel = relative(ROOT, path);
    const text = readFileSync(path, 'utf8');
    for (const [, id] of text.matchAll(CITATION)) {
      if (!citations.has(id)) citations.set(id, new Set());
      citations.get(id).add(rel);
    }
  }
  return citations;
}

function main() {
  const { requirements, problems } = collectRequirements();
  const citations = collectCitations();

  for (const req of requirements.values()) {
    if (req.level !== 'MUST' || req.verification !== 'test') continue;
    if (!citations.has(req.id)) {
      problems.push(
        `${req.id} (${req.file}:${req.line}) is MUST + \`test\` but no test cites it. ` +
          `Add the ID to a test name, or change the tag to how it is really verified.`,
      );
    }
  }

  for (const [id, files] of citations) {
    if (!requirements.has(id)) {
      problems.push(
        `${id} is cited by ${[...files].join(', ')} but no spec defines it. ` +
          'A renamed or deleted requirement looks exactly like this.',
      );
    }
  }

  const counts = { total: requirements.size, tested: 0, other: 0, withdrawn: 0 };
  for (const req of requirements.values()) {
    if (req.level === 'WITHDRAWN') counts.withdrawn++;
    else if (req.level === 'MUST' && req.verification === 'test') counts.tested++;
    else counts.other++;
  }

  if (problems.length > 0) {
    console.error(`\nspec:check failed — ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    console.error('\nSee specs/README.md for the requirement format and the workflow.\n');
    process.exit(1);
  }

  console.log(
    `spec:check ok — ${counts.total} requirements ` +
      `(${counts.tested} test-verified, ${counts.other} other, ${counts.withdrawn} withdrawn), ` +
      `${citations.size} cited by tests.`,
  );
}

main();
