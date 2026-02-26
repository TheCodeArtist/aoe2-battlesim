# AoE2 Battle Simulator — API Specification

## Core Data Model

Every request revolves around two **army specs**. Each spec can define units in three interchangeable ways:

```json
// Option A: reference a known unit/preset by key
{ "unit": "archer_fu_feudal" }

// Option B: reference a base unit + override specific stats
{ "unit": "archer_fu_feudal", "overrides": { "hp": 40, "patk": 7 } }

// Option C: fully inline custom unit (no base required)
{ "unit": { "name": "Custom Archer", "hp": 30, "patk": 5, "parm": 1, "marm": 1, "reload": 2.0, "range": 5 } }
```

---

## Endpoints

### `POST /simulate` — Single matchup

The bread-and-butter endpoint.

**Request:**

```json
{
  "side_a": {
    "unit": "archer_fu_feudal",
    "count": 10,
    "delay": 0,
    "tech_delay": 0,
    "units_before": 0,
    "buildings": 1,
    "engagement_pct": 100,
    "micro": 5,
    "resource_discounts": { "all": 0, "food": 0, "wood": 0, "gold": 0 }
  },
  "side_b": {
    "unit": "skirm_fu_feudal",
    "overrides": { "bonus_atk": 3 },
    "count": 10,
    "delay": 210,
    "tech_delay": 0,
    "units_before": 0,
    "buildings": 1,
    "engagement_pct": 100,
    "micro": 5
  },
  "options": {
    "maxDuration": 300,
    "tick": 0.05,
    "include_history": false
  }
}
```

**Response:**

```json
{
  "winner": "side_b",
  "draw": false,
  "duration_s": 78.3,
  "side_a": {
    "remaining_count": 0,
    "remaining_hp": 0,
    "initial_count": 10,
    "hp_pct_remaining": 0.0,
    "resource_value_initial": 700,
    "resource_value_remaining": 0,
    "resource_value_lost": 700
  },
  "side_b": {
    "remaining_count": 3.7,
    "remaining_hp": 92,
    "initial_count": 10,
    "hp_pct_remaining": 0.31,
    "resource_value_initial": 600,
    "resource_value_remaining": 186,
    "resource_value_lost": 414
  },
  "efficiency": {
    "side_a_per_resource_spent": 0.592,
    "side_b_per_resource_spent": 1.69
  },
  "history": null
}
```

---

### `POST /simulate/batch` — Multiple matchups in one call

Useful for comparing many configurations at once without multiple round trips.

**Request:**

```json
{
  "matchups": [
    { "id": "run_1", "side_a": { "..." }, "side_b": { "..." } },
    { "id": "run_2", "side_a": { "..." }, "side_b": { "..." } }
  ],
  "options": { "include_history": false }
}
```

**Response:** array of standard `/simulate` results, each tagged with the caller's `id`.

---

### `POST /simulate/sweep` — Parameter sweep (breakeven finder)

The most powerful endpoint — vary one parameter across a range and see where the outcome flips. Directly answers questions like "how many archers does it take to beat 10 skirms?"

**Request:**

```json
{
  "side_a": { "unit": "archer_fu_feudal", "count": "__sweep__" },
  "side_b": { "unit": "skirm_fu_feudal", "count": 10 },
  "sweep": {
    "target": "side_a.count",
    "range": { "min": 1, "max": 30, "step": 1 }
  },
  "options": { "include_history": false }
}
```

**Response:**

```json
{
  "sweep_param": "side_a.count",
  "breakeven": 14,
  "results": [
    { "value": 1,  "winner": "side_b" },
    { "value": 14, "winner": "side_a" }
  ]
}
```

---

### `GET /scenarios` — List predefined scenarios

Returns all named scenarios with their metadata (name, description, side configs).

### `POST /scenarios/{id}/simulate` — Run a named scenario

Runs a scenario as defined, with optional overrides. Makes sharing and linking results easy.

### `GET /units` / `GET /units/{id}` — Unit catalog (v1)

Returns the full unit list or a single unit's stats. Supports filtering by `?name=archer`.

### `GET /presets` / `GET /presets/{id}` — Preset catalog

Returns the full preset list or a single preset's stats.

---

### `POST /simulate/v2` — Single matchup (v2 engine)

