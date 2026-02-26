import { CORS } from '../cors.js';
import { SCENARIOS } from '../data.js';
import { simulateLogic, batchLogic, sweepLogic } from './simulate.js';
import { simulateLogic as simulateV2Logic, batchLogic as batchV2Logic, sweepLogic as sweepV2Logic } from './simulate_v2.js';
import { listUnitsLogic, getUnitLogic, listPresetsLogic, getPresetLogic } from './catalog.js';
import { listScenariosLogic, runScenarioLogic } from './scenarios.js';

// ── Shared schema fragments ───────────────────────────────────────────────────

const STAT_OVERRIDES_PROPERTIES = {
  hp:              { type: 'number', description: 'Hit points per unit.' },
  patk:            { type: 'number', description: 'Pierce attack.' },
  matk:            { type: 'number', description: 'Melee attack.' },
  parm:            { type: 'number', description: 'Pierce armour.' },
  marm:            { type: 'number', description: 'Melee armour.' },
  reload:          { type: 'number', description: 'Attack reload time in seconds.' },
  range:           { type: 'number', description: 'Attack range (0 = melee).' },
  bonus_atk:       { type: 'number', description: 'Bonus attack vs specific unit classes.' },
  bonus_reduction: { type: 'number', minimum: 0, maximum: 1, description: 'Bonus attack reduction factor (0–1 scale).' },
};

const ARMY_SPEC_SCHEMA = {
  type: 'object',
  description: 'Army specification — unit key reference, key + overrides, or fully inline stats.',
  additionalProperties: false,
  required: ['unit'],
  properties: {
    unit: {
      description: 'Unit key string (e.g. "archer_fu_feudal") or inline stat object. Call list_presets or list_units first if you do not know a valid key.',
      oneOf: [
        { type: 'string', description: 'Key from the units or presets catalog.' },
        {
          type: 'object',
          description: 'Fully inline stat object.',
          required: ['name', 'hp', 'reload', 'range'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', description: 'Unit display name.' },
            ...STAT_OVERRIDES_PROPERTIES,
          },
        },
      ],
    },
    count:          { type: 'integer', minimum: 1,                     description: 'Number of units (default 1).' },
    overrides:      {
      type: 'object',
      description: 'Stat overrides applied on top of the base unit.',
      additionalProperties: false,
      properties: STAT_OVERRIDES_PROPERTIES,
    },
    engagement_pct: { type: 'integer', minimum: 1,   maximum: 100,    description: 'Percentage of units engaging each volley (default 100).' },
    micro:          { type: 'integer', minimum: 0,   maximum: 5,      description: 'Target-fire micro level: 0 = no micro, 5 = perfect (default 0).' },
    delay:          { type: 'number',  minimum: 0,                    description: 'Start delay in seconds before this army begins producing units (default 0).' },
    tech_delay:     { type: 'number',  minimum: 0,                    description: 'Tech upgrade delay in seconds after pre-queued units (default 0).' },
    units_before:   { type: 'integer', minimum: 0,                    description: 'Units already queued before the fight starts (default 0).' },
    buildings:      { type: 'integer', minimum: 1,                    description: 'Number of production buildings (default 1).' },
    resource_discounts: {
      type: 'object',
      description: 'Resource cost discounts as percentages (0–100).',
      additionalProperties: false,
      properties: {
        all:  { type: 'number', minimum: 0, maximum: 100, description: 'Discount applied to all resources.' },
        food: { type: 'number', minimum: 0, maximum: 100, description: 'Food discount.' },
        wood: { type: 'number', minimum: 0, maximum: 100, description: 'Wood discount.' },
        gold: { type: 'number', minimum: 0, maximum: 100, description: 'Gold discount.' },
      },
    },
  },
};

const OPTIONS_SCHEMA = {
  type: 'object',
  description: 'Simulation options.',
  additionalProperties: false,
  properties: {
    include_history: { type: 'boolean',                 description: 'Include tick-by-tick history in the result (default false).' },
    tick:            { type: 'number',  minimum: 0.001, description: 'Simulation time step in seconds (default 0.05).' },
    maxDuration:     { type: 'number',  minimum: 1,     description: 'Maximum simulation duration in seconds (default 300).' },
  },
};

