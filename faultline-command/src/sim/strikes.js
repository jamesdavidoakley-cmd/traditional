// Theatre fires: launching signature strikes, flying them in visibly, and the
// loitering munitions that hunt for their own targets once they arrive.

import { clamp, dist, TAU } from '../core/util.js';
import { ABILITIES, abilityName } from '../data/abilities.js';
import { THREAT } from '../data/damage.js';
import { PROJ_SPEED } from './combat.js';

export function abilityState(game, p, key) {
  const a = ABILITIES[key];
  if (!a) return { ok: false, reason: 'Unavailable' };
  const st = p.abilities[key];
  if (!st) return { ok: false, reason: 'Unavailable' };
  if (st.cooldown > 0) return { ok: false, reason: 'Reloading', cooldown: st.cooldown };

  for (const req of a.requires.buildings || []) {
    const has = p.buildings.some((b) => !b.dead && b.key === req && b.state === 'active' && b.online);
    if (!has) return { ok: false, reason: 'Requires an operational ' + reqName(p, req) };
  }
  for (const req of a.requires.units || []) {
    const has = p.units.some((u) => !u.dead && u.key === req);
    if (!has) {
      const label = req === 'destroyer'
        ? (p.era === 'interwar' ? 'a capital ship at sea' : 'a missile destroyer at sea')
        : 'a ' + req;
      return { ok: false, reason: 'Requires ' + label };
    }
  }
  if (a.requires.power && p.lowPower) return { ok: false, reason: 'Insufficient power' };
  if (a.requires.data) {
    if (!p.dataOnline) return { ok: false, reason: 'Data link offline' };
    if (!p.radarOnline) return { ok: false, reason: 'Radar offline' };
  }
  if (a.requires.ammo && p.ammoStock < a.requires.ammo) return { ok: false, reason: 'Insufficient ammunition' };
  if (p.credits < a.cost) return { ok: false, reason: 'Insufficient funds' };
  return { ok: true };
}

function reqName(p, key) {
  const names = {
    awc: 'Advanced Weapons Command', radar: 'Radar Station', data: 'Data Centre',
    navalyard: 'Naval Yard', artillery: 'Artillery & Munitions Complex',
  };
  return names[key] || key;
}

/** Where an inbound strike enters the map, so the defender can see it coming. */
function entryPoint(game, p, tx, ty, approach) {
  const w = game.world;
  if (approach === 'launcher') {
    const ship = p.units.find((u) => !u.dead && u.key === 'destroyer');
    if (ship) return { x: ship.x, y: ship.y, from: ship };
  }
  const home = p.hq && !p.hq.dead ? p.hq : (p.buildings[0] || { x: w.width / 2, y: w.height / 2 });
  let dx = tx - home.x, dy = ty - home.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  // Run in along the launch bearing from over the horizon: far enough that the
  // defender sees it coming and can engage, close enough to still be a weapon.
  const RUN_IN = 44;
  let x = tx, y = ty;
  for (let i = 0; i < RUN_IN; i++) {
    const nx = x - dx, ny = y - dy;
    if (nx < 1 || ny < 1 || nx > w.width - 2 || ny > w.height - 2) break;
    x = nx; y = ny;
  }
  return { x: clamp(x, 0.5, w.width - 1.5), y: clamp(y, 0.5, w.height - 1.5), from: null };
}

export function useAbility(game, p, key, tx, ty) {
  const a = ABILITIES[key];
  const st = abilityState(game, p, key);
  if (!st.ok) return st;

  p.credits -= a.cost;
  p.ammoStock = Math.max(0, p.ammoStock - (a.requires.ammo || 0));
  p.abilities[key].cooldown = a.cooldown;
  p.abilities[key].usedAt = game.time;

  const entry = entryPoint(game, p, tx, ty, a.flight.approach);
  const count = a.payload.count || 0;

  if (a.payload.reveal) {
    game.reveals.push({
      owner: p.index, x: tx, y: ty, r: a.payload.reveal,
      until: game.time + (a.payload.revealTime || 20) + dist(entry.x, entry.y, tx, ty) / a.flight.speed,
      arriveAt: game.time + dist(entry.x, entry.y, tx, ty) / a.flight.speed,
    });
  }

  for (let i = 0; i < count; i++) {
    const spread = a.payload.spread || 0;
    const ang = game.rng() * TAU, r = game.rng() * spread;
    const px = clamp(tx + Math.cos(ang) * r, 1, game.world.width - 2);
    const py = clamp(ty + Math.sin(ang) * r, 1, game.world.height - 2);
    const delay = i * (a.payload.interval || 0.5);
    game.pending.push({
      at: game.time + delay,
      fn: () => launchOne(game, p, a, entry, px, py),
    });
  }
  if (count === 0 && a.payload.reveal) {
    // Unarmed reconnaissance drone: it still has to physically fly there.
    game.world.projectiles.push(makeStrike(game, p, a, entry, tx, ty, true));
  }

  game.alerts.push({ type: 'strikeLaunched', at: game.time, owner: p.index, key, x: tx, y: ty });
  game.onAbilityUsed(p, key, tx, ty);
  return { ok: true };
}