Same request/response shape as `/simulate` but uses the v2 simulation engine.
Unit keys are civ-prefixed: `britons_cavalier`, `aztecs_elite_eagle_warrior`, etc.
Call `GET /v2/units` to discover valid keys.

Supports an additional `options.accuracy` boolean: when `true`, ranged units
(range > 1) have their effective damage scaled by `unit.accuracy / 100` per volley.

### `POST /simulate/v2/batch` / `POST /simulate/v2/sweep`

Same shape as `/simulate/batch` and `/simulate/sweep`, using the v2 engine.

---

### `GET /v2/units` — V2 unit catalog

Returns all 1 433 civ-specific units (Feudal, Castle, and Imperial Age).

**Query parameters:**

| Param | Description |
|-------|-------------|
| `?name=cavalier` | Case-insensitive substring filter on unit name |
| `?civ=britons` | Filter to a single civ by slug prefix |

### `GET /v2/units/:id` — Single v2 unit

Returns the full stat block for one unit, or `404` with `{ "error": "V2 unit not found: …" }`.

Each v2 unit includes: `hp`, `attacks` (armor-class map), `armors` (armor-class map),
`cost`, `reload`, `range`, `speed`, `accuracy`, `blastWidth`, `blastDamage`, `blastLevel`, `bonuses`.

---

---

## MCP Endpoint

### `POST /mcp` — Model Context Protocol (Streamable HTTP transport)

