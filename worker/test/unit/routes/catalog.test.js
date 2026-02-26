import { describe, it, expect } from 'vitest';
import { listUnitsLogic, getUnitLogic, listPresetsLogic, getPresetLogic } from '../../../src/routes/catalog.js';

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
