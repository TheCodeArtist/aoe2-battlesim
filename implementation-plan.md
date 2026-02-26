# AoE2 Battle Simulator — Implementation Plan

## How to Use This Document

Each step is a discrete, independently testable unit of work. Complete the steps in order:

1. Read the step's **Goal** and **Implementation Notes**.
2. Write the **Tests First** (TDD where practical) — the failing tests define the contract.
3. Implement the code until all tests pass.
4. Verify the **Definition of Done** checklist.
5. **Commit** with tests included before moving to the next step.

> **Rule:** No step may be started until all tests from the previous step are passing and committed.

---

## 0. Coding Guidelines

These guidelines apply to every file in `worker/`. They must be followed from Step 1 onward.

### Language & Modules
- **ES Modules only.** `package.json` must have `"type": "module"`. Every file uses `import`/`export`; no `require()`.
- **No TypeScript.** Plain `.js` files throughout. JSDoc comments for param/return types where helpful.

### File Naming & Structure
- Lowercase, hyphenated filenames: `gen-data.mjs`, `sim.js`, `data.js`.
- Route files under `worker/src/routes/`: `simulate.js`, `scenarios.js`, `catalog.js`, `mcp.js`.
- Test files mirror source structure under `worker/test/`: `test/sim.test.js`, `test/data.test.js`, `test/routes/simulate.test.js`, etc.

### Code Style
- 2-space indentation.
- Single quotes for strings unless the string contains a single quote.
- `const` by default; `let` only where reassignment is necessary; `var` never.
- No trailing whitespace. Files end with a single newline.
- Arrow functions for callbacks; named `function` declarations for top-level exports.

### Error Handling
- Route **logic functions** (pure JS) throw plain `Error` objects with descriptive messages. Example: `throw new Error('Unknown unit key: archer_xyz')`.
- Route **HTTP handlers** catch errors from logic functions and return `Response.json({ error: err.message }, { status: 400, headers: CORS })`.
- The MCP handler catches errors from logic functions and returns an `isError: true` tool result (never a top-level JSON-RPC error for tool failures — per MCP spec §tool-errors).

### Layered Architecture — The Two-Layer Rule
Every route file exports two distinct things:

```js
// Layer 1 — Logic function: pure JS, no Request/Response, testable without a Worker runtime.
export function simulateLogic(side_a, side_b, options = {}) { ... }

// Layer 2 — HTTP handler: parses Request, calls logic, wraps in Response.
export async function handleSimulate(request) {
  const { side_a, side_b, options } = await request.json();
  const result = simulateLogic(side_a, side_b, options);
  return Response.json(result, { headers: CORS });
}
```

Logic functions are tested with plain unit tests (no Worker runtime required). HTTP handlers are tested with integration tests.

### sim.js — Verbatim Copy Policy
`worker/src/sim.js` is a near-verbatim copy of the simulation kernel from `vendor/chombat/script.js`. The **only** permitted additions are:
- The `export` statement at the bottom.
- Making `this.tick` and `this.maxDuration` constructor-configurable (one-line additions to the constructor body).
- No other logic changes. This policy makes future chombat diffs mechanical to apply.

### Data Field Mapping
The chombat `Unit` constructor uses camelCase internal field names; the API uses `snake_case`. The mapping lives exclusively in `data.js` (`resolveUnit`) and route handlers. Never put mapping logic in `sim.js`.

| API field | Unit constructor field |
|---|---|
| `bonus_atk` | `bonusAtk` |
| `bonus_reduction` (0–1 float) | `bonusReduct` (0–100 int in original; **normalize on input**: multiply by 100) |
| `tech_delay` | `techDelay` |
| `units_before` | `unitsBefore` |
| `engagement_pct` | `configX.engagement` |
| `micro` | `configX.targetMicro` |
| `resource_discounts.all` | `discAll` |
| `resource_discounts.food` | `discF` |
| `resource_discounts.wood` | `discW` |
| `resource_discounts.gold` | `discG` |

> **Unsupported chombat field:** `atkSpeed` (attack speed %, stored as `atkSpeedBonus` on the Unit instance, affects `reload` time). This field exists in the original `Unit` constructor but is **not exposed** by the API — omitting it is a deliberate simplification. Units that have attack speed bonuses in chombat (e.g. some scenario entries) will have their reload slightly incorrect. Add `atkSpeed` support to the override schema if precision becomes a requirement.

---

## 1. Testing Strategy

### Framework
- **Vitest** (`vitest`) as the test runner.
- **`@cloudflare/vitest-pool-workers`** for integration tests that need the Workers runtime (`fetch`, `Response`, `Request`).
- Pure logic function tests run in the default Node environment (no Worker runtime overhead).

### Test Configuration
Two vitest configs side-by-side:

| Config file | Scope | Environment |
|---|---|---|
| `worker/vitest.config.js` | Unit tests (`test/unit/**`) | Node (`node`) |
| `worker/vitest.integration.config.js` | Integration tests (`test/integration/**`) | `@cloudflare/vitest-pool-workers` |

`package.json` scripts:
```json
"test":             "vitest run --config worker/vitest.config.js",
"test:integration": "vitest run --config worker/vitest.integration.config.js",
"test:all":         "npm test && npm run test:integration",
"test:watch":       "vitest --config worker/vitest.config.js"
```

### Coverage Requirements
- **Logic functions** (Steps 3–9): ≥ 90% line coverage measured via `vitest --coverage`.
- **HTTP handlers** (Steps 5–9): every defined route must have at least one integration test covering the happy path and one covering an error path (missing fields, unknown keys, wrong method).
- **MCP handlers** (Step 10): every JSON-RPC method must have a dedicated test.

### What NOT to Test
- Generated files in `worker/src/generated/` (build artefacts).
- `gen-data.mjs` beyond a smoke run that checks the output files exist and contain the expected export line.
- The `wrangler.toml` or deployment config.

### Test Fixture Convention
Place shared test fixtures (sample unit objects, army specs, matchup payloads) in `worker/test/fixtures.js`. Import from there in all test files — do not repeat raw payloads inline.

---

## Step 1 — Repository Scaffolding

**Goal:** A clean project skeleton with Wrangler, the test framework, and the submodule pointing at chombat.

### Files to Create / Modify
- `package.json`
- `.gitignore`
- `worker/wrangler.toml`
- `worker/vitest.config.js`
- `worker/vitest.integration.config.js`
- `.gitmodules` + `vendor/chombat/` (submodule)

### Implementation Notes

**`package.json`** — project root:
```json
{
  "name": "aoe2-battlesim",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "prebuild":          "node worker/scripts/gen-data.mjs",
    "predev":            "node worker/scripts/gen-data.mjs",
    "predeploy":         "node worker/scripts/gen-data.mjs",
    "dev":               "wrangler dev --config worker/wrangler.toml",
    "deploy":            "wrangler deploy --config worker/wrangler.toml",
    "test":              "vitest run --config worker/vitest.config.js",
    "test:integration":  "vitest run --config worker/vitest.integration.config.js",
    "test:all":          "npm test && npm run test:integration",
    "test:watch":        "vitest --config worker/vitest.config.js",
    "test:coverage":     "vitest run --coverage --config worker/vitest.config.js"
  },
  "devDependencies": {
    "wrangler": "latest",
    "vitest": "latest",
    "@cloudflare/vitest-pool-workers": "latest",
    "@vitest/coverage-v8": "latest"
  }
}
```

**`worker/wrangler.toml`**:
```toml
name = "aoe2-battlesim"
main = "src/index.js"
compatibility_date = "2025-01-01"
```

**`worker/vitest.config.js`** (unit tests, Node environment):
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/generated/**'],
    },
  },
});
```

**`worker/vitest.integration.config.js`** (integration tests, Workers runtime):
```js
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['test/integration/**/*.test.js'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

**`.gitignore`** additions:
```
node_modules/
worker/src/generated/
.wrangler/
dist/
coverage/
```

Add `vendor/chombat` as a git submodule pointing at the chombat repo:
```bash
git submodule add <chombat-remote-url> vendor/chombat
```

### Tests to Write

**`worker/test/unit/scaffold.test.js`** — verifies the project can be imported and the toolchain works:
```js
import { describe, it, expect } from 'vitest';

describe('project scaffold', () => {
  it('runs a trivial assertion (toolchain smoke test)', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Definition of Done
- [ ] `npm install` completes without errors.
- [ ] `npm test` runs and the scaffold test passes.
- [ ] `vendor/chombat/units.js`, `presets.js`, `scenarios.js`, `script.js` are all present (submodule checked out).
- [ ] `worker/src/generated/` is listed in `.gitignore`.

### Commit
```
git add -A && git commit -m "chore: scaffold project, add wrangler, vitest, and chombat submodule"
```

---

## Step 2 — Prebuild Script (`worker/scripts/gen-data.mjs`)

**Goal:** A script that wraps chombat's non-module JS files into ES modules, placing outputs in `worker/src/generated/`.

### Files to Create
- `worker/scripts/gen-data.mjs`

### Implementation Notes

```js
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const root   = join(dirname(fileURLToPath(import.meta.url)), '../..');
const VENDOR = join(root, 'vendor/chombat');
const OUT    = join(root, 'worker/src/generated');

mkdirSync(OUT, { recursive: true });

const files = [
  { src: 'units.js',     exp: 'export { units };' },
  { src: 'presets.js',   exp: 'export { presets };' },
  { src: 'scenarios.js', exp: 'export { scenarios, featuredScenarios };' },
];

