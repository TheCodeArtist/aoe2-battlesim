import { describe, it, expect } from 'vitest';
import {
  ALL_UNITS, UNITS, PRESETS, SCENARIOS, featuredScenarios,
  resolveUnit,
} from '../../src/data.js';
import { ARCHER_SPEC, SKIRM_SPEC, INLINE_UNIT_SPEC } from '../fixtures.js';

describe('data exports', () => {
  it('ALL_UNITS contains units from both units.js and presets.js', () => {
    expect(Object.keys(ALL_UNITS).length).toBeGreaterThan(0);
    expect(ALL_UNITS['archer_fu_feudal']).toBeDefined();  // from presets
  });

  it('UNITS has at least 100 entries (full unit catalog)', () => {
    expect(Object.keys(UNITS).length).toBeGreaterThan(100);
  });

  it('PRESETS has core units like archer_fu_feudal and skirm_fu_feudal', () => {
    expect(PRESETS['archer_fu_feudal']).toBeDefined();
    expect(PRESETS['skirm_fu_feudal']).toBeDefined();
  });

  it('SCENARIOS has expected scenario keys', () => {
    expect(SCENARIOS['archers_vs_skirms']).toBeDefined();
    expect(SCENARIOS['maa_vs_scouts']).toBeDefined();
  });

  it('featuredScenarios is a non-empty array', () => {
    expect(Array.isArray(featuredScenarios)).toBe(true);
    expect(featuredScenarios.length).toBeGreaterThan(0);
  });
});

describe('resolveUnit — Option A (key reference)', () => {
  it('resolves a known preset key', () => {
    const unit = resolveUnit(ARCHER_SPEC);
    expect(unit.hp).toBe(30);
    expect(unit.patk).toBe(5);
    expect(unit.count).toBe(10);
  });

  it('throws for an unknown key', () => {
    expect(() => resolveUnit({ unit: 'nonexistent_unit_xyz' })).toThrow('Unknown unit key');
  });
});

describe('resolveUnit — Option B (key + overrides)', () => {
  it('applies numeric stat overrides', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', overrides: { hp: 40, patk: 7 }, count: 5 });
    expect(unit.hp).toBe(40);
    expect(unit.patk).toBe(7);
    expect(unit.count).toBe(5);
  });

  it('maps bonus_atk override to bonusAtk', () => {
    const unit = resolveUnit({ unit: 'skirm_fu_feudal', overrides: { bonus_atk: 3 } });
    expect(unit.bonusAtk).toBe(3);
  });

  it('converts bonus_reduction from 0-1 float to 0-100 for Unit constructor', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', overrides: { bonus_reduction: 0.5 } });
    expect(unit.bonusReduct).toBe(50);
  });

  it('does not mutate the original preset entry in ALL_UNITS', () => {
    const originalHp = ALL_UNITS['archer_fu_feudal'].hp;
    resolveUnit({ unit: 'archer_fu_feudal', overrides: { hp: 999 } });
    expect(ALL_UNITS['archer_fu_feudal'].hp).toBe(originalHp);
  });
});

describe('resolveUnit — Option C (fully inline)', () => {
  it('returns the inline stat object with army fields merged', () => {
    const unit = resolveUnit(INLINE_UNIT_SPEC);
    expect(unit.name).toBe('Custom Archer');
    expect(unit.hp).toBe(30);
    expect(unit.count).toBe(5);
  });

  it('throws if required inline fields are missing', () => {
    expect(() => resolveUnit({ unit: { name: 'Bad', hp: 30 } })).toThrow('missing required field');
  });
});

describe('resolveUnit — army-level field mapping', () => {
  it('maps tech_delay to techDelay', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', tech_delay: 40 });
    expect(unit.techDelay).toBe(40);
  });

  it('maps units_before to unitsBefore', () => {
    const unit = resolveUnit({ unit: 'archer_fu_feudal', units_before: 3 });
    expect(unit.unitsBefore).toBe(3);
  });

  it('maps resource_discounts correctly', () => {
    const unit = resolveUnit({
      unit: 'archer_fu_feudal',
      resource_discounts: { all: 10, food: 5, wood: 15, gold: 20 },
    });
    expect(unit.discAll).toBe(10);
    expect(unit.discF).toBe(5);
    expect(unit.discW).toBe(15);
    expect(unit.discG).toBe(20);
  });
});
