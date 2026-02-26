import { describe, it, expect } from 'vitest';
import { Unit, CombatSim, calculateCount } from '../../src/sim.js';

// ── Unit class ────────────────────────────────────────────────────────────────

describe('Unit', () => {
  const archerData = {
    name: 'Archer', count: 10, hp: 30, patk: 5, matk: 0,
    parm: 1, marm: 1, reload: 2.0, range: 5,
    f: 0, w: 25, g: 45,
  };

  it('constructs with correct initial values', () => {
    const u = new Unit(archerData);
    expect(u.initialCount).toBe(10);
    expect(u.hpPerUnit).toBe(30);
    expect(u.patk).toBe(5);
    expect(u.parm).toBe(1);
  });

  it('isMelee() returns false for ranged units (range > 1)', () => {
    expect(new Unit({ ...archerData, range: 5 }).isMelee()).toBe(false);
  });

  it('isMelee() returns true for melee units (range <= 1)', () => {
    expect(new Unit({ ...archerData, range: 0 }).isMelee()).toBe(true);
    expect(new Unit({ ...archerData, range: 1 }).isMelee()).toBe(true);
  });

  it('getTotalHp() returns full HP for a fresh unit group', () => {
    const u = new Unit(archerData);
    expect(u.getTotalHp()).toBe(10 * 30); // 300
  });

  it('getParsedCost() returns correct total with no discounts', () => {
    const u = new Unit(archerData);
    const cost = u.getParsedCost();
    expect(cost.f).toBe(0);
    expect(cost.w).toBe(25);
    expect(cost.g).toBe(45);
    expect(cost.total).toBe(70);
  });

  it('getParsedCost() applies discAll correctly', () => {
    const u = new Unit({ ...archerData, discAll: 15 }); // 15% all discount
    const cost = u.getParsedCost();
    expect(cost.total).toBeCloseTo(70 * 0.85, 5);
  });

  it('getParsedCost() applies per-resource discount correctly', () => {
    const u = new Unit({ ...archerData, discG: 20 }); // 20% gold discount
    const cost = u.getParsedCost();
    expect(cost.g).toBeCloseTo(45 * 0.80, 5);
    expect(cost.w).toBe(25);
  });
});

// ── CombatSim ─────────────────────────────────────────────────────────────────

