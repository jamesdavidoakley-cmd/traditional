// Weapon selection, firing, projectiles, splash, subsystem damage and interception.

import { clamp, dist, angleDiff, TAU } from '../core/util.js';
import { damageMultiplier, THREAT } from '../data/damage.js';
import { armourOf, effectiveRof, effectiveAccuracy } from './entities.js';

const PROJ_SPEED = {
  bullet: 26, shell: 19, arc: 10.5, rocket: 12, missile: 15,
  cruise: 6.4, ballistic: 13, aircraft: 9.5, loiter: 4.6, interceptor: 22,
};

export function targetClass(e) {
  if (e.kind === 'proj') return 'air';
  if (e.kind === 'unit' && e.def.domain === 'naval') return 'naval';
  return 'land';
}

export function weaponCanHit(w, target) {
  return w.targets.includes(targetClass(target));
}

/** Pick the weapon that does the most damage to this target and is ready to fire. */
export function bestWeapon(u, target) {
  const arm = armourOf(target);
  let best = null, bestScore = -1;
  for (const w of u.def.weapons) {
    if (!weaponCanHit(w, target)) continue;
    if (w.ammoCost > 0 && u.ammo < w.ammoCost) continue;
    const mult = damageMultiplier(w.type, arm);
    const score = mult * w.damage * (w.salvo || 1) / Math.max(0.2, w.rof);
    if (score > bestScore) { bestScore = score; best = w; }
  }
  return best;
}

/** Any weapon at all that could engage this target, ignoring ammo. */
export function anyWeaponFor(u, target) {
  for (const w of u.def.weapons) if (weaponCanHit(w, target)) return w;
  return null;
}

export function weaponRange(u) {
  let r = 0;
  for (const w of u.def.weapons) r = Math.max(r, w.range);
  return r;
}

// ------------------------------------------------------------- line of sight
function directFireBlocked(world, ax, ay, bx, by, targetId) {
  const steps = 7;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = (ax + (bx - ax) * t) | 0, y = (ay + (by - ay) * t) | 0;
    if (!world.inBounds(x, y)) continue;
    const k = world.idx(x, y);
    if (world.blocked[k] && world.occupant[k] !== targetId) return true;
  }
  return false;
}

// ------------------------------------------------------------------ scoring
const ROLE_PRIORITY = {
  artillery: 2.4, rocketArtillery: 2.4, antiArmour: 1.9, airDefence: 1.5,
  engineer: 1.7, scout: 1.1, repair: 1.6, mainArmour: 1.35, support: 1.15,
  lineInfantry: 1.0, transport: 0.9, raider: 1.6, navalHeavy: 1.6,
  navalArtillery: 2.0, navalLine: 1.3, navalLight: 1.0, navalTransport: 1.2,
};

export function threatScore(attacker, target) {
  const w = bestWeapon(attacker, target) || anyWeaponFor(attacker, target);
  if (!w) return -1;
  const mult = damageMultiplier(w.type, armourOf(target));
  if (mult < 0.06) return -1;
  const d = dist(attacker.x, attacker.y, target.x, target.y);
  let s = mult * 100;
  if (target.kind === 'unit') s *= (ROLE_PRIORITY[target.def.role] || 1);
  else if (target.kind === 'building') s *= target.def.critical ? 1.7 : 1.0;
  else s *= 0.8;
  // Prefer things that are already hurt, and things that are close.
  s *= 1 + (1 - target.hp / target.hpMax) * 0.45;
  s /= (1 + d * 0.22);
  return s;
}

