import { SCENARIOS } from '../data.js';
import { simulateLogic } from './simulate.js';
import { CORS } from '../cors.js';

// ── Translation helpers ───────────────────────────────────────────────────────

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

  // Collect stat-level fields that deviate from the base preset.
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

function mergeArmySpec(base, patch) {
  if (!patch) return base;
  const merged = { ...base, ...patch };
  // Shallow-merge the nested 'overrides' sub-object so scenario-level overrides
  // are preserved when the caller adds their own stat patches.
  if (base.overrides !== undefined || patch.overrides !== undefined) {
    merged.overrides = { ...(base.overrides || {}), ...(patch.overrides || {}) };
  }
  return merged;
}

// ── Logic functions ───────────────────────────────────────────────────────────

export function listScenariosLogic() {
  return Object.entries(SCENARIOS).map(([id, s]) => ({
    id,
    name: s.name,
    desc: s.desc,
    side_a: scenarioToArmySpec(s.a),
    side_b: scenarioToArmySpec(s.b),
  }));
}

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

// ── HTTP handlers ─────────────────────────────────────────────────────────────

export function handleListScenarios(request) {
  return Response.json(listScenariosLogic(), { headers: CORS });
}

export async function handleScenarioSimulate(request, id) {
  try {
    const overrides = await request.json().catch(() => ({}));
    return Response.json(runScenarioLogic(id, overrides), { headers: CORS });
  } catch (err) {
    const status = err.message.startsWith('Scenario not found') ? 404 : 400;
    return Response.json({ error: err.message }, { status, headers: CORS });
  }
}