Implements the [MCP Streamable HTTP transport](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/#streamable-http).
All messages are JSON-RPC 2.0. Responses are plain JSON (no SSE stream needed for these tools).

**Request headers:**
```
Content-Type: application/json
```

**Supported JSON-RPC methods:**

| Method | Description |
|--------|-------------|
| `initialize` | Handshake |
| `notifications/initialized` | Client ack (notification — no `id`, returns `202`) |
| `tools/list` | Return all 12 tool definitions |
| `tools/call` | Invoke a tool by name |

---

**`initialize` response:**
```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "aoe2-battlesim", "version": "1.0.0" }
  }
}
```

---

**`tools/list` response — full `inputSchema` definitions:**

`inputSchema` is a JSON Schema object returned with every tool entry. It is the sole mechanism
by which MCP clients discover what arguments exist, which are required, and what shape they take.
Property-level `description` strings are what the LLM reads when deciding what values to supply —
they are as important as type constraints.

Two shared sub-schemas are referenced via `$defs` in the tools that need them.

> **Implementation note:** The `run_scenario` tool's `id` field uses an `enum` built at server
> startup from the loaded scenario data — not hardcoded — so it always reflects the actual
> available scenarios without manual maintenance.

**`$defs.ArmySpec`** — appears in `simulate`, `simulate_batch`, `simulate_sweep`, `run_scenario`:
```json
{
  "type": "object",
  "required": ["unit"],
  "properties": {
    "unit": {
      "description": "Unit key string for a known unit or preset (use list_units / list_presets to browse), OR an inline stat object for a fully custom unit.",
      "oneOf": [
        {
          "type": "string",
          "examples": ["archer_fu_feudal", "skirm_fu_feudal", "knight_fu_castle", "maa_fu_feudal", "halberdier"]
        },
        {
          "type": "object",
          "description": "Fully inline custom unit — all required stat fields must be provided.",
          "required": ["name", "hp", "patk", "parm", "marm", "reload", "range"],
          "properties": {
            "name":   { "type": "string" },
            "hp":     { "type": "number", "description": "Hit points.", "minimum": 1 },
            "patk":   { "type": "number", "description": "Pierce attack damage.", "minimum": 0 },
            "matk":   { "type": "number", "description": "Melee attack damage.", "minimum": 0 },
            "parm":   { "type": "number", "description": "Pierce armour.", "minimum": 0 },
            "marm":   { "type": "number", "description": "Melee armour.", "minimum": 0 },
            "reload": { "type": "number", "description": "Attack cooldown in seconds.", "exclusiveMinimum": 0 },
            "range":  { "type": "number", "description": "Attack range in tiles. 0–1 = melee (uses matk/marm pair); >1 = ranged (uses patk/parm pair).", "minimum": 0 }
          }
        }
      ]
    },
    "overrides": {
      "type": "object",
      "description": "Stat overrides applied on top of the base unit key. Provide only the fields to change. Valid keys: hp, patk, matk, parm, marm, reload, range, bonus_atk, bonus_reduction.",
      "properties": {
        "hp":               { "type": "number", "minimum": 1 },
        "patk":             { "type": "number", "minimum": 0 },
        "matk":             { "type": "number", "minimum": 0 },
        "parm":             { "type": "number", "minimum": 0 },
        "marm":             { "type": "number", "minimum": 0 },
        "reload":           { "type": "number", "exclusiveMinimum": 0 },
        "range":            { "type": "number", "minimum": 0 },
        "bonus_atk":        { "type": "number", "minimum": 0 },
        "bonus_reduction":  { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "additionalProperties": false
    },
    "count": {
      "type": "integer",
      "description": "Number of units on this side.",
      "minimum": 1,
      "default": 1,
      "examples": [5, 10, 20, 30]
    },
    "delay": {
      "type": "number",
      "description": "Seconds before this side enters combat (simulates production or travel time). 0 = immediate. Typical feudal-age delays are 100–210 s.",
      "minimum": 0,
      "default": 0,
      "examples": [0, 35, 165, 210]
    },
    "tech_delay": {
      "type": "number",
      "description": "Additional seconds added for technology research (e.g. 40 s for Man-at-Arms upgrade).",
      "minimum": 0,
      "default": 0,
      "examples": [0, 40, 50, 75]
    },
    "units_before": {
      "type": "integer",
      "description": "Units already produced before the fight starts. Shifts the resource cost curve.",
      "minimum": 0,
      "default": 0
    },
    "buildings": {
      "type": "integer",
      "description": "Number of production buildings training this unit. Affects resource cost calculation.",
      "minimum": 1,
      "default": 1,
      "examples": [1, 2, 3]
    },
    "engagement_pct": {
      "type": "number",
      "description": "Percentage of units actively firing each volley (1–100). 100 = all units fight. Lower values model partial engagements, flanking, or chokepoints.",
      "minimum": 1,
      "maximum": 100,
      "default": 100,
      "examples": [100, 75, 50, 25]
    },
    "micro": {
      "type": "number",
      "description": "Split-fire group count. 0 = focus fire (all damage to fewest targets, maximises overkill waste). 5 = split fire (damage spread across more units, minimises waste). Higher values favour the side with more HP-efficient units.",
      "minimum": 0,
      "default": 0,
      "examples": [0, 1, 5]
    },
    "resource_discounts": {
      "type": "object",
      "description": "Percentage cost discounts on resources, e.g. Burgundians 15% food discount → food: 15. Applied before resource value calculations.",
      "properties": {
        "all":  { "type": "number", "minimum": 0, "maximum": 100, "default": 0 },
        "food": { "type": "number", "minimum": 0, "maximum": 100, "default": 0 },
        "wood": { "type": "number", "minimum": 0, "maximum": 100, "default": 0 },
        "gold": { "type": "number", "minimum": 0, "maximum": 100, "default": 0 }
      }
    }
  }
}
```

**`$defs.Options`** — appears in `simulate`, `simulate_batch`, `simulate_sweep`:
```json
{
  "type": "object",
  "properties": {
    "maxDuration": {
      "type": "number",
      "description": "Simulation time cap in seconds. Prevents infinite loops on evenly-matched sides. Raise if you expect very long attrition fights.",
      "minimum": 1,
      "maximum": 3600,
      "default": 300
    },
    "tick": {
      "type": "number",
      "description": "Simulation tick size in seconds. Smaller = more accurate, slower. Default 0.05 s is sufficient for most use cases.",
      "minimum": 0.01,
      "maximum": 1.0,
      "default": 0.05,
      "examples": [0.05, 0.1]
    },
    "include_history": {
      "type": "boolean",
      "description": "Include tick-by-tick combat history in the response. Off by default — only needed for charting. Significantly increases response size.",
      "default": false
    }
  }
}
```

---

**Per-tool `inputSchema`:**

**`simulate`**
```json
{
  "type": "object",
  "required": ["side_a", "side_b"],
  "properties": {
    "side_a":   { "$ref": "#/$defs/ArmySpec" },
    "side_b":   { "$ref": "#/$defs/ArmySpec" },
    "options":  { "$ref": "#/$defs/Options"  }
  }
}
```

**`simulate_v2`** *(preferred — full AoE2 armor-class formula, trample, accuracy)*
```json
{
  "type": "object",
  "required": ["side_a", "side_b"],
  "properties": {
    "side_a":  { "$ref": "#/$defs/ArmySpec", "description": "unit key must be a civ-prefixed v2 key, e.g. 'britons_cavalier'." },
    "side_b":  { "$ref": "#/$defs/ArmySpec" },
    "options": {
      "allOf": [{ "$ref": "#/$defs/Options" }],
      "properties": {
        "accuracy": {
          "type": "boolean",
          "description": "Enable accuracy modelling: ranged units deal 0 damage on a miss (default false)."
        }
      }
    }
  }
}
```

Unit keys for v2 are civ-prefixed: call `GET /v2/units` to discover them.

**`simulate_v2_batch`** *(v2 engine — multiple matchups in one request)*
```json
{
  "type": "object",
  "required": ["matchups"],
  "properties": {
    "matchups": {
      "type": "array",
      "description": "List of independent v2 matchups to run. Each result is tagged with the caller-supplied id.",
      "items": {
        "type": "object",
        "required": ["side_a", "side_b"],
        "properties": {
          "id":     { "type": "string", "description": "Caller-supplied identifier echoed in the result." },
          "side_a": { "$ref": "#/$defs/ArmySpec", "description": "unit key must be a civ-prefixed v2 key." },
          "side_b": { "$ref": "#/$defs/ArmySpec" }
        }
      }
    },
    "options": {
      "allOf": [{ "$ref": "#/$defs/Options" }],
      "properties": {
        "accuracy": { "type": "boolean", "description": "Enable accuracy modelling (default false)." }
      }
    }
  }
}
```

**`simulate_v2_sweep`** *(v2 engine — parameter sweep)*
```json
{
  "type": "object",
  "required": ["side_a", "side_b", "sweep"],
  "properties": {
    "side_a": { "$ref": "#/$defs/ArmySpec", "description": "unit key must be a civ-prefixed v2 key." },
    "side_b": { "$ref": "#/$defs/ArmySpec" },
    "sweep": {
      "type": "object",
      "required": ["target", "range"],
      "description": "Defines which parameter to vary and the range to sweep.",
      "properties": {
        "target": {
          "type": "string",
          "description": "Dot-path to the numeric field being swept.",
          "examples": ["side_a.count", "side_b.count", "side_a.overrides.hp", "side_b.overrides.patk"]
        },
        "range": {
          "type": "object",
          "required": ["min", "max", "step"],
          "properties": {
            "min":  { "type": "number", "minimum": 0 },
            "max":  { "type": "number" },
            "step": { "type": "number", "exclusiveMinimum": 0 }
          }
        }
      }
    },
    "options": {
      "allOf": [{ "$ref": "#/$defs/Options" }],
      "properties": {
        "accuracy": { "type": "boolean", "description": "Enable accuracy modelling (default false)." }
      }
    }
  }
}
```

**`simulate_batch`**
```json
{
  "type": "object",
  "required": ["matchups"],
  "properties": {
    "matchups": {
      "type": "array",
      "description": "List of independent matchups to run. Each result is tagged with the caller-supplied id.",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "side_a", "side_b"],
        "properties": {
          "id":     { "type": "string", "description": "Caller-supplied identifier echoed in the result. Use descriptive names, e.g. 'archers_10v10'." },
          "side_a": { "$ref": "#/$defs/ArmySpec" },
          "side_b": { "$ref": "#/$defs/ArmySpec" }
        }
      }
    },
    "options": { "$ref": "#/$defs/Options" }
  }
}
```

**`simulate_sweep`**
```json
{
  "type": "object",
  "required": ["side_a", "side_b", "sweep"],
  "properties": {
    "side_a": { "$ref": "#/$defs/ArmySpec" },
    "side_b": { "$ref": "#/$defs/ArmySpec" },
    "sweep": {
      "type": "object",
      "required": ["target", "range"],
      "description": "Defines which parameter to vary and the range to sweep. The server finds the breakeven point automatically.",
      "properties": {
        "target": {
          "type": "string",
          "description": "Dot-path to the field being swept. The field's value in side_a/side_b is ignored and replaced at each step. Use 'side_a.count' or 'side_b.count' for the most common breakeven question. Use 'side_a.overrides.<stat>' to sweep a stat override.",
          "examples": [
            "side_a.count",
            "side_b.count",
            "side_a.engagement_pct",
            "side_b.engagement_pct",
            "side_a.overrides.hp",
            "side_b.overrides.patk"
          ]
        },
        "range": {
          "type": "object",
          "required": ["min", "max", "step"],
          "properties": {
            "min":  { "type": "number", "description": "Start of sweep range (inclusive). Must be less than max.", "minimum": 0 },
            "max":  { "type": "number", "description": "End of sweep range (inclusive). Must be greater than min." },
            "step": { "type": "number", "description": "Increment per step. Must be positive. Small steps give more precise breakeven values at the cost of more simulation runs.", "exclusiveMinimum": 0, "examples": [1, 5, 0.5] }
          }
        }
      }
    },
    "options": { "$ref": "#/$defs/Options" }
  }
}
```

**`list_units`**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Case-insensitive substring filter on unit name. Omit to return all units. Use partial names to narrow results, e.g. 'archer' returns all archer variants.",
      "examples": ["archer", "knight", "skirmisher", "cataphract"]
    }
  }
}
```

**`get_unit`**
```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Exact unit key (snake_case). Call list_units first to find valid keys — guessing is unreliable given the large catalog.",
      "examples": ["archer_fu_feudal", "skirm_fu_feudal", "knight_fu_castle", "maa_fu_feudal", "halberdier"]
    }
  }
}
```

**`list_presets`**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Case-insensitive substring filter on preset name. Omit to return all presets.",
      "examples": ["archer", "knight", "skirm"]
    }
  }
}
```

