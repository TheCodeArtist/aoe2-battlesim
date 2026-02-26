# aoe2-battlesim

A Cloudflare Workers API for Age of Empires II combat simulation.

Run deterministic unit battles, sweep parameters, and query the unit catalog, all over HTTP or via a Model Context Protocol (MCP) server.

Built on top of [Chombat](https://chombat.crazybus.org) (included as a git submodule).

**Live:** `https://aoe2-battlesim.thecodeartist.workers.dev`

### Use as an MCP server

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=aoe2-battlesim&config=eyJ1cmwiOiJodHRwczovL2FvZTItYmF0dGxlc2ltLnRoZWNvZGVhcnRpc3Qud29ya2Vycy5kZXYvbWNwIn0=)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](vscode:mcp/install?%7B%22name%22%3A%22aoe2-battlesim%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Faoe2-battlesim.thecodeartist.workers.dev%2Fmcp%22%7D)

> **Note:** Uses Age of Empires II game data under the [Microsoft Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules). Not endorsed by or affiliated with Microsoft.

---

## API

All endpoints return JSON. CORS is enabled on all routes.

### Simulation — v1 (generic catalog)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/simulate` | Run a single battle between two army specs |
| `POST` | `/simulate/batch` | Run multiple matchups in one request |
| `POST` | `/simulate/sweep` | Sweep a numeric parameter across a range |

### Simulation — v2 (civ-specific, recommended)

Uses the full AoE2 armor-class damage formula, per-civ tech bonuses, trample, and accuracy modelling. Unit keys are civ-prefixed (e.g. `britons_cavalier`, `aztecs_elite_eagle_warrior`).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/simulate/v2` | Run a single battle (v2 engine) |
| `POST` | `/simulate/v2/batch` | Run multiple matchups (v2 engine) |
| `POST` | `/simulate/v2/sweep` | Parameter sweep (v2 engine) |

### Catalog — v1

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/units` | List all units (optional `?name=` filter) |
| `GET` | `/units/:id` | Get a unit's full stat block |
| `GET` | `/presets` | List all preset army configurations |
| `GET` | `/presets/:id` | Get a preset's full stat block |

### Catalog — v2

1 433 civ-specific units across Feudal, Castle, and Imperial Age. Supports `?name=` and `?civ=` filters.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v2/units` | List all v2 units (`?name=cavalier`, `?civ=britons`) |
| `GET` | `/v2/units/:id` | Get a single unit's full stat block (attacks, armors, bonuses) |

### Scenarios

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scenarios` | List all built-in scenarios |
| `POST` | `/scenarios/:id/simulate` | Run a named scenario (with optional overrides) |

### MCP

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | JSON-RPC 2.0 endpoint (MCP protocol version `2025-03-26`) |

The MCP server exposes all simulation and catalog operations as tools (12 total):

`simulate_v2` *(preferred — full AoE2 formula)*, `simulate`,  
`simulate_v2_batch`, `simulate_v2_sweep`,  
`simulate_batch`, `simulate_sweep`,  
`list_units`, `get_unit`,  
`list_presets`, `get_preset`,  
`list_scenarios`, `run_scenario`.

### Documentation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/docs` | Interactive Swagger UI documentation |
| `GET` | `/openapi.json` | OpenAPI 3.0 specification JSON |

---

## Army Spec

Every simulation endpoint takes army specs for `side_a` and `side_b`. All fields except `unit` are optional.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `unit` | string \| object | — | Unit key (e.g. `"archer"`, `"archer_fu_feudal"`) **or** a fully inline stat object with at least `name`, `hp`, `reload`, `range` |
| `count` | integer | `1` | Number of units |
| `overrides` | object | — | Stat overrides applied on top of the base unit (`hp`, `patk`, `matk`, `parm`, `marm`, `reload`, `range`, `bonus_atk`, `bonus_reduction`) |
| `micro` | integer 0–5 | `0` | Target-fire micro level: `0` = no micro, `5` = perfect focus-fire |
| `engagement_pct` | integer 1–100 | `100` | Percentage of units that engage each volley |
| `delay` | number | `0` | Seconds before this army starts producing units |
| `tech_delay` | number | `0` | Seconds of tech upgrade delay after pre-queued units finish |
| `units_before` | integer | `0` | Units already queued before the fight starts |
| `buildings` | integer | `1` | Number of production buildings |
| `resource_discounts` | object | — | Cost discounts as percentages 0–100: `all`, `food`, `wood`, `gold` |

### Options

