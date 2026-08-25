// Orders, path following, local avoidance and per-unit behaviour.

import { clamp, dist, turnToward, angleDiff, TAU } from '../core/util.js';
import { T } from '../core/terrain.js';
import { effectiveSpeed, isAlive } from './entities.js';
import { acquireTarget, tryFire, weaponRange, bestWeapon, inFiringPosition, applyDamage } from './combat.js';

const ARRIVE = 0.42;

export function issueOrder(game, u, order) {
  u.order = order;
  u.path = null;
  u.pathIdx = 0;
  u.repath = 0;
  u.stuck = 0;
  if (order.type !== 'attack') u.target = null;
}

/** Request a path, throttled so a large army cannot stall a frame. */
function requestPath(game, u, tx, ty) {
  if (game.pathBudget <= 0) { u.repath = 0.25; return; }
  game.pathBudget--;
  const p = game.world.pf.find(u.x, u.y, tx, ty, u.domain, u.heavy);
  u.path = p && p.length ? p : null;
  u.pathIdx = 0;
  u.repath = p ? 1.6 : 0.9;
  if (!p) u.noPath = (u.noPath || 0) + 1; else u.noPath = 0;
}

function moveAlong(game, u, dt, destX, destY, stopDist) {
  const world = game.world;
  const d = dist(u.x, u.y, destX, destY);
  if (d <= stopDist) { u.moving = false; return true; }

  u.repath -= dt;
  if (!u.path || u.repath <= 0) {
    const last = u.path && u.path.length ? u.path[u.path.length - 1] : null;
    if (!u.path || !last || dist(last.x, last.y, destX, destY) > 1.6) requestPath(game, u, destX, destY);
    else u.repath = 1.4;
  }

  let wx = destX, wy = destY;
  if (u.path && u.pathIdx < u.path.length) {
    const wp = u.path[u.pathIdx];
    wx = wp.x; wy = wp.y;
    if (dist(u.x, u.y, wx, wy) < ARRIVE) {
      u.pathIdx++;
      if (u.pathIdx >= u.path.length) { u.path = null; }
      return false;
    }
  }

  const speed = effectiveSpeed(world, u);
  if (speed <= 0) { u.moving = false; return false; }

  const want = Math.atan2(wy - u.y, wx - u.x);
  u.facing = turnToward(u.facing, want, u.def.turnRate * dt);
  const align = Math.cos(angleDiff(u.facing, want));
  const throttle = clamp(align, 0.12, 1);

  const step = speed * dt * throttle;
  let nx = u.x + Math.cos(u.facing) * step;
  let ny = u.y + Math.sin(u.facing) * step;

  if (!world.passable(nx, ny, u.domain, u.heavy)) {
    // Slide along whichever axis is still open, then force a repath.
    if (world.passable(nx, u.y, u.domain, u.heavy)) ny = u.y;
    else if (world.passable(u.x, ny, u.domain, u.heavy)) nx = u.x;
    else { nx = u.x; ny = u.y; u.repath = 0; u.stuck += dt; }
  }
  u.vx = (nx - u.x) / Math.max(dt, 0.0001);
  u.vy = (ny - u.y) / Math.max(dt, 0.0001);
  u.x = nx; u.y = ny;
  u.moving = true;

  const moved = Math.hypot(u.vx, u.vy);
  if (moved < speed * 0.12) u.stuck += dt; else u.stuck = Math.max(0, u.stuck - dt * 0.6);
  if (u.stuck > 1.4) { u.stuck = 0; u.repath = 0; u.path = null; nudge(game, u); }
  return false;
}

/** Shove a jammed unit a short distance sideways so columns unlock themselves. */
function nudge(game, u) {
  const world = game.world;
  for (let i = 0; i < 8; i++) {
    const a = game.rng() * TAU;
    const nx = u.x + Math.cos(a) * 1.1, ny = u.y + Math.sin(a) * 1.1;
    if (world.passable(nx, ny, u.domain, u.heavy)) { u.x = nx; u.y = ny; return; }
  }
}