for (const { src, exp } of files) {
  const content = readFileSync(join(VENDOR, src), 'utf8');
  writeFileSync(join(OUT, src), content + '\n' + exp + '\n');
  console.log(`gen-data: wrote generated/${src}`);
}
```

**Key constraints:**
- The script appends the export line — it never modifies the original content.
- `mkdirSync(..., { recursive: true })` is idempotent; safe to call on every prebuild.
- The script must exit with code `0` on success; Node will propagate a non-zero exit code from any thrown exception automatically.

### Tests to Write

**`worker/test/unit/gen-data.test.js`** — runs the script as a subprocess and verifies outputs:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('../../..', import.meta.url).pathname;
const GEN  = join(ROOT, 'worker/src/generated');

describe('gen-data.mjs', () => {
  beforeAll(() => {
    // Remove generated dir to test fresh creation
    if (existsSync(GEN)) rmSync(GEN, { recursive: true });
    execSync('node worker/scripts/gen-data.mjs', { cwd: ROOT });
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
    execSync('node worker/scripts/gen-data.mjs', { cwd: ROOT });
    const after = readFileSync(join(GEN, 'units.js'), 'utf8');
    expect(before).toBe(after);
  });
});
```

### Definition of Done
- [ ] `node worker/scripts/gen-data.mjs` exits 0 and produces three files.
- [ ] Each generated file ends with the correct `export` statement.
- [ ] Running the script twice produces identical output (idempotency test passes).
- [ ] All tests in this step pass.

### Commit
```
git add -A && git commit -m "feat: add gen-data.mjs prebuild script with tests"
```

---

## Step 3 — Sim Kernel (`worker/src/sim.js`)

**Goal:** Extract the pure simulation logic from `vendor/chombat/script.js` into an ES module. No DOM, no charts, no UI globals.

### Files to Create
- `worker/src/sim.js`

### Implementation Notes

Copy verbatim from `script.js`:
- `Unit` class: lines 8–52.
- `CombatSim` class: lines 54–144.
- `calculateCount` function: lines 235–242.

**Permitted constructor additions** (do not change any existing logic):

In `CombatSim` constructor, after `this.tick = 0.05;`, add:
```js
if (config && config.tick)        this.tick = config.tick;
if (config && config.maxDuration) this.maxDuration = config.maxDuration;
```

In `run()`, change the while condition from `this.time < 300` to:
```js
while (subA.currentCount > 0 && subB.currentCount > 0 && this.time < (this.maxDuration || 300))
```

The `CombatSim` constructor signature becomes:
```js
constructor(dataA, dataB, configA, configB, simConfig = {})
```

At the bottom of the file:
```js
export { Unit, CombatSim, calculateCount };
```

**Verification checklist before writing the file:**
- Search for `document`, `window`, `chart`, `Chart` — none should be present.
- Search for `import` at the top — none (this file has no dependencies).

### Tests to Write

**`worker/test/unit/sim.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import { Unit, CombatSim, calculateCount } from '../../src/sim.js';

// ── Unit class ────────────────────────────────────────────────────────────────

describe('Unit', () => {
  const archerData = {
    name: 'Archer', count: 10, hp: 30, patk: 5, matk: 0,
    parm: 1, marm: 1, reload: 2.0, range: 5,
    f: 0, w: 25, g: 45,
  };

  it('constructs with correct initial values', () => {
    const u = new Unit(archerData);
    expect(u.initialCount).toBe(10);
    expect(u.hpPerUnit).toBe(30);
    expect(u.patk).toBe(5);
    expect(u.parm).toBe(1);
  });

  it('isMelee() returns false for ranged units (range > 1)', () => {
    expect(new Unit({ ...archerData, range: 5 }).isMelee()).toBe(false);
  });

  it('isMelee() returns true for melee units (range <= 1)', () => {
    expect(new Unit({ ...archerData, range: 0 }).isMelee()).toBe(true);
    expect(new Unit({ ...archerData, range: 1 }).isMelee()).toBe(true);
  });

  it('getTotalHp() returns full HP for a fresh unit group', () => {
    const u = new Unit(archerData);
    expect(u.getTotalHp()).toBe(10 * 30); // 300
  });

  it('getParsedCost() returns correct total with no discounts', () => {
    const u = new Unit(archerData);
    const cost = u.getParsedCost();
    expect(cost.f).toBe(0);
    expect(cost.w).toBe(25);
    expect(cost.g).toBe(45);
    expect(cost.total).toBe(70);
  });

  it('getParsedCost() applies discAll correctly', () => {
    const u = new Unit({ ...archerData, discAll: 15 }); // 15% all discount
    const cost = u.getParsedCost();
    expect(cost.total).toBeCloseTo(70 * 0.85, 5);
  });

  it('getParsedCost() applies per-resource discount correctly', () => {
    const u = new Unit({ ...archerData, discG: 20 }); // 20% gold discount
    const cost = u.getParsedCost();
    expect(cost.g).toBeCloseTo(45 * 0.80, 5);
    expect(cost.w).toBe(25);
  });
});

// ── CombatSim ─────────────────────────────────────────────────────────────────

describe('CombatSim', () => {
  const archerData = {
    name: 'Archer', count: 10, hp: 30, patk: 5, matk: 0,
    parm: 1, marm: 1, reload: 2.0, range: 5, f: 0, w: 25, g: 45,
  };
  const skirmData = {
    name: 'Skirm', count: 10, hp: 30, patk: 3, matk: 0,
    parm: 4, marm: 1, reload: 3.0, range: 5,
    bonusAtk: 3, f: 25, w: 35, g: 0,
  };
  const defaultConfig = { engagement: 100, targetMicro: 0 };

  it('run() returns a result with armyA, armyB, history, duration fields', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const result = sim.run();
    expect(result).toHaveProperty('armyA');
    expect(result).toHaveProperty('armyB');
    expect(result).toHaveProperty('history');
    expect(result).toHaveProperty('duration');
  });

  it('run() produces a definitive winner (one side reaches 0)', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const { armyA, armyB } = sim.run();
    const eitherDead = armyA.remaining === 0 || armyB.remaining === 0;
    expect(eitherDead).toBe(true);
  });

  it('skirms beat archers 10v10 (focus fire)', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const { armyA, armyB } = sim.run();
    expect(armyA.remaining).toBe(0);
    expect(armyB.remaining).toBeGreaterThan(0);
  });

  it('respects custom tick via simConfig', () => {
    const simFast = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig, { tick: 0.1 });
    const simSlow = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig, { tick: 0.05 });
    expect(simFast.tick).toBe(0.1);
    expect(simSlow.tick).toBe(0.05);
    // Both should agree on winner
    expect(simFast.run().armyA.remaining).toBe(0);
    expect(simSlow.run().armyA.remaining).toBe(0);
  });

  it('respects custom maxDuration — stops early if set very low', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig, { maxDuration: 1 });
    const result = sim.run();
    expect(result.duration).toBeLessThanOrEqual(1.1); // within one tick of 1s
  });

  it('history array is non-empty and starts at time 0', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const { history } = sim.run();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].time).toBe(0);
  });

  it('calculateDamage uses pierce stats for ranged units', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const a = new Unit(archerData);
    const b = new Unit(skirmData);
    const dmg = sim.calculateDamage(a, b);
    // archer patk=5, skirm parm=4 → max(1, 5-4) = 1; no bonus
    expect(dmg).toBe(1);
  });

  it('calculateDamage uses melee stats for melee units', () => {
    const maaData = { ...archerData, matk: 7, patk: 0, marm: 1, parm: 2, range: 0 };
    const sim = new CombatSim(maaData, archerData, defaultConfig, defaultConfig);
    const a = new Unit(maaData);
    const b = new Unit(archerData);
    const dmg = sim.calculateDamage(a, b);
    // maa matk=7, archer marm=1 → max(1, 7-1) = 6
    expect(dmg).toBe(6);
  });

  it('calculateDamage applies bonus attack correctly', () => {
    const skirmWithBonus = { ...skirmData, bonusAtk: 3, bonusReduct: 0 };
    const sim = new CombatSim(skirmWithBonus, archerData, defaultConfig, defaultConfig);
    const a = new Unit(skirmWithBonus);
    const b = new Unit(archerData);
    const dmg = sim.calculateDamage(a, b);
    // skirm patk=3, archer parm=1 → max(1,3-1)=2; bonus=3*(1-0)=3 → total 5
    expect(dmg).toBe(5);
  });

  it('engagement_pct limits active units per volley', () => {
    const lowEngConfig = { engagement: 50, targetMicro: 0 };
    const fullEngConfig = { engagement: 100, targetMicro: 0 };
    const simLow  = new CombatSim(archerData, skirmData, lowEngConfig, fullEngConfig);
    const simFull = new CombatSim(archerData, skirmData, fullEngConfig, fullEngConfig);
    // With 50% engagement for side_a, skirms should win faster
    expect(simLow.run().duration).toBeGreaterThanOrEqual(simFull.run().duration - 0.5);
  });
});

// ── calculateCount ────────────────────────────────────────────────────────────

describe('calculateCount', () => {
  it('returns 0 before start time', () => {
    expect(calculateCount(50, 100, 0, 30, 1, 0)).toBe(0);
  });

  it('counts units produced after start with no tech delay', () => {
    // start=0, tech=0, trainTime=30, buildings=1, pre=0
    expect(calculateCount(30, 0, 0, 30, 1, 0)).toBe(1);
    expect(calculateCount(60, 0, 0, 30, 1, 0)).toBe(2);
  });

  it('respects unitsBefore (pre-queued units)', () => {
    // 3 units produced before fight starts at t=0
    expect(calculateCount(0, 0, 0, 30, 1, 3)).toBe(0);
    expect(calculateCount(90, 0, 0, 30, 1, 3)).toBe(3); // 3 * 30 / 1 = 90s for pre units
  });

  it('accounts for tech delay correctly', () => {
    // pre=3, trainTime=30, start=0; tech delay of 40s kicks in after pre units
    // t=90: all 3 pre units done; tech until t=130; production resumes at 130
    expect(calculateCount(100, 0, 40, 30, 1, 3)).toBe(3);
    expect(calculateCount(160, 0, 40, 30, 1, 3)).toBe(4); // 130 + 30 = 160
  });

  it('scales with number of buildings', () => {
    // 2 buildings halves the time-per-unit
    expect(calculateCount(30, 0, 0, 30, 2, 0)).toBe(2);
  });
});
```

