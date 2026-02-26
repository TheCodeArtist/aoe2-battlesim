import { describe, it, expect } from 'vitest';
import { Unit, CombatSim } from '../../src/sim_v2.js';

// Real armor class IDs (from extracted_data/armor_classes.json)
// 3 = Base Pierce, 4 = Base Melee, 8 = Cavalry, 1 = Infantry, 27 = Spearmen

// Representative melee infantry vs cavalry scenario.
// Halberdier-like: base melee (cl4=10), cavalry bonus (cl8=32), spearmen armor (cl27=0)
// Cavalier-like: base melee armor (cl4=5), cavalry armor (cl8=0)
const HALB_ATTACKS = { '4': 10, '8': 32, '5': 28, '27': 0, '1': 0 };
const CAVALIER_ARMORS = { '4': 5, '3': 6, '8': 0 };

function makeUnit(overrides) {
  return new Unit({
    name: 'Test', count: 10, hp: 100,
    matk: 0, patk: 0, marm: 0, parm: 0,
    range: 0, attacks: {}, armors: {},
    f: 0, w: 0, g: 100,
    ...overrides,
  });
}

function sim(aData, bData) {
  const cfg = { engagement: 100, targetMicro: 0 };
  return new CombatSim(
    { count: 10, hp: 100, f: 0, w: 0, g: 100, ...aData },
    { count: 10, hp: 100, f: 0, w: 0, g: 100, ...bData },
    cfg, cfg,
  );
}

// ── calculateDamage ────────────────────────────────────────────────────────────

describe('CombatSim.calculateDamage (armor-class formula)', () => {
  it('sums matched class pairs — Halberdier vs Cavalier', () => {
    const halb = makeUnit({ range: 0, attacks: HALB_ATTACKS, armors: { '4': 3, '3': 4 } });
    const cav  = makeUnit({ range: 0, attacks: { '4': 12 }, armors: CAVALIER_ARMORS });
    const s = sim(
      { range: 0, attacks: HALB_ATTACKS, armors: { '4': 3, '3': 4 } },
      { range: 0, attacks: { '4': 12 }, armors: CAVALIER_ARMORS },
    );
    const dmg = s.calculateDamage(halb, cav);
    // cl4: 10-5=5, cl8: 32-0=32, cl5: cav has no cl5 → skip, cl27: cav has no cl27 → skip
    // cl1: cav has no cl1 → skip
    // total = 37
    expect(dmg).toBe(37);
  });

  it('class contributions can be negative (reduces total)', () => {
    // Unit with a -3 penalty on class 39 (Mounted Archers)
    const atk = makeUnit({ range: 0, attacks: { '4': 10, '39': -3 }, armors: {} });
    const def = makeUnit({ range: 0, attacks: {}, armors: { '4': 2, '39': 0 } });
    const s = sim(
      { range: 0, attacks: { '4': 10, '39': -3 }, armors: {} },
      { range: 0, attacks: {}, armors: { '4': 2, '39': 0 } },
    );
    const dmg = s.calculateDamage(atk, def);
    // cl4: 10-2=8, cl39: -3-0=-3 → total = 5
    expect(dmg).toBe(5);
  });

  it('total is floored at 1 when armor exceeds attack on all classes', () => {
    const atk = makeUnit({ range: 0, attacks: { '4': 2 }, armors: {} });
    const def = makeUnit({ range: 0, attacks: {}, armors: { '4': 10 } });
    const s = sim(
      { range: 0, attacks: { '4': 2 }, armors: {} },
      { range: 0, attacks: {}, armors: { '4': 10 } },
    );
    expect(s.calculateDamage(atk, def)).toBe(1);
  });

  it('unmatched attacker classes are ignored', () => {
    // attacker has cavalry bonus (cl8=20) but defender has no cavalry armor class
    const atk = makeUnit({ range: 0, attacks: { '4': 6, '8': 20 }, armors: {} });
    const def = makeUnit({ range: 0, attacks: {}, armors: { '4': 2 } }); // no cl8
    const s = sim(
      { range: 0, attacks: { '4': 6, '8': 20 }, armors: {} },
      { range: 0, attacks: {}, armors: { '4': 2 } },
    );
    // cl4: 6-2=4, cl8: defender has no cl8 → skip
    expect(s.calculateDamage(atk, def)).toBe(4);
  });

  it('legacy fallback (no attacks dict) uses matk/patk + bonusAtk', () => {
    const atk = makeUnit({ range: 0, matk: 8, marm: 0, attacks: {}, bonusAtk: 4, bonusReduct: 0 });
    const def = makeUnit({ range: 0, marm: 2, parm: 2, armors: {} });
    const s = sim(
      { range: 0, matk: 8, marm: 0, attacks: {}, bonusAtk: 4, bonusReduct: 0 },
      { range: 0, marm: 2, armors: {} },
    );
    const dmg = s.calculateDamage(atk, def);
    // base: max(0, 8-2)=6; bonus: 4*(1-0)=4 → total = 10
    expect(dmg).toBe(10);
  });
});

