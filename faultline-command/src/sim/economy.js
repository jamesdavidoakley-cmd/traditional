// Infrastructure: power, data links, ammunition manufacture, income, construction
// and production. This is where "buildings have meaningful dependencies" lives.

import { clamp, dist } from '../core/util.js';
import { getBuilding } from '../data/buildings.js';
import { getUnit } from '../data/units.js';
import { makeUnit } from './entities.js';
import { issueOrder } from './movement.js';

export const PRODUCTION_MIN = 0.30;   // worst-case production rate in a brown-out
export const POWER_ONLINE_AT = 0.85;  // ratio below which powered systems shut down
export const BASE_OIL_CAPACITY = 2;   // sites you can run with no oil administration
export const OIL_PER_ADMIN = 4;       // extra sites each Oil Administration Facility runs
export const OVERFLOW_YIELD = 0.42;   // yield from sites beyond that capacity

/** Recompute a player's whole infrastructure picture. Cheap enough to run at 4 Hz. */
export function recomputeInfrastructure(game, p) {
  let supply = 0, demand = 0;
  let dataCap = 0, dataUse = 0;
  let hasData = false, hasRadar = false;
  let ammoRate = 0, ammoCap = 70;
  let baseIncome = 0, oilBonus = 0, oilAdminCount = 0;

  const prevData = p.dataOnline;
  const prevLow = p.lowPower;

  for (const b of p.buildings) {
    if (b.dead || b.state !== 'active') continue;
    const d = b.def;
    const health = clamp(b.hp / b.hpMax, 0.25, 1);
    if (d.power > 0) supply += d.power * (0.5 + 0.5 * health);
    else demand += -d.power;
  }
  p.powerSupply = Math.round(supply);
  p.powerDemand = Math.round(demand);
  p.powerRatio = demand > 0 ? clamp(supply / demand, 0, 1) : 1;
  p.lowPower = supply + 0.5 < demand;
  p.productionRate = clamp(PRODUCTION_MIN + (1 - PRODUCTION_MIN) * p.powerRatio, PRODUCTION_MIN, 1);

  for (const b of p.buildings) {
    if (b.dead) continue;
    b.online = b.state === 'active' && (!b.def.needsPower || p.powerRatio >= POWER_ONLINE_AT);
    b.powered = !b.def.needsPower || p.powerRatio >= POWER_ONLINE_AT;
    if (b.state !== 'active') continue;
    const d = b.def;
    if (d.dataLinks && b.online) { dataCap += d.dataLinks; hasData = true; }
    if (d.dataUse) dataUse += d.dataUse;
    if (d.providesRadar && b.online) hasRadar = true;
    if (d.ammoRate && b.online) { ammoRate += d.ammoRate; ammoCap += 45; }
    if (d.baseIncome) baseIncome += d.baseIncome;
    if (d.oilBonus) { oilBonus += d.oilBonus; oilAdminCount++; }
  }

  p.dataCapacity = dataCap;
  p.dataUsed = dataUse;
  p.radarOnline = hasRadar;
  p.dataOnline = hasData && dataUse <= dataCap;
  p.ammoRate = ammoRate * p.productionRate;
  p.ammoMax = ammoCap;
  p.baseIncome = baseIncome;
  p.oilBonus = Math.min(0.9, oilBonus);

  // Oil administration capacity. Sites beyond what your administration can handle
  // still produce, but at a fraction of their rate — so seizing the whole map is
  // worth much less than seizing what you can actually run.
  const held = game.world.neutrals.filter((n) => n.owner === p.index && n.disabled <= 0);
  held.sort((a, b) => b.income - a.income);
  const capacity = BASE_OIL_CAPACITY + OIL_PER_ADMIN * oilAdminCount;
  let oilIncome = 0;
  held.forEach((n, i) => {
    oilIncome += i < capacity ? n.income * (1 + p.oilBonus) : n.income * OVERFLOW_YIELD;
  });
  p.oilIncome = oilIncome;
  p.oilSites = held.length;
  p.oilCapacity = capacity;
  p.income = (p.baseIncome + p.oilIncome) * p.incomeMultiplier;

  if (p.isHuman) {
    if (p.lowPower && !prevLow) game.alerts.push({ type: 'lowPower', at: game.time });
    if (!p.dataOnline && prevData) game.alerts.push({ type: 'dataLost', at: game.time });
  }
}