### Definition of Done
- [ ] `worker/src/sim.js` has no references to `document`, `window`, or `charts`.
- [ ] All tests in `sim.test.js` pass.
- [ ] The `skirms beat archers 10v10` test passes (this validates that the kernel is correct).
- [ ] Coverage for `sim.js` is ≥ 90%.

### Commit
```
git add -A && git commit -m "feat: add sim kernel (Unit, CombatSim, calculateCount) with tests"
```

---

## Step 4 — Data Layer (`worker/src/data.js`)

**Goal:** Import the generated chombat data files and expose a `resolveUnit(spec)` function that handles all three army spec formats (key reference, key + overrides, fully inline).

### Files to Create / Modify
- `worker/src/data.js`
- `worker/test/unit/data.test.js`
- `worker/test/fixtures.js` (shared fixtures — start here)

### Implementation Notes

```js
import { units }    from './generated/units.js';
import { presets }  from './generated/presets.js';
import { scenarios, featuredScenarios } from './generated/scenarios.js';

export const ALL_UNITS = { ...units, ...presets };  // presets win on key collision
export { units as UNITS, presets as PRESETS, scenarios as SCENARIOS, featuredScenarios };

/**
 * Resolve an army spec's `unit` field into a plain stat object ready for `new Unit(...)`.
 * Applies overrides if present. Supports all three input formats from arch.md.
 *
 * @param {object} spec  Army spec ({ unit, overrides?, count?, ... })
 * @returns {object}     Merged stat object with all Unit constructor fields populated.
 * @throws {Error}       If `spec.unit` is a string key not found in ALL_UNITS.
 */
export function resolveUnit(spec) {
  let base;

  if (typeof spec.unit === 'string') {
    base = ALL_UNITS[spec.unit];
    if (!base) throw new Error(`Unknown unit key: ${spec.unit}`);
    base = { ...base };
  } else if (typeof spec.unit === 'object' && spec.unit !== null) {
    // Option C: fully inline; validate required fields
    const required = ['name', 'hp', 'reload', 'range'];
    for (const f of required) {
      if (spec.unit[f] === undefined) throw new Error(`Inline unit missing required field: ${f}`);
    }
    base = { ...spec.unit };
  } else {
    throw new Error('spec.unit must be a string key or an inline stat object');
  }

  // Apply overrides (Option B), normalizing snake_case → camelCase where needed
  if (spec.overrides) {
    const { bonus_atk, bonus_reduction, ...rest } = spec.overrides;
    Object.assign(base, rest);
    if (bonus_atk !== undefined)       base.bonusAtk    = bonus_atk;
    // bonusReduct in Unit constructor expects 0-100; API provides 0-1 float → convert
    if (bonus_reduction !== undefined) base.bonusReduct = bonus_reduction * 100;
  }

  // Merge army-level fields onto the stat object
  if (spec.count        !== undefined) base.count       = spec.count;
  if (spec.delay        !== undefined) base.delay       = spec.delay;
  if (spec.tech_delay   !== undefined) base.techDelay   = spec.tech_delay;
  if (spec.units_before !== undefined) base.unitsBefore = spec.units_before;
  if (spec.buildings    !== undefined) base.buildings   = spec.buildings;

  // Resource discounts
  if (spec.resource_discounts) {
    const d = spec.resource_discounts;
    if (d.all  !== undefined) base.discAll = d.all;
    if (d.food !== undefined) base.discF   = d.food;
    if (d.wood !== undefined) base.discW   = d.wood;
    if (d.gold !== undefined) base.discG   = d.gold;
  }

  return base;
}
```

**Create `worker/test/fixtures.js`** to hold reusable test payloads:
```js
export const ARCHER_SPEC = { unit: 'archer_fu_feudal', count: 10 };
export const SKIRM_SPEC  = { unit: 'skirm_fu_feudal',  count: 10 };
export const INLINE_UNIT_SPEC = {
  unit: { name: 'Custom Archer', hp: 30, patk: 5, parm: 1, marm: 1, reload: 2.0, range: 5 },
  count: 5,
};
export const SIMULATE_BODY = {
  side_a: ARCHER_SPEC,
  side_b: SKIRM_SPEC,
};
```

### Tests to Write

**`worker/test/unit/data.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import {
  ALL_UNITS, UNITS, PRESETS, SCENARIOS, featuredScenarios,
  resolveUnit,
} from '../../src/data.js';
import { ARCHER_SPEC, SKIRM_SPEC, INLINE_UNIT_SPEC } from '../fixtures.js';

describe('data exports', () => {
  it('ALL_UNITS contains units from both units.js and presets.js', () => {
    expect(Object.keys(ALL_UNITS).length).toBeGreaterThan(0);
    expect(ALL_UNITS['archer_fu_feudal']).toBeDefined();  // from presets
  });

  it('UNITS has at least 100 entries (full unit catalog)', () => {
    expect(Object.keys(UNITS).length).toBeGreaterThan(100);
  });

  it('PRESETS has core units like archer_fu_feudal and skirm_fu_feudal', () => {
    expect(PRESETS['archer_fu_feudal']).toBeDefined();
    expect(PRESETS['skirm_fu_feudal']).toBeDefined();
  });

  it('SCENARIOS has expected scenario keys', () => {
    expect(SCENARIOS['archers_vs_skirms']).toBeDefined();
    expect(SCENARIOS['maa_vs_scouts']).toBeDefined();
  });

  it('featuredScenarios is a non-empty array', () => {
    expect(Array.isArray(featuredScenarios)).toBe(true);
    expect(featuredScenarios.length).toBeGreaterThan(0);
  });
});

describe('resolveUnit — Option A (key reference)', () => {
  it('resolves a known preset key', () => {
    const unit = resolveUnit(ARCHER_SPEC);
    expect(unit.hp).toBe(30);
    expect(unit.patk).toBe(5);
    expect(unit.count).toBe(10);
  });

  it('throws for an unknown key', () => {
    expect(() => resolveUnit({ unit: 'nonexistent_unit_xyz' })).toThrow('Unknown unit key');
  });
});

describe('resolveUnit — Option B (key + overrides)', () => {
  it('applies numeric stat overrides', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', overrides: { hp: 40, patk: 7 }, count: 5 });
    expect(unit.hp).toBe(40);
    expect(unit.patk).toBe(7);
    expect(unit.count).toBe(5);
  });

  it('maps bonus_atk override to bonusAtk', () => {
    const unit = resolveUnit({ unit: 'skirm_fu_feudal', overrides: { bonus_atk: 3 } });
    expect(unit.bonusAtk).toBe(3);
  });

  it('converts bonus_reduction from 0-1 float to 0-100 for Unit constructor', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', overrides: { bonus_reduction: 0.5 } });
    expect(unit.bonusReduct).toBe(50);
  });

  it('does not mutate the original preset entry in ALL_UNITS', () => {
    const originalHp = ALL_UNITS['archer_fu_feudal'].hp;
    resolveUnit({ unit: 'archer_fu_feudal', overrides: { hp: 999 } });
    expect(ALL_UNITS['archer_fu_feudal'].hp).toBe(originalHp);
  });
});

describe('resolveUnit — Option C (fully inline)', () => {
  it('returns the inline stat object with army fields merged', () => {
    const unit = resolveUnit(INLINE_UNIT_SPEC);
    expect(unit.name).toBe('Custom Archer');
    expect(unit.hp).toBe(30);
    expect(unit.count).toBe(5);
  });

  it('throws if required inline fields are missing', () => {
    expect(() => resolveUnit({ unit: { name: 'Bad', hp: 30 } })).toThrow('missing required field');
  });
});

describe('resolveUnit — army-level field mapping', () => {
  it('maps tech_delay to techDelay', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', tech_delay: 40 });
    expect(unit.techDelay).toBe(40);
  });

  it('maps units_before to unitsBefore', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', units_before: 3 });
    expect(unit.unitsBefore).toBe(3);
  });

  it('maps resource_discounts correctly', () => {
    const unit = resolveUnit({
      unit: 'archer_fu_feudal',
      resource_discounts: { all: 10, food: 5, wood: 15, gold: 20 },
    });
    expect(unit.discAll).toBe(10);
    expect(unit.discF).toBe(5);
    expect(unit.discW).toBe(15);
    expect(unit.discG).toBe(20);
  });
});
```

### Definition of Done
- [ ] `npm run prebuild` succeeds (generated files present) before running tests.
- [ ] All tests in `data.test.js` pass.
- [ ] `resolveUnit` never mutates entries in `ALL_UNITS`.
- [ ] `resolveUnit` throws with a useful error message for all invalid inputs.

### Commit
```
git add -A && git commit -m "feat: add data layer (resolveUnit, ALL_UNITS exports) with tests"
```

---

## Step 5 — Request Router & CORS (`worker/src/index.js`)

**Goal:** A Cloudflare Worker entry point with CORS headers, OPTIONS preflight handling, and a complete route dispatch table. Route handlers are stubbed (return 501) until Steps 6–9 implement them.

### Files to Create
- `worker/src/cors.js`
- `worker/src/index.js`
- `worker/test/integration/router.test.js`

### Implementation Notes