All simulation endpoints accept an optional `options` object:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tick` | number | `0.05` | Simulation time step in seconds |
| `maxDuration` | number | `300` | Maximum simulation duration in seconds |
| `include_history` | boolean | `false` | Include tick-by-tick history in the result |
| `accuracy` | boolean | `false` | **(v2 only)** Enable accuracy modelling — ranged units deal 0 damage on a miss |

---

## Simulate Response

```json
{
  "winner": "side_a" | "side_b" | null,
  "draw": false,
  "duration_s": 12.3,
  "side_a": {
    "remaining_count": 4,
    "remaining_hp": 160,
    "initial_count": 10,
    "hp_pct_remaining": 0.4,
    "resource_value_initial": 350,
    "resource_value_remaining": 140,
    "resource_value_lost": 210
  },
  "side_b": { "...same fields..." },
  "efficiency": {
    "side_a_per_resource_spent": 1.67,
    "side_b_per_resource_spent": 0.6
  },
  "history": null
}
```

`winner` is `null` on a draw. `efficiency.side_a_per_resource_spent` is the resource value destroyed on side B per resource spent by side A (higher = more efficient). `history` is populated only when `options.include_history` is `true`.

---

## Examples

All examples hit the live API.  

> Note: Install [jq](https://jqlang.org) for pretty output, or drop the `| jq` part.

### 1. Do 20 Briton Halberdiers beat 10 Briton Cavaliers? (v2 — civ-specific)

```bash
curl -s https://aoe2-battlesim.thecodeartist.workers.dev/simulate/v2 \
  -H "Content-Type: application/json" \
  -d '{
    "side_a": { "unit": "britons_halberdier", "count": 20 },
    "side_b": { "unit": "britons_cavalier",   "count": 10 }
  }' | jq '{ winner, "halbs_left": .side_a.remaining_count }'
```

```json
{ "winner": "side_a", "halbs_left": 14 }
```

### 2. Do skirms beat archers 10v10? (v1 — generic catalog)

```bash
curl -s https://aoe2-battlesim.thecodeartist.workers.dev/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "side_a": { "unit": "archer",     "count": 10 },
    "side_b": { "unit": "skirmisher", "count": 10 }
  }' | jq '{ winner, "skirms_left": .side_b.remaining_count }'
```

```json
{ "winner": "side_b", "skirms_left": 5 }
```

### 3. Is Fletching worth it?

Fletching (Feudal Age Blacksmith) gives archers **+1 pierce attack** (4→5) and **+1 range** (4→5).  
Both matter: extra attack means more damage per volley, extra range means archers get the first shot.  
Use `overrides` to apply both and see whether they flip the 10v10 outcome:

```bash
curl -s https://aoe2-battlesim.thecodeartist.workers.dev/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "side_a": { "unit": "archer", "count": 10, "overrides": { "patk": 5, "range": 5 } },
    "side_b": { "unit": "skirmisher", "count": 10 }
  }' | jq '{ winner, "archers_left": .side_a.remaining_count, "skirms_left": .side_b.remaining_count }'
```

```json
{ "winner": "side_a", "archers_left": 6, "skirms_left": 0 }
```

### 4. How many unupgraded archers does it take to beat 10 skirms? (breakeven sweep)

```bash
curl -s https://aoe2-battlesim.thecodeartist.workers.dev/simulate/sweep \
  -H "Content-Type: application/json" \
  -d '{
    "side_a": { "unit": "archer" },
    "side_b": { "unit": "skirmisher", "count": 10 },
    "sweep": { "target": "side_a.count", "range": { "min": 1, "max": 30, "step": 1 } }
  }' | jq '{ sweep_param, breakeven }'
```

```json
{ "sweep_param": "side_a.count", "breakeven": 12 }
```

---

## Development

**Prerequisites:** Node.js, Python 3.9+, a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier), and Wrangler (installed as a dev dependency).

Python is required to regenerate `units_v2.js` from the `vendor/aoe2-unit-analyzer` submodule. It runs automatically as part of every pre-hook (`prebuild`, `predev`, `predeploy`, `pretest`).

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/thecodeartist/aoe2-battlesim.git
cd aoe2-battlesim

npm install

# Start local dev server (regenerates v1 + v2 data, then runs wrangler dev)
npm run dev
```

The worker should be available at `http://localhost:8787`.

---

## Testing

```bash
npm test                # Unit tests
npm run test:integration  # Integration tests (runs in Workers runtime)
npm run test:all          # Both
npm run test:coverage     # Unit tests with coverage report
```

---

## Deployment

### Manual

```bash
npx wrangler login   # Authenticate with Cloudflare (one-time)
npm run deploy       # Build and deploy to Cloudflare Workers
```

### CI/CD (GitHub Actions)

Every push to `main` runs tests then deploys automatically. Pull requests run tests only.

Add two secrets to your GitHub repository (`Settings → Secrets and variables → Actions`):

| Secret | Where to get it |
|--------|----------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token (use the *Edit Cloudflare Workers* template) |


---

## Project structure

```
worker/
  src/
    index.js          # Router entry point
    sim.js            # Combat simulation engine (v1 — verbatim Chombat kernel)
    sim_v2.js         # Combat simulation engine (v2 — armor-class formula, trample, accuracy)
    data.js           # Data resolution (v1)
    data_v2.js        # Data resolution (v2 — resolveUnit, ALL_UNITS, ARMOR_CLASSES)
    cors.js           # Shared CORS headers
    routes/           # Route handlers (simulate, simulate_v2, catalog, scenarios, mcp, root)
    generated/        # Auto-generated unit/preset/scenario data (gitignored)
  scripts/
    gen-data.mjs      # Generates v1 data from vendor/chombat → src/generated/
    convert_data.py   # Generates v2 data from vendor/aoe2-unit-analyzer → src/generated/units_v2.js
  test/
    unit/             # Vitest unit tests
    integration/      # Vitest integration tests (Workers runtime)
vendor/
  chombat/            # Git submodule — v1 unit definitions and scenarios
  aoe2-unit-analyzer/ # Git submodule — dat-file extracted AoE2 data (units, techs, civs, armor classes)
```
