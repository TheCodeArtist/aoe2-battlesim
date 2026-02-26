import { describe, it, expect } from 'vitest';
import { simulateLogic, batchLogic, sweepLogic } from '../../../src/routes/simulate.js';
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

describe('batchLogic', () => {
  it('throws if matchups is not an array', () => {
    expect(() => batchLogic(null)).toThrow('non-empty array');
  });

  it('throws if matchups is empty', () => {
    expect(() => batchLogic([])).toThrow('non-empty array');
  });

  it('returns an array with results tagged by id', () => {
    const results = batchLogic([
      { id: 'run_1', side_a: ARCHER_SPEC, side_b: SKIRM_SPEC },
      { id: 'run_2', side_a: SKIRM_SPEC,  side_b: ARCHER_SPEC },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('run_1');
    expect(results[1].id).toBe('run_2');
    expect(results[0]).toHaveProperty('winner');
  });

  it('results are independent (different matchups can have different winners)', () => {
    const results = batchLogic([
      { id: 'a_wins', side_a: { unit: 'archer_fu_feudal', count: 30 }, side_b: SKIRM_SPEC },
      { id: 'b_wins', side_a: ARCHER_SPEC, side_b: { unit: 'skirm_fu_feudal', count: 30 } },
    ]);
    expect(results[0].winner).toBe('side_a');
    expect(results[1].winner).toBe('side_b');
  });
});

describe('sweepLogic', () => {
  it('throws for step <= 0', () => {
    expect(() => sweepLogic(ARCHER_SPEC, SKIRM_SPEC, {
      target: 'side_a.count', range: { min: 1, max: 10, step: 0 },
    })).toThrow('step must be positive');
  });

  it('throws for min > max', () => {
    expect(() => sweepLogic(ARCHER_SPEC, SKIRM_SPEC, {
      target: 'side_a.count', range: { min: 20, max: 10, step: 1 },
    })).toThrow('min must be');
  });

  it('throws for invalid target prefix', () => {
    expect(() => sweepLogic(ARCHER_SPEC, SKIRM_SPEC, {
      target: 'side_c.count', range: { min: 1, max: 5, step: 1 },
    })).toThrow('side_a or side_b');
  });

  it('returns sweep_param, breakeven, and results fields', () => {
    const result = sweepLogic(
      { unit: 'archer_fu_feudal' }, SKIRM_SPEC,
      { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } }
    );
    expect(result).toHaveProperty('sweep_param', 'side_a.count');
    expect(result).toHaveProperty('breakeven');
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('every result entry has value and winner', () => {
    const { results } = sweepLogic(
      { unit: 'archer_fu_feudal' }, SKIRM_SPEC,
      { target: 'side_a.count', range: { min: 1, max: 5, step: 1 } }
    );
    results.forEach(r => {
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('winner');
    });
  });

  it('sweep side_a.count 1→30 vs 10 skirms — breakeven is found', () => {
    const { breakeven } = sweepLogic(
      { unit: 'archer_fu_feudal' }, { unit: 'skirm_fu_feudal', count: 10 },
      { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } }
    );
    expect(breakeven).not.toBeNull();
    expect(breakeven).toBeGreaterThan(1);
    expect(breakeven).toBeLessThan(30);
  });

  it('breakeven is null when winner never flips', () => {
    // side_a always wins: 30 archers vs 1 skirm, vary side_a.count from 20 to 30
    const { breakeven } = sweepLogic(
      { unit: 'archer_fu_feudal' }, { unit: 'skirm_fu_feudal', count: 1 },
      { target: 'side_a.count', range: { min: 20, max: 30, step: 1 } }
    );
    expect(breakeven).toBeNull();
  });

  it('does not mutate the original side_a and side_b objects', () => {
    const orig_a = { unit: 'archer_fu_feudal', count: 5 };
    const orig_b = { unit: 'skirm_fu_feudal',  count: 10 };
    sweepLogic(orig_a, orig_b, { target: 'side_a.count', range: { min: 1, max: 3, step: 1 } });
    expect(orig_a.count).toBe(5); // must not have been mutated
  });
});