/** Find the best thing within weapon range for this unit to shoot at. */
export function acquireTarget(game, u, extraRange = 0) {
  const world = game.world;
  const range = weaponRange(u) + extraRange;
  if (range <= 0) return null;
  const list = world.unitsNear(u.x, u.y, range, game._tgtScratch);
  let best = null, bestScore = 0;
  for (const e of list) {
    if (e.dead || e.owner === u.owner || e.loaded) continue;
    if (game.isAllied(u.owner, e.owner)) continue;
    if (!game.canSee(u.owner, e.x, e.y)) continue;
    if (e.def.lowProfile && dist(u.x, u.y, e.x, e.y) > u.def.vision * (1 - e.def.lowProfile)) continue;
    const s = threatScore(u, e);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  const blds = world.buildingsNear(u.x, u.y, range, game._bScratch);
  for (const e of blds) {
    if (e.dead || e.owner === u.owner || e.owner < 0) continue;
    if (game.isAllied(u.owner, e.owner)) continue;
    if (!game.canSee(u.owner, e.x, e.y)) continue;
    const s = threatScore(u, e) * 0.55;   // prefer shooting units over buildings when both are near
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return best;
}

// ------------------------------------------------------------------- firing
export function inFiringPosition(game, u, target, w) {
  const d = dist(u.x, u.y, target.x, target.y);
  const reach = w.range + (target.radius || 0);
  if (d > reach) return false;
  if (w.minRange && d < w.minRange) return false;
  if (!w.arcing && u.def.needsSpotting !== true) {
    if (directFireBlocked(game.world, u.x, u.y, target.x, target.y, target.id)) return false;
  }
  if (u.def.needsSpotting && !game.canSee(u.owner, target.x, target.y)) return false;
  return true;
}

export function tryFire(game, u, target, dt) {
  if (u.fireCd > 0) return false;
  const w = bestWeapon(u, target);
  if (!w) return false;
  if (!inFiringPosition(game, u, target, w)) return false;

  // Turret has to be pointed at the target first.
  const want = Math.atan2(target.y - u.y, target.x - u.x);
  const diff = Math.abs(angleDiff(u.turret, want));
  if (diff > 0.16) return false;

  fireWeapon(game, u, target, w);
  return true;
}

export function fireWeapon(game, u, target, w) {
  const salvo = w.salvo || 1;
  const burst = w.burst || 1;
  u.fireCd = effectiveRof(u, w);
  u.lastFireAt = game.time;
  if (w.ammoCost) u.ammo = Math.max(0, u.ammo - w.ammoCost);
  u.recoil = 1;

  const shots = salvo * burst;
  for (let i = 0; i < shots; i++) {
    game.pending.push({
      at: game.time + i * (salvo > 1 ? 0.16 : 0.07),
      fn: () => spawnProjectile(game, u, target, w, i),
    });
  }
  if (u.def.shootAndScoot && salvo > 1) u.scootUntil = game.time + 1.2;
  game.audio && game.audio.weapon(w, u, game);
}

export function spawnProjectile(game, src, target, w, index) {
  if (src.dead) return;
  const acc = effectiveAccuracy(src, w);
  const spread = (w.spread || 0) * (1 - acc * 0.55);
  const rng = game.rng;
  let tx = target && !target.dead ? target.x : (src.aimX || src.x);
  let ty = target && !target.dead ? target.y : (src.aimY || src.y);
  if (target && target.kind === 'unit' && target.moving && w.projectile !== 'missile') {
    // simple lead
    const flight = dist(src.x, src.y, tx, ty) / (PROJ_SPEED[w.projectile] || 15);
    tx += (target.vx || 0) * flight * 0.7;
    ty += (target.vy || 0) * flight * 0.7;
  }
  if (spread) {
    const a = rng() * TAU, r = rng() * spread;
    tx += Math.cos(a) * r; ty += Math.sin(a) * r;
  }
  const hitRoll = rng() < acc;

  const p = {
    kind: 'proj', type: w.projectile === 'none' ? 'melee' : w.projectile,
    owner: src.owner, srcId: src.id,
    x: src.x, y: src.y, z: 0,
    sx: src.x, sy: src.y, tx, ty,
    target: (w.projectile === 'missile' && target && !target.dead) ? target : null,
    damage: w.damage, damageType: w.type, splash: w.splash || 0,
    speed: PROJ_SPEED[w.projectile] || 16,
    threat: w.threat || null, interceptable: !!w.threat,
    arc: w.arcing || w.projectile === 'arc' ? 1 : (w.projectile === 'shell' ? 0.22 : 0),
    life: 0, maxLife: 14, hit: hitRoll, engaged: null,
    aimEntity: (target && !target.dead) ? target : null,
    trail: w.projectile === 'rocket' || w.projectile === 'missile' ? [] : null,
    weapon: w,
  };
  const d = dist(p.x, p.y, tx, ty);
  p.flightTime = d / p.speed;
  p.maxLife = p.flightTime + 0.5;
  if (p.type === 'melee') {
    resolveImpact(game, p, target);
    return;
  }
  game.world.projectiles.push(p);
  game.fx.muzzle(src, tx, ty);
}

// --------------------------------------------------------------- projectiles
export function updateProjectiles(game, dt) {
  const world = game.world;
  for (const p of world.projectiles) {
    if (p.dead) continue;
    p.life += dt;

    if (p.target && (p.target.dead || p.target.loaded)) { p.tx = p.target.x; p.ty = p.target.y; p.target = null; }
    if (p.target) { p.tx = p.target.x; p.ty = p.target.y; }

    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step || p.life > p.maxLife) {
      p.x = p.tx; p.y = p.ty;
      resolveImpact(game, p, p.target);
      p.dead = true;
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    if (p.arc) {
      const total = dist(p.sx, p.sy, p.tx, p.ty);
      const travelled = dist(p.sx, p.sy, p.x, p.y);
      const t = total > 0 ? travelled / total : 1;
      p.z = Math.sin(t * Math.PI) * total * 0.22 * p.arc;
    } else if (p.threat === THREAT.BALLISTIC) {
      const total = dist(p.sx, p.sy, p.tx, p.ty);
      const travelled = dist(p.sx, p.sy, p.x, p.y);
      const t = total > 0 ? travelled / total : 1;
      p.z = Math.sin(t * Math.PI) * 22;
    } else if (p.threat === THREAT.CRUISE || p.threat === THREAT.AIRCRAFT) {
      p.z = 4.2;
    } else if (p.threat === THREAT.LOITER) {
      p.z = 2.4;
    }
    if (p.trail) {
      p.trail.push(p.x, p.y);
      if (p.trail.length > 26) p.trail.splice(0, 2);
    }
  }
}

export function resolveImpact(game, p, target) {
  const world = game.world;
  if (p.type === 'interceptor') { resolveInterceptor(game, p); return; }
  if (p.harmless) { game.fx.airburst(p.x, p.y, false); return; }
  const structureBonus = p.bunkerBuster ? 1.55 : 1;
  if (p.splash > 0) {
    game.fx.explosion(p.x, p.y, p.splash, p.damageType);
    world.addScorch(p.x, p.y, p.splash * 0.85);
    const list = world.unitsNear(p.x, p.y, p.splash + 1.2, game._splashScratch);
    for (const e of list.slice()) {
      if (e.dead || e.loaded) continue;
      if (game.isAllied(p.owner, e.owner) && e.owner !== p.owner) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      const falloff = clamp(1 - d / (p.splash + 0.8), 0, 1);
      if (falloff <= 0) continue;
      applyDamage(game, e, p.damage * falloff, p.damageType, p, p.x, p.y);
    }
    const blds = world.buildingsNear(p.x, p.y, p.splash + 1.5, []);
    for (const b of blds) {
      if (b.dead) continue;
      if (b.owner >= 0 && game.isAllied(p.owner, b.owner) && b.owner !== p.owner) continue;
      const d = Math.max(0, dist(p.x, p.y, b.x, b.y) - b.radius);
      const falloff = clamp(1 - d / (p.splash + 1.0), 0, 1);
      if (falloff <= 0) continue;
      applyDamage(game, b, p.damage * falloff * structureBonus, p.damageType, p, p.x, p.y);
    }
  } else {
    game.fx.impact(p.x, p.y, p.damageType);
    const intended = target && !target.dead ? target : (p.aimEntity && !p.aimEntity.dead ? p.aimEntity : null);
    if (intended && p.hit && dist(intended.x, intended.y, p.x, p.y) <= (intended.radius || 0.6) + 1.4) {
      const mult = (intended.kind === 'building' || intended.kind === 'neutral') ? structureBonus : 1;
      applyDamage(game, intended, p.damage * mult, p.damageType, p, p.x, p.y);
    } else {
      // Round fell short, or the target moved: hit whatever is actually standing there.
      let hitSomething = false;
      const list = world.unitsNear(p.x, p.y, 0.8, game._splashScratch);
      for (const e of list) {
        if (e.dead || e.loaded || e.owner === p.owner || game.isAllied(p.owner, e.owner)) continue;
        applyDamage(game, e, p.damage, p.damageType, p, p.x, p.y);
        hitSomething = true;
        break;
      }
      if (!hitSomething) {
        const blds = world.buildingsNear(p.x, p.y, 0.8, []);
        for (const b of blds) {
          if (b.dead || b.owner === p.owner || (b.owner >= 0 && game.isAllied(p.owner, b.owner))) continue;
          applyDamage(game, b, p.damage * structureBonus, p.damageType, p, p.x, p.y);
          break;
        }
      }
    }
  }
}

// ------------------------------------------------------------------- damage
export function applyDamage(game, target, amount, damageType, source, hx, hy) {
  if (!target || target.dead) return 0;
  const world = game.world;
  let mult = damageMultiplier(damageType, armourOf(target));

  if (target.kind === 'unit') {
    if (target.def.class === 'infantry') {
      const cover = world.coverAt(target.x, target.y);
      mult *= (1 - cover * 0.85);
    } else if (target.def.frontalArc && hx !== undefined) {
      // Hitting a tank in the flank hurts a great deal more than hitting its glacis.
      const inbound = Math.atan2(target.y - hy, target.x - hx);
      const rel = Math.abs(angleDiff(target.facing, inbound));
      if (rel > 2.1) mult *= (1 - target.def.frontalArc * 0.55);        // frontal
      else if (rel < 1.05) mult *= 1.35;                                 // rear
      else mult *= 1.18;                                                 // flank
    }
  }

  const dealt = amount * mult;
  target.hp -= dealt;
  target.lastDamageAt = game.time;

  if (target.kind === 'unit' && target.def.class === 'vehicle' && dealt > 12) {
    // Mobility and weapon damage before the hull finally gives out.
    const roll = game.rng();
    const sev = clamp(dealt / target.hpMax * 2.2, 0.02, 0.3);
    if (roll < 0.16) {
      target.mobility = clamp(target.mobility - sev, 0.15, 1);
      game.fx.sparks(target.x, target.y, '#ffb347');
      if (target.owner === game.humanIndex) game.alerts.push({ type: 'mobility', at: game.time, x: target.x, y: target.y });
    } else if (roll < 0.28) {
      target.weaponHealth = clamp(target.weaponHealth - sev, 0.15, 1);
      game.fx.sparks(target.x, target.y, '#ff7043');
    }
  }
  if (target.kind === 'building' || target.kind === 'neutral') {
    game.notifyBaseAttack(target, source);
  } else if (target.kind === 'unit') {
    game.notifyUnitAttack(target, source);
  }

  if (target.hp <= 0) killEntity(game, target, source);
  return dealt;
}

export function killEntity(game, e, source) {
  if (e.dead) return;
  const world = game.world;
  if (e.kind === 'unit') {
    e.hp = 0;
    for (const c of e.cargo) { c.dead = true; world.remove(c); }
    e.cargo.length = 0;
    if (e.transport) {
      const i = e.transport.cargo.indexOf(e);
      if (i >= 0) e.transport.cargo.splice(i, 1);
    }
    game.fx.explosion(e.x, e.y, e.def.class === 'infantry' ? 0.8 : 1.5, 'he');
    if (e.def.class !== 'infantry') {
      world.addWreck(e.x, e.y, e.def.art, game.players[e.owner].colour, e.facing);
      world.addScorch(e.x, e.y, 1.0);
    }
    world.remove(e);
    game.onUnitKilled(e, source);
  } else if (e.kind === 'building') {
    e.hp = 0;
    game.fx.buildingDestroyed(e);
    world.addScorch(e.x, e.y, e.size * 0.7);
    world.remove(e);
    game.onBuildingDestroyed(e, source);
  } else if (e.kind === 'neutral') {
    e.hp = 0;
    e.disabled = 45;
    e.owner = -1;
    e.captureProgress = 0;
    game.fx.explosion(e.x, e.y, 1.8, 'he');
    world.addScorch(e.x, e.y, 1.4);
    game.onNeutralDisabled(e, source);
  }
}

// ------------------------------------------------------------- interception
/**
 * Every interceptor system that can reach an inbound threat gets exactly one
 * attempt at it. Success is a roll, never a certainty, and every attempt is
 * drawn as a real interceptor missile leaving the launcher.
 */
export function updateInterception(game, dt) {
  const world = game.world;
  const threats = world.projectiles.filter((p) => !p.dead && p.interceptable && p.life > 0.35);
  if (threats.length === 0) return;

  const tryEngage = (site, ic, ammoRef) => {
    if (site.interceptCd > 0) return;
    for (const p of threats) {
      if (p.dead || game.isAllied(site.owner, p.owner)) continue;
      if (p.owner === site.owner) continue;
      if (!p.engaged) p.engaged = [];
      if (p.engaged.includes(site.id)) continue;
      const d = dist(site.x, site.y, p.x, p.y);
      if (d > ic.range) continue;
      // Do not fire at something that will land before the interceptor arrives.
      const remaining = dist(p.x, p.y, p.tx, p.ty) / p.speed;
      if (remaining < 0.35) continue;

      p.engaged.push(site.id);
      site.interceptCd = ic.reload;
      if (ammoRef) { ammoRef.ammo = Math.max(0, ammoRef.ammo - 1); }

      let chance = ic[p.threat] !== undefined ? ic[p.threat] : 0.2;
      if (ic.needsData) {
        const pl = game.players[site.owner];
        if (!pl.dataOnline) chance *= 0.35;
        if (!pl.radarOnline) chance *= 0.5;
      }
      if (p.weapon && p.weapon.evasive) chance *= (1 - p.weapon.evasive);
      if (game.difficultyOf(site.owner)) chance *= game.difficultyOf(site.owner).interceptSkill || 1;
      chance = clamp(chance, 0, 0.94);
      const success = game.rng() < chance;

      game.world.projectiles.push({
        kind: 'proj', type: 'interceptor', owner: site.owner, srcId: site.id,
        x: site.x, y: site.y, z: 1.2, sx: site.x, sy: site.y,
        tx: p.x, ty: p.y, target: p, speed: PROJ_SPEED.interceptor,
        damage: 0, damageType: 'aa', splash: 0, threat: null, interceptable: false,
        arc: 0, life: 0, maxLife: 4.5, hit: success, trail: [],
        interceptTarget: p, interceptSuccess: success,
      });
      game.audio && game.audio.intercept(site);
      if (p.owner === game.humanIndex) {
        game.alerts.push({ type: 'intercepted', at: game.time, x: p.x, y: p.y, soft: true });
      }
      return;
    }
  };

  for (const b of world.buildings) {
    if (b.dead || b.state !== 'active') continue;
    const ic = b.def.interceptor;
    if (!ic) continue;
    if (!b.online || !b.powered) continue;
    if (b.ammoMax > 0 && b.ammo <= 0) continue;
    tryEngage(b, ic, b);
  }
  for (const u of world.units) {
    if (u.dead || u.loaded) continue;
    const ic = u.def.interceptor;
    if (!ic) continue;
    if (u.ammoMax > 0 && u.ammo <= 0) continue;
    tryEngage(u, ic, u);
  }
}

/** Resolve an interceptor reaching its assigned threat. */
export function resolveInterceptor(game, p) {
  const t = p.interceptTarget;
  if (!t || t.dead) { game.fx.airburst(p.x, p.y, false); return; }
  if (p.interceptSuccess) {
    game.fx.airburst(t.x, t.y, true);
    t.dead = true;
    game.audio && game.audio.airburst();
    const victim = game.ai.find((a) => a.player.index === t.owner);
    if (victim) victim.onStrikeIntercepted();
    const shooter = game.players[p.owner];
    if (shooter) shooter.stats.intercepts++;
  } else {
    game.fx.airburst(p.x, p.y, false);
  }
}

export { PROJ_SPEED };