const OPTIONS_V2_SCHEMA = {
  ...OPTIONS_SCHEMA,
  properties: {
    ...OPTIONS_SCHEMA.properties,
    accuracy: { type: 'boolean', description: 'Enable accuracy modelling: ranged units deal 0 damage on a miss (default false).' },
  },
};

// ── Tools manifest ────────────────────────────────────────────────────────────

export const TOOLS = [
  {
    name: 'simulate',
    description:
      'Run a single battle simulation between two army specs using the v1 generic catalog. ' +
      'Returns: winner ("side_a"|"side_b"|null for draw), draw (bool), duration_s, ' +
      'per-side remaining_count/remaining_hp/hp_pct_remaining/resource_value_initial/' +
      'resource_value_remaining/resource_value_lost, and efficiency ratios. ' +
      'Call list_presets or list_units first if you do not know a valid unit key. ' +
      'For civ-specific Imperial/Castle/Feudal stats use simulate_v2 instead — ' +
      'it uses the full AoE2 armor-class damage formula, per-civ tech bonuses, trample, and accuracy, ' +
      'making it a significantly more accurate model of the actual game.',
    inputSchema: {
      type: 'object',
      required: ['side_a', 'side_b'],
      additionalProperties: false,
      properties: {
        side_a:  { ...ARMY_SPEC_SCHEMA, description: 'Army A specification.' },
        side_b:  { ...ARMY_SPEC_SCHEMA, description: 'Army B specification.' },
        options: OPTIONS_SCHEMA,
      },
    },
  },
  {
    name: 'simulate_v2',
    description:
      'Run a single battle simulation using the v2 engine with civ-specific unit data. ' +
      'Unit keys are civ-prefixed (e.g. "britons_cavalier", "aztecs_eagle_warrior"). ' +
      'Uses the full AoE2 armor-class damage formula and supports trample (blastDamage). ' +
      'Supports accuracy modelling via options.accuracy:true (ranged units can miss). ' +
      'Returns the same fields as simulate. ' +
      'Call GET /v2/units to discover valid keys.',
    inputSchema: {
      type: 'object',
      required: ['side_a', 'side_b'],
      additionalProperties: false,
      properties: {
        side_a:  { ...ARMY_SPEC_SCHEMA, description: 'Army A — unit key must be a v2 civ-prefixed key.' },
        side_b:  { ...ARMY_SPEC_SCHEMA, description: 'Army B — unit key must be a v2 civ-prefixed key.' },
        options: OPTIONS_V2_SCHEMA,
      },
    },
  },
  {
    name: 'simulate_v2_batch',
    description:
      'Run multiple v2 battle simulations in a single request, each tagged with a caller-supplied id. ' +
      'Unit keys must be v2 civ-prefixed (e.g. "britons_cavalier"). ' +
      'Returns an array where each element includes the id plus the same fields as simulate_v2. ' +
      'Call GET /v2/units to discover valid keys.',
    inputSchema: {
      type: 'object',
      required: ['matchups'],
      additionalProperties: false,
      properties: {
        matchups: {
          type: 'array',
          description: 'Array of matchups to simulate.',
          items: {
            type: 'object',
            required: ['side_a', 'side_b'],
            additionalProperties: false,
            properties: {
              id:     { type: 'string', description: 'Caller-supplied identifier for this matchup.' },
              side_a: { ...ARMY_SPEC_SCHEMA, description: 'Army A — unit key must be a v2 civ-prefixed key.' },
              side_b: { ...ARMY_SPEC_SCHEMA, description: 'Army B — unit key must be a v2 civ-prefixed key.' },
            },
          },
        },
        options: OPTIONS_V2_SCHEMA,
      },
    },
  },
  {
    name: 'simulate_v2_sweep',
    description:
      'Sweep a numeric parameter across a range using the v2 engine and report results per step. ' +
      'Unit keys must be v2 civ-prefixed (e.g. "britons_cavalier"). ' +
      'Returns: sweep_param, breakeven (the value where the winner first flips, or null if no flip), ' +
      'and results array of {value, winner} entries. ' +
      'Call GET /v2/units to discover valid keys.',
    inputSchema: {
      type: 'object',
      required: ['side_a', 'side_b', 'sweep'],
      additionalProperties: false,
      properties: {
        side_a: { ...ARMY_SPEC_SCHEMA, description: 'Army A — unit key must be a v2 civ-prefixed key.' },
        side_b: { ...ARMY_SPEC_SCHEMA, description: 'Army B — unit key must be a v2 civ-prefixed key.' },
        sweep: {
          type: 'object',
          description: 'Sweep configuration.',
          required: ['target', 'range'],
          additionalProperties: false,
          properties: {
            target: {
              type: 'string',
              description: 'Dot-path to the numeric field to sweep.',
              enum: [
                'side_a.count',          'side_b.count',
                'side_a.micro',          'side_b.micro',
                'side_a.engagement_pct', 'side_b.engagement_pct',
                'side_a.buildings',      'side_b.buildings',
                'side_a.delay',          'side_b.delay',
                'side_a.tech_delay',     'side_b.tech_delay',
                'side_a.units_before',   'side_b.units_before',
                'side_a.overrides.hp',     'side_b.overrides.hp',
                'side_a.overrides.patk',   'side_b.overrides.patk',
                'side_a.overrides.matk',   'side_b.overrides.matk',
                'side_a.overrides.parm',   'side_b.overrides.parm',
                'side_a.overrides.marm',   'side_b.overrides.marm',
                'side_a.overrides.reload', 'side_b.overrides.reload',
                'side_a.overrides.range',  'side_b.overrides.range',
              ],
            },
            range: {
              type: 'object',
              description: 'Numeric range for the sweep.',
              required: ['min', 'max', 'step'],
              additionalProperties: false,
              properties: {
                min:  { type: 'number', description: 'Start value (inclusive).' },
                max:  { type: 'number', description: 'End value (inclusive).' },
                step: { type: 'number', minimum: 0.001, description: 'Increment between values (must be > 0).' },
              },
            },
          },
        },
        options: OPTIONS_V2_SCHEMA,
      },
    },
  },
  {
    name: 'simulate_batch',
    description:
      'Run multiple battle simulations in a single request, each tagged with a caller-supplied id. ' +
      'Returns an array where each element includes the id plus the same fields as simulate. ' +
      'Call list_presets or list_units first if you do not know valid unit keys.',
    inputSchema: {
      type: 'object',
      required: ['matchups'],
      additionalProperties: false,
      properties: {
        matchups: {
          type: 'array',
          description: 'Array of matchups to simulate.',
          items: {
            type: 'object',
            required: ['side_a', 'side_b'],
            additionalProperties: false,
            properties: {
              id:     { type: 'string', description: 'Caller-supplied identifier for this matchup.' },
              side_a: ARMY_SPEC_SCHEMA,
              side_b: ARMY_SPEC_SCHEMA,
            },
          },
        },
        options: OPTIONS_SCHEMA,
      },
    },
  },
  {
    name: 'simulate_sweep',
    description:
      'Sweep a numeric parameter across a range and report results per step. ' +
      'Returns: sweep_param, breakeven (the value where the winner first flips, or null if no flip), ' +
      'and results array of {value, winner} entries. ' +
      'Call list_presets or list_units first if you do not know a valid unit key.',
    inputSchema: {
      type: 'object',
      required: ['side_a', 'side_b', 'sweep'],
      additionalProperties: false,
      properties: {
        side_a: ARMY_SPEC_SCHEMA,
        side_b: ARMY_SPEC_SCHEMA,
        sweep: {
          type: 'object',
          description: 'Sweep configuration.',
          required: ['target', 'range'],
          additionalProperties: false,
          properties: {
            target: {
              type: 'string',
              description: 'Dot-path to the numeric field to sweep.',
              enum: [
                'side_a.count',          'side_b.count',
                'side_a.micro',          'side_b.micro',
                'side_a.engagement_pct', 'side_b.engagement_pct',
                'side_a.buildings',      'side_b.buildings',
                'side_a.delay',          'side_b.delay',
                'side_a.tech_delay',     'side_b.tech_delay',
                'side_a.units_before',   'side_b.units_before',
                'side_a.overrides.hp',     'side_b.overrides.hp',
                'side_a.overrides.patk',   'side_b.overrides.patk',
                'side_a.overrides.matk',   'side_b.overrides.matk',
                'side_a.overrides.parm',   'side_b.overrides.parm',
                'side_a.overrides.marm',   'side_b.overrides.marm',
                'side_a.overrides.reload', 'side_b.overrides.reload',
                'side_a.overrides.range',  'side_b.overrides.range',
              ],
            },
            range: {
              type: 'object',
              description: 'Numeric range for the sweep.',
              required: ['min', 'max', 'step'],
              additionalProperties: false,
              properties: {
                min:  { type: 'number', description: 'Start value (inclusive).' },
                max:  { type: 'number', description: 'End value (inclusive).' },
                step: { type: 'number', minimum: 0.001, description: 'Increment between values (must be > 0).' },
              },
            },
          },
        },
        options: OPTIONS_SCHEMA,
      },
    },
  },
  {
    name: 'list_units',
    description: 'List all base units in the catalog. Returns keys suitable for use as the unit field in army specs. Use list_presets for fully-upgraded named configurations.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Case-insensitive substring filter on unit name.' },
      },
    },
  },
  {
    name: 'get_unit',
    description: 'Get the full stat block for a single base unit by its catalog key.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Unit catalog key (e.g. "archer").' },
      },
    },
  },
  {
    name: 'list_presets',
    description: 'List all preset army configurations (fully-upgraded named units for specific ages/civs). Returns keys suitable for use as the unit field in army specs.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Case-insensitive substring filter on preset name.' },
      },
    },
  },
  {
    name: 'get_preset',
    description: 'Get the full stat block for a single preset by its key.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: 'Preset key (e.g. "archer_fu_feudal").' },
      },
    },
  },
  {
    name: 'list_scenarios',
    description: 'List all built-in named scenarios with their translated army specs. Returns ids valid for use in run_scenario.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'run_scenario',
    description:
      'Run a named built-in scenario by id, optionally overriding army specs or options. ' +
      'Returns the same fields as simulate. Call list_scenarios first to discover valid scenario ids.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'Scenario id.',
          enum: Object.keys(SCENARIOS),
        },
        overrides: {
          type: 'object',
          description: 'Optional overrides for side_a, side_b, or options.',
          additionalProperties: false,
          properties: {
            side_a:  { ...ARMY_SPEC_SCHEMA, required: [], description: 'Partial army spec merged onto scenario side A — all fields optional.' },
            side_b:  { ...ARMY_SPEC_SCHEMA, required: [], description: 'Partial army spec merged onto scenario side B — all fields optional.' },
            options: OPTIONS_SCHEMA,
          },
        },
      },
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

