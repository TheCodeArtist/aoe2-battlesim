import { describe, it, expect } from 'vitest';
import { listScenariosLogic, runScenarioLogic } from '../../../src/routes/scenarios.js';

describe('listScenariosLogic', () => {
  it('returns an array of scenario objects', () => {
    const list = listScenariosLogic();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('each scenario has id, name, desc, side_a, side_b', () => {
    listScenariosLogic().forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('desc');
      expect(s).toHaveProperty('side_a');
      expect(s).toHaveProperty('side_b');
    });
  });

  it('includes archers_vs_skirms scenario', () => {
    const ids = listScenariosLogic().map(s => s.id);
    expect(ids).toContain('archers_vs_skirms');
  });
});

describe('runScenarioLogic', () => {
  it('runs archers_vs_skirms and returns a winner', () => {
    const result = runScenarioLogic('archers_vs_skirms');
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('draw');
  });

  it('throws for an unknown scenario id', () => {
    expect(() => runScenarioLogic('no_such_scenario')).toThrow('Scenario not found');
  });

  it('applies overrides.side_a correctly', () => {
    // Give side_a massive count to guarantee they win
    const result = runScenarioLogic('archers_vs_skirms', {
      side_a: { count: 100 },
    });
    expect(result.winner).toBe('side_a');
  });

  it('preserves non-overridden fields from the scenario', () => {
    const normal   = runScenarioLogic('archers_vs_skirms');
    const override = runScenarioLogic('archers_vs_skirms', { options: { include_history: true } });
    expect(Array.isArray(override.history)).toBe(true);
    expect(normal.history).toBeNull();
  });
});
