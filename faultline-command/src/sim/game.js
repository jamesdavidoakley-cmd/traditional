// The match: players, fixed-step simulation, fog, victory and the command API
// that both the human interface and the AI drive.

import { makeRng, dist, TAU } from '../core/util.js';
import { loadMap } from '../maps/maps.js';
import { World, Fog } from './world.js';
import { makeUnit, makeBuilding, makeNeutral } from './entities.js';
import { getUnit, rosterFor } from '../data/units.js';
import { getBuilding, structureList, defenceList } from '../data/buildings.js';
import { FACTIONS, TEAM_COLOURS } from '../data/factions.js';
import { DIFFICULTIES, resolveCommander } from '../data/commanders.js';
import { abilitiesFor } from '../data/abilities.js';
import { updateProjectiles, updateInterception, killEntity, spawnProjectile } from './combat.js';
import { updateUnit, separate, issueOrder } from './movement.js';
import { recomputeInfrastructure, updateEconomy, updateResupply, updateDepots, updateConstruction, updateProduction, prereqsMet, structureBlockReason,  } from './economy.js';
import { useAbility, abilityState, updateAbilityCooldowns, updateLoiterers } from './strikes.js';
import { Effects } from '../render/effects.js';

export const TICK = 1 / 30;
export const START_CREDITS = 7200;

export class Game {
  constructor(config) {
    this.config = config;
    this.rng = makeRng(config.seed || 12345);
    this.mapData = loadMap(config.mapKey);
    this.era = config.era;
    this.world = new World(this.mapData);
    this.fog = new Fog(this.world.width, this.world.height, config.players.length);
    this.fx = new Effects(this);
    this.audio = null;
    this.ai = [];

    this.time = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.speed = 1;
    this.paused = false;
    this.over = false;
    this.result = null;

    this.alerts = [];
    this.messages = [];
    this.pending = [];
    this.reveals = [];
    this.pathBudget = 24;

    this._tgtScratch = [];
    this._bScratch = [];
    this._splashScratch = [];
    this._fogTimer = 0;
    this._infraTimer = 0;
    this._objectiveTimer = 90;

    this.players = [];
    this.humanIndex = -1;
    this.setup();
  }