// ── run() ─────────────────────────────────────────────────────────────────────

describe('CombatSim.run() with armor-class units', () => {
  const CHAMPION = {
    name: 'Champion', count: 10, hp: 70,
    matk: 18, patk: 0, marm: 4, parm: 6, range: 0, reload: 2.0,
    attacks: { '4': 18, '29': 8, '21': 6, '8': 0, '30': 0, '15': 0 },
    armors: { '1': 0, '4': 4, '3': 6, '31': 0 },
    cost: { food: 50, wood: 0, gold: 20 },
  };
  const HALB = {
    name: 'Halberdier', count: 10, hp: 60,
    matk: 10, patk: 0, marm: 3, parm: 4, range: 0, reload: 3.0,
    attacks: { '8': 32, '5': 28, '4': 10, '29': 1, '21': 3, '15': 0 },
    armors: { '1': 0, '4': 3, '3': 4 },
    cost: { food: 35, wood: 25, gold: 0 },
  };

  it('run() returns armyA, armyB, history, duration', () => {
    const cfg = { engagement: 100, targetMicro: 0 };
    const result = new CombatSim(CHAMPION, HALB, cfg, cfg).run();
    expect(result).toHaveProperty('armyA');
    expect(result).toHaveProperty('armyB');
    expect(result).toHaveProperty('history');
    expect(result).toHaveProperty('duration');
  });

  it('at least one side reaches 0 at the end', () => {
    const cfg = { engagement: 100, targetMicro: 0 };
    const { armyA, armyB } = new CombatSim(CHAMPION, HALB, cfg, cfg).run();
    expect(armyA.remaining === 0 || armyB.remaining === 0).toBe(true);
  });

  it('history starts at time 0', () => {
    const cfg = { engagement: 100, targetMicro: 0 };
    const { history } = new CombatSim(CHAMPION, HALB, cfg, cfg).run();
    expect(history[0].time).toBe(0);
  });
});

// ── Trample damage ─────────────────────────────────────────────────────────────

describe('CombatSim trample damage (blastLevel=2, 0 < blastDamage < 1)', () => {
  function makeTrampleSim(aOverrides = {}, bOverrides = {}) {
    const cfg = { engagement: 100, targetMicro: 0 };
    const baseA = { count: 10, hp: 100, f: 0, w: 0, g: 100, attacks: { '4': 10 }, armors: { '4': 0 }, range: 0 };
    const baseB = { count: 100, hp: 10, f: 0, w: 0, g: 100, attacks: { '4': 1 }, armors: { '4': 0 }, range: 0 };
    return new CombatSim({ ...baseA, ...aOverrides }, { ...baseB, ...bOverrides }, cfg, cfg);
  }

  it('Unit constructor reads blastDamage, blastWidth, blastLevel', () => {
    const u = makeUnit({ blastDamage: 0.5, blastWidth: 0.5, blastLevel: 2 });
    expect(u.blastDamage).toBe(0.5);
    expect(u.blastWidth).toBe(0.5);
    expect(u.blastLevel).toBe(2);
  });

  it('Unit constructor defaults blast fields to 0 when absent', () => {
    const u = makeUnit({});
    expect(u.blastDamage).toBe(0);
    expect(u.blastWidth).toBe(0);
    expect(u.blastLevel).toBe(0);
  });

  it('trample attacker kills enemy faster — battle ends sooner', () => {
    const noTrample  = makeTrampleSim();
    const withTrample = makeTrampleSim({ blastDamage: 0.5, blastWidth: 0.5, blastLevel: 2 });
    const { duration: normDur }  = noTrample.run();
    const { duration: trmpDur }  = withTrample.run();
    // Trample deals extra AoE damage, so B dies sooner
    expect(trmpDur).toBeLessThan(normDur);
  });

  it('blastDamage=1 (full splash, e.g. Onager) ends battle faster than blastDamage=0', () => {
    const noTrample  = makeTrampleSim();
    const fullSplash = makeTrampleSim({ blastDamage: 1, blastWidth: 1, blastLevel: 2 });
    const { duration: normDur }   = noTrample.run();
    const { duration: splashDur } = fullSplash.run();
    expect(splashDur).toBeLessThan(normDur);
  });

  it('trample has no effect on side that has no blast fields', () => {
    // side B has no trample; the A-side trample should not affect A
    const s = makeTrampleSim({ blastDamage: 0.5, blastWidth: 0.5, blastLevel: 2 });
    const { armyA } = s.run();
    // army A has stronger attack + trample; armyA should still have survivors
    expect(armyA.remaining).toBeGreaterThan(0);
  });
});