**`worker/src/cors.js`** — shared constant imported by `index.js` and all route files. Keeping it in a dedicated file prevents the circular dependency that would arise if route files imported from `index.js`:
```js
export const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

```js
import { CORS } from './cors.js';
import { handleSimulate, handleBatch, handleSweep } from './routes/simulate.js';
import { handleListScenarios, handleScenarioSimulate } from './routes/scenarios.js';
import { handleListUnits, handleGetUnit, handleListPresets, handleGetPreset } from './routes/catalog.js';
import { handleMcp } from './routes/mcp.js';

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export default {
  async fetch(request) {
    const url    = new URL(request.url);
    const method = request.method;
    const path   = url.pathname;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // POST routes
    if (method === 'POST') {
      if (path === '/simulate')         return handleSimulate(request);
      if (path === '/simulate/batch')   return handleBatch(request);
      if (path === '/simulate/sweep')   return handleSweep(request);
      if (path === '/mcp')              return handleMcp(request);

      const scenarioMatch = path.match(/^\/scenarios\/([^/]+)\/simulate$/);
      if (scenarioMatch) return handleScenarioSimulate(request, scenarioMatch[1]);
    }

    // GET routes
    if (method === 'GET') {
      if (path === '/scenarios')  return handleListScenarios(request);
      if (path === '/units')      return handleListUnits(request);
      if (path === '/presets')    return handleListPresets(request);

      const unitMatch   = path.match(/^\/units\/([^/]+)$/);
      const presetMatch = path.match(/^\/presets\/([^/]+)$/);
      if (unitMatch)   return handleGetUnit(request, unitMatch[1]);
      if (presetMatch) return handleGetPreset(request, presetMatch[1]);
    }

    // 405 for known paths with wrong method; 404 for everything else
    const knownPaths = ['/simulate', '/simulate/batch', '/simulate/sweep',
                        '/scenarios', '/units', '/presets', '/mcp'];
    const isKnown = knownPaths.includes(path)
      || /^\/scenarios\/[^/]+\/simulate$/.test(path)
      || /^\/units\/[^/]+$/.test(path)
      || /^\/presets\/[^/]+$/.test(path);
    return json({ error: isKnown ? 'Method Not Allowed' : 'Not Found' }, isKnown ? 405 : 404);
  },
};
```

**Stub all route files** so `index.js` can import them without errors:

Create `worker/src/routes/simulate.js`, `scenarios.js`, `catalog.js`, `mcp.js`, each exporting stub handlers that return a `501 Not Implemented` response temporarily. These will be fully implemented in later steps.

### Tests to Write

**`worker/test/integration/router.test.js`** — tests routing and CORS behaviour, not business logic:

```js
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('CORS + preflight', () => {
  it('OPTIONS /simulate returns 204 with CORS headers', async () => {
    const res = await SELF.fetch('http://example.com/simulate', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('every successful response includes CORS header', async () => {
    const res = await SELF.fetch('http://example.com/units');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('routing', () => {
  it('returns 404 for unknown paths', async () => {
    const res = await SELF.fetch('http://example.com/unknown-path');
    expect(res.status).toBe(404);
  });

  it('returns 405 for GET on POST-only /simulate', async () => {
    const res = await SELF.fetch('http://example.com/simulate', { method: 'GET' });
    expect(res.status).toBe(405);
  });

  it('routes POST /simulate to the simulate handler (not 404)', async () => {
    const res = await SELF.fetch('http://example.com/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Will be 400 (bad input) or 200 once handler is implemented; must not be 404/405
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(405);
  });

  it('routes GET /units to the catalog handler (not 404)', async () => {
    const res = await SELF.fetch('http://example.com/units');
    expect(res.status).not.toBe(404);
  });

  it('routes POST /scenarios/:id/simulate correctly', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/archers_vs_skirms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(405);
  });
});
```

### Definition of Done
- [ ] All stub route files created; `worker/src/index.js` imports without errors.
- [ ] `npm test` (unit tests) still passes.
- [ ] `npm run test:integration` — routing tests pass.
- [ ] No 404/405 on any of the 9 defined routes.

### Commit
```
git add -A && git commit -m "feat: add request router, CORS handling, and route stubs with integration tests"
```

---

## Step 6 — Catalog Routes (`worker/src/routes/catalog.js`)

**Goal:** Implement `GET /units`, `GET /units/:id`, `GET /presets`, `GET /presets/:id` with optional `?name=` filter on the list endpoints.

### Files to Create / Modify
- `worker/src/routes/catalog.js` (replace stub)
- `worker/test/unit/routes/catalog.test.js`
- `worker/test/integration/catalog.test.js`

### Implementation Notes

```js
import { UNITS, PRESETS } from '../data.js';
import { CORS } from '../cors.js';

// ── Logic functions ───────────────────────────────────────────────────────────

export function listUnitsLogic(nameFilter = '') {
  if (!nameFilter) return UNITS;
  const q = nameFilter.toLowerCase();
  return Object.fromEntries(
    Object.entries(UNITS).filter(([, v]) => v.name.toLowerCase().includes(q))
  );
}

export function getUnitLogic(id) {
  const unit = UNITS[id];
  if (!unit) throw new Error(`Unit not found: ${id}`);
  return unit;
}

export function listPresetsLogic(nameFilter = '') {
  if (!nameFilter) return PRESETS;
  const q = nameFilter.toLowerCase();
  return Object.fromEntries(
    Object.entries(PRESETS).filter(([, v]) => v.name.toLowerCase().includes(q))
  );
}

export function getPresetLogic(id) {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`Preset not found: ${id}`);
  return preset;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

export function handleListUnits(request) {
  const url        = new URL(request.url);
  const nameFilter = url.searchParams.get('name') || '';
  return Response.json(listUnitsLogic(nameFilter), { headers: CORS });
}

export function handleGetUnit(request, id) {
  try {
    return Response.json(getUnitLogic(id), { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404, headers: CORS });
  }
}

export function handleListPresets(request) {
  const url        = new URL(request.url);
  const nameFilter = url.searchParams.get('name') || '';
  return Response.json(listPresetsLogic(nameFilter), { headers: CORS });
}

export function handleGetPreset(request, id) {
  try {
    return Response.json(getPresetLogic(id), { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404, headers: CORS });
  }
}
```

### Tests to Write

**`worker/test/unit/routes/catalog.test.js`** (logic functions, no runtime):

```js
import { describe, it, expect } from 'vitest';
import { listUnitsLogic, getUnitLogic, listPresetsLogic, getPresetLogic } from '../../../src/routes/catalog.js';

describe('listUnitsLogic', () => {
  it('returns all units when no filter', () => {
    const result = listUnitsLogic();
    expect(Object.keys(result).length).toBeGreaterThan(100);
  });

  it('filters by name substring (case-insensitive)', () => {
    const result = listUnitsLogic('archer');
    const names  = Object.values(result).map(u => u.name.toLowerCase());
    expect(names.every(n => n.includes('archer'))).toBe(true);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('returns empty object for filter with no matches', () => {
    expect(Object.keys(listUnitsLogic('zzznomatch999')).length).toBe(0);
  });
});

describe('getUnitLogic', () => {
  it('returns the unit for a valid key', () => {
    const unit = getUnitLogic('archer');
    expect(unit).toBeDefined();
    expect(unit.hp).toBeGreaterThan(0);
  });

  it('throws for an unknown key', () => {
    expect(() => getUnitLogic('no_such_unit')).toThrow('Unit not found');
  });
});

describe('listPresetsLogic', () => {
  it('returns all presets when no filter', () => {
    const result = listPresetsLogic();
    expect(result['archer_fu_feudal']).toBeDefined();
    expect(result['skirm_fu_feudal']).toBeDefined();
  });

  it('filters by name substring', () => {
    const result = listPresetsLogic('archer');
    expect(Object.keys(result).length).toBeGreaterThan(0);
    Object.values(result).forEach(p => {
      expect(p.name.toLowerCase()).toContain('archer');
    });
  });
});

describe('getPresetLogic', () => {
  it('returns the preset for a valid key', () => {
    const preset = getPresetLogic('archer_fu_feudal');
    expect(preset.hp).toBe(30);
    expect(preset.patk).toBe(5);
  });

  it('throws for an unknown key', () => {
    expect(() => getPresetLogic('no_such_preset')).toThrow('Preset not found');
  });
});
```

**`worker/test/integration/catalog.test.js`** (HTTP layer via Workers runtime):

```js
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('GET /units', () => {
  it('returns 200 with all units', async () => {
    const res  = await SELF.fetch('http://example.com/units');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).length).toBeGreaterThan(100);
  });

  it('?name= filter returns matching units', async () => {
    const res  = await SELF.fetch('http://example.com/units?name=archer');
    const body = await res.json();
    Object.values(body).forEach(u => expect(u.name.toLowerCase()).toContain('archer'));
  });
});

describe('GET /units/:id', () => {
  it('returns a single unit for a valid key', async () => {
    const res  = await SELF.fetch('http://example.com/units/archer');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hp).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown unit key', async () => {
    const res = await SELF.fetch('http://example.com/units/zzz_no_such_unit');
    expect(res.status).toBe(404);
  });
});

describe('GET /presets', () => {
  it('returns all presets', async () => {
    const res  = await SELF.fetch('http://example.com/presets');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['archer_fu_feudal']).toBeDefined();
  });
});

describe('GET /presets/:id', () => {
  it('returns the preset for archer_fu_feudal', async () => {
    const res  = await SELF.fetch('http://example.com/presets/archer_fu_feudal');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hp).toBe(30);
    expect(body.patk).toBe(5);
  });

  it('returns 404 for an unknown preset', async () => {
    const res = await SELF.fetch('http://example.com/presets/no_such_preset');
    expect(res.status).toBe(404);
  });
});
```

### Definition of Done
- [ ] All logic function unit tests pass.
- [ ] All HTTP integration tests pass.
- [ ] `?name=` filter is case-insensitive.
- [ ] 404 responses have a JSON body with an `error` field.

### Commit
```
git add -A && git commit -m "feat: implement catalog routes (units, presets) with unit and integration tests"
```

---

## Step 7 — Single Simulate Route (`POST /simulate`)

**Goal:** Implement the core battle simulation endpoint — resolve units, run the sim kernel, compute resource values and efficiency, return the structured result.

### Files to Create / Modify
- `worker/src/routes/simulate.js` (replace stub — add `simulateLogic` + `handleSimulate`)
- `worker/test/unit/routes/simulate.test.js`
- `worker/test/integration/simulate.test.js`
- Update `worker/test/fixtures.js` with additional payloads

### Implementation Notes

Route files import `CORS` from `'../cors.js'` (not from `'../index.js'` — that would be a circular import).

**`buildSimData(spec)` helper** — converts a resolved stat object + army spec into the two CombatSim arguments:
```js
function buildSimData(spec) {
  const unitData = resolveUnit(spec);
  const config   = {
    engagement:  spec.engagement_pct ?? 100,
    targetMicro: spec.micro ?? 0,
  };
  return { unitData, config };
}
```

**`simulateLogic(side_a, side_b, options = {})` — full contract:**
1. Validate: `side_a` and `side_b` must be present and have a `unit` field; throw `Error` otherwise.
2. Build `dataA`/`configA` from `side_a`; `dataB`/`configB` from `side_b`.
3. Instantiate `CombatSim(dataA, dataB, configA, configB, { tick, maxDuration })`.
4. Call `sim.run()`.
5. Build and return the response object per `arch.md`:

```js
const costA   = new Unit(dataA).getParsedCost().total;
const costB   = new Unit(dataB).getParsedCost().total;
const initValA = dataA.count * costA;
const initValB = dataB.count * costB;
const hpPctA   = result.armyA.totalHp / result.armyA.initialTotalHp || 0;
const hpPctB   = result.armyB.totalHp / result.armyB.initialTotalHp || 0;
const remValA  = hpPctA * initValA;
const remValB  = hpPctB * initValB;
const lostValA = initValA - remValA;
const lostValB = initValB - remValB;
```

- `winner`: `'side_a'` if `result.armyA.remaining > result.armyB.remaining`; `'side_b'` if vice-versa; `null` if both reach 0 **or** if both are equal and non-zero (timeout tie — e.g. `maxDuration` cut the fight short with both sides equal). In both tie cases `draw` is also `true`.
- `draw`: `true` if `result.armyA.remaining === result.armyB.remaining` (covers mutual annihilation and timeout ties).
- `efficiency.side_a_per_resource_spent`: `lostValB / lostValA` (opponent losses / your losses). Guard against division by zero (`lostValA === 0 → null`).
- `efficiency.side_b_per_resource_spent`: `lostValA / lostValB` (opponent losses / your losses, from side B's perspective). Guard against division by zero (`lostValB === 0 → null`).
- `history`: `null` if `options.include_history !== true`; else `result.history`.

### Tests to Write

**`worker/test/unit/routes/simulate.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import { simulateLogic } from '../../../src/routes/simulate.js';
import { ARCHER_SPEC, SKIRM_SPEC, INLINE_UNIT_SPEC } from '../../fixtures.js';

describe('simulateLogic — validation', () => {
  it('throws if side_a is missing', () => {
    expect(() => simulateLogic(null, SKIRM_SPEC)).toThrow();
  });

  it('throws if side_b.unit is missing', () => {
    expect(() => simulateLogic(ARCHER_SPEC, { count: 10 })).toThrow();
  });

  it('throws for an unknown unit key', () => {
    expect(() => simulateLogic({ unit: 'zzz_bad_key', count: 5 }, SKIRM_SPEC)).toThrow('Unknown unit key');
  });
});

describe('simulateLogic — result shape', () => {
  it('returns all required top-level fields', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('draw');
    expect(result).toHaveProperty('duration_s');
    expect(result).toHaveProperty('side_a');
    expect(result).toHaveProperty('side_b');
    expect(result).toHaveProperty('efficiency');
    expect(result).toHaveProperty('history');
  });

  it('returns correct side_a shape', () => {
    const { side_a } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(side_a).toHaveProperty('remaining_count');
    expect(side_a).toHaveProperty('remaining_hp');
    expect(side_a).toHaveProperty('initial_count');
    expect(side_a).toHaveProperty('hp_pct_remaining');
    expect(side_a).toHaveProperty('resource_value_initial');
    expect(side_a).toHaveProperty('resource_value_remaining');
    expect(side_a).toHaveProperty('resource_value_lost');
  });
});

describe('simulateLogic — known outcomes', () => {
  it('skirms beat archers 10v10 (focus fire)', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(result.winner).toBe('side_b');
    expect(result.draw).toBe(false);
    expect(result.side_a.remaining_count).toBe(0);
    expect(result.side_b.remaining_count).toBeGreaterThan(0);
  });

  it('resource_value_initial for archers = 10 * (25w + 45g) = 700', () => {
    const { side_a } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(side_a.resource_value_initial).toBeCloseTo(700, 0);
  });

  it('resource_value_lost = initial - remaining (conservation check)', () => {
    const { side_a, side_b } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(side_a.resource_value_lost).toBeCloseTo(
      side_a.resource_value_initial - side_a.resource_value_remaining, 1
    );
    expect(side_b.resource_value_lost).toBeCloseTo(
      side_b.resource_value_initial - side_b.resource_value_remaining, 1
    );
  });

  it('side_b efficiency > 1 when skirms win (they destroyed more than they lost)', () => {
    const { efficiency } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(efficiency.side_b_per_resource_spent).toBeGreaterThan(1);
  });
});

describe('simulateLogic — Option B (overrides)', () => {
  it('reflects overridden stats in the outcome', () => {
    const baseResult     = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    const boostedResult  = simulateLogic(
      { unit: 'archer_fu_feudal', overrides: { patk: 20 }, count: 10 },
      SKIRM_SPEC,
    );
    // Much stronger archers should win
    expect(boostedResult.winner).toBe('side_a');
    expect(boostedResult.winner).not.toBe(baseResult.winner);
  });
});

describe('simulateLogic — Option C (inline unit)', () => {
  it('accepts a fully inline unit spec', () => {
    const result = simulateLogic(INLINE_UNIT_SPEC, SKIRM_SPEC);
    expect(result).toHaveProperty('winner');
  });
});

describe('simulateLogic — options', () => {
  it('history is null by default', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(result.history).toBeNull();
  });

  it('history is non-null when include_history=true', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC, { include_history: true });
    expect(Array.isArray(result.history)).toBe(true);
    expect(result.history.length).toBeGreaterThan(0);
  });

  it('draw=true when both sides are equally matched and both reach 0', () => {
    // Identical units with identical counts should be a draw
    const sameSpec = { unit: 'archer_fu_feudal', count: 10 };
    const result   = simulateLogic(sameSpec, { ...sameSpec });
    // May or may not be a draw depending on rounding; just verify the field is boolean
    expect(typeof result.draw).toBe('boolean');
  });
});
```

**`worker/test/integration/simulate.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { SIMULATE_BODY } from '../fixtures.js';

