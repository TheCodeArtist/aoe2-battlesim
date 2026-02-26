import { units } from './generated/units_v2.js';

export const ALL_UNITS = { ...units };

/**
 * Maps armor class IDs (as string keys) to human-readable names.
 * Source: vendor/aoe2-unit-analyzer/extraction/extracted_data/armor_classes.json
 */
export const ARMOR_CLASSES = {
  '0':  'Unused',
  '1':  'Infantry',
  '2':  'Turtle Ships',
  '3':  'Base Pierce',
  '4':  'Base Melee',
  '5':  'War Elephants',
  '8':  'Cavalry',
  '11': 'All Buildings',
  '13': 'Stone Defense',
  '14': 'Predator Animals',
  '15': 'Archers',
  '16': 'Ships & Saboteurs',
  '17': 'Rams',
  '18': 'Trees',
  '19': 'Unique Units',
  '20': 'Siege Weapons',
  '21': 'Standard Buildings',
  '22': 'Walls & Gates',
  '23': 'Gunpowder Units',
  '24': 'Boars',
  '25': 'Monks',
  '26': 'Castles',
  '27': 'Spearmen',
  '28': 'Cavalry Archers',
  '29': 'Eagle Warriors',
  '30': 'Camels',
  '31': 'Leitis',
  '32': 'Condottieri',
  '33': 'Fishing Ships',
  '34': 'Mamelukes',
  '35': 'Heroes & Kings',
  '36': 'Hussite Wagons',
  '38': 'Skirmishers',
  '39': 'Mounted Archers',
};

/**
 * Resolve an army spec's `unit` field into a plain stat object ready for `new Unit(...)`.
 * Applies overrides if present.
 *
 * @param {object} spec  Army spec ({ unit, overrides?, count?, ... })
 * @returns {object}     Merged stat object with all Unit constructor fields populated.
 * @throws {Error}       If `spec.unit` is a string key not found in ALL_UNITS.
 */
export function resolveUnit(spec) {
  let base;

  if (typeof spec.unit === 'string') {
    // Check if unit exists
    if (!ALL_UNITS[spec.unit]) {
        // Fallback: try to find a generic version or throw
        // For now, strict check
        throw new Error(`Unknown unit key: ${spec.unit}`);
    }
    base = structuredClone(ALL_UNITS[spec.unit]);
  } else if (typeof spec.unit === 'object' && spec.unit !== null) {
    // Inline unit definition
    base = { ...spec.unit };
  } else {
    throw new Error('spec.unit must be a string key or an inline stat object');
  }

  // Apply overrides
  if (spec.overrides) {
    // Handle specific overrides for v2 structure
    // e.g. attacks, armors might need deep merge if provided partially
    // For now, simple object assign for top-level properties
    const { attacks, armors, cost, ...rest } = spec.overrides;
    
    Object.assign(base, rest);
    
    if (attacks) {
        base.attacks = { ...base.attacks, ...attacks };
    }
    if (armors) {
        base.armors = { ...base.armors, ...armors };
    }
    if (cost) {
        base.cost = { ...base.cost, ...cost };
    }
  }

  // Merge army-level fields onto the stat object
  if (spec.count        !== undefined) base.count       = spec.count;
  if (spec.delay        !== undefined) base.delay       = spec.delay;
  if (spec.tech_delay   !== undefined) base.techDelay   = spec.tech_delay;
  if (spec.units_before !== undefined) base.unitsBefore = spec.units_before;
  if (spec.buildings    !== undefined) base.buildings   = spec.buildings;

  // Resource discounts (legacy support, or map to cost reduction)
  // In v2, we might want to apply discounts directly to cost object here
  if (spec.resource_discounts) {
    const d = spec.resource_discounts;
    // Map to Unit constructor fields
    if (d.all  !== undefined) base.discAll = d.all;
    if (d.food !== undefined) base.discF   = d.food;
    if (d.wood !== undefined) base.discW   = d.wood;
    if (d.gold !== undefined) base.discG   = d.gold;
  }

  return base;
}