export function updateEconomy(game, dt) {
  for (const p of game.players) {
    if (!p.alive) continue;
    p.credits += p.income * dt;
    p.ammoStock = clamp(p.ammoStock + p.ammoRate * dt, 0, p.ammoMax);
    p.creditsEarned += p.income * dt;
  }
}

// ------------------------------------------------------------- resupply
const RESUPPLY_RADIUS = 12;

/** Units near friendly infrastructure draw replacement rounds from the stockpile. */
export function updateResupply(game, dt) {
  for (const u of game.world.units) {
    if (u.dead || u.loaded || u.ammoMax <= 0 || u.ammo >= u.ammoMax) continue;
    u.resupplyCd -= dt;
    if (u.resupplyCd > 0) continue;
    u.resupplyCd = 0.6;
    const p = game.players[u.owner];
    if (!p || p.ammoStock <= 0.5) continue;

    let rate = 0;
    const blds = game.world.buildingsNear(u.x, u.y, RESUPPLY_RADIUS, []);
    for (const b of blds) {
      if (b.dead || b.owner !== u.owner || b.kind !== 'building' || b.state !== 'active') continue;
      const d = dist(u.x, u.y, b.x, b.y);
      if (b.def.rearmRate && d <= (b.def.repairRadius || 6)) rate = Math.max(rate, b.def.rearmRate);
      else if (d <= RESUPPLY_RADIUS) rate = Math.max(rate, 1.2);
    }
    if (rate <= 0) continue;
    const amt = Math.min(rate * 0.7, u.ammoMax - u.ammo, p.ammoStock);
    u.ammo += amt;
    p.ammoStock -= amt;
  }
  // Defensive emplacements top themselves up from the same stockpile.
  for (const b of game.world.buildings) {
    if (b.dead || b.ammoMax <= 0 || b.ammo >= b.ammoMax || b.state !== 'active') continue;
    const p = game.players[b.owner];
    if (!p || p.ammoStock <= 0.5) continue;
    const amt = Math.min(1.1 * dt, b.ammoMax - b.ammo, p.ammoStock);
    b.ammo += amt; p.ammoStock -= amt;
  }
}

// ---------------------------------------------------------- repair depots
export function updateDepots(game, dt) {
  for (const b of game.world.buildings) {
    if (b.dead || b.state !== 'active' || !b.def.repairRate || !b.online) continue;
    const list = game.world.unitsNear(b.x, b.y, b.def.repairRadius, []);
    for (const u of list) {
      if (u.dead || u.owner !== b.owner || u.def.class === 'infantry') continue;
      if (u.hp < u.hpMax) { u.hp = Math.min(u.hpMax, u.hp + b.def.repairRate * dt); game.fx.repairSpark(u.x, u.y); }
      if (u.mobility < 1) u.mobility = Math.min(1, u.mobility + 0.09 * dt);
      if (u.weaponHealth < 1) u.weaponHealth = Math.min(1, u.weaponHealth + 0.09 * dt);
    }
  }
}

// ------------------------------------------------------------ construction
export function canAfford(p, cost) { return p.credits >= cost; }

export function prereqsMet(game, p, key) {
  const def = getBuilding(key, p.faction, p.era);
  if (!def) return false;
  for (const req of def.prereq) {
    if (!p.buildings.some((b) => !b.dead && b.key === req && b.state === 'active')) return false;
  }
  if (def.limit && p.buildings.filter((b) => !b.dead && b.key === key).length >= def.limit) return false;
  return true;
}

export function structureBlockReason(game, p, key) {
  const def = getBuilding(key, p.faction, p.era);
  if (!def) return 'Unavailable';
  for (const req of def.prereq) {
    if (!p.buildings.some((b) => !b.dead && b.key === req && b.state === 'active')) {
      return 'Requires ' + getBuilding(req, p.faction, p.era).name;
    }
  }
  if (def.limit && p.buildings.filter((b) => !b.dead && b.key === key).length >= def.limit) return 'Limit reached';
  if (p.credits < def.cost) return 'Insufficient funds';
  if (p.construction.length >= p.maxConcurrent) return 'Construction bay busy';
  return null;
}