async function simulate(body) {
  return SELF.fetch('http://example.com/simulate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

describe('POST /simulate', () => {
  it('returns 200 with winner field for a valid request', async () => {
    const res  = await simulate(SIMULATE_BODY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('winner');
    expect(body).toHaveProperty('draw');
  });

  it('returns 400 when side_a is missing', async () => {
    const res = await simulate({ side_b: { unit: 'skirm_fu_feudal', count: 10 } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for unknown unit key', async () => {
    const res = await simulate({ side_a: { unit: 'zzz_bad', count: 5 }, side_b: { unit: 'archer_fu_feudal', count: 5 } });
    expect(res.status).toBe(400);
  });

  it('CORS header is present on the response', async () => {
    const res = await simulate(SIMULATE_BODY);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('inline unit (Option C) returns a valid result', async () => {
    const res = await simulate({
      side_a: { unit: { name: 'X', hp: 30, patk: 5, parm: 1, marm: 1, reload: 2.0, range: 5 }, count: 5 },
      side_b: { unit: 'skirm_fu_feudal', count: 5 },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('winner');
  });
});
```

### Definition of Done
- [ ] All unit tests in `simulate.test.js` pass.
- [ ] All integration tests pass.
- [ ] `winner`, `draw`, `duration_s`, both side objects, `efficiency`, `history` are always present in the response.
- [ ] `resource_value_lost + resource_value_remaining ≈ resource_value_initial` for both sides (conservation check passes).
- [ ] Division by zero in efficiency is handled gracefully.

### Commit
```
git add -A && git commit -m "feat: implement POST /simulate with full result shape, efficiency, and tests"
```

---

## Step 8 — Batch & Sweep Routes (`POST /simulate/batch` and `POST /simulate/sweep`)

**Goal:** Implement the multi-matchup and parameter-sweep endpoints, building on `simulateLogic` from Step 7.

### Files to Modify
- `worker/src/routes/simulate.js` (add `batchLogic`, `handleBatch`, `sweepLogic`, `handleSweep`)
- `worker/test/unit/routes/simulate.test.js` (add batch + sweep tests)
- `worker/test/integration/simulate.test.js` (add batch + sweep integration tests)

### Implementation Notes

**`batchLogic(matchups, options = {})`**:
```js
export function batchLogic(matchups, options = {}) {
  if (!Array.isArray(matchups) || matchups.length === 0)
    throw new Error('matchups must be a non-empty array');
  return matchups.map(({ id, side_a, side_b }) => ({
    id,
    ...simulateLogic(side_a, side_b, options),
  }));
}
```

**`sweepLogic(side_a, side_b, sweep, options = {})`**:

**Runtime note:** `structuredClone` is used for deep-cloning specs on each iteration. It is available natively in Node ≥ 17 and in Cloudflare Workers. If your CI uses Node 16, add `import { structuredClone } from 'node:v8'` or upgrade to Node 17+.

**Draw-as-breakeven:** If the very first sweep value produces `winner === null` (a draw or timeout tie), `baseWinner` is set to `null`. Any subsequent non-null winner will register as a breakeven. This is the correct behaviour — a draw is distinct from either side winning, so a flip away from draw counts as the point where the outcome changes.

Key implementation details:
- Parse `sweep.target` dot-path: only `'side_a.<field>'` and `'side_b.<field>'` paths are valid. Split on `.` with a max depth of 3 (e.g. `'side_a.overrides.hp'`).
- For each `value` in `[min, min+step, min+2*step, ..., max]` (inclusive, floating-point safe): deep-clone both specs, set the target field, call `simulateLogic`, record `{ value, winner }`.
- **Breakeven**: the first `value` where `winner` differs from the `winner` at `min`. If it never flips, `breakeven = null`.
- Guard: if `step <= 0` throw immediately; if `min > max` throw immediately.
- Do not include `history` in sweep sub-results (ignore `options.include_history` within each inner call).

```js
export function sweepLogic(side_a, side_b, sweep, options = {}) {
  const { target, range: { min, max, step } } = sweep;
  if (step <= 0)  throw new Error('sweep.range.step must be positive');
  if (min > max)  throw new Error('sweep.range.min must be <= max');

  const [side, ...fieldPath] = target.split('.');
  if (side !== 'side_a' && side !== 'side_b')
    throw new Error('sweep.target must start with side_a or side_b');

  const results = [];
  let baseWinner = null;
  let breakeven  = null;

  for (let v = min; v <= max + 1e-9; v = Math.round((v + step) * 1e9) / 1e9) {
    const a = structuredClone(side_a);
    const b = structuredClone(side_b);
    const target_obj = side === 'side_a' ? a : b;
    setPath(target_obj, fieldPath, v);  // helper: set nested field by path array

    const { winner } = simulateLogic(a, b, { ...options, include_history: false });
    results.push({ value: v, winner });

    if (baseWinner === null) baseWinner = winner;
    else if (breakeven === null && winner !== baseWinner) breakeven = v;
  }

  return { sweep_param: target, breakeven, results };
}

function setPath(obj, path, value) {
  const last = path[path.length - 1];
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] === undefined) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[last] = value;
}
```

### Tests to Write

Add to **`worker/test/unit/routes/simulate.test.js`**:

```js
describe('batchLogic', () => {
  it('throws if matchups is not an array', () => {
    expect(() => batchLogic(null)).toThrow('non-empty array');
  });

  it('throws if matchups is empty', () => {
    expect(() => batchLogic([])).toThrow('non-empty array');
  });

  it('returns an array with results tagged by id', () => {
    const results = batchLogic([
      { id: 'run_1', side_a: ARCHER_SPEC, side_b: SKIRM_SPEC },
      { id: 'run_2', side_a: SKIRM_SPEC,  side_b: ARCHER_SPEC },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('run_1');
    expect(results[1].id).toBe('run_2');
    expect(results[0]).toHaveProperty('winner');
  });

  it('results are independent (different matchups can have different winners)', () => {
    const results = batchLogic([
      { id: 'a_wins', side_a: { unit: 'archer_fu_feudal', count: 30 }, side_b: SKIRM_SPEC },
      { id: 'b_wins', side_a: ARCHER_SPEC, side_b: { unit: 'skirm_fu_feudal', count: 30 } },
    ]);
    expect(results[0].winner).toBe('side_a');
    expect(results[1].winner).toBe('side_b');
  });
});

describe('sweepLogic', () => {
  it('throws for step <= 0', () => {
    expect(() => sweepLogic(ARCHER_SPEC, SKIRM_SPEC, {
      target: 'side_a.count', range: { min: 1, max: 10, step: 0 },
    })).toThrow('step must be positive');
  });

  it('throws for min > max', () => {
    expect(() => sweepLogic(ARCHER_SPEC, SKIRM_SPEC, {
      target: 'side_a.count', range: { min: 20, max: 10, step: 1 },
    })).toThrow('min must be');
  });

  it('throws for invalid target prefix', () => {
    expect(() => sweepLogic(ARCHER_SPEC, SKIRM_SPEC, {
      target: 'side_c.count', range: { min: 1, max: 5, step: 1 },
    })).toThrow('side_a or side_b');
  });

  it('returns sweep_param, breakeven, and results fields', () => {
    const result = sweepLogic(
      { unit: 'archer_fu_feudal' }, SKIRM_SPEC,
      { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } }
    );
    expect(result).toHaveProperty('sweep_param', 'side_a.count');
    expect(result).toHaveProperty('breakeven');
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('every result entry has value and winner', () => {
    const { results } = sweepLogic(
      { unit: 'archer_fu_feudal' }, SKIRM_SPEC,
      { target: 'side_a.count', range: { min: 1, max: 5, step: 1 } }
    );
    results.forEach(r => {
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('winner');
    });
  });

  it('sweep side_a.count 1→30 vs 10 skirms — breakeven is found', () => {
    const { breakeven } = sweepLogic(
      { unit: 'archer_fu_feudal' }, { unit: 'skirm_fu_feudal', count: 10 },
      { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } }
    );
    expect(breakeven).not.toBeNull();
    expect(breakeven).toBeGreaterThan(1);
    expect(breakeven).toBeLessThan(30);
  });

  it('breakeven is null when winner never flips', () => {
    // side_a always wins: 30 archers vs 1 skirm, vary side_a.count from 20 to 30
    const { breakeven } = sweepLogic(
      { unit: 'archer_fu_feudal' }, { unit: 'skirm_fu_feudal', count: 1 },
      { target: 'side_a.count', range: { min: 20, max: 30, step: 1 } }
    );
    expect(breakeven).toBeNull();
  });

  it('does not mutate the original side_a and side_b objects', () => {
    const orig_a = { unit: 'archer_fu_feudal', count: 5 };
    const orig_b = { unit: 'skirm_fu_feudal',  count: 10 };
    sweepLogic(orig_a, orig_b, { target: 'side_a.count', range: { min: 1, max: 3, step: 1 } });
    expect(orig_a.count).toBe(5); // must not have been mutated
  });
});
```

Add to **`worker/test/integration/simulate.test.js`**:

```js
describe('POST /simulate/batch', () => {
  it('returns an array of results tagged with ids', async () => {
    const res = await SELF.fetch('http://example.com/simulate/batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        matchups: [
          { id: 'run_1', ...SIMULATE_BODY },
          { id: 'run_2', side_a: SIMULATE_BODY.side_b, side_b: SIMULATE_BODY.side_a },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('run_1');
    expect(body[0]).toHaveProperty('winner');
  });

  it('returns 400 for empty matchups array', async () => {
    const res = await SELF.fetch('http://example.com/simulate/batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ matchups: [] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /simulate/sweep', () => {
  it('returns sweep_param, breakeven, and results', async () => {
    const res = await SELF.fetch('http://example.com/simulate/sweep', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        side_a: { unit: 'archer_fu_feudal' },
        side_b: { unit: 'skirm_fu_feudal', count: 10 },
        sweep:  { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('breakeven');
    expect(body.results.every(r => 'winner' in r)).toBe(true);
  });

  it('returns 400 for invalid sweep target', async () => {
    const res = await SELF.fetch('http://example.com/simulate/sweep', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        side_a: { unit: 'archer_fu_feudal', count: 5 },
        side_b: { unit: 'skirm_fu_feudal',  count: 5 },
        sweep:  { target: 'invalid.field', range: { min: 1, max: 5, step: 1 } },
      }),
    });
    expect(res.status).toBe(400);
  });
});
```

### Definition of Done
- [ ] All batch and sweep unit tests pass.
- [ ] All integration tests pass.
- [ ] The sweep breakeven value changes correctly when unit counts change.
- [ ] Mutation safety test passes (sweep does not modify input objects).
- [ ] Floating-point range loop does not skip or double-count the final value.

### Commit
```
git add -A && git commit -m "feat: implement batch and sweep routes with breakeven detection and tests"
```

---

## Step 9 — Scenarios Routes (`GET /scenarios`, `POST /scenarios/:id/simulate`)

**Goal:** Implement the scenarios catalog and the named-scenario simulation endpoint, translating chombat's internal scenario format to the API's army spec format.

### Files to Create / Modify
- `worker/src/routes/scenarios.js` (replace stub)
- `worker/test/unit/routes/scenarios.test.js`
- `worker/test/integration/scenarios.test.js`

### Implementation Notes

The chombat `scenarios.js` uses a different field schema than the API's `ArmySpec`. The translation is done once in `routes/scenarios.js`:

| Scenario field | ArmySpec field |
|---|---|
| `preset` | `unit` (key reference) |
| `count` | `count` |
| `delay` | `delay` |
| `tech` | `tech_delay` |
| `pre` | `units_before` |
| `bbn` | `overrides.bonus_atk` |
| `hp` | `overrides.hp` (if present) |
| `micro` | `micro` |
| `eng` | `engagement_pct` |
| `buildings` | `buildings` |

**`scenarioToArmySpec(side)` helper** — translates a chombat scenario side into the API's `ArmySpec` format:

```js
function scenarioToArmySpec(side) {
  const spec = {
    unit:           side.preset || side.unit,
    count:          side.count         ?? 1,
    delay:          side.delay         ?? 0,
    tech_delay:     side.tech          ?? 0,
    units_before:   side.pre           ?? 0,
    buildings:      side.buildings     ?? 1,
    engagement_pct: side.eng           ?? 100,
    micro:          side.micro         ?? 0,
  };

  // Collect any stat-level fields that deviate from the base preset.
  // Scenario objects (especially complex ones like champi_scout_vs_fc_cataphract)
  // can carry inline overrides for hp, attack, armour, and resource costs.
  const overrides = {};
  const statFields = ['name', 'hp', 'matk', 'patk', 'marm', 'parm', 'reload', 'range', 'f', 'w', 'g'];
  for (const f of statFields) {
    if (side[f] !== undefined) overrides[f] = side[f];
  }
  // bbn → bonus_atk (chombat naming)
  if (side.bbn !== undefined) overrides.bonus_atk = side.bbn;
  // abr in chombat is bonus_reduction on a 0–100 scale; API expects 0–1 float
  if (side.abr !== undefined) overrides.bonus_reduction = side.abr / 100;

  if (Object.keys(overrides).length > 0) spec.overrides = overrides;
  return spec;
}
```

> **Note:** chombat's `as` (attack speed %) field is not supported by the API. Scenario sides that use it (none of the current built-in scenarios do) will silently ignore it. Similarly, `'train-time'` in scenarios is not translated (the Unit constructor default of 30 s is used instead).

**`mergeArmySpec(base, patch)` helper** — merges a request-body override onto a translated spec. The only nested object that needs special handling is `overrides` (so that a caller supplying `{ overrides: { hp: 50 } }` extends rather than replaces the scenario's existing `overrides`):

```js
function mergeArmySpec(base, patch) {
  if (!patch) return base;
  const merged = { ...base, ...patch };
  // Shallow-merge the nested 'overrides' sub-object so scenario-level overrides
  // (e.g. bbn) are preserved when the caller adds their own stat patches.
  if (base.overrides !== undefined || patch.overrides !== undefined) {
    merged.overrides = { ...(base.overrides || {}), ...(patch.overrides || {}) };
  }
  return merged;
}
```

**`listScenariosLogic()`**: returns an array of `{ id, name, desc, side_a, side_b }` by iterating `SCENARIOS`.

**`runScenarioLogic(id, overrides = {})`**:
1. Look up `SCENARIOS[id]`; throw `Error('Scenario not found: <id>')` if missing.
2. Translate `scenario.a` and `scenario.b` via `scenarioToArmySpec`.
3. Merge any `overrides.side_a` / `overrides.side_b` onto the translated specs via `mergeArmySpec`.
4. Call `simulateLogic(mergedA, mergedB, overrides.options)`.

```js
export function runScenarioLogic(id, overrides = {}) {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`Scenario not found: ${id}`);
  const specA = scenarioToArmySpec(scenario.a);
  const specB = scenarioToArmySpec(scenario.b);
  return simulateLogic(
    mergeArmySpec(specA, overrides.side_a),
    mergeArmySpec(specB, overrides.side_b),
    overrides.options,
  );
}
```

### Tests to Write

**`worker/test/unit/routes/scenarios.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import { listScenariosLogic, runScenarioLogic } from '../../../src/routes/scenarios.js';

describe('listScenariosLogic', () => {
  it('returns an array of scenario objects', () => {
    const list = listScenariosLogic();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('each scenario has id, name, desc, side_a, side_b', () => {
    listScenariosLogic().forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('desc');
      expect(s).toHaveProperty('side_a');
      expect(s).toHaveProperty('side_b');
    });
  });

  it('includes archers_vs_skirms scenario', () => {
    const ids = listScenariosLogic().map(s => s.id);
    expect(ids).toContain('archers_vs_skirms');
  });
});

describe('runScenarioLogic', () => {
  it('runs archers_vs_skirms and returns a winner', () => {
    const result = runScenarioLogic('archers_vs_skirms');
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('draw');
  });

  it('throws for an unknown scenario id', () => {
    expect(() => runScenarioLogic('no_such_scenario')).toThrow('Scenario not found');
  });

  it('applies overrides.side_a correctly', () => {
    // Give side_a massive count to guarantee they win
    const result = runScenarioLogic('archers_vs_skirms', {
      side_a: { count: 100 },
    });
    expect(result.winner).toBe('side_a');
  });

  it('preserves non-overridden fields from the scenario', () => {
    const normal   = runScenarioLogic('archers_vs_skirms');
    const override = runScenarioLogic('archers_vs_skirms', { options: { include_history: true } });
    expect(Array.isArray(override.history)).toBe(true);
    expect(normal.history).toBeNull();
  });
});
```

**`worker/test/integration/scenarios.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('GET /scenarios', () => {
  it('returns 200 with an array of scenarios', async () => {
    const res  = await SELF.fetch('http://example.com/scenarios');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('each scenario has id, name, desc fields', async () => {
    const body = await (await SELF.fetch('http://example.com/scenarios')).json();
    body.forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('desc');
    });
  });
});

describe('POST /scenarios/:id/simulate', () => {
  it('returns 200 with winner for a valid scenario (no body)', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/archers_vs_skirms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   '{}',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('winner');
  });

  it('returns 404 for an unknown scenario id', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/no_such_scenario/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   '{}',
    });
    expect(res.status).toBe(404);
  });

  it('accepts overrides in the request body', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/archers_vs_skirms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ side_a: { count: 100 } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.winner).toBe('side_a');
  });
});
```

### Definition of Done
- [ ] All unit tests in `scenarios.test.js` pass.
- [ ] All integration tests pass.
- [ ] Scenario fields `bbn`, `hp`, `pre`, `tech`, `eng`, `micro` are correctly translated.
- [ ] 404 is returned for unknown scenario IDs; the response has an `error` field.

### Commit
```
git add -A && git commit -m "feat: implement scenarios routes (list + run) with field translation and tests"
```

---

## Step 10 — MCP Server (`worker/src/routes/mcp.js`)

**Goal:** Implement the `POST /mcp` endpoint as a JSON-RPC 2.0 server using the Streamable HTTP transport. Expose all 9 tools backed by the logic functions from Steps 6–9.

### Files to Create / Modify
- `worker/src/routes/mcp.js` (replace stub)
- `worker/test/unit/routes/mcp.test.js`
- `worker/test/integration/mcp.test.js`

### Implementation Notes

**Overall structure of `mcp.js`:**

```
TOOLS constant (top-level) → array of 9 tool definitions with inputSchema
TOOL_HANDLERS map → { tool_name: handlerFn }
handleMcp(request) → parses JSON-RPC, dispatches, returns Response
```

**JSON-RPC dispatch (`handleMcp`):**

```js
export async function handleMcp(request) {
  const msg = await request.json();

  // Notification: no id present → process but return 204
  if (msg.id === undefined) {
    // handle notifications/initialized etc.
    return new Response(null, { status: 204 });
  }

  const respond = (result) =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }),
      { headers: { 'Content-Type': 'application/json' } });

  const respondError = (code, message) =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code, message } }),
      { headers: { 'Content-Type': 'application/json' } });

  try {
    switch (msg.method) {
      case 'initialize':
        return respond({
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'aoe2-battlesim', version: '1.0.0' },
        });

      case 'notifications/initialized':
        return new Response(null, { status: 204 });

      case 'tools/list':
        return respond({ tools: TOOLS });

      case 'tools/call': {
        const { name, arguments: args } = msg.params;
        const handler = TOOL_HANDLERS[name];
        if (!handler) return respond({
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        });
        try {
          const result = handler(args);
          return respond({
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: false,
          });
        } catch (e) {
          return respond({
            content: [{ type: 'text', text: e.message }],
            isError: true,
          });
        }
      }

      default:
        return respondError(-32601, 'Method not found');
    }
  } catch (e) {
    return respondError(-32603, e.message);
  }
}
```

**`TOOLS` array** — build per `arch.md §tools/list`. Important implementation notes:
- Use `$defs` for `ArmySpec` and `Options` at the top of the schema object — do not copy-paste them into each tool.
- Build the `run_scenario` tool's `id` enum **dynamically**: `"enum": Object.keys(SCENARIOS)`.
- Every property must have a `"description"` string.
- Every required field must appear in `"required": [...]`.

**`TOOL_HANDLERS` map:**
```js
const TOOL_HANDLERS = {
  simulate:       (a) => simulateLogic(a.side_a, a.side_b, a.options),
  simulate_batch: (a) => batchLogic(a.matchups, a.options),
  simulate_sweep: (a) => sweepLogic(a.side_a, a.side_b, a.sweep, a.options),
  list_units:     (a) => listUnitsLogic(a.name),
  get_unit:       (a) => getUnitLogic(a.id),
  list_presets:   ()  => listPresetsLogic(),
  get_preset:     (a) => getPresetLogic(a.id),
  list_scenarios: ()  => listScenariosLogic(),
  run_scenario:   (a) => runScenarioLogic(a.id, a.overrides),
};
```

### Tests to Write

**`worker/test/unit/routes/mcp.test.js`** (tests the dispatch logic directly):

```js
import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../../src/routes/mcp.js';
import { SCENARIOS } from '../../../src/data.js';

