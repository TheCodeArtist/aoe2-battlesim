import { CombatSim, Unit } from '../sim_v2.js';
import { resolveUnit } from '../data_v2.js';
import { CORS } from '../cors.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSimData(spec) {
  const unitData = resolveUnit(spec);
  const config   = {
    engagement:  spec.engagement_pct ?? 100,
    targetMicro: spec.micro ?? 0,
  };
  return { unitData, config };
}

// ── Logic functions ───────────────────────────────────────────────────────────

export function simulateLogic(side_a, side_b, options = {}) {
  if (!side_a || !side_a.unit) throw new Error('side_a must be present and have a unit field');
  if (!side_b || !side_b.unit) throw new Error('side_b must be present and have a unit field');

  const { unitData: dataA, config: configA } = buildSimData(side_a);
  const { unitData: dataB, config: configB } = buildSimData(side_b);

  const simConfig = {};
  if (options.tick)        simConfig.tick        = options.tick;
  if (options.maxDuration) simConfig.maxDuration = options.maxDuration;
  if (options.accuracy)    simConfig.accuracy    = options.accuracy;

  const sim    = new CombatSim(dataA, dataB, configA, configB, simConfig);
  const result = sim.run();

  const costA     = new Unit(dataA).getParsedCost().total;
  const costB     = new Unit(dataB).getParsedCost().total;
  const initValA  = dataA.count * costA;
  const initValB  = dataB.count * costB;
  const hpPctA    = result.armyA.totalHp / result.armyA.initialTotalHp || 0;
  const hpPctB    = result.armyB.totalHp / result.armyB.initialTotalHp || 0;
  const remValA   = hpPctA * initValA;
  const remValB   = hpPctB * initValB;
  const lostValA  = initValA - remValA;
  const lostValB  = initValB - remValB;

  const remA = result.armyA.remaining;
  const remB = result.armyB.remaining;
  const draw = remA === remB;
  let winner = null;
  if (!draw) winner = remA > remB ? 'side_a' : 'side_b';

  return {
    winner,
    draw,
    duration_s: result.duration,
    side_a: {
      remaining_count:        remA,
      remaining_hp:           result.armyA.totalHp,
      initial_count:          dataA.count,
      hp_pct_remaining:       hpPctA,
      resource_value_initial: initValA,
      resource_value_remaining: remValA,
      resource_value_lost:    lostValA,
    },
    side_b: {
      remaining_count:        remB,
      remaining_hp:           result.armyB.totalHp,
      initial_count:          dataB.count,
      hp_pct_remaining:       hpPctB,
      resource_value_initial: initValB,
      resource_value_remaining: remValB,
      resource_value_lost:    lostValB,
    },
    efficiency: {
      side_a_per_resource_spent: lostValA === 0 ? null : lostValB / lostValA,
      side_b_per_resource_spent: lostValB === 0 ? null : lostValA / lostValB,
    },
    history: options.include_history === true ? result.history : null,
  };
}

export function batchLogic(matchups, options = {}) {
  if (!Array.isArray(matchups) || matchups.length === 0)
    throw new Error('matchups must be a non-empty array');
  return matchups.map(({ id, side_a, side_b }) => ({
    id,
    ...simulateLogic(side_a, side_b, options),
  }));
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
    setPath(target_obj, fieldPath, v);

    const { winner } = simulateLogic(a, b, { ...options, include_history: false });
    results.push({ value: v, winner });

    if (baseWinner === null) baseWinner = winner;
    else if (breakeven === null && winner !== baseWinner) breakeven = v;
  }

  return { sweep_param: target, breakeven, results };
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

export async function handleSimulate(request) {
  try {
    const { side_a, side_b, options } = await request.json();
    return Response.json(simulateLogic(side_a, side_b, options), { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400, headers: CORS });
  }
}

export async function handleBatch(request) {
  try {
    const { matchups, options } = await request.json();
    return Response.json(batchLogic(matchups, options), { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400, headers: CORS });
  }
}

export async function handleSweep(request) {
  try {
    const { side_a, side_b, sweep, options } = await request.json();
    return Response.json(sweepLogic(side_a, side_b, sweep, options), { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400, headers: CORS });
  }
}
