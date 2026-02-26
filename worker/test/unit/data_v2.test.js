import { describe, it, expect } from 'vitest';
import { resolveUnit, ALL_UNITS } from '../../src/data_v2.js';

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
