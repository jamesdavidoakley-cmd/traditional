// Entity factories and the small helpers that read them.

import { getUnit } from '../data/units.js';
import { getBuilding } from '../data/buildings.js';
import { DOMAIN } from '../core/terrain.js';

export const NEUTRAL_TYPES = {
  derrick:   { name: 'Oil Derrick', income: 9, hp: 900, size: 2, radius: 1.4, captureTime: 6.5 },
  refinery:  { name: 'Refinery', income: 15, hp: 1500, size: 3, radius: 2.0, captureTime: 9 },
  port:      { name: 'Port Facility', income: 12, hp: 1200, size: 3, radius: 1.9, captureTime: 8 },
  // Every base starts with one of these just outside its perimeter, already its
  // own. A modest, guaranteed income so losing the race for the open oil does
  // not leave a commander with nothing but the headquarters budget.
  fieldrefinery: { name: 'Field Refinery', income: 7, hp: 1000, size: 2, radius: 1.6, captureTime: 7 },
  // The richest capturable site in the game, and the hardest to keep: the yards
  // sit in the contested middle of the European map rather than beside a base.
  railyard:  { name: 'Marshalling Yard', income: 22, hp: 1700, size: 3, radius: 2.0, captureTime: 11 },
  objective: { name: 'Strategic Objective', income: 0, hp: 600, size: 2, radius: 1.3, captureTime: 5, bounty: 900 },
};

export function unitRadius(def) {
  if (def.class === 'infantry') return 0.36;
  if (def.class === 'naval') return 0.85;
  return 0.46;
}

export function makeUnit(world, owner, faction, era, key, x, y, facing = 0) {
  const def = getUnit(faction, era, key);
  if (!def) return null;
  const u = {
    kind: 'unit', key, def, owner, x, y,
    hp: def.hp, hpMax: def.hp,
    ammo: def.ammoMax, ammoMax: def.ammoMax,
    facing, turret: facing,
    mobility: 1, weaponHealth: 1,
    order: { type: 'idle' },
    path: null, pathIdx: 0, repath: 0, stuck: 0,
    target: null, fireCd: 0, burstLeft: 0, burstCd: 0, burstWeapon: null,
    vision: def.vision, radius: unitRadius(def),
    domain: def.domain === 'naval' ? DOMAIN.NAVAL : DOMAIN.LAND,
    heavy: !!def.heavy,
    cargo: [], loaded: false, transport: null,
    selected: false, ctrlGroups: 0,
    lastDamageAt: -999, lastFireAt: -999, spawnAt: 0,
    resupplyCd: 0, scootUntil: 0, aiRole: null, aiGroup: null,
    vx: 0, vy: 0, moving: false, recoil: 0,
  };
  return world.register(u);
}

export function makeBuilding(world, owner, faction, era, key, padCx, padCy, opts = {}) {
  const def = getBuilding(key, faction, era);
  if (!def) return null;
  const size = def.size;
  const tx = padCx - (size >> 1), ty = padCy - (size >> 1);
  const b = {
    kind: 'building', key, def, owner,
    tx, ty, size, x: tx + size / 2, y: ty + size / 2,
    radius: size / 2,
    hp: opts.instant ? def.hp : Math.max(1, Math.round(def.hp * 0.12)),
    hpMax: def.hp,
    state: opts.instant ? 'active' : 'constructing',
    progress: opts.instant ? 1 : 0,
    buildTime: def.buildTime,
    padId: opts.padId !== undefined ? opts.padId : -1,
    powered: true, online: true, dataOk: true,
    queue: [], produceProgress: 0, produceTotal: 0,
    rally: null,
    ammo: def.ammoMax || 0, ammoMax: def.ammoMax || 0,
    fireCd: 0, interceptCd: 0, target: null, turret: 0,
    selected: false, lastDamageAt: -999, sold: false,
    smokeCd: 0,
  };
  return world.register(b);
}

export function makeNeutral(world, type, x, y, id) {
  const t = NEUTRAL_TYPES[type];
  const b = {
    kind: 'neutral', type, def: t, owner: -1, siteId: id,
    x: x + 0.5, y: y + 0.5, tx: x, ty: y, size: t.size, radius: t.radius,
    hp: t.hp, hpMax: t.hp,
    captureProgress: 0, capturingBy: -1,
    disabled: 0, income: t.income,
    lastDamageAt: -999, cooldown: 0,
  };
  return world.register(b);
}

// ---------------------------------------------------------------- accessors
export function isAlive(e) { return e && !e.dead && e.hp > 0; }

export function armourOf(e) {
  if (e.kind === 'building' || e.kind === 'neutral') return 'structure';
  return e.def.armour;
}

export function displayName(e) {
  if (e.kind === 'neutral') return e.def.name;
  return e.def.name;
}

export function canAttack(u) {
  return u.def.weapons && u.def.weapons.length > 0;
}

/** Effective movement speed after terrain, mobility damage and roads. */
export function effectiveSpeed(world, u) {
  const f = world.speedFactor(u.x, u.y, u.domain, u.heavy);
  if (f === 0) return 0;
  return u.def.speed * f * (0.34 + 0.66 * u.mobility);
}

/** Effective reload time after weapon damage. */
export function effectiveRof(u, w) {
  return w.rof / (0.42 + 0.58 * u.weaponHealth);
}

export function effectiveAccuracy(u, w) {
  return w.accuracy * (0.55 + 0.45 * u.weaponHealth);
}
