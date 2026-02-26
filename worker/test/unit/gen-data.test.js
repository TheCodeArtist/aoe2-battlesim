import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const GEN  = join(ROOT, 'worker/src/generated');

function runGenData() {
  const result = spawnSync(process.execPath, ['worker/scripts/gen-data.mjs'], { cwd: ROOT });
  if (result.status !== 0) throw new Error(result.stderr?.toString() || 'gen-data failed');
}

describe('gen-data.mjs', () => {
  beforeAll(() => {
    if (existsSync(GEN)) rmSync(GEN, { recursive: true });
    runGenData();
  });

  it('creates the generated directory', () => {
    expect(existsSync(GEN)).toBe(true);
  });

  it('generates units.js with correct export line', () => {
    const content = readFileSync(join(GEN, 'units.js'), 'utf8');
    expect(content).toContain('export { units };');
    expect(content).toContain('const units =');
  });

  it('generates presets.js with correct export line', () => {
    const content = readFileSync(join(GEN, 'presets.js'), 'utf8');
    expect(content).toContain('export { presets };');
    expect(content).toContain('const presets =');
  });

  it('generates scenarios.js with correct export lines', () => {
    const content = readFileSync(join(GEN, 'scenarios.js'), 'utf8');
    expect(content).toContain('export { scenarios, featuredScenarios };');
    expect(content).toContain('const scenarios =');
    expect(content).toContain('const featuredScenarios =');
  });

  it('is idempotent — running twice does not change output', () => {
    const before = readFileSync(join(GEN, 'units.js'), 'utf8');
    runGenData();
    const after = readFileSync(join(GEN, 'units.js'), 'utf8');
    expect(before).toBe(after);
  });
});
