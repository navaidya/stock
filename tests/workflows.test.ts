import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** Structural checks on the workflow wiring.
 *
 *  These do not run the workflows — they assert the connections that, when
 *  broken, fail silently. The pipeline's whole failure mode is looking healthy
 *  while doing nothing: every run green, and no data on the page. */

const workflow = (name: string) =>
  parse(readFileSync(join(process.cwd(), '.github/workflows', name), 'utf8'));

const refresh = workflow('refresh-data.yml');
const refreshSp500 = workflow('refresh-sp500.yml');
const deploy = workflow('deploy.yml');

describe('refresh-data workflow', () => {
  it('[COL-17] calls the deploy workflow rather than relying on the push trigger', () => {
    // A push made with GITHUB_TOKEN does not trigger workflows, so without an
    // explicit call the data commit is built by nothing.
    const deployJob = refresh.jobs.deploy;
    expect(deployJob).toBeDefined();
    expect(deployJob.uses).toBe('./.github/workflows/deploy.yml');
    expect(deployJob.needs).toBe('refresh');
  });

  it('[COL-17] builds main, not the SHA that triggered the run', () => {
    // The triggering SHA predates the data commit the refresh job just pushed.
    expect(refresh.jobs.deploy.with.ref).toBe('main');
  });

  it('[COL-17] grants the deploy job the permissions Pages needs', () => {
    expect(refresh.jobs.deploy.permissions).toMatchObject({
      'pages': 'write',
      'id-token': 'write',
    });
  });

  it('[COL-6] commits through the tested script rather than inline git', () => {
    const steps = refresh.jobs.refresh.steps.map((s: { run?: string }) => s.run ?? '');
    expect(steps.some((run: string) => run.includes('scripts/commit-data.sh'))).toBe(true);
    // The original bug, kept out by name: it ran cleanly and committed nothing.
    expect(steps.some((run: string) => run.includes('commit -am'))).toBe(false);
  });
});

describe('refresh-sp500 workflow', () => {
  it('[COL-22] runs on its own separate schedule from refresh-data', () => {
    const crons = (spec: any) =>
      (Array.isArray(spec.on.schedule) ? spec.on.schedule : []).map((s: { cron: string }) => s.cron);
    const dataCrons = crons(refresh);
    const sp500Crons = crons(refreshSp500);
    expect(sp500Crons.length).toBeGreaterThan(0);
    for (const c of sp500Crons) expect(dataCrons).not.toContain(c);
  });

  it('[COL-21] collects the sp500 target', () => {
    const steps = refreshSp500.jobs.refresh.steps.map((s: { run?: string }) => s.run ?? '');
    expect(steps.some((run: string) => run.includes('npm run collect:sp500'))).toBe(true);
  });

  it('[COL-6, COL-15] commits only data/sp500.json, through the tested script', () => {
    const steps = refreshSp500.jobs.refresh.steps.map((s: { run?: string }) => s.run ?? '');
    expect(steps.some((run: string) => run.includes('scripts/commit-data.sh data/sp500.json'))).toBe(
      true,
    );
  });

  it('[COL-17] calls the deploy workflow rather than relying on the push trigger', () => {
    const deployJob = refreshSp500.jobs.deploy;
    expect(deployJob).toBeDefined();
    expect(deployJob.uses).toBe('./.github/workflows/deploy.yml');
    expect(deployJob.needs).toBe('refresh');
    expect(deployJob.with.ref).toBe('main');
  });
});

describe('deploy workflow', () => {
  it('[COL-17] is callable and accepts a ref to build', () => {
    expect(deploy.on.workflow_call).toBeDefined();
    expect(deploy.on.workflow_call.inputs.ref).toBeDefined();
  });

  it('[COL-17] checks out the requested ref, falling back to the trigger', () => {
    const checkout = deploy.jobs.build.steps.find((s: { uses?: string }) =>
      s.uses?.startsWith('actions/checkout'),
    );
    expect(checkout.with.ref).toBe('${{ inputs.ref || github.ref }}');
  });

  it('[DEL-2] runs the test suite before building', () => {
    const runs = deploy.jobs.build.steps.map((s: { run?: string }) => s.run ?? '');
    expect(runs).toContain('npm test');
    expect(runs.indexOf('npm test')).toBeLessThan(runs.indexOf('npm run build'));
  });
});
