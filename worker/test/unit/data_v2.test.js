import { describe, it, expect } from 'vitest';
import { resolveUnit, ALL_UNITS } from '../../src/data_v2.js';

describe('resolveUnit — error paths', () => {
  it('throws Unknown unit key for an unrecognised string', () => {
    expect(() => resolveUnit({ unit: 'zzz_not_a_unit' })).toThrow('Unknown unit key');
  });

  it('throws when spec.unit is neither a string nor an object', () => {
    expect(() => resolveUnit({ unit: 42 })).toThrow();
  });
});

describe('resolveUnit — inline unit object', () => {
  it('accepts a fully inline stat object as spec.unit', () => {
    const spec = {
      unit: { name: 'Custom', hp: 50, matk: 8, marm: 2, reload: 2, range: 0,
               attacks: {}, armors: {}, cost: { food: 40, wood: 0, gold: 30 } },
      count: 5,
    };
    const resolved = resolveUnit(spec);
    expect(resolved.name).toBe('Custom');
    expect(resolved.hp).toBe(50);
    expect(resolved.count).toBe(5);
  });
});

describe('resolveUnit — army-level field mapping', () => {
  it('passes through count when provided', () => {
    const resolved = resolveUnit({ unit: 'britons_knight', count: 7 });
    expect(resolved.count).toBe(7);
  });

  it('leaves count undefined when not provided (Unit constructor defaults to 1)', () => {
    const resolved = resolveUnit({ unit: 'britons_knight' });
    expect(resolved.count).toBeUndefined();
  });

  it('maps tech_delay → techDelay', () => {
    const resolved = resolveUnit({ unit: 'britons_knight', tech_delay: 15 });
    expect(resolved.techDelay).toBe(15);
  });

  it('maps units_before → unitsBefore', () => {
    const resolved = resolveUnit({ unit: 'britons_knight', units_before: 3 });
    expect(resolved.unitsBefore).toBe(3);
  });

  it('passes through delay and buildings', () => {
    const resolved = resolveUnit({ unit: 'britons_knight', delay: 5, buildings: 2 });
    expect(resolved.delay).toBe(5);
    expect(resolved.buildings).toBe(2);
  });
});

describe('resolveUnit — resource_discounts mapping', () => {
  it('maps all → discAll, food → discF, wood → discW, gold → discG', () => {
    const resolved = resolveUnit({
      unit: 'britons_knight',
      resource_discounts: { all: 10, food: 20, wood: 30, gold: 40 },
    });
    expect(resolved.discAll).toBe(10);
    expect(resolved.discF).toBe(20);
    expect(resolved.discW).toBe(30);
    expect(resolved.discG).toBe(40);
  });
});

describe('resolveUnit — overrides', () => {
  it('deep-merges attacks overrides (preserves unaffected classes)', () => {
    const base = resolveUnit({ unit: 'britons_halberdier' });
    const resolved = resolveUnit({ unit: 'britons_halberdier', overrides: { attacks: { '8': 99 } } });
    // class 8 overridden
    expect(resolved.attacks['8']).toBe(99);
    // other classes preserved
    expect(resolved.attacks['4']).toBe(base.attacks['4']);
  });

  it('deep-merges armors overrides', () => {
    const resolved = resolveUnit({ unit: 'britons_knight', overrides: { armors: { '4': 99 } } });
    expect(resolved.armors['4']).toBe(99);
  });

  it('top-level stat overrides (hp) apply correctly', () => {
    const resolved = resolveUnit({ unit: 'britons_knight', overrides: { hp: 999 } });
    expect(resolved.hp).toBe(999);
  });
});

describe('Data V2', () => {
  it('should load all units', () => {
    expect(Object.keys(ALL_UNITS).length).toBeGreaterThan(0);
  });

  it('castle age units are present for a civ that has the full imperial line', () => {
    // Britons have Arbalester at imperial — so britons_crossbowman is castle-age exclusive
    expect(ALL_UNITS).toHaveProperty('britons_crossbowman');
    expect(ALL_UNITS).toHaveProperty('britons_knight');
  });

  it('feudal age units are present', () => {
    expect(ALL_UNITS).toHaveProperty('britons_man_at_arms');
    expect(ALL_UNITS).toHaveProperty('britons_archer');
  });

  it('castle age unit has correct hp compared to imperial upgrade', () => {
    const castle = ALL_UNITS['britons_crossbowman'];
    const imperial = ALL_UNITS['britons_arbalester'];
    expect(castle).toBeDefined();
    expect(imperial).toBeDefined();
    // Crossbowman has 35 HP, Arbalester has 40 HP
    expect(castle.hp).toBeLessThan(imperial.hp);
  });

  it('should resolve a specific unit', () => {
    const spec = { unit: 'britons_champion', count: 10 };
    const resolved = resolveUnit(spec);
    
    expect(resolved.name).toBe('Britons Champion');
    expect(resolved.count).toBe(10);
    expect(resolved.hp).toBe(70);
    expect(resolved.matk).toBe(18); // 13 + 4 + ? (Analyzer output)
    expect(resolved.attacks['4']).toBe(18);
  });

  it('should apply overrides', () => {
    const spec = { 
        unit: 'britons_champion', 
        count: 10,
        overrides: {
            hp: 100,
            attacks: { '4': 20 }
        }
    };
    const resolved = resolveUnit(spec);
    
    expect(resolved.hp).toBe(100);
    expect(resolved.attacks['4']).toBe(20);
    // Should preserve other stats
    expect(resolved.marm).toBe(4);
  });
});