// ── Accuracy modelling ────────────────────────────────────────────────────────

describe('CombatSim accuracy modelling (options.accuracy: true)', () => {
  function makeAccuracySim(accuracy, options = {}) {
    const cfg = { engagement: 100, targetMicro: 0 };
    const ranged = {
      count: 10, hp: 50, f: 0, w: 0, g: 100, reload: 2,
      range: 5, attacks: { '3': 6 }, armors: { '3': 0 },
      accuracy,
    };
    const target = {
      count: 10, hp: 50, f: 0, w: 0, g: 100, reload: 5,
      range: 0, attacks: { '4': 1 }, armors: { '3': 0 },
      accuracy: 100,
    };
    return new CombatSim(ranged, target, cfg, cfg, options);
  }

  it('Unit constructor reads accuracy field', () => {
    const u = makeUnit({ accuracy: 80 });
    expect(u.accuracy).toBe(80);
  });

  it('Unit constructor defaults accuracy to 100 when absent', () => {
    const u = makeUnit({});
    expect(u.accuracy).toBe(100);
  });

  it('100% accuracy with flag enabled produces same result as no flag', () => {
    const withFlag    = makeAccuracySim(100, { accuracy: true });
    const withoutFlag = makeAccuracySim(100, {});
    const { duration: durWith }    = withFlag.run();
    const { duration: durWithout } = withoutFlag.run();
    expect(durWith).toBe(durWithout);
  });

  it('lower accuracy causes ranged units to deal less total damage (battle ends later)', () => {
    const full   = makeAccuracySim(100, { accuracy: true });
    const half   = makeAccuracySim(50,  { accuracy: true });
    const { duration: fullDur } = full.run();
    const { duration: halfDur } = half.run();
    expect(halfDur).toBeGreaterThan(fullDur);
  });

  it('accuracy flag has no effect on melee units (range <= 1)', () => {
    const cfg = { engagement: 100, targetMicro: 0 };
    const melee = {
      count: 10, hp: 50, f: 0, w: 0, g: 100, reload: 2,
      range: 0, attacks: { '4': 6 }, armors: { '4': 0 },
      accuracy: 50,
    };
    const target = {
      count: 10, hp: 50, f: 0, w: 0, g: 100, reload: 5,
      range: 0, attacks: { '4': 1 }, armors: { '4': 0 },
      accuracy: 100,
    };
    const withFlag    = new CombatSim(melee, target, cfg, cfg, { accuracy: true });
    const withoutFlag = new CombatSim(melee, target, cfg, cfg, {});
    const { duration: durWith }    = withFlag.run();
    const { duration: durWithout } = withoutFlag.run();
    expect(durWith).toBe(durWithout);
  });
});

// ── Unit constructor — count default ──────────────────────────────────────────

describe('Unit constructor — count default', () => {
  it('defaults initialCount to 1 when count is absent', () => {
    const u = new Unit({ name: 'X', hp: 100, range: 0, reload: 2, attacks: {}, armors: {} });
    expect(u.initialCount).toBe(1);
    expect(u.currentCount).toBe(1);
  });

  it('respects an explicit count of 1', () => {
    const u = makeUnit({ count: 1 });
    expect(u.initialCount).toBe(1);
  });

  it('respects an explicit count > 1', () => {
    const u = makeUnit({ count: 5 });
    expect(u.initialCount).toBe(5);
  });

  it('CombatSim.run() without count specified produces a real fight (not instant draw)', () => {
    const cfg = { engagement: 100, targetMicro: 0 };
    const unit = { name: 'X', hp: 100, range: 0, reload: 2, attacks: { '4': 10 }, armors: { '4': 2 } };
    const { armyA, armyB, duration } = new CombatSim(unit, unit, cfg, cfg).run();
    // Both armies start at 1 unit — one must die; duration must be > 0
    expect(armyA.remaining === 0 || armyB.remaining === 0).toBe(true);
    expect(duration).toBeGreaterThan(0);
  });
});

// ── Unit getParsedCost() with cost object ─────────────────────────────────────

describe('Unit.getParsedCost() with cost object', () => {
  it('reads food/wood/gold from cost object', () => {
    const u = new Unit({
      name: 'X', count: 1, hp: 10, range: 0, reload: 2,
      attacks: {}, armors: {},
      cost: { food: 40, wood: 20, gold: 30 },
    });
    const c = u.getParsedCost();
    expect(c.f).toBe(40);
    expect(c.w).toBe(20);
    expect(c.g).toBe(30);
    expect(c.total).toBe(90);
  });

  it('falls back to legacy f/w/g fields', () => {
    const u = new Unit({
      name: 'X', count: 1, hp: 10, range: 0, reload: 2,
      attacks: {}, armors: {},
      f: 25, w: 10, g: 45,
    });
    expect(u.getParsedCost().total).toBe(80);
  });
});
