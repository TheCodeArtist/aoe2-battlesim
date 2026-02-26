import { SCENARIOS } from '../data.js';
import { simulateLogic, batchLogic, sweepLogic } from './simulate.js';
import { listUnitsLogic, getUnitLogic, listPresetsLogic, getPresetLogic } from './catalog.js';
import { listScenariosLogic, runScenarioLogic } from './scenarios.js';

// ── Shared schema fragments ───────────────────────────────────────────────────

const ARMY_SPEC_SCHEMA = {
  type: 'object',
  description: 'Army specification — unit key reference, key + overrides, or fully inline stats.',
  properties: {
    unit: {
      description: 'Unit key string (e.g. "archer_fu_feudal") or inline stat object.',
      oneOf: [
        { type: 'string', description: 'Key from the units or presets catalog.' },
        {
          type: 'object',
          description: 'Fully inline stat object.',
          required: ['name', 'hp', 'reload', 'range'],
          properties: {
            name:   { type: 'string',  description: 'Unit display name.' },
            hp:     { type: 'number',  description: 'Hit points per unit.' },
            patk:   { type: 'number',  description: 'Pierce attack.' },
            matk:   { type: 'number',  description: 'Melee attack.' },
            parm:   { type: 'number',  description: 'Pierce armour.' },
            marm:   { type: 'number',  description: 'Melee armour.' },
            reload: { type: 'number',  description: 'Attack reload time in seconds.' },
            range:  { type: 'number',  description: 'Attack range (0 = melee).' },
          },
        },
      ],
    },
    count:          { type: 'number',  description: 'Number of units.' },
    overrides:      { type: 'object',  description: 'Stat overrides applied on top of the base unit.' },
    engagement_pct: { type: 'number',  description: 'Percentage of units engaging each volley (1–100).' },
    micro:          { type: 'number',  description: 'Target-fire micro level (0 = no micro, 5 = perfect).' },
    delay:          { type: 'number',  description: 'Start delay in seconds before this army begins producing.' },
    tech_delay:     { type: 'number',  description: 'Tech upgrade delay in seconds after pre-queued units.' },
    units_before:   { type: 'number',  description: 'Number of units already in queue before the fight starts.' },
    buildings:      { type: 'number',  description: 'Number of production buildings.' },
    resource_discounts: {
      type: 'object',
      description: 'Resource cost discounts (percentage, 0–100).',
      properties: {
        all:  { type: 'number', description: 'Discount applied to all resources.' },
        food: { type: 'number', description: 'Food discount.' },
        wood: { type: 'number', description: 'Wood discount.' },
        gold: { type: 'number', description: 'Gold discount.' },
      },
    },
  },
  required: ['unit'],
};

const OPTIONS_SCHEMA = {
  type: 'object',
  description: 'Simulation options.',
  properties: {
    include_history: { type: 'boolean', description: 'Include tick-by-tick history in the result.' },
    tick:            { type: 'number',  description: 'Simulation time step in seconds (default 0.05).' },
    maxDuration:     { type: 'number',  description: 'Maximum simulation duration in seconds (default 300).' },
  },
};

// ── Tools manifest ────────────────────────────────────────────────────────────

export const TOOLS = [
  {
    name: 'simulate',
    description: 'Run a single battle simulation between two army specs and return the outcome with resource efficiency.',
    inputSchema: {
      type: 'object',
      required: ['side_a', 'side_b'],
      properties: {
        side_a:  { ...ARMY_SPEC_SCHEMA, description: 'Army A specification.' },
        side_b:  { ...ARMY_SPEC_SCHEMA, description: 'Army B specification.' },
        options: OPTIONS_SCHEMA,
      },
    },
  },
  {
    name: 'simulate_batch',
    description: 'Run multiple battle simulations in a single request, each tagged with a caller-supplied id.',
    inputSchema: {
      type: 'object',
      required: ['matchups'],
      properties: {
        matchups: {
          type: 'array',
          description: 'Array of matchups to simulate.',
          items: {
            type: 'object',
            required: ['side_a', 'side_b'],
            properties: {
              id:     { type: 'string',         description: 'Caller-supplied identifier for this matchup.' },
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
    description: 'Sweep a numeric parameter across a range and report results per value, including the breakeven point where the winner flips.',
    inputSchema: {
      type: 'object',
      required: ['side_a', 'side_b', 'sweep'],
      properties: {
        side_a: ARMY_SPEC_SCHEMA,
        side_b: ARMY_SPEC_SCHEMA,
        sweep: {
          type: 'object',
          description: 'Sweep configuration.',
          required: ['target', 'range'],
          properties: {
            target: {
              type: 'string',
              description: 'Dot-path to the field to sweep, e.g. "side_a.count" or "side_a.overrides.hp".',
            },
            range: {
              type: 'object',
              description: 'Numeric range for the sweep.',
              required: ['min', 'max', 'step'],
              properties: {
                min:  { type: 'number', description: 'Start value (inclusive).' },
                max:  { type: 'number', description: 'End value (inclusive).' },
                step: { type: 'number', description: 'Increment between values (must be > 0).' },
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
    description: 'List all units in the catalog, optionally filtered by name substring.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Case-insensitive substring filter on unit name.' },
      },
    },
  },
  {
    name: 'get_unit',
    description: 'Get the full stat block for a single unit by its catalog key.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Unit catalog key (e.g. "archer").' },
      },
    },
  },
  {
    name: 'list_presets',
    description: 'List all preset army configurations (fully-upgraded named units for specific ages/civs).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_preset',
    description: 'Get the full stat block for a single preset by its key.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Preset key (e.g. "archer_fu_feudal").' },
      },
    },
  },
  {
    name: 'list_scenarios',
    description: 'List all built-in named scenarios with their translated army specs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_scenario',
    description: 'Run a named built-in scenario by id, optionally overriding army specs or options.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          description: 'Scenario id.',
          enum: Object.keys(SCENARIOS),
        },
        overrides: {
          type: 'object',
          description: 'Optional overrides for side_a, side_b, or options.',
          properties: {
            side_a:  { ...ARMY_SPEC_SCHEMA, description: 'Overrides merged onto scenario side A.' },
            side_b:  { ...ARMY_SPEC_SCHEMA, description: 'Overrides merged onto scenario side B.' },
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
  simulate_batch: (a) => batchLogic(a.matchups, a.options),
  simulate_sweep: (a) => sweepLogic(a.side_a, a.side_b, a.sweep, a.options),
  list_units:     (a) => listUnitsLogic(a.name),
  get_unit:       (a) => getUnitLogic(a.id),
  list_presets:   ()  => listPresetsLogic(),
  get_preset:     (a) => getPresetLogic(a.id),
  list_scenarios: ()  => listScenariosLogic(),
  run_scenario:   (a) => runScenarioLogic(a.id, a.overrides),
};

// ── JSON-RPC handler ──────────────────────────────────────────────────────────

export async function handleMcp(request) {
  const msg = await request.json();

  // Notification: no id present → process but return 204
  if (msg.id === undefined) {
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
