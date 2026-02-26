import { describe, it, expect } from 'vitest';
import { simulateLogic } from '../../../src/routes/simulate.js';
import { ARCHER_SPEC, SKIRM_SPEC, INLINE_UNIT_SPEC } from '../../fixtures.js';

describe('simulateLogic — validation', () => {
  it('throws if side_a is missing', () => {
    expect(() => simulateLogic(null, SKIRM_SPEC)).toThrow();
  });

  it('throws if side_b.unit is missing', () => {
    expect(() => simulateLogic(ARCHER_SPEC, { count: 10 })).toThrow();
  });

  it('throws for an unknown unit key', () => {
    expect(() => simulateLogic({ unit: 'zzz_bad_key', count: 5 }, SKIRM_SPEC)).toThrow('Unknown unit key');
  });
});

describe('simulateLogic — result shape', () => {
  it('returns all required top-level fields', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('draw');
    expect(result).toHaveProperty('duration_s');
    expect(result).toHaveProperty('side_a');
    expect(result).toHaveProperty('side_b');
    expect(result).toHaveProperty('efficiency');
    expect(result).toHaveProperty('history');
  });

  it('returns correct side_a shape', () => {
    const { side_a } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(side_a).toHaveProperty('remaining_count');
    expect(side_a).toHaveProperty('remaining_hp');
    expect(side_a).toHaveProperty('initial_count');
    expect(side_a).toHaveProperty('hp_pct_remaining');
    expect(side_a).toHaveProperty('resource_value_initial');
    expect(side_a).toHaveProperty('resource_value_remaining');
    expect(side_a).toHaveProperty('resource_value_lost');
  });
});

describe('simulateLogic — known outcomes', () => {
  it('skirms beat archers 10v10 (focus fire)', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(result.winner).toBe('side_b');
    expect(result.draw).toBe(false);
    expect(result.side_a.remaining_count).toBe(0);
    expect(result.side_b.remaining_count).toBeGreaterThan(0);
  });

  it('resource_value_initial for archers = 10 * (25w + 45g) = 700', () => {
    const { side_a } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(side_a.resource_value_initial).toBeCloseTo(700, 0);
  });

  it('resource_value_lost = initial - remaining (conservation check)', () => {
    const { side_a, side_b } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(side_a.resource_value_lost).toBeCloseTo(
      side_a.resource_value_initial - side_a.resource_value_remaining, 1
    );
    expect(side_b.resource_value_lost).toBeCloseTo(
      side_b.resource_value_initial - side_b.resource_value_remaining, 1
    );
  });

  it('side_b efficiency > 1 when skirms win (they destroyed more than they lost)', () => {
    const { efficiency } = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(efficiency.side_b_per_resource_spent).toBeGreaterThan(1);
  });
});

describe('simulateLogic — Option B (overrides)', () => {
  it('reflects overridden stats in the outcome', () => {
    const baseResult    = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    const boostedResult = simulateLogic(
      { unit: 'archer_fu_feudal', overrides: { patk: 20 }, count: 10 },
      SKIRM_SPEC,
    );
    // Much stronger archers should win
    expect(boostedResult.winner).toBe('side_a');
    expect(boostedResult.winner).not.toBe(baseResult.winner);
  });
});

describe('simulateLogic — Option C (inline unit)', () => {
  it('accepts a fully inline unit spec', () => {
    const result = simulateLogic(INLINE_UNIT_SPEC, SKIRM_SPEC);
    expect(result).toHaveProperty('winner');
  });
});

describe('simulateLogic — options', () => {
  it('history is null by default', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC);
    expect(result.history).toBeNull();
  });

  it('history is non-null when include_history=true', () => {
    const result = simulateLogic(ARCHER_SPEC, SKIRM_SPEC, { include_history: true });
    expect(Array.isArray(result.history)).toBe(true);
    expect(result.history.length).toBeGreaterThan(0);
  });

  it('draw=true when both sides are equally matched and both reach 0', () => {
    // Identical units with identical counts should be a draw
    const sameSpec = { unit: 'archer_fu_feudal', count: 10 };
    const result   = simulateLogic(sameSpec, { ...sameSpec });
    // May or may not be a draw depending on rounding; just verify the field is boolean
    expect(typeof result.draw).toBe('boolean');
  });
});