  // ------------------------------------------------------------------ setup
  setup() {
    const cfg = this.config;
    const hasWater = this.mapData.navigable;

    cfg.players.forEach((pc, i) => {
      const faction = FACTIONS[pc.faction];
      const diff = DIFFICULTIES[pc.difficultyKey] || DIFFICULTIES.officer;
      const cmd = pc.isHuman ? null : resolveCommander(pc.commanderKey, hasWater);
      const colour = TEAM_COLOURS.find((c) => c.key === pc.colourKey) || TEAM_COLOURS[i];
      const p = {
        index: i, isHuman: !!pc.isHuman,
        name: pc.name || (pc.isHuman ? 'Field Command' : (cmd ? cmd.codename : 'AI')),
        faction: pc.faction, factionDef: faction, era: this.era,
        commanderKey: pc.isHuman ? null : pc.commanderKey,
        commander: cmd, unknownCommander: !!pc.unknownCommander, identified: !pc.unknownCommander,
        difficultyKey: pc.difficultyKey, difficulty: diff,
        team: pc.team, colour: colour.hex, colourKey: colour.key, colourName: colour.name,
        startIndex: pc.startIndex,
        credits: START_CREDITS, creditsEarned: 0,
        alive: true, defeatedAt: null,
        buildings: [], units: [], construction: [],
        maxConcurrent: 2,
        powerSupply: 0, powerDemand: 0, powerRatio: 1, lowPower: false, productionRate: 1,
        dataCapacity: 0, dataUsed: 0, dataOnline: false, radarOnline: false,
        ammoStock: 55, ammoMax: 70, ammoRate: 0,
        baseIncome: 0, oilIncome: 0, income: 0, oilBonus: 0, oilSites: 0,
        incomeMultiplier: pc.isHuman ? 1 : diff.incomeMultiplier,
        buildSpeed: pc.isHuman ? 1 : diff.buildSpeed,
        abilities: {}, hq: null, pads: [],
        stats: { kills: 0, losses: 0, built: 0, structuresLost: 0, strikes: 0, intercepts: 0 },
        threat: 0, lastAttackedAt: -999, lastAttackPos: null,
      };
      for (const k of abilitiesFor(pc.faction, this.era)) {
        p.abilities[k] = { cooldown: 25, usedAt: -999 };
      }
      if (p.isHuman) this.humanIndex = i;
      this.players.push(p);
    });

    // Neutral oil infrastructure and strategic objectives.
    for (const o of this.mapData.oil) {
      const n = makeNeutral(this.world, o.type, o.x, o.y, o.id);
      // A site the map hands to a starting position belongs to whoever deploys
      // there: the field refinery outside each base is yours from the first tick.
      if (o.owner !== undefined) {
        const holder = this.players.find((p) => p.startIndex === o.owner);
        if (holder) { n.owner = holder.index; holder.neutrals = (holder.neutrals || 0) + 1; }
      }
      this.world.stampBuilding(n, true);
    }
    for (const ob of this.mapData.objectives) {
      makeNeutral(this.world, 'objective', ob.x, ob.y, -1);
    }

    // Home bases.
    this.players.forEach((p) => {
      const start = this.mapData.starts[p.startIndex % this.mapData.starts.length];
      p.pads = start.pads.map((pad) => ({ ...pad, occupied: null }));
      p.start = start;
      const hqPad = p.pads.find((pd) => pd.hq) || p.pads[12];
      const hq = makeBuilding(this.world, p.index, p.faction, this.era, 'hq', hqPad.cx, hqPad.cy, { instant: true, padId: hqPad.id });
      hqPad.occupied = hq;
      p.buildings.push(hq);
      p.hq = hq;
      hq.rally = { x: hqPad.cx + 4, y: hqPad.cy + 5 };

      const spawn = [
        ['rifle', -5, 5], ['rifle', -3, 6], ['rifle', 5, 5],
        ['engineer', 3, 6], ['scout', -6, 3], ['scout', 6, 3],
      ];
      for (const [key, dx, dy] of spawn) {
        const pos = this.findSpawn(hq.x + dx, hq.y + dy, key, p);
        const u = makeUnit(this.world, p.index, p.faction, this.era, key, pos.x, pos.y, Math.PI / 2);
        if (u) { p.units.push(u); issueOrder(this, u, { type: 'guard', x: u.x, y: u.y }); }
      }
    });

    this.world.rebuildIndex();
    for (const p of this.players) recomputeInfrastructure(this, p);
    this.updateFog(true);
  }

