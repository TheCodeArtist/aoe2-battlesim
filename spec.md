# AoE2 Battle Simulator — Implementation Spec

## Status legend
- `[ ]` not started
- `[~]` in progress
- `[x]` done

---

## Overview

`aoe2-battlesim` is a **Cloudflare Worker** that exposes the Chombat combat simulation engine as a
REST API. It is a distinct git repository that treats
[chombat](https://github.com/crazybus/chombat) as a **git submodule**. It requires **zero changes
to chombat**: a prebuild script generates ES module wrappers from chombat's plain JS data files,
and the sim kernel is a maintained verbatim copy of the relevant lines from `script.js`.

The Worker runs at the edge (no cold starts, globally distributed, free tier: 100k req/day). Any
HTTP client — `fetch()` in a browser, `curl`, Python `requests` — can query it identically.

```
aoe2-battlesim/
  vendor/
    chombat/              ← git submodule (pinned to a chombat commit, never modified)
      units.js            ← plain const, wrapped at build time
      presets.js
      scenarios.js
      script.js           ← sim kernel lines copied from here (one-time)
  worker/
    scripts/
      gen-data.mjs        ← prebuild: wraps vendor JS files into ES modules
    src/
      generated/          ← build artefact (gitignored); produced by gen-data.mjs
        units.js
        presets.js
        scenarios.js
      index.js            ← request router + CORS
      sim.js              ← Unit, CombatSim, calculateCount (verbatim copy + export)
      data.js             ← imports from generated/, exposes resolveUnit()
      routes/
        simulate.js       ← POST /simulate, /simulate/batch, /simulate/sweep
        scenarios.js      ← GET /scenarios, POST /scenarios/:id/simulate
        catalog.js        ← GET /units, /units/:id, /presets, /presets/:id
    wrangler.toml         ← worker name, routes, compatibility_date
  package.json            ← prebuild/predev hooks wired to gen-data.mjs
  spec.md                 ← this file
  arch.md                 ← API contract reference
```

---

## Phase 1 — Repository setup

### 1.1 — Init git repo and install Wrangler
`[ ]` Run `git init` in `aoe2-battlesim/` if not already a repo.  
`[ ]` Install Wrangler: `npm install -D wrangler`  
`[ ]` Create `package.json` with:
  - `"type": "module"` (ES modules throughout)
  - dev dependency: `wrangler`
  - scripts:
    ```json
    "prebuild": "node worker/scripts/gen-data.mjs",
    "predev":   "node worker/scripts/gen-data.mjs",
    "dev":      "wrangler dev",
    "deploy":   "wrangler deploy"
    ```
`[ ]` Add `worker/src/generated/` to `.gitignore` (build artefact, not committed).

### 1.2 — Add chombat as a git submodule
`[ ]` `git submodule add <chombat-remote-url> vendor/chombat`  
`[ ]` Commit `.gitmodules` and `vendor/chombat`.

### 1.3 — Create `worker/wrangler.toml`
```toml
name = "aoe2-battlesim"
main = "src/index.js"
compatibility_date = "2024-01-01"
```

**To update the submodule later (the full update workflow):**
```bash
git submodule update --remote vendor/chombat
git add vendor/chombat
git commit -m "chore: bump chombat to $(git -C vendor/chombat rev-parse --short HEAD)"
```

---

## Phase 2 — Prebuild script (`worker/scripts/gen-data.mjs`)

chombat's data files use `const x = { ... }` with no `export` — they are not ES modules.
Rather than modifying chombat, this script runs before every `dev` and `deploy`, reads the three
files from the submodule, appends the appropriate `export` line to each, and writes the results to
`worker/src/generated/`. The Worker imports from `generated/`, not from `vendor/` directly.

`[ ]` Create `worker/scripts/gen-data.mjs`:
```js
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const root    = join(dirname(fileURLToPath(import.meta.url)), "../..");
const VENDOR  = join(root, "vendor/chombat");
const OUT     = join(root, "worker/src/generated");
mkdirSync(OUT, { recursive: true });

const files = [
  { src: "units.js",     exp: "export { units };" },
  { src: "presets.js",   exp: "export { presets };" },
  { src: "scenarios.js", exp: "export { scenarios, featuredScenarios };" },
];

for (const { src, exp } of files) {
  const content = readFileSync(join(VENDOR, src), "utf8");
  writeFileSync(join(OUT, src), content + "\n" + exp + "\n");
  console.log(`gen-data: wrote generated/${src}`);
}
```

`[ ]` Verify it runs cleanly: `node worker/scripts/gen-data.mjs` should produce three files
in `worker/src/generated/` with correct `export` lines at the bottom.

---

## Phase 3 — Sim kernel extraction (`worker/src/sim.js`)

Extract the pure simulation logic from chombat's `script.js` into a standalone ES module. No UI,
no DOM, no chart rendering — only the three classes/functions the API needs.

`[ ]` Copy `Unit` class verbatim from `script.js` lines 8–52.  
`[ ]` Copy `CombatSim` class verbatim from `script.js` lines 54–144.  
`[ ]` Copy `calculateCount` function verbatim from `script.js` lines 235–242.  
`[ ]` Add `export { Unit, CombatSim, calculateCount }` at the bottom.  
`[ ]` Confirm no remaining references to DOM, `document`, or chart globals.

The kernel is intentionally a near-verbatim copy (not a rewrite) so that diffs against
future chombat changes are easy to review and apply.

**Key simulation behaviour (for reference when reviewing future diffs):**

`calculateDamage(attacker, defender)`:
```
max(1, atk - armor) + bonusAtk × (1 − bonusReduction)
```
where `atk`/`armor` are the melee pair if `range ≤ 1`, otherwise pierce pair.

`applyDamage(unit, totalDmg, micro)`:
- `micro = 0` (focus fire): full `totalDmg` hits the HP pool, overkill is wasted.
- `micro > 0` (split fire): damage is divided into `micro` equal chunks; each chunk is
  capped at the HP of the unit it hits, preventing overkill. Effective damage is lower but
  kills are spread across more units.

`run()` tick loop (tick = 0.05 s, max 300 s):
- Each side fires when `attackCooldown ≤ 0`, then resets cooldown to `reload`.
- Engagement percentage caps how many units are actively firing each volley.
- History is recorded at t=0, on every whole-unit death, and every 0.25 s.

---

## Phase 4 — Data layer (`worker/src/data.js`)

Imports from the `generated/` files produced by `gen-data.mjs` — never directly from `vendor/`.

`[ ]` Import the three generated data files:
```js
import { units }    from "./generated/units.js";
import { presets }  from "./generated/presets.js";
import { scenarios, featuredScenarios } from "./generated/scenarios.js";

export const ALL_UNITS = { ...units, ...presets };  // presets win on key collision
export { units as UNITS, presets as PRESETS, scenarios as SCENARIOS, featuredScenarios };
```

`[ ]` Expose `resolveUnit(spec)` handling the three input formats from `arch.md`:
```js
// Option A: string key
resolveUnit({ unit: "archer_fu_feudal" })
// Option B: key + overrides
resolveUnit({ unit: "archer_fu_feudal", overrides: { hp: 40 } })
// Option C: fully inline
resolveUnit({ unit: { name: "Custom", hp: 30, patk: 5, ... } })
```

---

## Phase 5 — CORS + request routing (`worker/src/index.js`)

`[ ]` Define CORS headers (permissive — any origin may call the API):
```js
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```

`[ ]` Handle `OPTIONS` preflight:
```js
if (request.method === "OPTIONS")
  return new Response(null, { status: 204, headers: CORS });
```

`[ ]` Route table (dispatch to handlers imported from `routes/`):

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/simulate` | `handleSimulate` |
| `POST` | `/simulate/batch` | `handleBatch` |
| `POST` | `/simulate/sweep` | `handleSweep` |
| `GET`  | `/scenarios` | `handleListScenarios` |
| `POST` | `/scenarios/:id/simulate` | `handleScenarioSimulate` |
| `GET`  | `/units` | `handleListUnits` |
| `GET`  | `/units/:id` | `handleGetUnit` |
| `GET`  | `/presets` | `handleListPresets` |
| `GET`  | `/presets/:id` | `handleGetPreset` |

`[ ]` All `Response.json(body, { headers: CORS })` — CORS headers on every response.  
`[ ]` 404 for unmatched routes, 405 for wrong method on known paths.

---

## Phase 6 — Route handlers (`worker/src/routes/`)

Each route file exports two layers:
- **Logic function** — pure JS, takes plain objects, returns a plain result object. Called by both REST handlers and the MCP server (Phase 9).
- **HTTP handler** — parses the `Request`, calls the logic function, wraps the result in `Response.json(..., { headers: CORS })`.

```js
// logic function (also used by MCP)
export function simulateLogic(side_a, side_b, options = {}) { ... }

// HTTP handler (used by REST router)
export async function handleSimulate(request) {
  const { side_a, side_b, options } = await request.json();
  const result = simulateLogic(side_a, side_b, options);
  return Response.json(result, { headers: CORS });
}
```

Input validation is lightweight (check required fields, default optionals) — no schema library
needed. Throw a `400` with a JSON error body if required fields are missing (REST path); throw a
plain `Error` from logic functions (MCP path catches it and maps to a JSON-RPC error).

### `POST /simulate` (`routes/simulate.js`)
`[ ]` `simulateLogic(side_a, side_b, options)`:
  - Resolve unit specs via `resolveUnit`.  
  - Instantiate `CombatSim`, call `run()`.  
  - Compute resource values from `getParsedCost()` and remaining HP %.  
  - Determine winner and draw:
    - `winner = "side_a"` if `remaining_a > remaining_b`
    - `winner = "side_b"` if vice-versa
    - `draw = true` if both reach 0 (mutual annihilation)
  - Compute efficiency: `resource_value_lost_by_opponent / resource_value_spent`.
  - Return result object per `arch.md`.
`[ ]` `handleSimulate(request)`: parse body, call `simulateLogic`, return `Response.json`.

### `POST /simulate/batch` (`routes/simulate.js`)
`[ ]` `batchLogic(matchups, options)`: run `simulateLogic` for each entry, tag each result with its `id`.  
`[ ]` `handleBatch(request)`: parse body, call `batchLogic`, return array of results.

### `POST /simulate/sweep` (`routes/simulate.js`)
`[ ]` `sweepLogic(side_a, side_b, sweep, options)`:
  - Parse `sweep.target` (e.g. `"side_a.count"`) and `sweep.range = { min, max, step }`.  
  - For each value in range, deep-clone the args, set the target field, call `simulateLogic`, record `{ value, winner }`.  
  - `breakeven`: the first value where `winner` flips from the result at `min`.  
  - Return `{ sweep_param, breakeven, results }`.
`[ ]` `handleSweep(request)`: parse body, call `sweepLogic`, return result.

### `GET /scenarios` and `POST /scenarios/:id/simulate` (`routes/scenarios.js`)
`[ ]` `GET /scenarios`: return array of `{ id, name, desc, side_a, side_b }` from `SCENARIOS`.  
`[ ]` `runScenarioLogic(id, overrides)`: look up scenario by id, merge overrides, call `simulateLogic`. Throws if not found.  
`[ ]` `handleScenarioSimulate(request, id)`: call `runScenarioLogic`, return result or 404.

### `GET /units`, `/units/:id`, `GET /presets`, `/presets/:id` (`routes/catalog.js`)
`[ ]` `/units`: return all of `UNITS`. Support `?name=` substring filter (case-insensitive).  
`[ ]` `/units/:id`: return single entry or 404.  
`[ ]` Same pattern for `/presets`.

---

## Phase 7 — Local dev and deployment

`[ ]` `cd worker && wrangler dev` — serves the worker locally at `http://localhost:8787`.  
`[ ]` Smoke test locally with curl before deploying (see Phase 7).  
`[ ]` `wrangler deploy` — publishes to `https://aoe2-battlesim.<your-account>.workers.dev`.  
`[ ]` (Optional) Add a custom route in `wrangler.toml` if a vanity domain is desired.

---

## Phase 8 — Smoke tests

Test against the local dev server (`http://localhost:8787`) before deploying.

`[ ]` `OPTIONS /simulate` returns `204` with CORS headers (preflight check).

`[ ]` `GET /units/archer` returns the archer stat block.

`[ ]` `POST /simulate` — archers vs skirms, 10v10, assert `side_b` wins:
```bash
curl -s -X POST http://localhost:8787/simulate \
  -H "Content-Type: application/json" \
  -d '{"side_a":{"unit":"archer_fu_feudal","count":10},
       "side_b":{"unit":"skirm_fu_feudal","count":10}}'
```

`[ ]` `POST /simulate` with inline unit (Option C) returns a valid result.

`[ ]` `POST /simulate` with `overrides` (Option B) reflects the overridden stats.

`[ ]` `POST /simulate/batch` with two matchups returns two tagged results.

`[ ]` `POST /simulate/sweep` — sweep `side_a.count` 1→30 vs 10 skirms, assert a `breakeven`
  value is returned and all results in the array have a `winner` field.

`[ ]` `GET /scenarios` returns at least the featured scenarios.

`[ ]` `POST /scenarios/archers_vs_skirms/simulate` returns a result without body overrides.

`[ ]` `GET /units?name=archer` returns a filtered subset.

---

## Phase 9 — MCP server (`worker/src/routes/mcp.js`)

The Worker exposes an MCP endpoint at `POST /mcp` using the **Streamable HTTP** transport
(JSON-RPC 2.0 over plain HTTP POST). No extra package is needed — the protocol is simple
enough to implement directly in ~120 lines. The same Worker binary serves both environments:

| Environment | MCP URL |
|-------------|---------|
| Local dev   | `http://localhost:8787/mcp` |
| Remote      | `https://aoe2-battlesim.<account>.workers.dev/mcp` |

### 9.1 — Route entry point
`[ ]` Add `POST /mcp` to the route table in `index.js` → `handleMcp`.  
`[ ]` No CORS preflight needed for MCP (clients connect server-to-server, not from a browser).

### 9.2 — JSON-RPC 2.0 dispatch (`routes/mcp.js`)
`[ ]` Parse the request body as JSON-RPC 2.0.  
`[ ]` If `id` is absent the message is a **notification** — process it but return `204 No Content`.  
`[ ]` Dispatch on `method`:

| `method` | Action |
|----------|--------|
| `initialize` | Return `protocolVersion: "2024-11-05"`, `capabilities: { tools: {} }`, `serverInfo` |
| `notifications/initialized` | No-op notification |
| `tools/list` | Return the tool manifest (see §9.3) |
| `tools/call` | Dispatch to the matching tool handler (see §9.4) |
| _(anything else)_ | Return JSON-RPC error `{ code: -32601, message: "Method not found" }` |

`[ ]` Wrap all dispatch in try/catch; unhandled errors → `{ code: -32603, message: err.message }`.  
`[ ]` All responses: `Content-Type: application/json`, status `200` (or `204` for notifications).

### 9.3 — Tool manifest
Nine tools with JSON Schema `inputSchema` objects:

| Tool | Description | Logic function |
|------|-------------|----------------|
| `simulate` | Single matchup | `simulateLogic` |
| `simulate_batch` | Multiple matchups | `batchLogic` |
| `simulate_sweep` | Parameter sweep / breakeven | `sweepLogic` |
| `list_units` | Unit catalog (optional `name` filter) | `UNITS` |
| `get_unit` | Single unit stat block by key | `UNITS[id]` |
| `list_presets` | All presets | `PRESETS` |
| `get_preset` | Single preset stat block by key | `PRESETS[id]` |
| `list_scenarios` | All scenarios | `SCENARIOS` |
| `run_scenario` | Named scenario + optional overrides | `runScenarioLogic` |

`[ ]` Define the manifest as a top-level `const TOOLS = [...]` in `routes/mcp.js`.  
`[ ]` Every tool entry must include `name`, `description`, and a complete `inputSchema` — see
`arch.md §MCP Endpoint` for the full JSON Schema objects.  
`[ ]` `inputSchema` must include:
  - `"required": [...]` for every non-optional field (absence = LLM may silently omit it)
  - `"description"` on every property (the LLM reads these when choosing what value to supply)
  - `"minimum"` / `"maximum"` / `"exclusiveMinimum"` on all numeric fields (prevents invalid inputs without a round-trip error)
  - `"examples"` arrays on string/numeric fields where valid values follow a non-obvious pattern (e.g. `sweep.target` dot-paths, unit key format)
  - `"enum"` for fields with a fixed finite set of valid values — `run_scenario.id` is a static list built at startup from the loaded scenario data; `enum` is preferred over `examples` here because it lets clients validate before sending
  - `"$defs"` for `ArmySpec` and `Options` (shared across 4+ tools) — avoids copy-paste drift between tools
`[ ]` Build `run_scenario`'s `id` enum dynamically from `Object.keys(SCENARIOS)` at startup, not hardcoded — so it stays accurate when scenarios change.

### 9.4 — `tools/call` handler
`[ ]` Switch on `params.name`; call the corresponding logic function with `params.arguments`.  
`[ ]` Return the MCP tool result envelope:
```js
{
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  isError: false,
}
```
`[ ]` On error, return the same envelope with `isError: true` and the error message as `text` —
do **not** use a JSON-RPC error object for tool execution failures (MCP spec §tool-errors).

### 9.5 — Client configuration
**Cursor** (`.cursor/mcp.json` or global MCP settings):
```json
{
  "mcpServers": {
    "aoe2-battlesim": {
      "url": "https://aoe2-battlesim.<account>.workers.dev/mcp"
    }
  }
}
```
For local dev, swap the URL to `http://localhost:8787/mcp` while `wrangler dev` is running.

### 9.6 — MCP smoke tests
`[ ]` Send `initialize` → assert `protocolVersion` in response.  
`[ ]` Send `tools/list` → assert all 9 tool names are present.  
`[ ]` Send `tools/call` `simulate` (archers vs skirms 10v10) → assert `winner` in parsed `text`.  
`[ ]` Send `tools/call` `simulate_sweep` → assert `breakeven` in parsed `text`.  
`[ ]` Send `tools/call` `get_unit` with `id: "archer_fu_feudal"` → assert stat fields present.  
`[ ]` Send `tools/call` `get_preset` with `id: "archer_fu_feudal"` → assert stat fields present.  
`[ ]` Send notification `notifications/initialized` → assert `204` response.

---

## Keeping chombat data in sync

chombat is never modified. The full update workflow when chombat changes (game patches, new
units, preset/scenario edits):

```bash
# from aoe2-battlesim root
git submodule update --remote vendor/chombat
git add vendor/chombat
git commit -m "chore: bump chombat to $(git -C vendor/chombat rev-parse --short HEAD)"
npm run deploy        # runs gen-data.mjs (predev hook) then wrangler deploy
```

`gen-data.mjs` re-reads the updated vendor files and regenerates `src/generated/` automatically
as part of the deploy — no manual step needed.

No other changes are needed unless the data **schema** changes (new fields added to units), in
which case `sim.js` and the route handlers may need updating too.

**Syncing simulation logic changes:**  
`sim.js` is a verbatim copy of the kernel from `script.js`. When chombat's simulation algorithm
changes (not just data), diff `script.js` against the last-synced commit and apply the equivalent
changes to `sim.js` manually. The near-verbatim copy makes this diff mechanical.