/** Keep units from stacking on top of each other. */
export function separate(game, dt) {
  const world = game.world;
  const scratch = [];
  for (const u of world.units) {
    if (u.dead || u.loaded) continue;
    const list = world.unitsNear(u.x, u.y, 1.35, scratch);
    let px = 0, py = 0, n = 0;
    for (const o of list) {
      if (o === u || o.dead || o.loaded) continue;
      if ((o.def.class === 'naval') !== (u.def.class === 'naval')) continue;
      const dx = u.x - o.x, dy = u.y - o.y;
      const d2 = dx * dx + dy * dy;
      const want = (u.radius + o.radius) * 1.05;
      if (d2 > want * want || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (want - d) / want;
      px += (dx / d) * push; py += (dy / d) * push;
      n++;
    }
    if (n === 0) continue;
    const f = (u.moving ? 2.6 : 1.7) * dt;
    const nx = u.x + px * f, ny = u.y + py * f;
    if (world.passable(nx, ny, u.domain, u.heavy)) { u.x = nx; u.y = ny; }
  }
}

// ------------------------------------------------------------- unit update
export function updateUnit(game, u, dt) {
  if (u.dead || u.loaded) return;
  const world = game.world;
  u.fireCd = Math.max(0, u.fireCd - dt);
  u.recoil = Math.max(0, u.recoil - dt * 4);
  u.moving = false;

  // Shoot-and-scoot: rocket artillery displaces after a salvo.
  if (u.scootUntil > game.time && u.order.type !== 'move') {
    const away = game.retreatVector(u);
    u.order = { type: 'move', x: clamp(u.x + away.x * 6, 2, world.width - 3), y: clamp(u.y + away.y * 6, 2, world.height - 3), scoot: true };
  }

  const o = u.order;
  switch (o.type) {
    case 'move': {
      const done = moveAlong(game, u, dt, o.x, o.y, o.stop || ARRIVE);
      if (done || (u.noPath || 0) > 3) { u.noPath = 0; issueOrder(game, u, { type: 'idle' }); }
      autoDefend(game, u, dt);
      break;
    }
    case 'attackMove': {
      const t = u.target && isAlive(u.target) && game.canSee(u.owner, u.target.x, u.target.y) ? u.target : acquireTarget(game, u, 2);
      if (t) {
        u.target = t;
        engage(game, u, t, dt, true);
      } else {
        const done = moveAlong(game, u, dt, o.x, o.y, o.stop || ARRIVE);
        if (done) issueOrder(game, u, { type: 'guard', x: u.x, y: u.y });
      }
      break;
    }
    case 'attack': {
      const t = u.target;
      if (!t || !isAlive(t)) { issueOrder(game, u, { type: 'guard', x: u.x, y: u.y }); break; }
      engage(game, u, t, dt, true);
      break;
    }
    case 'guard': {
      const t = acquireTarget(game, u, 0);
      if (t) { u.target = t; engage(game, u, t, dt, false, o); }
      else {
        const d = dist(u.x, u.y, o.x, o.y);
        if (d > 2.4) moveAlong(game, u, dt, o.x, o.y, 1.2);
        else idleTurret(u, dt);
      }
      break;
    }
    case 'capture': {
      const t = o.target;
      if (!t || t.dead || t.owner === u.owner) { issueOrder(game, u, { type: 'idle' }); break; }
      const d = dist(u.x, u.y, t.x, t.y);
      if (d > t.radius + 1.1) {
        moveAlong(game, u, dt, t.x, t.y, t.radius + 0.9);
        u.capturing = null;
      } else {
        u.moving = false;
        doCapture(game, u, t, dt);
      }
      break;
    }
    case 'repairTarget': {
      const t = o.target;
      if (!t || t.dead || t.hp >= t.hpMax) { issueOrder(game, u, { type: 'idle' }); break; }
      const d = dist(u.x, u.y, t.x, t.y);
      if (d > (u.def.repairRadius || 2.5)) moveAlong(game, u, dt, t.x, t.y, (u.def.repairRadius || 2.5) - 0.4);
      else u.moving = false;
      break;
    }
    case 'enter': {
      const t = o.target;
      if (!t || t.dead || t.cargo.length >= (t.def.cargo || 0)) { issueOrder(game, u, { type: 'idle' }); break; }
      const d = dist(u.x, u.y, t.x, t.y);
      if (d > 1.3) moveAlong(game, u, dt, t.x, t.y, 1.1);
      else {
        u.loaded = true; u.transport = t; t.cargo.push(u);
        issueOrder(game, u, { type: 'idle' });
      }
      break;
    }
    case 'unload': {
      const d = dist(u.x, u.y, o.x, o.y);
      if (d > 1.6) moveAlong(game, u, dt, o.x, o.y, 1.4);
      else { unloadAll(game, u); issueOrder(game, u, { type: 'idle' }); }
      break;
    }
    default: {
      const t = acquireTarget(game, u, 0);
      if (t) { u.target = t; engage(game, u, t, dt, false); }
      else idleTurret(u, dt);
      break;
    }
  }

  // Dust from tracks on dry ground, and smoke from a badly damaged hull.
  if (u.moving && u.def.class === 'vehicle') {
    const t = world.tileAt(u.x, u.y);
    const dusty = t === T.SAND || t === T.DUNE || t === T.FARM || t === T.RUBBLE;
    game.fx.dust(u.x, u.y, (dusty ? 0.22 : 0.07) * (u.heavy ? 1.4 : 1) * dt * 30);
  }
  if (u.def.class !== 'infantry' && u.hp < u.hpMax * 0.35) {
    u.smokeCd = (u.smokeCd || 0) - dt;
    if (u.smokeCd <= 0) { u.smokeCd = 0.45; game.fx.smokeColumn(u.x, u.y); }
  }

  // Engineering vehicles and depots keep the fleet running.
  if (u.def.repairsVehicles) fieldRepair(game, u, dt);
  if (u.def.repairsStructures) engineerRepair(game, u, dt);
}

function idleTurret(u, dt) {
  u.turret = turnToward(u.turret, u.facing, u.def.turretRate * dt * 0.6);
}

/** Return fire without abandoning the current order. */
function autoDefend(game, u, dt) {
  if (u.fireCd > 0) return;
  const t = acquireTarget(game, u, 0);
  if (!t) return;
  const w = bestWeapon(u, t);
  if (!w) return;
  const want = Math.atan2(t.y - u.y, t.x - u.x);
  u.turret = turnToward(u.turret, want, u.def.turretRate * dt);
  if (inFiringPosition(game, u, t, w)) tryFire(game, u, t, dt);
}

function engage(game, u, t, dt, pursue, guardOrder) {
  const w = bestWeapon(u, t) || (u.def.weapons[0] || null);
  if (!w) {
    if (pursue) moveAlong(game, u, dt, t.x, t.y, 2);
    return;
  }
  const want = Math.atan2(t.y - u.y, t.x - u.x);
  u.turret = turnToward(u.turret, want, u.def.turretRate * dt);

  const d = dist(u.x, u.y, t.x, t.y);
  const reach = w.range + (t.radius || 0);
  const tooClose = w.minRange && d < w.minRange * 0.92;

  if (tooClose) {
    // Artillery backs off rather than firing into its own minimum range.
    const ax = u.x + (u.x - t.x) / d, ay = u.y + (u.y - t.y) / d;
    moveAlong(game, u, dt, ax * 1.0 + (u.x - t.x) * 0.4, ay + (u.y - t.y) * 0.4, 0.3);
    return;
  }
  if (d > reach * 0.94 || !inFiringPosition(game, u, t, w)) {
    if (pursue) {
      moveAlong(game, u, dt, t.x, t.y, Math.max(0.8, reach * 0.82));
    } else if (guardOrder) {
      const home = dist(u.x, u.y, guardOrder.x, guardOrder.y);
      if (home < 7.5) moveAlong(game, u, dt, t.x, t.y, Math.max(0.8, reach * 0.82));
      else moveAlong(game, u, dt, guardOrder.x, guardOrder.y, 1.2);
    }
    return;
  }
  u.moving = false;
  if (u.def.turnRate && u.def.class === 'vehicle' && !u.def.art.turret) {
    u.facing = turnToward(u.facing, want, u.def.turnRate * dt);
  }
  tryFire(game, u, t, dt);
}

function doCapture(game, u, t, dt) {
  if (t.owner === u.owner) { issueOrder(game, u, { type: 'idle' }); return; }
  if (t.disabled > 0) { issueOrder(game, u, { type: 'idle' }); return; }
  u.capturing = t;
  const speed = 1 / (t.def.captureTime || 6);
  if (t.capturingBy !== u.owner) { t.capturingBy = u.owner; t.captureProgress = 0; }
  t.captureProgress += speed * dt;
  if (t.captureProgress >= 1) {
    game.captureNeutral(t, u.owner, u);
    t.captureProgress = 0;
    t.capturingBy = -1;
    if (t.type === 'objective') { u.dead = false; }
    issueOrder(game, u, { type: 'idle' });
  }
}

function fieldRepair(game, u, dt) {
  if (u.moving) return;
  const radius = u.def.repairRadius || 3;
  const list = game.world.unitsNear(u.x, u.y, radius, []);
  for (const o of list) {
    if (o === u || o.dead || o.owner !== u.owner) continue;
    if (o.def.class === 'infantry') continue;
    let did = false;
    if (o.hp < o.hpMax) { o.hp = Math.min(o.hpMax, o.hp + u.def.repairsVehicles * dt); did = true; }
    if (o.mobility < 1) { o.mobility = Math.min(1, o.mobility + 0.06 * dt); did = true; }
    if (o.weaponHealth < 1) { o.weaponHealth = Math.min(1, o.weaponHealth + 0.06 * dt); did = true; }
    if (u.def.rearms && o.ammo < o.ammoMax) {
      const pl = game.players[u.owner];
      if (pl.ammoStock > 0) {
        const amt = Math.min(u.def.rearms * dt, o.ammoMax - o.ammo, pl.ammoStock);
        o.ammo += amt; pl.ammoStock -= amt; did = true;
      }
    }
    if (did) { game.fx.repairSpark(o.x, o.y); break; }
  }
}

function engineerRepair(game, u, dt) {
  if (u.moving) return;
  const list = game.world.buildingsNear(u.x, u.y, 3.2, []);
  for (const b of list) {
    if (b.dead || b.owner !== u.owner || b.kind !== 'building') continue;
    if (b.hp >= b.hpMax) continue;
    b.hp = Math.min(b.hpMax, b.hp + u.def.repairsStructures * dt);
    game.fx.repairSpark(b.x, b.y);
    break;
  }
}

export function unloadAll(game, transport) {
  const world = game.world;
  for (const c of transport.cargo.slice()) {
    let placed = false;
    for (let r = 1; r < 6 && !placed; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * TAU;
        const nx = transport.x + Math.cos(ang) * r, ny = transport.y + Math.sin(ang) * r;
        if (world.passable(nx, ny, c.domain, c.heavy)) {
          c.x = nx; c.y = ny; placed = true; break;
        }
      }
    }
    if (!placed) continue;
    c.loaded = false; c.transport = null;
    issueOrder(game, c, { type: 'guard', x: c.x, y: c.y });
    const i = transport.cargo.indexOf(c);
    if (i >= 0) transport.cargo.splice(i, 1);
  }
}

export { moveAlong };