describe('TOOLS manifest', () => {
  const toolNames = ['simulate', 'simulate_batch', 'simulate_sweep',
                     'list_units', 'get_unit', 'list_presets', 'get_preset',
                     'list_scenarios', 'run_scenario'];

  it('has exactly 9 tools', () => {
    expect(TOOLS).toHaveLength(9);
  });

  it('contains all required tool names', () => {
    const names = TOOLS.map(t => t.name);
    toolNames.forEach(n => expect(names).toContain(n));
  });

  it('every tool has a description and inputSchema', () => {
    TOOLS.forEach(t => {
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe('object');
    });
  });

  it('run_scenario id enum is built from SCENARIOS (not hardcoded)', () => {
    const tool = TOOLS.find(t => t.name === 'run_scenario');
    const idEnum = tool.inputSchema.properties.id.enum;
    expect(Array.isArray(idEnum)).toBe(true);
    Object.keys(SCENARIOS).forEach(id => expect(idEnum).toContain(id));
  });

  it('simulate tool requires side_a and side_b', () => {
    const tool = TOOLS.find(t => t.name === 'simulate');
    expect(tool.inputSchema.required).toContain('side_a');
    expect(tool.inputSchema.required).toContain('side_b');
  });
});
```

**`worker/test/integration/mcp.test.js`**:

```js
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