export function updateConstruction(game, dt) {
  for (const p of game.players) {
    if (!p.alive) continue;
    for (const b of p.construction.slice()) {
      if (b.dead) { p.construction.splice(p.construction.indexOf(b), 1); continue; }
      const rate = (1 / b.buildTime) * p.productionRate * p.buildSpeed;
      b.progress = clamp(b.progress + rate * dt, 0, 1);
      b.hp = Math.max(b.hp, b.hpMax * (0.12 + 0.88 * b.progress));
      if (b.progress >= 1) {
        b.state = 'active';
        b.hp = b.hpMax;
        p.construction.splice(p.construction.indexOf(b), 1);
        game.onBuildingComplete(b);
      }
    }
  }
}

// -------------------------------------------------------------- production
export function queueUnit(game, p, building, key) {
  const def = getUnit(p.faction, p.era, key);
  if (!def) return false;
  if (p.credits < def.cost) return false;
  if (building.queue.length >= 8) return false;
  p.credits -= def.cost;
  building.queue.push({ key, paid: def.cost });
  return true;
}

export function cancelUnit(game, p, building, index) {
  const item = building.queue[index === undefined ? building.queue.length - 1 : index];
  if (!item) return;
  p.credits += item.paid * (index === 0 ? (1 - building.produceProgress) : 1);
  building.queue.splice(index === undefined ? building.queue.length - 1 : index, 1);
  if (index === 0 || index === undefined) building.produceProgress = 0;
}

export function updateProduction(game, dt) {
  for (const b of game.world.buildings) {
    if (b.dead || b.state !== 'active' || b.queue.length === 0) continue;
    const p = game.players[b.owner];
    if (!p || !p.alive) continue;
    const item = b.queue[0];
    const def = getUnit(p.faction, p.era, item.key);
    if (!def) { b.queue.shift(); continue; }
    b.produceTotal = def.buildTime;
    const rate = (1 / def.buildTime) * p.productionRate * p.buildSpeed;
    b.produceProgress += rate * dt;
    if (b.produceProgress >= 1) {
      b.produceProgress = 0;
      b.queue.shift();
      spawnFromBuilding(game, p, b, item.key);
    }
  }
}

export function spawnFromBuilding(game, p, b, key) {
  const world = game.world;
  const def = getUnit(p.faction, p.era, key);
  const naval = def.domain === 'naval';
  let sx = null, sy = null;
  for (let r = b.size * 0.6 + 0.8; r < b.size + 8 && sx === null; r += 0.8) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2 + b.spawnAngle || 0;
      const nx = b.x + Math.cos(ang) * r, ny = b.y + Math.sin(ang) * r;
      if (world.passable(nx, ny, naval ? 'naval' : 'land', def.heavy)) { sx = nx; sy = ny; break; }
    }
  }
  if (sx === null) { sx = b.x; sy = b.y + b.size * 0.7; }
  const u = makeUnit(world, p.index, p.faction, p.era, key, sx, sy, Math.PI / 2);
  if (!u) return null;
  u.spawnAt = game.time;
  p.units.push(u);
  const rally = b.rally;
  if (rally) issueOrder(game, u, { type: 'move', x: rally.x, y: rally.y });
  else issueOrder(game, u, { type: 'guard', x: sx, y: sy });
  game.onUnitProduced(u, b);
  return u;
}

/** Which of this player's buildings can produce the given unit key. */
export function producersFor(p, key) {
  return p.buildings.filter((b) => !b.dead && b.state === 'active' && b.def.produces && b.def.produces.includes(key));
}

export function unitAvailable(game, p, key) {
  const def = getUnit(p.faction, p.era, key);
  if (!def) return false;
  return producersFor(p, key).length > 0;
}

export function unitBlockReason(game, p, key) {
  const def = getUnit(p.faction, p.era, key);
  if (!def) return 'Not fielded by this coalition';
  if (producersFor(p, key).length === 0) {
    const src = { rifle: 'Barracks', at: 'Barracks', engineer: 'Barracks', recon: 'Barracks', manpads: 'Barracks', sf: 'Barracks' }[key]
      || (def.class === 'naval' ? 'Naval Yard' : (def.role === 'artillery' || def.role === 'rocketArtillery' ? 'Artillery & Munitions Complex' : 'Armoured Vehicle Factory'));
    return 'Requires ' + src;
  }
  if (p.credits < def.cost) return 'Insufficient funds';
  return null;
}