  findSpawn(x, y, key, p) {
    const def = getUnit(p.faction, this.era, key);
    const domain = def.domain === 'naval' ? 'naval' : 'land';
    for (let r = 0; r < 14; r += 0.7) {
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * TAU;
        const nx = x + Math.cos(ang) * r, ny = y + Math.sin(ang) * r;
        if (this.world.passable(nx, ny, domain, def.heavy)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  }

  // ------------------------------------------------------------------- loop
  update(dtReal) {
    if (this.paused || this.over) { this.fx.update(dtReal); return; }
    this.accumulator += Math.min(dtReal, 0.25) * this.speed;
    let steps = 0;
    while (this.accumulator >= TICK && steps < 8) {
      this.tick(TICK);
      this.accumulator -= TICK;
      steps++;
    }
    this.fx.update(dtReal * this.speed);
  }

  tick(dt) {
    this.time += dt;
    this.elapsed += dt;
    this.pathBudget = 26;

    // Scheduled work (staggered salvos, delayed strike launches).
    if (this.pending.length) {
      const still = [];
      for (const item of this.pending) {
        if (item.at <= this.time) item.fn();
        else still.push(item);
      }
      this.pending = still;
    }

    this.world.rebuildIndex();

    this._infraTimer -= dt;
    if (this._infraTimer <= 0) {
      this._infraTimer = 0.25;
      for (const p of this.players) if (p.alive) recomputeInfrastructure(this, p);
    }

    updateEconomy(this, dt);
    updateConstruction(this, dt);
    updateProduction(this, dt);
    updateResupply(this, dt);
    updateDepots(this, dt);
    updateAbilityCooldowns(this, dt);

    for (const u of this.world.units) updateUnit(this, u, dt);
    separate(this, dt);
    this.updateBuildings(dt);
    this.updateNeutrals(dt);
    updateLoiterers(this, dt);
    updateProjectiles(this, dt);
    updateInterception(this, dt);

    for (const ai of this.ai) ai.update(dt);

    this._fogTimer -= dt;
    if (this._fogTimer <= 0) {
      this._fogTimer = 0.2;
      this.updateFog(false);
      this.updateIntel();
      this.checkAmmoAlert();
    }

    this._objectiveTimer -= dt;
    if (this._objectiveTimer <= 0) { this._objectiveTimer = 150; this.refreshObjective(); }

    this.world.sweep();
    this.checkVictory();
    if (this.alerts.length > 60) this.alerts.splice(0, this.alerts.length - 60);
  }

  // -------------------------------------------------------------- buildings
  updateBuildings(dt) {
    for (const b of this.world.buildings) {
      if (b.dead) continue;
      b.fireCd = Math.max(0, b.fireCd - dt);
      b.interceptCd = Math.max(0, b.interceptCd - dt);
      if (b.state === 'active' && b.hp < b.hpMax * 0.4) {
        b.smokeCd -= dt;
        if (b.smokeCd <= 0) { b.smokeCd = 0.5; this.fx.smokeColumn(b.x, b.y); }
      }
      if (b.state !== 'active') continue;

      const weapons = b.def.weapons;
      if (!weapons || weapons.length === 0) continue;
      if (b.def.needsPower && !b.online) continue;
      if (b.def.interceptor && b.def.interceptor.needsData && !this.players[b.owner].radarOnline) continue;

      const range = Math.max(...weapons.map((w) => w.range));
      const t = this.acquireForBuilding(b, range);
      if (!t) continue;
      b.turret = Math.atan2(t.y - b.y, t.x - b.x);
      if (b.fireCd > 0) continue;

      const cls = t.def && t.def.domain === 'naval' ? 'naval' : 'land';
      const w = weapons.find((wp) => wp.targets.includes(cls));
      if (!w) continue;
      if (w.ammoCost && b.ammo < w.ammoCost) continue;
      if (dist(b.x, b.y, t.x, t.y) > w.range + (t.radius || 0)) continue;

      b.fireCd = w.rof;
      if (w.ammoCost) b.ammo = Math.max(0, b.ammo - w.ammoCost);
      this.spawnBuildingShot(b, t, w);
    }
  }

  /** Buildings shoot through a lightweight proxy so they reuse the unit weapon code. */
  spawnBuildingShot(b, t, w) {
    const proxy = {
      x: b.x, y: b.y, owner: b.owner, id: b.id, dead: false,
      def: { weapons: [w], art: {} }, weaponHealth: 1, ammo: 99,
      moving: false, vx: 0, vy: 0, aimX: t.x, aimY: t.y,
    };
    const shots = (w.salvo || 1) * (w.burst || 1);
    for (let i = 0; i < shots; i++) {
      this.pending.push({
        at: this.time + i * 0.08,
        fn: () => { if (!b.dead) spawnProjectile(this, proxy, t, w, i); },
      });
    }
    this.audio && this.audio.weapon(w, b, this);
  }

  acquireForBuilding(b, range) {
    const list = this.world.unitsNear(b.x, b.y, range, this._tgtScratch);
    let best = null, bestScore = 0;
    for (const e of list) {
      if (e.dead || e.loaded || e.owner === b.owner || this.isAllied(b.owner, e.owner)) continue;
      if (!this.canSee(b.owner, e.x, e.y)) continue;
      const w = b.def.weapons[0];
      const cls = e.def.domain === 'naval' ? 'naval' : 'land';
      if (!b.def.weapons.some((wp) => wp.targets.includes(cls))) continue;
      const d = dist(b.x, b.y, e.x, e.y);
      const s = (1000 - d * 20) * ((e.def.cost || 300) / 500);
      if (s > bestScore) { bestScore = s; best = e; }
    }
    return best;
  }

  // --------------------------------------------------------------- neutrals
  updateNeutrals(dt) {
    for (const n of this.world.neutrals) {
      if (n.disabled > 0) {
        n.disabled -= dt;
        if (n.disabled <= 0) { n.hp = n.hpMax * 0.5; n.owner = -1; }
        continue;
      }
      if (n.hp < n.hpMax) n.hp = Math.min(n.hpMax, n.hp + n.hpMax * 0.012 * dt);
      // Capture progress decays when nobody is standing on it.
      if (n.capturingBy >= 0) {
        let stillThere = false;
        const list = this.world.unitsNear(n.x, n.y, n.radius + 1.4, []);
        for (const u of list) {
          if (!u.dead && u.owner === n.capturingBy && u.def.canCapture && u.capturing === n) { stillThere = true; break; }
        }
        if (!stillThere) {
          n.captureProgress = Math.max(0, n.captureProgress - dt * 0.5);
          if (n.captureProgress <= 0) n.capturingBy = -1;
        }
      }
    }
  }

  captureNeutral(n, owner, by) {
    const prev = n.owner;
    n.owner = owner;
    if (n.type === 'objective') {
      const p = this.players[owner];
      p.credits += n.def.bounty;
      this.alerts.push({ type: 'objective', at: this.time, owner, x: n.x, y: n.y });
      this.pushMessage(owner, 'Strategic objective secured — +$' + n.def.bounty);
      n.owner = -1;
      n.disabled = 150;
      return;
    }
    this.alerts.push({ type: 'captured', at: this.time, owner, prev, x: n.x, y: n.y });
    if (owner === this.humanIndex) this.pushMessage(owner, n.def.name + ' captured');
    else if (prev === this.humanIndex) this.pushMessage(this.humanIndex, n.def.name + ' lost to the enemy', true);
    this.audio && this.audio.capture();
  }

  refreshObjective() {
    for (const n of this.world.neutrals) {
      if (n.type === 'objective' && n.disabled > 0 && n.disabled < 140) n.disabled = 0.1;
    }
  }

  // -------------------------------------------------------------------- fog
  updateFog(force) {
    for (const p of this.players) {
      const i = p.index;
      this.fog.clearVisible(i);
      if (!p.alive) continue;
      for (const u of p.units) {
        if (u.dead || u.loaded) continue;
        this.fog.stamp(i, u.x, u.y, u.def.vision);
      }
      for (const b of p.buildings) {
        if (b.dead) continue;
        this.fog.stamp(i, b.x, b.y, b.state === 'active' ? b.size + 5 : b.size + 2);
      }
      for (const n of this.world.neutrals) {
        if (n.owner === i) this.fog.stamp(i, n.x, n.y, 6);
      }
    }
    for (const r of this.reveals) {
      if (r.arriveAt !== undefined && this.time < r.arriveAt) continue;
      this.fog.stamp(r.owner, r.x, r.y, r.r);
    }
    // Allies share their picture.
    for (const p of this.players) {
      for (const q of this.players) {
        if (p === q || p.team !== q.team) continue;
        const a = this.fog.visible[p.index], b = this.fog.visible[q.index];
        const ea = this.fog.explored[p.index], eb = this.fog.explored[q.index];
        for (let k = 0; k < a.length; k++) { if (b[k]) { a[k] = 1; ea[k] = 1; } if (eb[k]) ea[k] = 1; }
      }
    }
  }

  /**
   * An opponent deployed as an "unknown commander" stays anonymous until the
   * player has actually watched enough of their construction and their forces.
   */
  updateIntel() {
    const me = this.humanIndex;
    if (me < 0) return;
    for (const p of this.players) {
      if (p.isHuman || p.identified || !p.commander) continue;
      let seen = 0;
      for (const b of p.buildings) {
        if (b.dead) continue;
        if (this.fog.isVisible(me, b.x, b.y)) seen += b.def.category === 'defence' ? 2 : 1.4;
      }
      for (const u of p.units) {
        if (u.dead || u.loaded) continue;
        if (this.fog.isVisible(me, u.x, u.y)) seen += 0.5;
      }
      p.intel = (p.intel || 0) + seen * 0.2;
      if (p.intel >= 24) {
        p.identified = true;
        const c = p.commander;
        this.pushMessage(me, 'INTELLIGENCE: ' + p.factionDef.abbr + ' opponent identified as ' + c.codename
          + ' (' + c.name + ') — ' + c.doctrine + ' doctrine. Weakness: ' + c.weakness);
        this.alerts.push({ type: 'identified', at: this.time, owner: p.index });
      }
    }
  }

  /** Warn once when the army has run dry and nothing is manufacturing rounds. */
  checkAmmoAlert() {
    const me = this.humanIndex;
    if (me < 0) return;
    const p = this.players[me];
    if (!p || !p.alive) return;
    if (p.ammoStock > 4 || p.ammoRate > 0) { this._ammoAlertAt = -999; return; }
    const dry = p.units.filter((u) => !u.dead && u.ammoMax > 0 && u.ammo <= 0).length;
    if (dry < 2) return;
    if (this.time - (this._ammoAlertAt || -999) < 45) return;
    this._ammoAlertAt = this.time;
    this.alerts.push({ type: 'noAmmo', at: this.time });
    this.pushMessage(me, dry + ' units have no ammunition and there is no munitions production.', true);
  }

  canSee(owner, x, y) {
    if (owner < 0) return true;
    if (this.revealAllFor === owner) return true;
    return this.fog.isVisible(owner, x, y);
  }

  isAllied(a, b) {
    if (a === b) return true;
    if (a < 0 || b < 0) return false;
    const pa = this.players[a], pb = this.players[b];
    if (!pa || !pb) return false;
    return pa.team === pb.team;
  }

  difficultyOf(i) { return this.players[i] ? this.players[i].difficulty : null; }

  enemiesOf(i) { return this.players.filter((p) => p.alive && !this.isAllied(i, p.index)); }

  // -------------------------------------------------------------- callbacks
  onUnitProduced(u, b) {
    if (u.owner === this.humanIndex) this.audio && this.audio.unitReady();
  }

  onUnitKilled(u, source) {
    const p = this.players[u.owner];
    if (p) { p.stats.losses++; const i = p.units.indexOf(u); if (i >= 0) p.units.splice(i, 1); }
    const killer = source && source.owner !== undefined ? this.players[source.owner] : null;
    if (killer && killer !== p) killer.stats.kills++;
    for (const ai of this.ai) ai.onUnitLost(u, source);
  }

  onBuildingComplete(b) {
    const p = this.players[b.owner];
    p.stats.built++;
    if (b.owner === this.humanIndex) {
      this.pushMessage(b.owner, b.def.name + ' operational');
      this.audio && this.audio.built();
    }
    recomputeInfrastructure(this, p);
  }

  onBuildingDestroyed(b, source) {
    const p = this.players[b.owner];
    if (p) {
      p.stats.structuresLost++;
      const i = p.buildings.indexOf(b); if (i >= 0) p.buildings.splice(i, 1);
      const ci = p.construction.indexOf(b); if (ci >= 0) p.construction.splice(ci, 1);
      const pad = p.pads.find((pd) => pd.id === b.padId);
      if (pad) pad.occupied = null;
      if (b.key === 'hq') this.defeatPlayer(p, source);
      recomputeInfrastructure(this, p);
      if (b.owner === this.humanIndex) {
        this.pushMessage(b.owner, b.def.name + ' destroyed', true);
        if (b.key === 'data') this.alerts.push({ type: 'dataLost', at: this.time });
      }
    }
    for (const ai of this.ai) ai.onBuildingLost(b, source);
  }

  onNeutralDisabled(n, source) {
    if (n.owner === this.humanIndex) this.pushMessage(this.humanIndex, n.def.name + ' knocked out', true);
  }

  onAbilityUsed(p, key, x, y) {
    p.stats.strikes++;
    const enemies = this.enemiesOf(p.index);
    for (const e of enemies) {
      if (e.isHuman) {
        this.alerts.push({ type: 'incoming', at: this.time, x, y, key });
        this.audio && this.audio.warning();
      }
    }
    for (const ai of this.ai) ai.onEnemyStrike(p, key, x, y);
  }

  notifyBaseAttack(target, source) {
    if (target.owner < 0) return;
    const p = this.players[target.owner];
    if (!p) return;
    p.lastAttackedAt = this.time;
    p.lastAttackPos = { x: target.x, y: target.y };
    if (p.isHuman && this.time - (this._lastBaseAlert || -99) > 9) {
      this._lastBaseAlert = this.time;
      this.alerts.push({ type: 'baseAttack', at: this.time, x: target.x, y: target.y });
      this.audio && this.audio.warning();
    }
    for (const ai of this.ai) if (ai.player.index === target.owner) ai.onAttacked(target, source);
  }

  notifyUnitAttack(target, source) {
    if (!source || source.owner === undefined) return;
    const p = this.players[target.owner];
    if (p) { p.lastAttackedAt = this.time; }
    // An idle unit that is being shot at will shoot back.
    if (target.kind === 'unit' && target.order.type === 'idle' && source.srcId) {
      const attacker = this.world.byId.get(source.srcId);
      if (attacker && !attacker.dead && attacker.kind === 'unit') {
        target.target = attacker;
        issueOrder(this, target, { type: 'guard', x: target.x, y: target.y });
        target.target = attacker;
      }
    }
    for (const ai of this.ai) if (ai.player.index === target.owner) ai.onUnitAttacked(target, source);
  }

  pushMessage(owner, text, bad) {
    if (owner !== this.humanIndex) return;
    this.messages.push({ text, at: this.time, bad: !!bad });
    if (this.messages.length > 40) this.messages.shift();
  }

  // ---------------------------------------------------------------- victory
  defeatPlayer(p, source) {
    if (!p.alive) return;
    p.alive = false;
    p.defeatedAt = this.time;
    this.pushMessage(this.humanIndex, p.name + ' has been eliminated.');
    // The command structure collapses: everything they own goes up over a few seconds.
    const all = [...p.buildings, ...p.units];
    all.forEach((e, i) => {
      this.pending.push({ at: this.time + 0.1 + i * 0.06 + this.rng() * 1.6, fn: () => { if (!e.dead) killEntity(this, e, null); } });
    });
  }

  checkVictory() {
    if (this.over) return;
    const alive = this.players.filter((p) => p.alive);
    const teams = new Set(alive.map((p) => p.team));
    const human = this.players[this.humanIndex];
    // The battle ends when one side is left standing — or the moment the player's
    // own headquarters falls, even if an allied commander is still fighting.
    const humanOut = this.humanIndex >= 0 && human && !human.alive;
    if (teams.size <= 1 || humanOut) {
      this.over = true;
      const won = !!(human && human.alive) && teams.size <= 1;
      this.result = {
        won, time: this.elapsed,
        survivors: alive.map((p) => p.name),
        stats: this.players.map((p) => ({
          name: p.name, faction: p.factionDef.abbr, colour: p.colour,
          kills: p.stats.kills, losses: p.stats.losses, built: p.stats.built,
          earned: Math.round(p.creditsEarned), alive: p.alive,
          commander: p.commander ? p.commander.codename : 'Human',
        })),
      };
    }
  }

  // ---------------------------------------------------------- command API
  retreatVector(u) {
    const p = this.players[u.owner];
    const home = p.hq && !p.hq.dead ? p.hq : (p.buildings[0] || { x: u.x, y: u.y });
    let dx = home.x - u.x, dy = home.y - u.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  /** Move a group, spreading them into a loose formation around the destination. */
  commandMove(units, x, y, attackMove) {
    const list = units.filter((u) => !u.dead && !u.loaded);
    if (!list.length) return;
    const cols = Math.ceil(Math.sqrt(list.length));
    const spacing = 1.25;
    list.sort((a, b) => (a.x - b.x) + (a.y - b.y));
    list.forEach((u, i) => {
      const cx = (i % cols) - (cols - 1) / 2;
      const cy = Math.floor(i / cols) - (Math.ceil(list.length / cols) - 1) / 2;
      let tx = x + cx * spacing, ty = y + cy * spacing;
      const spot = this.world.pf.nearestPassable(tx, ty, u.domain, u.heavy, 8);
      if (spot) { tx = spot.x + 0.5; ty = spot.y + 0.5; }
      issueOrder(this, u, { type: attackMove ? 'attackMove' : 'move', x: tx, y: ty });
    });
  }

  commandAttack(units, target) {
    for (const u of units) {
      if (u.dead) continue;
      u.target = target;
      issueOrder(this, u, { type: 'attack' });
      u.target = target;
    }
  }

  commandStop(units) {
    for (const u of units) { if (!u.dead) issueOrder(this, u, { type: 'guard', x: u.x, y: u.y }); }
  }

  commandCapture(units, target) {
    for (const u of units) {
      if (u.dead || !u.def.canCapture) continue;
      issueOrder(this, u, { type: 'capture', target });
    }
  }

  commandRepair(units, target) {
    for (const u of units) {
      if (u.dead) continue;
      if (u.def.repairsVehicles || u.def.repairsStructures) issueOrder(this, u, { type: 'repairTarget', target });
    }
  }

  commandLoad(units, transport) {
    for (const u of units) {
      if (u.dead || u === transport) continue;
      if (u.def.class !== 'infantry' && !(transport.def.cargo >= 6 && u.def.class === 'vehicle')) continue;
      issueOrder(this, u, { type: 'enter', target: transport });
    }
  }

  commandUnload(transports, x, y) {
    for (const t of transports) {
      if (t.dead || !t.cargo.length) continue;
      issueOrder(this, t, { type: 'unload', x, y });
    }
  }

  // ------------------------------------------------------------- structures
  padAvailableFor(p, key, pad) {
    if (pad.occupied && !pad.occupied.dead) return false;
    const def = getBuilding(key, p.faction, this.era);
    if (!def) return false;
    if (def.padType === 'naval') return pad.type === 'naval';
    if (pad.type === 'naval') return false;
    return true;
  }

  validPadsFor(p, key) {
    return p.pads.filter((pad) => this.padAvailableFor(p, key, pad));
  }

  startConstruction(p, key, pad) {
    const def = getBuilding(key, p.faction, this.era);
    if (!def) return { ok: false, reason: 'Unavailable' };
    const reason = structureBlockReason(this, p, key);
    if (reason) return { ok: false, reason };
    if (!this.padAvailableFor(p, key, pad)) return { ok: false, reason: 'Construction point unavailable' };
    p.credits -= def.cost;
    const b = makeBuilding(this.world, p.index, p.faction, this.era, key, pad.cx, pad.cy, { padId: pad.id });
    pad.occupied = b;
    p.buildings.push(b);
    p.construction.push(b);
    if (def.produces) b.rally = { x: b.x + 3, y: b.y + 4 };
    this.audio && p.isHuman && this.audio.build();
    return { ok: true, building: b };
  }

  sellBuilding(p, b) {
    if (b.key === 'hq' || b.dead) return false;
    p.credits += Math.round(b.def.cost * 0.5 * (b.state === 'active' ? 1 : b.progress));
    b.sold = true;
    killEntity(this, b, null);
    return true;
  }

  useAbility(p, key, x, y) { return useAbility(this, p, key, x, y); }
  abilityState(p, key) { return abilityState(this, p, key); }

  // ------------------------------------------------------------------ misc
  entityAt(x, y, ownerFilter) {
    const list = this.world.unitsNear(x, y, 1.4, []);
    let best = null, bestD = 99;
    for (const u of list) {
      if (u.dead || u.loaded) continue;
      const d = dist(u.x, u.y, x, y);
      if (d < u.radius + 0.45 && d < bestD) { bestD = d; best = u; }
    }
    if (best) return best;
    const bs = this.world.buildingsNear(x, y, 0.6, []);
    for (const b of bs) {
      if (b.dead) continue;
      if (x >= b.tx - 0.2 && x <= b.tx + b.size + 0.2 && y >= b.ty - 0.2 && y <= b.ty + b.size + 0.2) return b;
    }
    for (const n of this.world.neutrals) {
      if (dist(n.x, n.y, x, y) < n.radius + 0.6) return n;
    }
    return null;
  }

  rosterFor(p, category) { return rosterFor(p.faction, this.era, category); }
  structureListFor(p) { return structureList(p.faction, this.era, this.mapData.naval); }
  defenceListFor(p) { return defenceList(p.faction, this.era, this.mapData.naval); }
}
