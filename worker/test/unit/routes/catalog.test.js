import { describe, it, expect } from 'vitest';
import {
  listUnitsLogic, getUnitLogic, listPresetsLogic, getPresetLogic,
  listV2UnitsLogic, getV2UnitLogic,
} from '../../../src/routes/catalog.js';

describe('listUnitsLogic', () => {
  it('returns all units when no filter', () => {
    const result = listUnitsLogic();
    expect(Object.keys(result).length).toBeGreaterThan(100);
  });

  it('filters by name substring (case-insensitive)', () => {
    const result = listUnitsLogic('archer');
    const names  = Object.values(result).map(u => u.name.toLowerCase());
    expect(names.every(n => n.includes('archer'))).toBe(true);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('returns empty object for filter with no matches', () => {
    expect(Object.keys(listUnitsLogic('zzznomatch999')).length).toBe(0);
  });
});

describe('getUnitLogic', () => {
  it('returns the unit for a valid key', () => {
    const unit = getUnitLogic('archer');
    expect(unit).toBeDefined();
    expect(unit.hp).toBeGreaterThan(0);
  });

  it('throws for an unknown key', () => {
    expect(() => getUnitLogic('no_such_unit')).toThrow('Unit not found');
  });
});

describe('listPresetsLogic', () => {
  it('returns all presets when no filter', () => {
    const result = listPresetsLogic();
    expect(result['archer_fu_feudal']).toBeDefined();
    expect(result['skirm_fu_feudal']).toBeDefined();
  });

  it('filters by name substring', () => {
    const result = listPresetsLogic('archer');
    expect(Object.keys(result).length).toBeGreaterThan(0);
    Object.values(result).forEach(p => {
      expect(p.name.toLowerCase()).toContain('archer');
    });
  });
});

describe('getPresetLogic', () => {
  it('returns the preset for a valid key', () => {
    const preset = getPresetLogic('archer_fu_feudal');
    expect(preset.hp).toBe(30);
    expect(preset.patk).toBe(5);
  });

  it('throws for an unknown key', () => {
    expect(() => getPresetLogic('no_such_preset')).toThrow('Preset not found');
  });
});

describe('listV2UnitsLogic', () => {
  it('returns all v2 units when no filters', () => {
    const result = listV2UnitsLogic();
    expect(Object.keys(result).length).toBeGreaterThan(500);
  });

  it('filters by name substring (case-insensitive)', () => {
    const result = listV2UnitsLogic('crossbowman');
    const names  = Object.values(result).map(u => u.name.toLowerCase());
    expect(names.every(n => n.includes('crossbowman'))).toBe(true);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('filters by civ prefix', () => {
    const result = listV2UnitsLogic('', 'britons');
    expect(Object.keys(result).every(k => k.startsWith('britons_'))).toBe(true);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('name and civ filters are AND-ed', () => {
    const result = listV2UnitsLogic('cavalier', 'britons');
    expect(Object.keys(result)).toContain('britons_cavalier');
    expect(Object.keys(result).every(k => k.startsWith('britons_'))).toBe(true);
  });

  it('returns empty object when nothing matches', () => {
    expect(Object.keys(listV2UnitsLogic('zzznomatch999')).length).toBe(0);
  });
});

describe('getV2UnitLogic', () => {
  it('returns the unit data for a valid key', () => {
    const unit = getV2UnitLogic('britons_cavalier');
    expect(unit).toBeDefined();
    expect(unit.hp).toBeGreaterThan(0);
    expect(unit.attacks).toBeDefined();
    expect(unit.armors).toBeDefined();
  });

  it('throws for an unknown key', () => {
    expect(() => getV2UnitLogic('zzz_no_such_unit')).toThrow('V2 unit not found');
  });
});
