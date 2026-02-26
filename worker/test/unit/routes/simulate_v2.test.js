import { describe, it, expect } from 'vitest';
import { simulateLogic, batchLogic, sweepLogic } from '../../../src/routes/simulate_v2.js';
import { HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2, SIMULATE_BODY_V2 } from '../../fixtures.js';

// Halberdier: hp=60, cost=35f+25w, +32 cavalry bonus — reliable counter to cavalry.
// Cavalier:   hp=120, cost=60f+75g, fast reload — loses to halbs at equal counts.

describe('simulateLogic — validation', () => {
  it('throws if side_a is missing', () => {
    expect(() => simulateLogic(null, CAVALIER_SPEC_V2)).toThrow();
  });

  it('throws if side_a.unit is missing', () => {
    expect(() => simulateLogic({ count: 10 }, CAVALIER_SPEC_V2)).toThrow();
  });

  it('throws if side_b is missing', () => {
    expect(() => simulateLogic(HALBERDIER_SPEC_V2, null)).toThrow();
  });

  it('throws for an unknown v2 unit key', () => {
    expect(() => simulateLogic({ unit: 'zzz_bad_key', count: 5 }, CAVALIER_SPEC_V2))
      .toThrow('Unknown unit key');
  });
});

describe('simulateLogic — result shape', () => {
  it('returns all required top-level fields', () => {
    const result = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('draw');
    expect(result).toHaveProperty('duration_s');
    expect(result).toHaveProperty('side_a');
    expect(result).toHaveProperty('side_b');
    expect(result).toHaveProperty('efficiency');
    expect(result).toHaveProperty('history');
  });

  it('returns correct side_a shape', () => {
    const { side_a } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
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
  it('halberdiers beat cavaliers 20v10 (cavalry bonus)', () => {
    const result = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(result.winner).toBe('side_a');
    expect(result.draw).toBe(false);
    expect(result.side_a.remaining_count).toBeGreaterThan(0);
    expect(result.side_b.remaining_count).toBe(0);
  });

  it('duration_s is greater than 0', () => {
    const { duration_s } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(duration_s).toBeGreaterThan(0);
  });

  it('resource_value_initial for halbs = 20 * (35f + 25w) = 1200', () => {
    const { side_a } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(side_a.resource_value_initial).toBeCloseTo(1200, 0);
  });

  it('resource_value_initial for cavaliers = 10 * (60f + 75g) = 1350', () => {
    const { side_b } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(side_b.resource_value_initial).toBeCloseTo(1350, 0);
  });

  it('resource_value_lost = initial - remaining (conservation)', () => {
    const { side_a, side_b } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(side_a.resource_value_lost).toBeCloseTo(
      side_a.resource_value_initial - side_a.resource_value_remaining, 1,
    );
    expect(side_b.resource_value_lost).toBeCloseTo(
      side_b.resource_value_initial - side_b.resource_value_remaining, 1,
    );
  });

  it('winner efficiency > 1 (halbs destroyed more value than they lost)', () => {
    const { efficiency } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(efficiency.side_a_per_resource_spent).toBeGreaterThan(1);
  });

  it('1v1 knight loses to halberdier (cavalry bonus dominant in 1v1)', () => {
    const result = simulateLogic({ unit: 'britons_halberdier' }, { unit: 'britons_knight' });
    expect(result.winner).toBe('side_a');
    expect(result.side_b.remaining_count).toBe(0);
  });
});

describe('simulateLogic — overrides', () => {
  it('massively boosted cavalier hp reverses the outcome', () => {
    const base     = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    const boosted  = simulateLogic(
      HALBERDIER_SPEC_V2,
      { unit: 'britons_cavalier', count: 10, overrides: { hp: 9999 } },
    );
    expect(boosted.winner).toBe('side_b');
    expect(boosted.winner).not.toBe(base.winner);
  });
});

describe('simulateLogic — options', () => {
  it('history is null by default', () => {
    expect(simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2).history).toBeNull();
  });

  it('history is a non-empty array when include_history:true', () => {
    const { history } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2, { include_history: true });
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it('draw is a boolean', () => {
    const { draw } = simulateLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2);
    expect(typeof draw).toBe('boolean');
  });
});

describe('batchLogic', () => {
  it('throws if matchups is not an array', () => {
    expect(() => batchLogic(null)).toThrow('non-empty array');
  });

  it('throws if matchups is empty', () => {
    expect(() => batchLogic([])).toThrow('non-empty array');
  });

  it('returns an array tagged by id', () => {
    const results = batchLogic([
      { id: 'run_1', ...SIMULATE_BODY_V2 },
      { id: 'run_2', side_a: CAVALIER_SPEC_V2, side_b: HALBERDIER_SPEC_V2 },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('run_1');
    expect(results[1].id).toBe('run_2');
    expect(results[0]).toHaveProperty('winner');
  });

  it('different matchups can have different winners', () => {
    const results = batchLogic([
      { id: 'halbs_win',  side_a: HALBERDIER_SPEC_V2, side_b: CAVALIER_SPEC_V2 },
      { id: 'cavs_win',   side_a: { unit: 'britons_cavalier', count: 100 }, side_b: HALBERDIER_SPEC_V2 },
    ]);
    expect(results[0].winner).toBe('side_a');
    expect(results[1].winner).toBe('side_a');
  });
});

describe('sweepLogic', () => {
  it('throws for step <= 0', () => {
    expect(() => sweepLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2, {
      target: 'side_a.count', range: { min: 1, max: 10, step: 0 },
    })).toThrow('step must be positive');
  });

  it('throws for min > max', () => {
    expect(() => sweepLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2, {
      target: 'side_a.count', range: { min: 20, max: 10, step: 1 },
    })).toThrow('min must be');
  });

  it('throws for invalid target prefix', () => {
    expect(() => sweepLogic(HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2, {
      target: 'side_c.count', range: { min: 1, max: 5, step: 1 },
    })).toThrow('side_a or side_b');
  });

  it('returns sweep_param, breakeven, and results', () => {
    const result = sweepLogic(
      { unit: 'britons_halberdier' }, CAVALIER_SPEC_V2,
      { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
    );
    expect(result).toHaveProperty('sweep_param', 'side_a.count');
    expect(result).toHaveProperty('breakeven');
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('every result entry has value and winner', () => {
    const { results } = sweepLogic(
      { unit: 'britons_halberdier' }, CAVALIER_SPEC_V2,
      { target: 'side_a.count', range: { min: 1, max: 5, step: 1 } },
    );
    results.forEach(r => {
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('winner');
    });
  });

  it('sweeping halberdier count vs 10 cavaliers finds a breakeven', () => {
    const { breakeven } = sweepLogic(
      { unit: 'britons_halberdier' }, { unit: 'britons_cavalier', count: 10 },
      { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
    );
    expect(breakeven).not.toBeNull();
    expect(breakeven).toBeGreaterThan(1);
    expect(breakeven).toBeLessThan(30);
  });

  it('breakeven is null when winner never flips', () => {
    const { breakeven } = sweepLogic(
      { unit: 'britons_halberdier' }, { unit: 'britons_cavalier', count: 1 },
      { target: 'side_a.count', range: { min: 20, max: 30, step: 1 } },
    );
    expect(breakeven).toBeNull();
  });

  it('does not mutate the original side specs', () => {
    const orig_a = { unit: 'britons_halberdier', count: 5 };
    const orig_b = { unit: 'britons_cavalier',   count: 10 };
    sweepLogic(orig_a, orig_b, { target: 'side_a.count', range: { min: 1, max: 3, step: 1 } });
    expect(orig_a.count).toBe(5);
  });
});
