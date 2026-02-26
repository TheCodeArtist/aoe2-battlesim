# aoe2-battlesim

A Cloudflare Workers API for Age of Empires II combat simulation. Run deterministic unit battles, sweep parameters, and query the unit catalog — all over HTTP or via a Model Context Protocol (MCP) server.

Built on top of [Chombat](https://chombat.crazybus.org) (included as a git submodule).

**Live:** `https://aoe2-battlesim.thecodeartist.workers.dev`

> **Note:** Uses Age of Empires II game data under the [Microsoft Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules).

---

## API

All endpoints return JSON. CORS is enabled on all routes.

### Simulation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/simulate` | Run a single battle between two army specs |
| `POST` | `/simulate/batch` | Run multiple matchups in one request |
| `POST` | `/simulate/sweep` | Sweep a numeric parameter across a range |

### Catalog

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/units` | List all units (optional `?name=` filter) |
| `GET` | `/units/:id` | Get a unit's full stat block |
| `GET` | `/presets` | List all preset army configurations |
| `GET` | `/presets/:id` | Get a preset's full stat block |

### Scenarios

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scenarios` | List all built-in scenarios |
| `POST` | `/scenarios/:id/simulate` | Run a named scenario (with optional overrides) |

### MCP

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | JSON-RPC 2.0 endpoint (MCP protocol version `2024-11-05`) |

The MCP server exposes all simulation and catalog operations as tools: `simulate`, `simulate_batch`, `simulate_sweep`, `list_units`, `get_unit`, `list_presets`, `get_preset`, `list_scenarios`, `run_scenario`.

---

## Development

**Prerequisites:** Node.js, a [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier), and Wrangler (installed as a dev dependency).

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/thecodeartist/aoe2-battlesim.git
cd aoe2-battlesim

npm install

# Start local dev server (generates data files, then runs wrangler dev)
npm run dev
```

The worker is available at `http://localhost:8787`.

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

Every push to `master` runs tests then deploys automatically. Pull requests run tests only.

Add two secrets to your GitHub repository (`Settings → Secrets and variables → Actions`):

| Secret | Where to get it |
|--------|----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token (use the *Edit Cloudflare Workers* template) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |

---

## Project structure

```
worker/
  src/
    index.js          # Router entry point
    sim.js            # Combat simulation engine
    data.js           # Data resolution
    routes/           # Route handlers (simulate, catalog, scenarios, mcp)
    generated/        # Auto-generated unit/preset/scenario data (gitignored)
  scripts/
    gen-data.mjs      # Copies data from vendor/chombat → src/generated/
  test/
    unit/             # Vitest unit tests
    integration/      # Vitest integration tests (Workers runtime)
vendor/
  chombat/            # Git submodule — unit definitions and scenarios
```