const TOOL_HANDLERS = {
  simulate:       (a) => simulateLogic(a.side_a, a.side_b, a.options),
  simulate_v2:       (a) => simulateV2Logic(a.side_a, a.side_b, a.options),
  simulate_v2_batch: (a) => batchV2Logic(a.matchups, a.options),
  simulate_v2_sweep: (a) => sweepV2Logic(a.side_a, a.side_b, a.sweep, a.options),
  simulate_batch: (a) => batchLogic(a.matchups, a.options),
  simulate_sweep: (a) => sweepLogic(a.side_a, a.side_b, a.sweep, a.options),
  list_units:     (a) => listUnitsLogic(a.name),
  get_unit:       (a) => getUnitLogic(a.id),
  list_presets:   (a) => listPresetsLogic(a?.name),
  get_preset:     (a) => getPresetLogic(a.id),
  list_scenarios: ()  => listScenariosLogic(),
  run_scenario:   (a) => runScenarioLogic(a.id, a.overrides),
};

// ── JSON-RPC handler ──────────────────────────────────────────────────────────

export async function handleMcp(request) {
  const msg = await request.json();

  // Notification (no id) → 202 Accepted; no response body per MCP 2025-03-26
  if (msg.id === undefined) {
    return new Response(null, { status: 202 });
  }

  const respond = (result) =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });

  const respondError = (code, message) =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code, message } }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    switch (msg.method) {
      case 'initialize':
        return respond({
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'aoe2-battlesim', version: '0.2.0' },
        });

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