**`get_preset`**
```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Exact preset key (snake_case). Call list_presets first to find valid keys. Preset keys are also valid values for the 'unit' field in ArmySpec.",
      "examples": ["archer_fu_feudal", "skirm_fu_feudal", "knight_fu_castle", "maa_fu_feudal", "scout_fu_feudal"]
    }
  }
}
```

**`list_scenarios`** — `{ "type": "object", "properties": {} }`

**`run_scenario`**
```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Scenario ID. The enum is built at server startup from the loaded data — call list_scenarios to confirm available IDs.",
      "enum": [
        "archers_vs_skirms",
        "maa_vs_scouts",
        "militia_vs_scouts",
        "champi_vs_scouts",
        "knights_vs_halbs",
        "archer_vs_skirm_mass",
        "champi_scout_vs_fc_cataphract"
      ]
    },
    "overrides": {
      "type": "object",
      "description": "Optional partial overrides merged on top of the scenario's defaults. Omit to run the scenario exactly as defined.",
      "properties": {
        "side_a":  { "$ref": "#/$defs/ArmySpec" },
        "side_b":  { "$ref": "#/$defs/ArmySpec" },
        "options": { "$ref": "#/$defs/Options"  }
      }
    }
  }
}
```

---

**`tools/call` request:**
```json
{
  "jsonrpc": "2.0", "id": 3,
  "method": "tools/call",
  "params": {
    "name": "simulate",
    "arguments": {
      "side_a": { "unit": "archer_fu_feudal", "count": 10 },
      "side_b": { "unit": "skirm_fu_feudal",  "count": 10 }
    }
  }
}
```

**`tools/call` response (success):**
```json
{
  "jsonrpc": "2.0", "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "{ \"winner\": \"side_b\", \"draw\": false, ... }" }],
    "isError": false
  }
}
```

**`tools/call` response (tool-level error — bad input, unknown unit key, etc.):**
```json
{
  "jsonrpc": "2.0", "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "Unknown unit key: typo_archer" }],
    "isError": true
  }
}
```

Note: `isError: true` in `result` (not a top-level JSON-RPC `error` object) — per MCP spec §tool-errors.

---

## Design Principles

| Concern | Recommendation |
|---|---|
| **Unit input** | Support all three: key reference, key + overrides, and fully inline |
| **History verbosity** | Off by default (`include_history: false`); tick-by-tick data is expensive and only needed for charting |
| **Winner determination** | Always report `winner` (by surviving count), but also expose `hp_pct_remaining` and `resource_value_remaining` so callers can apply their own definition of "winning" |
| **Batch / sweep** | Essential for the core use case: "find the breakeven count" or "compare many civs at once" |
| **Stability** | Cap simulation at `max_duration` (default 300s) to avoid infinite loops for evenly matched sides |
| **Naming** | Mirror the existing `side_a` / `side_b` convention from the Chombat simulator |