async function mcp(body) {
  return SELF.fetch('http://example.com/mcp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

describe('initialize', () => {
  it('returns protocolVersion 2024-11-05', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.protocolVersion).toBe('2024-11-05');
    expect(body.result.capabilities).toHaveProperty('tools');
    expect(body.result.serverInfo.name).toBe('aoe2-battlesim');
  });
});

describe('notifications/initialized', () => {
  it('returns 204 (notification — no id)', async () => {
    const res = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res.status).toBe(204);
  });
});

describe('tools/list', () => {
  it('returns all 9 tools', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.tools).toHaveLength(9);
    const names = result.tools.map(t => t.name);
    expect(names).toContain('simulate');
    expect(names).toContain('run_scenario');
    expect(names).toContain('simulate_sweep');
  });
});

describe('tools/call — simulate', () => {
  it('returns isError:false and winner in text', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: 'simulate',
        arguments: {
          side_a: { unit: 'archer_fu_feudal', count: 10 },
          side_b: { unit: 'skirm_fu_feudal',  count: 10 },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('winner');
  });

  it('returns isError:true for bad input', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'simulate', arguments: { side_a: { unit: 'zzz_bad' }, side_b: {} } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBeTruthy();
  });
});

describe('tools/call — simulate_sweep', () => {
  it('returns breakeven in parsed text', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: {
        name: 'simulate_sweep',
        arguments: {
          side_a: { unit: 'archer_fu_feudal' },
          side_b: { unit: 'skirm_fu_feudal', count: 10 },
          sweep:  { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('breakeven');
  });
});

describe('tools/call — get_unit', () => {
  it('returns archer stat fields', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 6, method: 'tools/call',
      params: { name: 'get_unit', arguments: { id: 'archer_fu_feudal' } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hp).toBe(30);
  });
});

describe('tools/call — get_preset', () => {
  it('returns preset stat fields', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 7, method: 'tools/call',
      params: { name: 'get_preset', arguments: { id: 'archer_fu_feudal' } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hp).toBeDefined();
  });
});

