class Unit {
  constructor(data) {
    this.name = data.name || 'Unit';
    this.initialCount = parseFloat(data.count) || 0;
    this.currentCount = this.initialCount;
    this.hpPerUnit = parseFloat(data.hp) || 1;
    this.currentUnitHp = this.hpPerUnit;
    this.matk = parseFloat(data.matk) || 0;
    this.patk = parseFloat(data.patk) || 0;
    this.marm = parseFloat(data.marm) || 0;
    this.parm = parseFloat(data.parm) || 0;
    this.reloadBase = parseFloat(data.reload) || 2.0;
    this.range = parseFloat(data.range) || 0;
    this.bonusAtk = parseFloat(data.bonusAtk) || 0;
    this.bonusReduction = (parseFloat(data.bonusReduct) || 0) / 100;
    this.atkSpeedBonus = (parseFloat(data.atkSpeed) || 0) / 100;
    this.reload = this.reloadBase / (1 + this.atkSpeedBonus);
    this.attackCooldown = 0;
    this.trainTime = parseFloat(data.trainTime) || 30;
    this.buildings = parseFloat(data.buildings) || 1;
    this.startDelay = parseFloat(data.delay) || 0;
    this.techDelay = parseFloat(data.techDelay) || 0;
    this.unitsBefore = parseFloat(data.unitsBefore) || 0;
    this.baseF = parseFloat(data.f) || 0;
    this.baseW = parseFloat(data.w) || 0;
    this.baseG = parseFloat(data.g) || 0;
    this.discAll = (parseFloat(data.discAll) || 0) / 100;
    this.discF = (parseFloat(data.discF) || 0) / 100;
    this.discW = (parseFloat(data.discW) || 0) / 100;
    this.discG = (parseFloat(data.discG) || 0) / 100;
  }
  isMelee() {
    return this.range <= 1;
  }
  getTotalHp() {
    return Math.max(0, (this.currentCount - 1) * this.hpPerUnit + this.currentUnitHp);
  }
  getParsedCost() {
    const m = 1 - this.discAll;
    const f = this.baseF * (1 - this.discF) * m,
      w = this.baseW * (1 - this.discW) * m,
      g = this.baseG * (1 - this.discG) * m;
    return { f, w, g, total: f + w + g };
  }
}

class CombatSim {
  constructor(dataA, dataB, configA, configB, simConfig = {}) {
    this.dataA = dataA;
    this.dataB = dataB;
    this.configA = configA;
    this.configB = configB;
    this.time = 0;
    this.tick = 0.05;
    if (simConfig && simConfig.tick)        this.tick = simConfig.tick;
    if (simConfig && simConfig.maxDuration) this.maxDuration = simConfig.maxDuration;
    this.history = [];
  }
  calculateDamage(attacker, defender) {
    const isMelee = attacker.isMelee();
    const armor = isMelee ? defender.marm : defender.parm;
    const atk = isMelee ? attacker.matk : attacker.patk;
    return Math.max(1, atk - armor) + attacker.bonusAtk * (1 - defender.bonusReduction);
  }
  run() {
    const subA = new Unit({ ...this.dataA }),
      subB = new Unit({ ...this.dataB });
    const costA = subA.getParsedCost().total,
      costB = subB.getParsedCost().total;
    const initialValA = this.dataA.count * costA,
      initialValB = this.dataB.count * costB;
    const record = () => {
      const hpPctA = subA.getTotalHp() / (this.dataA.count * subA.hpPerUnit) || 0;
      const hpPctB = subB.getTotalHp() / (this.dataB.count * subB.hpPerUnit) || 0;
      this.history.push({
        time: this.time,
        countA: subA.currentCount,
        countB: subB.currentCount,
        hpA: subA.getTotalHp(),
        hpB: subB.getTotalHp(),
        valRemainingA: hpPctA * initialValA,
        valRemainingB: hpPctB * initialValB,
        valLostA: initialValA - hpPctA * initialValA,
        valLostB: initialValB - hpPctB * initialValB,
      });
    };
    record();
    while (subA.currentCount > 0 && subB.currentCount > 0 && this.time < (this.maxDuration || 300)) {
      const prevA = Math.ceil(subA.currentCount),
        prevB = Math.ceil(subB.currentCount);
      if (subA.attackCooldown <= 0) {
        const eff = Math.min(subA.currentCount, Math.max(1, subA.initialCount * (this.configA.engagement / 100)));
        this.applyDamage(subB, this.calculateDamage(subA, subB) * eff, this.configA.targetMicro);
        subA.attackCooldown = subA.reload;
      } else subA.attackCooldown -= this.tick;
      if (subB.attackCooldown <= 0) {
        const eff = Math.min(subB.currentCount, Math.max(1, subB.initialCount * (this.configB.engagement / 100)));
        this.applyDamage(subA, this.calculateDamage(subB, subA) * eff, this.configB.targetMicro);
        subB.attackCooldown = subB.reload;
      } else subB.attackCooldown -= this.tick;
      this.time += this.tick;
      if (
        Math.ceil(subA.currentCount) !== prevA ||
        Math.ceil(subB.currentCount) !== prevB ||
        Math.round(this.time * 100) % 25 === 0
      )
        record();
    }
    record();
    return {
      armyA: {
        remaining: subA.currentCount,
        totalHp: subA.getTotalHp(),
        initialTotalHp: this.dataA.count * subA.hpPerUnit,
      },
      armyB: {
        remaining: subB.currentCount,
        totalHp: subB.getTotalHp(),
        initialTotalHp: this.dataB.count * subB.hpPerUnit,
      },
      history: this.history,
      duration: this.time,
    };
  }
  applyDamage(unit, totalDmg, micro) {
    const poolHp = unit.getTotalHp();
    let effectiveDmg = totalDmg;
    if (micro !== 0) {
      const dmgPerChunk = totalDmg / micro;
      effectiveDmg = 0;
      const groups = Math.min(micro, Math.ceil(unit.currentCount));
      effectiveDmg += Math.min(unit.currentUnitHp, dmgPerChunk);
      if (groups > 1) effectiveDmg += (groups - 1) * Math.min(unit.hpPerUnit, dmgPerChunk);
    }
    const newPool = Math.max(0, poolHp - effectiveDmg);
    unit.currentCount = Math.ceil(newPool / unit.hpPerUnit);
    unit.currentUnitHp = newPool % unit.hpPerUnit || (unit.currentCount > 0 ? unit.hpPerUnit : 0);
  }
}

function calculateCount(t, start, tech, train, build, pre) {
  if (t < start) return 0;
  const tPerU = train / build;
  const timeToPre = start + pre * tPerU;
  if (t <= timeToPre) return Math.floor((t - start) / tPerU);
  if (t < timeToPre + tech) return pre;
  return pre + Math.floor((t - (timeToPre + tech)) / tPerU);
}

export { Unit, CombatSim, calculateCount };
