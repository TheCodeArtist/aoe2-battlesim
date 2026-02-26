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