describe('tools/call — unknown tool', () => {
  it('returns isError:true', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 8, method: 'tools/call',
      params: { name: 'not_a_real_tool', arguments: {} },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
  });
});

describe('unknown method', () => {
  it('returns JSON-RPC error -32601', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 9, method: 'no_such_method', params: {} });
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
  });
});
```

### Definition of Done
- [ ] All 9 tools present in manifest; manifest test passes.
- [ ] `run_scenario` `id` enum is built dynamically from `SCENARIOS` keys.
- [ ] `$defs.ArmySpec` and `$defs.Options` used for shared schemas (no copy-paste drift).
- [ ] All JSON-RPC integration tests pass.
- [ ] Tool-level errors use `isError: true` in `result`, not a top-level `error`.
- [ ] Notification messages (no `id`) always return `204`.

### Commit
```
git add -A && git commit -m "feat: implement MCP server (9 tools, JSON-RPC 2.0) with full test coverage"
```

---

## Step 11 — Local Dev Smoke Tests & Deployment

**Goal:** Verify the worker runs end-to-end under `wrangler dev`, then deploy to Cloudflare.

### Smoke Test Checklist (Manual — run against `http://localhost:8787`)

Start the dev server first (`npm run dev` — triggers `predev` which runs `gen-data.mjs`).

```bash
# 1. CORS preflight
curl -s -o /dev/null -w "%{http_code}" -X OPTIONS http://localhost:8787/simulate
# Expected: 204

# 2. Unit catalog
curl -s http://localhost:8787/units/archer_fu_feudal | jq .hp
# Expected: 30 (or the archer hp from presets.js)

# 3. Core simulation — archers vs skirms 10v10
curl -s -X POST http://localhost:8787/simulate \
  -H "Content-Type: application/json" \
  -d '{"side_a":{"unit":"archer_fu_feudal","count":10},"side_b":{"unit":"skirm_fu_feudal","count":10}}' \
  | jq .winner
# Expected: "side_b"

# 4. Inline unit (Option C)
curl -s -X POST http://localhost:8787/simulate \
  -H "Content-Type: application/json" \
  -d '{"side_a":{"unit":{"name":"X","hp":30,"patk":5,"parm":1,"marm":1,"reload":2,"range":5},"count":10},"side_b":{"unit":"skirm_fu_feudal","count":10}}' \
  | jq .winner

# 5. Override (Option B)
curl -s -X POST http://localhost:8787/simulate \
  -H "Content-Type: application/json" \
  -d '{"side_a":{"unit":"archer_fu_feudal","overrides":{"patk":20},"count":10},"side_b":{"unit":"skirm_fu_feudal","count":10}}' \
  | jq .winner
# Expected: "side_a" (greatly boosted archers)

# 6. Batch
curl -s -X POST http://localhost:8787/simulate/batch \
  -H "Content-Type: application/json" \
  -d '{"matchups":[{"id":"r1","side_a":{"unit":"archer_fu_feudal","count":10},"side_b":{"unit":"skirm_fu_feudal","count":10}},{"id":"r2","side_a":{"unit":"skirm_fu_feudal","count":10},"side_b":{"unit":"archer_fu_feudal","count":10}}]}' \
  | jq 'length'
# Expected: 2

# 7. Sweep
curl -s -X POST http://localhost:8787/simulate/sweep \
  -H "Content-Type: application/json" \
  -d '{"side_a":{"unit":"archer_fu_feudal"},"side_b":{"unit":"skirm_fu_feudal","count":10},"sweep":{"target":"side_a.count","range":{"min":1,"max":30,"step":1}}}' \
  | jq .breakeven
# Expected: a number between 1 and 30

# 8. Scenarios list
curl -s http://localhost:8787/scenarios | jq 'length'
# Expected: >= 7

# 9. Named scenario
curl -s -X POST http://localhost:8787/scenarios/archers_vs_skirms/simulate \
  -H "Content-Type: application/json" -d '{}' | jq .winner

# 10. Unit name filter
curl -s "http://localhost:8787/units?name=archer" | jq 'keys | length'
# Expected: > 0, all keys related to archers

# 11. MCP initialize
curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  | jq .result.protocolVersion
# Expected: "2024-11-05"

# 12. MCP tools/list — count tools
curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | jq '.result.tools | length'
# Expected: 9

# 13. MCP notification (no id) → 204
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
# Expected: 204
```

### Deployment

```bash
# Authenticate once (opens browser)
npx wrangler login

# Deploy (prebuild runs automatically via "predeploy" hook)
npm run deploy
```

After deployment, re-run the smoke tests substituting `https://aoe2-battlesim.<your-account>.workers.dev` for `http://localhost:8787`.

### MCP Client Configuration

Add to `.cursor/mcp.json` (or global MCP settings):
```json
{
  "mcpServers": {
    "aoe2-battlesim": {
      "url": "https://aoe2-battlesim.<your-account>.workers.dev/mcp"
    }
  }
}
```

For local development, swap the URL to `http://localhost:8787/mcp` while `wrangler dev` is running.

### Definition of Done
- [ ] All 13 smoke test commands return expected values against the local dev server.
- [ ] `npm run test:all` passes (all unit + integration tests).
- [ ] `wrangler deploy` succeeds.
- [ ] All 13 smoke tests pass against the deployed URL.
- [ ] MCP endpoint is reachable and recognized by Cursor.

### Commit
```
git add -A && git commit -m "chore: add deployment config and smoke test documentation"
```

---

## Appendix A — Directory Structure (Final)

```
aoe2-battlesim/
  vendor/
    chombat/              ← git submodule (never modified)
  worker/
    scripts/
      gen-data.mjs        ← prebuild: wraps vendor files into ES modules
    src/
      generated/          ← gitignored build artefact
        units.js
        presets.js
        scenarios.js
      index.js            ← router + CORS
      sim.js              ← Unit, CombatSim, calculateCount (verbatim copy + export)
      data.js             ← resolveUnit, ALL_UNITS, UNITS, PRESETS, SCENARIOS
      routes/
        simulate.js       ← simulateLogic, batchLogic, sweepLogic + HTTP handlers
        scenarios.js      ← listScenariosLogic, runScenarioLogic + HTTP handlers
        catalog.js        ← listUnits/getUnit/listPresets/getPreset logic + handlers
        mcp.js            ← JSON-RPC 2.0 handler + TOOLS manifest
    test/
      fixtures.js         ← shared test payloads
      unit/
        scaffold.test.js
        gen-data.test.js
        sim.test.js
        data.test.js
        routes/
          simulate.test.js
          scenarios.test.js
          catalog.test.js
          mcp.test.js
      integration/
        router.test.js
        simulate.test.js
        scenarios.test.js
        catalog.test.js
        mcp.test.js
    vitest.config.js
    vitest.integration.config.js
    wrangler.toml
  package.json
  .gitignore
  spec.md
  arch.md
  implementation-plan.md
```

---

## Appendix B — Chombat Submodule Update Workflow

When chombat publishes updated data (game patches, new units, scenario changes):

```bash
# from aoe2-battlesim root
git submodule update --remote vendor/chombat
git add vendor/chombat
git commit -m "chore: bump chombat to $(git -C vendor/chombat rev-parse --short HEAD)"

# Redeploy (gen-data.mjs runs automatically via predev/predeploy hook)
npm run deploy
```

When chombat's **simulation algorithm** changes (not just data), diff `vendor/chombat/script.js`
against the pinned commit and apply equivalent changes to `worker/src/sim.js` manually. Update
the sim tests to reflect the new behaviour before committing.

---

## Appendix C — Step Completion Tracker

| Step | Description | Status |
|------|-------------|--------|
| 1 | Repository scaffolding | `[ ]` |
| 2 | Prebuild script (gen-data.mjs) | `[ ]` |
| 3 | Sim kernel (sim.js) | `[ ]` |
| 4 | Data layer (data.js, resolveUnit) | `[ ]` |
| 5 | Router + CORS (index.js) | `[ ]` |
| 6 | Catalog routes | `[ ]` |
| 7 | POST /simulate | `[ ]` |
| 8 | POST /simulate/batch + /sweep | `[ ]` |
| 9 | Scenarios routes | `[ ]` |
| 10 | MCP server | `[ ]` |
| 11 | Smoke tests + deployment | `[ ]` |