function makeStrike(game, p, a, entry, tx, ty, harmless) {
  const speed = a.flight.speed;
  return {
    kind: 'proj', type: a.threat, owner: p.index, srcId: -1,
    x: entry.x, y: entry.y, z: 5, sx: entry.x, sy: entry.y, tx, ty,
    target: null,
    damage: harmless ? 0 : a.payload.damage,
    damageType: a.payload.type || 'cruise',
    splash: harmless ? 0 : (a.payload.splash || 1.5),
    speed, threat: a.threat, interceptable: a.interceptable !== false && !!a.threat,
    arc: a.threat === THREAT.BALLISTIC ? 0 : 0,
    life: 0, maxLife: dist(entry.x, entry.y, tx, ty) / speed + 1.2,
    hit: true, engaged: null, trail: [],
    weapon: { evasive: a.flight.evasive || 0 },
    strikeKey: a.key, harmless: !!harmless,
    bunkerBuster: !!a.payload.bunkerBuster,
  };
}

function launchOne(game, p, a, entry, tx, ty) {
  if (a.payload.hunt) {
    game.world.projectiles.push(makeLoiterer(game, p, a, entry, tx, ty));
  } else {
    game.world.projectiles.push(makeStrike(game, p, a, entry, tx, ty, false));
  }
  game.audio && game.audio.launch(a);
}

function makeLoiterer(game, p, a, entry, tx, ty) {
  const s = makeStrike(game, p, a, entry, tx, ty, false);
  s.loiter = { homeX: tx, homeY: ty, radius: a.payload.reveal || 10, state: 'ingress', hunt: 0 };
  s.maxLife = 999;
  s.type = THREAT.LOITER;
  s.threat = THREAT.LOITER;
  return s;
}

/**
 * Loitering munitions circle the target area and dive on the most valuable
 * vehicle they can find, one munition per target.
 */
export function updateLoiterers(game, dt) {
  for (const s of game.world.projectiles) {
    if (s.dead || !s.loiter) continue;
    const L = s.loiter;
    if (L.state === 'ingress') {
      if (dist(s.x, s.y, L.homeX, L.homeY) < 1.5) { L.state = 'hunting'; L.angle = game.rng() * TAU; }
      continue;
    }
    if (L.state === 'hunting') {
      L.hunt -= dt;
      if (L.hunt <= 0) {
        L.hunt = 0.55;
        let best = null, bestScore = 0;
        const list = game.world.unitsNear(L.homeX, L.homeY, L.radius, []);
        for (const e of list) {
          if (e.dead || e.loaded || game.isAllied(s.owner, e.owner) || e.owner === s.owner) continue;
          if (e.def.class === 'infantry') continue;
          let sc = (e.def.cost || 400) / 100;
          if (e.def.role === 'artillery' || e.def.role === 'rocketArtillery') sc *= 2.4;
          if (e.def.role === 'airDefence') sc *= 1.6;
          if (e.claimedByLoiter && e.claimedByLoiter !== s) sc *= 0.15;
          if (sc > bestScore) { bestScore = sc; best = e; }
        }
        if (best) {
          best.claimedByLoiter = s;
          L.state = 'diving'; s.target = best; s.tx = best.x; s.ty = best.y;
          s.speed = PROJ_SPEED.loiter * 2.2;
        } else {
          L.orbit = (L.orbit || 0) + dt * 1.4;
          s.tx = L.homeX + Math.cos(L.orbit) * (L.radius * 0.55);
          s.ty = L.homeY + Math.sin(L.orbit) * (L.radius * 0.55);
          L.life = (L.life || 0) + dt;
          if (L.life > 34) { s.dead = true; game.fx.airburst(s.x, s.y, false); }
        }
      }
      continue;
    }
    if (L.state === 'diving') {
      if (!s.target || s.target.dead) { L.state = 'hunting'; s.target = null; s.speed = PROJ_SPEED.loiter; }
    }
  }
}

export function updateAbilityCooldowns(game, dt) {
  for (const p of game.players) {
    for (const k of Object.keys(p.abilities)) {
      const st = p.abilities[k];
      if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
    }
  }
  for (let i = game.reveals.length - 1; i >= 0; i--) {
    if (game.reveals[i].until <= game.time) game.reveals.splice(i, 1);
  }
}

/** Extra damage when a bunker-busting warhead lands on a structure. */
export function strikeImpactBonus(p, target) {
  if (!p.bunkerBuster) return 1;
  return (target && (target.kind === 'building' || target.kind === 'neutral')) ? 1.55 : 1;
}

export { abilityName };