describe('CombatSim', () => {
  const archerData = {
    name: 'Archer', count: 10, hp: 30, patk: 5, matk: 0,
    parm: 1, marm: 1, reload: 2.0, range: 5, f: 0, w: 25, g: 45,
  };
  const skirmData = {
    name: 'Skirm', count: 10, hp: 30, patk: 3, matk: 0,
    parm: 4, marm: 1, reload: 3.0, range: 5,
    bonusAtk: 3, f: 25, w: 35, g: 0,
  };
  const defaultConfig = { engagement: 100, targetMicro: 0 };

  it('run() returns a result with armyA, armyB, history, duration fields', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const result = sim.run();
    expect(result).toHaveProperty('armyA');
    expect(result).toHaveProperty('armyB');
    expect(result).toHaveProperty('history');
    expect(result).toHaveProperty('duration');
  });

  it('run() produces a definitive winner (one side reaches 0)', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const { armyA, armyB } = sim.run();
    const eitherDead = armyA.remaining === 0 || armyB.remaining === 0;
    expect(eitherDead).toBe(true);
  });

  it('skirms beat archers 10v10 (focus fire)', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const { armyA, armyB } = sim.run();
    expect(armyA.remaining).toBe(0);
    expect(armyB.remaining).toBeGreaterThan(0);
  });

  it('respects custom tick via simConfig', () => {
    const simFast = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig, { tick: 0.1 });
    const simSlow = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig, { tick: 0.05 });
    expect(simFast.tick).toBe(0.1);
    expect(simSlow.tick).toBe(0.05);
    // Both should agree on winner
    expect(simFast.run().armyA.remaining).toBe(0);
    expect(simSlow.run().armyA.remaining).toBe(0);
  });

  it('respects custom maxDuration — stops early if set very low', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig, { maxDuration: 1 });
    const result = sim.run();
    expect(result.duration).toBeLessThanOrEqual(1.1); // within one tick of 1s
  });

  it('history array is non-empty and starts at time 0', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const { history } = sim.run();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].time).toBe(0);
  });

  it('calculateDamage uses pierce stats for ranged units', () => {
    const sim = new CombatSim(archerData, skirmData, defaultConfig, defaultConfig);
    const a = new Unit(archerData);
    const b = new Unit(skirmData);
    const dmg = sim.calculateDamage(a, b);
    // archer patk=5, skirm parm=4 → max(1, 5-4) = 1; no bonus
    expect(dmg).toBe(1);
  });

  it('calculateDamage uses melee stats for melee units', () => {
    const maaData = { ...archerData, matk: 7, patk: 0, marm: 1, parm: 2, range: 0 };
    const sim = new CombatSim(maaData, archerData, defaultConfig, defaultConfig);
    const a = new Unit(maaData);
    const b = new Unit(archerData);
    const dmg = sim.calculateDamage(a, b);
    // maa matk=7, archer marm=1 → max(1, 7-1) = 6
    expect(dmg).toBe(6);
  });

  it('calculateDamage applies bonus attack correctly', () => {
    const skirmWithBonus = { ...skirmData, bonusAtk: 3, bonusReduct: 0 };
    const sim = new CombatSim(skirmWithBonus, archerData, defaultConfig, defaultConfig);
    const a = new Unit(skirmWithBonus);
    const b = new Unit(archerData);
    const dmg = sim.calculateDamage(a, b);
    // skirm patk=3, archer parm=1 → max(1,3-1)=2; bonus=3*(1-0)=3 → total 5
    expect(dmg).toBe(5);
  });

  it('engagement_pct limits active units per volley', () => {
    const lowEngConfig = { engagement: 50, targetMicro: 0 };
    const fullEngConfig = { engagement: 100, targetMicro: 0 };
    const simLow  = new CombatSim(archerData, skirmData, lowEngConfig, fullEngConfig);
    const simFull = new CombatSim(archerData, skirmData, fullEngConfig, fullEngConfig);
    // With 50% engagement for side_a, skirms should win faster
    expect(simLow.run().duration).toBeGreaterThanOrEqual(simFull.run().duration - 0.5);
  });
});

// ── calculateCount ────────────────────────────────────────────────────────────

describe('calculateCount', () => {
  it('returns 0 before start time', () => {
    expect(calculateCount(50, 100, 0, 30, 1, 0)).toBe(0);
  });

  it('counts units produced after start with no tech delay', () => {
    // start=0, tech=0, trainTime=30, buildings=1, pre=0
    expect(calculateCount(30, 0, 0, 30, 1, 0)).toBe(1);
    expect(calculateCount(60, 0, 0, 30, 1, 0)).toBe(2);
  });

  it('respects unitsBefore (pre-queued units)', () => {
    // 3 units produced before fight starts at t=0
    expect(calculateCount(0, 0, 0, 30, 1, 3)).toBe(0);
    expect(calculateCount(90, 0, 0, 30, 1, 3)).toBe(3); // 3 * 30 / 1 = 90s for pre units
  });

  it('accounts for tech delay correctly', () => {
    // pre=3, trainTime=30, start=0; tech delay of 40s kicks in after pre units
    // t=90: all 3 pre units done; tech until t=130; production resumes at 130
    expect(calculateCount(100, 0, 40, 30, 1, 3)).toBe(3);
    expect(calculateCount(160, 0, 40, 30, 1, 3)).toBe(4); // 130 + 30 = 160
  });

  it('scales with number of buildings', () => {
    // 2 buildings halves the time-per-unit
    expect(calculateCount(30, 0, 0, 30, 2, 0)).toBe(2);
  });
});
