// The AI commander. Everything it knows comes from what its own units can see,
// and every decision below is weighted by the doctrine block on its commander.

import { clamp, dist, TAU } from '../core/util.js';
import { getUnit } from '../data/units.js';
import { getBuilding } from '../data/buildings.js';
import { ABILITIES } from '../data/abilities.js';
import { queueUnit, structureBlockReason } from '../sim/economy.js';
import { issueOrder } from '../sim/movement.js';

const MEMORY_UNIT = 42;      // seconds an unseen enemy unit stays on the map picture
const MEMORY_BUILDING = 260; // buildings stay remembered far longer — they do not move

const TARGET_CATEGORIES = {
  hq: (e) => e.kind === 'building' && e.key === 'hq',
  power: (e) => e.kind === 'building' && e.key === 'power',
  data: (e) => e.kind === 'building' && (e.key === 'data'),
  sensors: (e) => e.kind === 'building' && (e.key === 'data' || e.key === 'radar'),
  production: (e) => e.kind === 'building' && ['factory', 'barracks', 'artillery', 'navalyard'].includes(e.key),
  artillery: (e) => (e.kind === 'building' && e.key === 'artillery') || (e.kind === 'unit' && (e.role === 'artillery' || e.role === 'rocketArtillery')),
  defence: (e) => e.kind === 'building' && ['mg', 'atgun', 'sam', 'coastal', 'patriot', 's400', 'hq9', 'irondome'].includes(e.key),
  airDefence: (e) => (e.kind === 'building' && ['sam', 'patriot', 's400', 'hq9', 'irondome'].includes(e.key)) || (e.kind === 'unit' && e.role === 'airDefence'),
  coastal: (e) => e.kind === 'building' && ['coastal', 'navalyard'].includes(e.key),
  economy: (e) => e.kind === 'neutral' || (e.kind === 'building' && e.key === 'oiladmin'),
  construction: (e) => e.kind === 'building' && e.constructing,
  army: (e) => e.kind === 'unit',
};

export class AI {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.c = player.commander;
    this.diff = player.difficulty;
    this.rng = game.rng;

    this.known = new Map();
    this.planTimer = this.rng() * 1.5;
    this.microTimer = 0;
    this.buildIndex = 0;
    this.waveNumber = 0;
    this.nextAttackAt = this.c.army.firstAttackAt / Math.max(0.6, this.diff.aggression);
    this.attackState = 'building';
    this.attackTarget = null;
    this.staging = null;
    this.groups = { main: [], defence: [], harass: [], scout: [], engineer: [], artillery: [] };
    this.threatAt = null;
    this.threatUntil = 0;
    this.scoutQueue = [];
    this.lastScoutAt = -99;
    this.bombardUntil = 0;
    this.decisive = false;
    this.saidOpen = false;

    // Running tally the doctrine uses to adapt mid-match.
    this.adapt = {
      lostToAT: 0, lostToArtillery: 0, lostToAir: 0, lostToDefence: 0,
      enemySams: 0, enemyStatic: 0, strikesIntercepted: 0, oilLost: 0,
      artilleryBoost: 0, airDefenceBoost: 0, groundShift: 0, siegeBoost: 0,
    };
    this.voiceCd = 0;
  }

  get world() { return this.game.world; }

  // ------------------------------------------------------------------ loop
  update(dt) {
    const p = this.player;
    if (!p.alive || this.game.over) return;
    this.voiceCd -= dt;

    this.microTimer -= dt;
    if (this.microTimer <= 0) {
      this.microTimer = 0.45;
      this.observe();
      this.microManage();
    }

    this.planTimer -= dt;
    if (this.planTimer <= 0) {
      this.planTimer = this.diff.reaction * (0.85 + this.rng() * 0.3);
      this.plan();
    }
  }

  say(kind) {
    if (this.voiceCd > 0 || !this.c.voice) return;
    const lines = this.c.voice[kind];
    if (!lines || !lines.length) return;
    this.voiceCd = 22;
    const who = this.player.identified ? this.c.codename : 'UNIDENTIFIED COMMANDER';
    this.game.messages.push({
      text: who + ': "' + lines[Math.floor(this.rng() * lines.length)] + '"',
      at: this.game.time, radio: true, colour: this.player.colour, commander: who,
    });
  }

  // ------------------------------------------------------------- perception
  /** Refresh the remembered enemy picture using only what this player can see. */
  observe() {
    const g = this.game, me = this.player.index, t = g.time;
    for (const u of this.world.units) {
      if (u.dead || u.loaded || g.isAllied(me, u.owner)) continue;
      if (!g.canSee(me, u.x, u.y)) continue;
      this.known.set(u.id, {
        id: u.id, ref: u, kind: 'unit', key: u.key, owner: u.owner,
        x: u.x, y: u.y, seenAt: t, role: u.def.role, cost: u.def.cost, armour: u.def.armour,
      });
    }
    for (const b of this.world.buildings) {
      if (b.dead || g.isAllied(me, b.owner)) continue;
      if (!g.canSee(me, b.x, b.y)) continue;
      this.known.set(b.id, {
        id: b.id, ref: b, kind: 'building', key: b.key, owner: b.owner,
        x: b.x, y: b.y, seenAt: t, cost: b.def.cost, constructing: b.state !== 'active',
      });
    }
    for (const n of this.world.neutrals) {
      if (!g.canSee(me, n.x, n.y)) continue;
      this.known.set(n.id, {
        id: n.id, ref: n, kind: 'neutral', key: n.type, owner: n.owner,
        x: n.x, y: n.y, seenAt: t, income: n.income,
      });
    }
    for (const [id, m] of this.known) {
      const age = t - m.seenAt;
      const limit = m.kind === 'unit' ? MEMORY_UNIT : MEMORY_BUILDING;
      if (m.ref && m.ref.dead && g.canSee(me, m.x, m.y)) { this.known.delete(id); continue; }
      if (age > limit) this.known.delete(id);
    }

    // Doctrine reads the shape of what it has seen.
    let sams = 0, statics = 0;
    for (const m of this.known.values()) {
      if (m.owner === this.player.index || m.owner < 0) continue;
      if (m.kind === 'building' && ['sam', 'patriot', 's400', 'hq9', 'irondome'].includes(m.key)) sams++;
      if (m.kind === 'building' && TARGET_CATEGORIES.defence(m)) statics++;
    }
    this.adapt.enemySams = sams;
    this.adapt.enemyStatic = statics;
  }

  knownList(filter) {
    const out = [];
    for (const m of this.known.values()) {
      if (m.owner === this.player.index) continue;
      if (m.owner >= 0 && this.game.isAllied(this.player.index, m.owner)) continue;
      if (m.ref && m.ref.dead) continue;
      if (filter && !filter(m)) continue;
      out.push(m);
    }
    return out;
  }

  // ------------------------------------------------------------------ plan
  plan() {
    const p = this.player;
    if (!this.saidOpen && this.game.time > 4) { this.saidOpen = true; this.say('open'); }
    this.assignRoles();
    this.planEconomy();
    this.planConstruction();
    this.planProduction();
    this.planAbilities();
    this.planMilitary();
  }

  // ---------------------------------------------------------------- economy
  planEconomy() {
    const p = this.player;
    const urgency = this.c.build.expandUrgency;
    const engineers = this.groups.engineer;
    const wanted = Math.round(clamp(2 + urgency * 2.5, 2, 5));

    // Send engineers at the best oil site they know about and do not already hold.
    const sites = this.knownList((m) => m.kind === 'neutral' && m.key !== 'objective' && m.owner !== p.index);
    const objectives = this.knownList((m) => m.kind === 'neutral' && m.key === 'objective' && m.ref && m.ref.disabled <= 0);
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];
    if (!home) return;

    for (const e of engineers) {
      const cur = e.order.type === 'capture' ? e.order.target : null;
      if (cur && !cur.dead && cur.disabled <= 0 && cur.owner !== p.index) continue;
      let best = null, bestScore = -1;
      for (const s of sites) {
        if (s.ref && s.ref.disabled > 0) continue;
        const d = dist(e.x, e.y, s.x, s.y);
        const contested = s.owner >= 0 ? 0.4 : 1;
        const claimed = engineers.some((o) => o !== e && o.order.type === 'capture' && o.order.target === s.ref);
        if (claimed) continue;
        // Deep raids for oil only make sense once we can escort the engineer there.
        const deep = home ? dist(home.x, home.y, s.x, s.y) : 0;
        const reach = 28 + urgency * 20 + this.game.time * 0.15;
        if (deep > reach) continue;
        const score = (s.income || 10) * contested * (1 + urgency) / (12 + d);
        if (score > bestScore) { bestScore = score; best = s; }
      }
      // Strategic objectives are a bonus, never a substitute for holding oil.
      for (const s of objectives) {
        if (home && dist(home.x, home.y, s.x, s.y) > 34 + urgency * 18) continue;
        const d = dist(e.x, e.y, s.x, s.y);
        const score = 9 / (12 + d);
        if (score > bestScore) { bestScore = score; best = s; }
      }
      if (best && best.ref) this.game.commandCapture([e], best.ref);
      else if (e.order.type === 'idle') {
        // Nothing to take that it knows of — go and look.
        const spot = this.explorationTarget();
        if (spot) issueOrder(this.game, e, { type: 'move', x: spot.x, y: spot.y });
      }
    }

    // Replace lost engineers.
    if (engineers.length < wanted) this.wantUnit = 'engineer';
    else this.wantUnit = null;
  }

  // ----------------------------------------------------------- construction
  planConstruction() {
    const p = this.player;
    if (p.construction.length >= p.maxConcurrent) return;
    if (!p.hq || p.hq.dead) return;

    // Advance the doctrine pointer past anything the order already got us.
    const order = this.c.build.order;
    while (this.buildIndex < order.length && this.orderSatisfied(this.buildIndex)) this.buildIndex++;

    let key = this.nextStructure();
    if (!key) return;

    // Build the missing prerequisite instead of abandoning the goal, and simply
    // wait when the prerequisite is already going up.
    const resolved = this.resolveDeps(key, 0);
    if (resolved === null) return;              // waiting on something in progress
    if (resolved === false) { this.skip(key); return; }
    key = resolved;

    const def = getBuilding(key, p.faction, p.era);
    const reason = structureBlockReason(this.game, p, key);
    if (reason) {
      if (reason === 'Insufficient funds' || reason === 'Construction bay busy') return;
      this.skip(key);
      return;
    }
    const pad = this.choosePad(key, def);
    if (!pad) { this.skip(key); return; }
    const r = this.game.startConstruction(p, key, pad);
    if (r.ok && def.category === 'defence') this.say('defend');
  }

  /** Count of a structure the player has finished or is currently building. */
  countBuildingIncl(key) {
    return this.player.buildings.filter((b) => !b.dead && b.key === key).length;
  }

  /** Has the build order's Nth entry been satisfied, allowing for repeats? */
  orderSatisfied(idx) {
    const order = this.c.build.order;
    const key = order[idx];
    let needed = 0;
    for (let i = 0; i <= idx; i++) if (order[i] === key) needed++;
    if (this.skipped && this.skipped.has(key)) return true;
    const def = getBuilding(key, this.player.faction, this.player.era);
    if (!def) return true;
    if (def.coastalOnly && !this.game.mapData.naval) return true;
    return this.countBuildingIncl(key) >= needed;
  }

  skip(key) {
    if (!this.skipped) this.skipped = new Set();
    this.skipped.add(key);
    const order = this.c.build.order;
    while (this.buildIndex < order.length && this.orderSatisfied(this.buildIndex)) this.buildIndex++;
  }

  /**
   * Returns the key to build now: either the goal, or the first prerequisite it
   * still needs. null means "wait, it is already under construction"; false means
   * "this can never be built here".
   */
  resolveDeps(key, depth) {
    if (depth > 5) return false;
    const p = this.player;
    const def = getBuilding(key, p.faction, p.era);
    if (!def) return false;
    if (def.coastalOnly && !this.game.mapData.naval) return false;
    for (const req of def.prereq) {
      const active = p.buildings.some((b) => !b.dead && b.key === req && b.state === 'active');
      if (active) continue;
      const pending = p.buildings.some((b) => !b.dead && b.key === req);
      if (pending) return null;
      return this.resolveDeps(req, depth + 1);
    }
    return key;
  }

  countBuilding(key) {
    return this.player.buildings.filter((b) => !b.dead && b.key === key).length;
  }

  /** Doctrine build order first, then adaptive choices for the rest of the match. */
  nextStructure() {
    const p = this.player, B = this.c.build;

    // Emergency: critical infrastructure lost, rebuild it before anything else.
    if (this.countBuildingIncl('power') === 0) return 'power';
    if (p.lowPower && !p.construction.some((b) => b.key === 'power')) return 'power';
    if (this.countBuildingIncl('barracks') === 0) return 'barracks';
    // Rebuild lost production before anything else: a commander with no factory
    // is a commander who has already lost.
    if (this.countBuildingIncl('factory') === 0 && p.buildings.some((b) => !b.dead && b.key === 'barracks' && b.state === 'active')) return 'factory';

    if (this.buildIndex < B.order.length) {
      const key = B.order[this.buildIndex];
      const def = getBuilding(key, p.faction, p.era);
      if (def && (!def.coastalOnly || this.game.mapData.naval)) {
        // Keep a healthy power margin before adding another heavy consumer.
        if (def.power < 0 && p.powerSupply - p.powerDemand + def.power < -2
            && !p.construction.some((b) => b.key === 'power')) return 'power';
        return key;
      }
      this.buildIndex++;
      return this.nextStructure();
    }

    // Adaptive phase.
    if (p.powerSupply - p.powerDemand < B.powerBuffer * 0.55) return 'power';

    const wantDefence = this.defenceSpendRatio();
    const defCount = p.buildings.filter((b) => !b.dead && b.def.category === 'defence' || (!b.dead && b.def.category === 'signature')).length;
    const prodCount = p.buildings.filter((b) => !b.dead && b.def.produces).length;

    if (this.game.mapData.naval && B.navalUrgency > 0.7 && this.countBuildingIncl('navalyard') < 1) return 'navalyard';
    if (this.countBuildingIncl('oiladmin') < 1 && p.oilSites >= 1) return 'oiladmin';
    if (p.oilSites > (p.oilCapacity || 2) && this.countBuildingIncl('oiladmin') < 3) return 'oiladmin';
    if (this.countBuildingIncl('repair') < 1 && this.countBuildingIncl('factory') >= 1) return 'repair';
    if (this.countBuildingIncl('radar') < 1) return 'radar';
    if (this.countBuildingIncl('data') < 1 && this.countBuildingIncl('radar') >= 1) return 'data';
    if (this.countBuildingIncl('artillery') < 1 && this.countBuildingIncl('factory') >= 1) return 'artillery';
    if (this.countBuildingIncl('awc') < 1 && this.countBuildingIncl('data') >= 1) return 'awc';

    if (defCount < wantDefence * 12) {
      const d = this.chooseDefence();
      if (d) return d;
    }
    if (prodCount < 2 + Math.round(B.secondFactory * 2.4) && p.credits > 3200) {
      if (this.countBuildingIncl('factory') < 1 + Math.round(B.secondFactory)) return 'factory';
      if (this.countBuilding('barracks') < 2) return 'barracks';
    }
    if (this.countBuildingIncl('oiladmin') < 2 && p.oilSites >= 3 && p.credits > 2600) return 'oiladmin';
    if (p.credits > 5000) {
      const d = this.chooseDefence();
      if (d) return d;
      return 'power';
    }
    return null;
  }

  defenceSpendRatio() {
    let r = this.c.build.defenceRatio;
    r += this.adapt.airDefenceBoost * 0.1;
    if (this.player.lastAttackedAt > this.game.time - 45) r += 0.1;
    return clamp(r, 0.04, 0.6);
  }

  chooseDefence() {
    const p = this.player;
    const list = this.game.defenceListFor(p);
    const have = (k) => p.buildings.filter((b) => !b.dead && b.key === k).length;
    const B = this.c.build;

    // Signature interceptor batteries once the technical base allows it.
    if (this.countBuildingIncl('awc') > 0) {
      for (const k of list) {
        const def = getBuilding(k, p.faction, p.era);
        if (def.category !== 'signature') continue;
        const want = (B.airDefenceBias ? 2 : 1) + (this.adapt.airDefenceBoost > 1 ? 1 : 0);
        if (have(k) < want && !structureBlockReason(this.game, p, k)) return k;
      }
    }
    if (this.game.mapData.naval && B.navalUrgency > 0.6 && have('coastal') < 2 && !structureBlockReason(this.game, p, 'coastal')) return 'coastal';
    const wantSam = 1 + Math.round((B.airDefenceBias || 0) * 2) + (this.adapt.airDefenceBoost > 0 ? 1 : 0);
    if (have('sam') < wantSam && !structureBlockReason(this.game, p, 'sam')) return 'sam';
    if (have('atgun') < 2 + Math.round(B.defenceRatio * 6) && !structureBlockReason(this.game, p, 'atgun')) return 'atgun';
    if (have('mg') < 2 + Math.round(B.defenceRatio * 5) && !structureBlockReason(this.game, p, 'mg')) return 'mg';
    return null;
  }

  /**
   * Structures go inside the perimeter, defences go on the approach the enemy
   * actually uses, and naval yards go on the shoreline pads.
   */
  choosePad(key, def) {
    const p = this.player;
    const pads = this.game.validPadsFor(p, key);
    if (!pads.length) return null;
    const isDefence = def.category === 'defence' || def.category === 'signature';
    const threat = this.threatDirection();
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];

    let best = null, bestScore = -1e9;
    for (const pad of pads) {
      let s = 0;
      const dx = pad.cx - home.x, dy = pad.cy - home.y;
      const dHome = Math.hypot(dx, dy);
      if (isDefence) {
        s += pad.forward ? 60 : 0;
        s += pad.preferDefence ? 25 : 0;
        if (threat) {
          const dot = (dx * threat.x + dy * threat.y) / Math.max(1, dHome);
          s += dot * 45;
        }
        // Interceptor batteries sit over the things they are protecting.
        if (def.category === 'signature') s += (28 - dHome) * 1.6;
      } else {
        s += (26 - dHome) * 2.2;
        if (def.critical || key === 'data' || key === 'power' || key === 'artillery') s += (22 - dHome) * 2.4;
        if (pad.forward) s -= 70;
      }
      s += this.rng() * 8;
      if (s > bestScore) { bestScore = s; best = pad; }
    }
    return best;
  }

  threatDirection() {
    const p = this.player;
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];
    if (!home) return null;
    let tx = 0, ty = 0, n = 0;
    if (p.lastAttackPos && this.game.time - p.lastAttackedAt < 90) {
      tx += p.lastAttackPos.x - home.x; ty += p.lastAttackPos.y - home.y; n++;
    }
    const enemies = this.game.enemiesOf(p.index);
    for (const e of enemies) {
      if (!e.hq || e.hq.dead) continue;
      tx += e.hq.x - home.x; ty += e.hq.y - home.y; n++;
    }
    if (!n) return null;
    const len = Math.hypot(tx, ty) || 1;
    return { x: tx / len, y: ty / len };
  }

  // ------------------------------------------------------------- production
  planProduction() {
    const p = this.player;
    if (p.units.length >= 92) return;               // performance ceiling
    const reserve = this.constructionReserve();
    // A commander saving for a big building still has to keep an army in the field.
    const floor = 7 + this.waveNumber * 1.5 + Math.round(this.c.army.attackSize * 0.35);
    const starving = p.units.length < floor;
    // An engineer is how a commander gets its economy back. One that has lost its
    // engineers must never hold money back for a building: it ends up buying rifle
    // sections it can afford instead of the engineer it cannot, so it never takes
    // another oil site, never earns more, and stays broke for the rest of the match.
    const mustRecover = this.wantUnit === 'engineer' && !this.groups.engineer.length;
    // Even a commander short of troops keeps something back for the next building.
    let budget = p.credits - (mustRecover ? 0 : starving ? reserve * 0.35 : reserve);
    if (budget <= (mustRecover ? 0 : 120)) return;

    const weights = this.currentWeights();
    let totalW = 0;
    for (const k of Object.keys(weights)) totalW += weights[k];
    if (totalW <= 0) return;

    const counts = {};
    for (const u of p.units) counts[u.key] = (counts[u.key] || 0) + 1;
    for (const b of p.buildings) for (const q of b.queue) counts[q.key] = (counts[q.key] || 0) + 0.85;
    const totalUnits = p.units.length + 1;
    const queueCap = this.diff.planQuality > 0.8 ? 3 : 2;

    // Work out each production building's best pick, and note what it would rather
    // be building if it could afford it.
    const picks = [];
    for (const b of p.buildings) {
      if (b.dead || b.state !== 'active' || !b.def.produces) continue;
      if (b.queue.length >= queueCap) continue;
      if (this.wantUnit && b.def.produces.includes(this.wantUnit)) {
        picks.push({ b, key: this.wantUnit, deficit: 1e9 });
        continue;
      }
      let best = null, bestDef = -1e9, blockedDef = -1e9, blocked = null;
      for (const key of b.def.produces) {
        const w = weights[key];
        if (!w) continue;
        const def = getUnit(p.faction, p.era, key);
        if (!def) continue;
        const deficit = (w / totalW) * totalUnits - (counts[key] || 0);
        if (def.cost > budget) {
          if (deficit > blockedDef) { blockedDef = deficit; blocked = def; }
          continue;
        }
        if (deficit > bestDef) { bestDef = deficit; best = key; }
      }
      picks.push({ b, key: best, deficit: bestDef, blockedDef, blocked });
    }
    picks.sort((a, c) => c.deficit - a.deficit);

    for (const pick of picks) {
      if (!pick.key || pick.deficit < -0.35) continue;
      // Hold the money rather than filling the queue with cheap substitutes when
      // the doctrine really wants something expensive.
      if (pick.blocked && pick.blockedDef > pick.deficit + 1.1 && this.rng() < this.diff.planQuality) continue;
      const def = getUnit(p.faction, p.era, pick.key);
      if (!def || def.cost > budget) continue;
      if (queueUnit(this.game, p, pick.b, pick.key)) {
        budget -= def.cost;
        counts[pick.key] = (counts[pick.key] || 0) + 1;
      }
    }
  }

  constructionReserve() {
    const p = this.player;
    let r = 350;
    if (p.construction.length < p.maxConcurrent) {
      const next = this.nextStructure();
      if (next) {
        const def = getBuilding(next, p.faction, p.era);
        if (def) r = Math.min(def.cost * 0.62, 1500);
      }
    }
    if (this.c.army.abilityBias > 1.6) r += 320;
    return r;
  }

  /** Doctrine weights, adjusted by what the enemy has actually been doing. */
  currentWeights() {
    const p = this.player;
    const base = this.c.army.weights;
    const out = {};
    const avail = new Set();
    for (const b of p.buildings) {
      if (b.dead || b.state !== 'active' || !b.def.produces) continue;
      for (const k of b.def.produces) avail.add(k);
    }
    for (const k of Object.keys(base)) {
      if (!avail.has(k)) continue;
      if (!getUnit(p.faction, p.era, k)) continue;
      out[k] = base[k];
    }
    const A = this.adapt;
    // Repeatedly stopped by dug-in anti-tank teams? Bring the guns forward.
    if (A.artilleryBoost > 0) {
      for (const k of ['spg', 'mlrs', 'himars', 'phl16']) if (out[k]) out[k] *= 1 + Math.min(1.6, A.artilleryBoost * 0.5);
      if (out.rifle) out.rifle *= 1.25;
    }
    // Losing units to air and missile attack? Buy air defence.
    if (A.airDefenceBoost > 0) {
      if (out.aa) out.aa *= 1 + Math.min(1.8, A.airDefenceBoost * 0.45);
      if (out.manpads) out.manpads *= 1 + Math.min(1.8, A.airDefenceBoost * 0.5);
    }
    // Strikes keep getting intercepted? Fight on the ground instead.
    if (A.groundShift > 0) {
      for (const k of ['mbt', 'ifv', 'apc', 'rifle', 'at']) if (out[k]) out[k] *= 1 + Math.min(1.2, A.groundShift * 0.35);
    }
    // Enemy is turtling behind static defences? Bring siege weight.
    if (A.siegeBoost > 0) {
      for (const k of ['spg', 'mlrs', 'himars', 'phl16']) if (out[k]) out[k] *= 1 + Math.min(1.5, A.siegeBoost * 0.4);
      if (out.sf) out.sf *= 1.6;
    }
    // Heavy losses to enemy armour? More anti-tank.
    if (A.lostToArmour > 0 && out.at) out.at *= 1 + Math.min(1.3, A.lostToArmour * 0.12);
    return out;
  }

  // -------------------------------------------------------------- abilities
  planAbilities() {
    const p = this.player;
    const bias = this.c.army.abilityBias;
    if (bias <= 0) return;
    const keys = Object.keys(p.abilities);
    for (const key of keys) {
      const st = this.game.abilityState(p, key);
      if (!st.ok) continue;
      const a = ABILITIES[key];
      // Cheaper commanders hold fire until they have a worthwhile target.
      if (this.rng() > clamp(0.25 * bias, 0.1, 0.95)) continue;
      const target = this.chooseStrikeTarget(a);
      if (!target) continue;
      const r = this.game.useAbility(p, key, target.x, target.y);
      if (r.ok) { this.say('strike'); return; }
    }
  }

  chooseStrikeTarget(a) {
    const p = this.player;
    const priorities = this.c.targeting;

    if (a.payload.reveal && !a.payload.count) {
      // Pure reconnaissance: look where the picture is oldest and most valuable.
      const spot = this.explorationTarget(true);
      return spot;
    }
    if (a.payload.hunt) {
      // Loitering munitions want a cluster of vehicles.
      let best = null, bestScore = 0;
      for (const m of this.knownList((x) => x.kind === 'unit')) {
        if (this.game.time - m.seenAt > 16) continue;
        let score = 0;
        for (const o of this.knownList((x) => x.kind === 'unit')) {
          if (dist(m.x, m.y, o.x, o.y) < 7) score += (o.cost || 300) / 300 * (o.role === 'artillery' || o.role === 'rocketArtillery' ? 2.5 : 1);
        }
        if (score > bestScore) { bestScore = score; best = m; }
      }
      if (bestScore >= 3) return best;
      return null;
    }
    // Everything else wants a building, chosen by doctrine priority.
    for (const cat of priorities) {
      const f = TARGET_CATEGORIES[cat];
      if (!f) continue;
      const list = this.knownList((m) => m.kind === 'building' && f(m));
      if (!list.length) continue;
      list.sort((x, y) => (y.cost || 0) - (x.cost || 0));
      return list[0];
    }
    const any = this.knownList((m) => m.kind === 'building');
    return any.length ? any[0] : null;
  }

  // --------------------------------------------------------------- military
  assignRoles() {
    const p = this.player;
    const g = { main: [], defence: [], harass: [], scout: [], engineer: [], artillery: [] };
    const army = [];
    for (const u of p.units) {
      if (u.dead || u.loaded) continue;
      const role = u.def.role;
      if (role === 'engineer') { g.engineer.push(u); continue; }
      if (role === 'artillery' || role === 'rocketArtillery' || role === 'navalArtillery') { g.artillery.push(u); continue; }
      army.push(u);
    }
    // Scouting is a luxury a beaten commander cannot afford. The quota is taken
    // off the top of the army, so a force down to one or two units sent every one
    // of them wandering and left nothing at home — and a lone enemy raider parked
    // by the factory then killed each replacement as it rolled out, for the rest
    // of the match. Never let scouting take the last two defenders.
    const wantScouts = Math.min(
      clamp(Math.round(1 + this.c.build.expandUrgency * 2), 1, 4),
      Math.max(0, army.length - 2));
    const scouts = army.filter((u) => u.def.role === 'scout');
    for (let i = 0; i < Math.min(wantScouts, scouts.length); i++) g.scout.push(scouts[i]);

    const rest = army.filter((u) => !g.scout.includes(u));
    const total = rest.length;
    const e = this.escalation();
    const garrison = this.c.army.garrisonRatio * (e >= 3 ? 0.06 : e === 2 ? 0.25 : e === 1 ? 0.55 : 1);
    // Whatever the doctrine says, something stays home while the base is being
    // shot at — a ratio of a very small army rounds to nobody at all.
    const beingAttacked = this.game.time - p.lastAttackedAt < 25;
    const wantDefence = Math.max(beingAttacked ? Math.min(total, 2) : 0, Math.round(total * garrison));
    const wantHarass = Math.round(total * this.c.army.harassRatio);

    // Keep previous assignments where possible so groups do not churn every tick.
    const prev = this.groups;
    const stable = (u, list) => list.includes(u);
    for (const u of rest) {
      if (g.defence.length < wantDefence && stable(u, prev.defence)) g.defence.push(u);
      else if (g.harass.length < wantHarass && stable(u, prev.harass)) g.harass.push(u);
    }
    for (const u of rest) {
      if (g.defence.includes(u) || g.harass.includes(u)) continue;
      if (g.defence.length < wantDefence) g.defence.push(u);
      else if (g.harass.length < wantHarass) g.harass.push(u);
      else g.main.push(u);
    }
    this.groups = g;
  }

  planMilitary() {
    const p = this.player;
    const t = this.game.time;

    this.runScouts();
    this.runDefence();
    this.runHarass();

    // Defensive commanders eventually have to come out and win the game.
    if (!this.decisive && this.c.army.decisiveOffensiveAt && t > this.c.army.decisiveOffensiveAt) {
      this.decisive = true;
      this.nextAttackAt = t;
      this.say('final');
    }

    const main = this.groups.main;
    const needed = this.requiredAttackSize();

    if (this.attackState === 'building') {
      const surplus = main.length >= needed * 1.7 && main.length >= 8;
      if ((t >= this.nextAttackAt || surplus) && main.length >= needed) {
        this.attackTarget = this.chooseAttackTarget();
        if (this.attackTarget) {
          this.staging = this.stagingPoint(this.attackTarget);
          this.attackState = 'gathering';
          this.gatherUntil = t + 22;
          this.attackDeadline = t + 135;
          this.say('attack');
        } else {
          this.nextAttackAt = t + 12;
        }
      } else {
        this.holdMain();
      }
      return;
    }

    // Re-evaluate the objective regularly: targets die, change hands, or turn out
    // to be the wrong thing to be standing on.
    if (!this.targetValid(this.attackTarget) || t > (this.attackDeadline || 0)) {
      const next = this.chooseAttackTarget();
      if (!next) { this.endAttack(); return; }
      this.attackTarget = next;
      this.attackDeadline = t + 105;
      this.staging = this.stagingPoint(next);
      for (const u of main) if (u.order.type === 'attackMove') issueOrder(this.game, u, { type: 'idle' });
    }

    if (this.attackState === 'gathering') {
      const centre = this.centroid(main);
      let ready = 0;
      for (const u of main) {
        if (dist(u.x, u.y, this.staging.x, this.staging.y) < 9) ready++;
        if (u.order.type === 'idle' || (u.order.type !== 'attackMove' && u.order.type !== 'move')) {
          issueOrder(this.game, u, { type: 'move', x: this.staging.x + (this.rng() - 0.5) * 5, y: this.staging.y + (this.rng() - 0.5) * 5 });
        }
      }
      this.positionArtillery(centre);
      if (ready >= main.length * 0.65 || this.game.time > this.gatherUntil) {
        this.attackState = this.c.army.bombardFirst ? 'bombarding' : 'advancing';
        this.bombardUntil = this.game.time + 26;
        this.attackDeadline = this.game.time + 105;
      }
      return;
    }

    if (this.attackState === 'bombarding') {
      const centre = this.centroid(main);
      this.positionArtillery(centre, this.attackTarget);
      for (const u of main) {
        if (u.order.type === 'idle') issueOrder(this.game, u, { type: 'guard', x: u.x, y: u.y });
      }
      const artyInRange = this.groups.artillery.some((a) => dist(a.x, a.y, this.attackTarget.x, this.attackTarget.y) < (a.def.weapons[0] ? a.def.weapons[0].range : 15));
      if (this.game.time > this.bombardUntil || (!artyInRange && this.game.time > this.bombardUntil - 16)) {
        this.attackState = 'advancing';
        this.attackDeadline = this.game.time + 105;
      }
      return;
    }

    if (this.attackState === 'advancing') {
      const tgt = this.attackTarget;
      for (const u of main) {
        const busy = u.order.type === 'attack' && u.target && !u.target.dead;
        if (busy) continue;
        if (u.order.type !== 'attackMove' || dist(u.order.x, u.order.y, tgt.x, tgt.y) > 6) {
          issueOrder(this.game, u, { type: 'attackMove', x: tgt.x + (this.rng() - 0.5) * 5, y: tgt.y + (this.rng() - 0.5) * 5 });
        }
      }
      this.positionArtillery(this.centroid(main), tgt);
      const alive = main.filter((u) => !u.dead);
      if (alive.length < needed * 0.32) {
        this.say('losing');
        this.endAttack(true);
      }
      return;
    }
  }

  /** A target we are already standing on, or that has changed hands, is finished. */
  targetValid(m) {
    if (!m) return false;
    if (m.kind === 'guess') return true;
    const ref = m.ref;
    if (!ref) return true;
    if (ref.dead) return false;
    if (m.kind === 'neutral') {
      if (ref.owner === this.player.index) return false;
      if (this.game.isAllied(this.player.index, ref.owner)) return false;
      if (ref.disabled > 0) return false;
    }
    return true;
  }

  /**
   * How committed every commander is by now. Two cautious doctrines facing each
   * other would otherwise trade bombardments forever, so past eighteen minutes
   * the thresholds fall and the garrisons come off the wall.
   */
  escalation() {
    const t = this.game.time;
    // Past half an hour two entrenched commanders can grind each other
    // indefinitely, each rebuilding faster than the other can break through. At
    // that point both stop holding anything back and go for the headquarters.
    // Thirty-five minutes left too little road to cross the largest map on.
    if (t > 1800) return 3;
    if (t > 1500) return 2;
    if (t > 1080) return 1;
    return 0;
  }

  requiredAttackSize() {
    const a = this.c.army;
    // Waves grow, but never to the point where the commander just hoards.
    let n = Math.min(a.attackSize + this.waveNumber * a.attackGrowth, a.attackSize * 2.1 + 7);
    n /= clamp(this.diff.aggression, 0.6, 1.5);
    if (this.decisive) n *= 1.25;
    if (this.dominant()) n *= 0.6;
    const e = this.escalation();
    if (e === 1) n *= 0.6;
    else if (e === 2) n *= 0.35;
    else if (e >= 3) n *= 0.2;
    return Math.max(3, Math.round(n));
  }

  /** Are we clearly winning? If so, stop shopping and go and end it. */
  dominant() {
    const t = this.game.time;
    let enemyArmy = 0, seen = 0, enemyBuildings = 0;
    for (const m of this.known.values()) {
      if (m.owner === this.player.index) continue;
      if (this.game.isAllied(this.player.index, m.owner)) continue;
      if (m.kind === 'building' && m.ref && !m.ref.dead) enemyBuildings++;
      if (m.kind !== 'unit') continue;
      if (t - m.seenAt > 45) continue;
      seen++;
      enemyArmy += m.cost || 300;
    }
    // Dominance is a judgement about what we have actually observed. An empty map
    // picture means we have not scouted, not that the enemy has no army.
    if (seen < 3 && enemyBuildings < 4) return false;
    let mine = 0;
    for (const u of this.groups.main) mine += u.def.cost || 300;
    return mine > enemyArmy * 2 + 4500;
  }

  endAttack(withdraw) {
    this.attackState = 'building';
    this.waveNumber++;
    const e = this.escalation();
    const interval = this.c.army.attackInterval * (e === 2 ? 0.4 : e === 1 ? 0.65 : 1);
    this.nextAttackAt = this.game.time + interval / clamp(this.diff.aggression, 0.6, 1.6);
    this.attackTarget = null;
    if (withdraw) {
      const home = this.rallyPoint();
      for (const u of this.groups.main) issueOrder(this.game, u, { type: 'move', x: home.x + (this.rng() - 0.5) * 8, y: home.y + (this.rng() - 0.5) * 8 });
    }
  }

  holdMain() {
    const home = this.rallyPoint();
    for (const u of this.groups.main) {
      if (u.order.type === 'idle') {
        issueOrder(this.game, u, { type: 'guard', x: home.x + (this.rng() - 0.5) * 9, y: home.y + (this.rng() - 0.5) * 9 });
      }
    }
    this.positionArtillery(home);
  }

  rallyPoint() {
    const p = this.player;
    const home = p.hq && !p.hq.dead ? p.hq : (p.buildings[0] || { x: 64, y: 64 });
    const dir = this.threatDirection() || { x: 0, y: 1 };
    return { x: clamp(home.x + dir.x * 13, 4, this.world.width - 5), y: clamp(home.y + dir.y * 13, 4, this.world.height - 5) };
  }

  centroid(list) {
    if (!list.length) return this.rallyPoint();
    let x = 0, y = 0;
    for (const u of list) { x += u.x; y += u.y; }
    return { x: x / list.length, y: y / list.length };
  }

  /** Guns sit behind the armour, at a stand-off matched to their own range. */
  positionArtillery(centre, target) {
    const arty = this.groups.artillery;
    if (!arty.length) return;
    const depth = 5 + this.c.army.formationDepth * 5;
    let dirX = 0, dirY = -1;
    if (target) {
      dirX = target.x - centre.x; dirY = target.y - centre.y;
      const l = Math.hypot(dirX, dirY) || 1; dirX /= l; dirY /= l;
    } else {
      const d = this.threatDirection(); if (d) { dirX = d.x; dirY = d.y; }
    }
    arty.forEach((u, i) => {
      if (u.scootUntil > this.game.time) return;
      const w = u.def.weapons[0];
      const range = w ? w.range : 15;
      let px, py;
      if (target) {
        const stand = Math.min(range * 0.84, dist(centre.x, centre.y, target.x, target.y) + depth);
        px = target.x - dirX * stand;
        py = target.y - dirY * stand;
      } else {
        px = centre.x - dirX * depth;
        py = centre.y - dirY * depth;
      }
      px += ((i % 3) - 1) * 2.4;
      py += (Math.floor(i / 3) - 1) * 2.4;
      px = clamp(px, 3, this.world.width - 4); py = clamp(py, 3, this.world.height - 4);
      if (u.order.type === 'attack' && u.target && !u.target.dead) return;
      if (u.order.type === 'move' && dist(u.order.x, u.order.y, px, py) < 3.5) return;
      if (u.order.type === 'guard' && dist(u.x, u.y, px, py) < 3.5) return;
      issueOrder(this.game, u, { type: 'attackMove', x: px, y: py });
    });
  }

  chooseAttackTarget() {
    const p = this.player;
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];
    if (!home) return null;
    // Once we are clearly on top — or the match has run long — go for the throat.
    let priorities = this.c.targeting;
    const forTheThroat = this.dominant() || this.escalation() > 0 || this.decisive;
    if (forTheThroat) {
      priorities = ['hq'].concat(priorities.filter((c) => c !== 'hq'));
    }

    let best = null, bestScore = -1e9;
    for (let i = 0; i < priorities.length; i++) {
      const cat = priorities[i];
      const f = TARGET_CATEGORIES[cat];
      if (!f) continue;
      const weight = (priorities.length - i) * 40;
      for (const m of this.knownList(f)) {
        if (m.kind === 'unit' && this.game.time - m.seenAt > 22) continue;
        if (m.kind === 'neutral' && (m.owner < 0 || !this.targetValid(m))) continue;
        if (m.kind === 'building' && m.ref && m.ref.dead) continue;
        const d = dist(home.x, home.y, m.x, m.y);
        const guarded = this.defenceNear(m.x, m.y);
        // Distance normally decides between targets of similar value. But once a
        // commander has decided to go for the headquarters, distance must not
        // quietly send the army off to a nearer oil derrick instead — on a large
        // map the enemy HQ is always the furthest thing away, and that is exactly
        // where the battle is won. An HQ sitting behind a ring of emplacements is
        // a different proposition: strip the base first rather than marching the
        // whole army across the map into prepared fire.
        const throat = forTheThroat && cat === 'hq' && (guarded < 2 || this.escalation() >= 3);
        let s = weight - d * (throat ? 0.35 : 1.4);
        s += (m.cost || 200) / 60;
        // Avoid walking straight into a wall of known defences unless we brought guns.
        s -= guarded * (this.groups.artillery.length > 1 ? 12 : 34);
        if (s > bestScore) { bestScore = s; best = m; }
      }
      if (best && i >= 1) break;
    }
    if (!best) {
      // No picture at all: push toward the nearest enemy start position.
      const enemies = this.game.enemiesOf(p.index);
      if (!enemies.length) return null;
      let bd = 1e9, be = null;
      for (const e of enemies) {
        const st = this.game.mapData.starts[e.startIndex];
        const d = dist(home.x, home.y, st.x, st.y);
        if (d < bd) { bd = d; be = st; }
      }
      return be ? { x: be.x, y: be.y, kind: 'guess' } : null;
    }
    return best;
  }

  defenceNear(x, y) {
    let n = 0;
    for (const m of this.known.values()) {
      if (m.kind !== 'building' || m.owner === this.player.index) continue;
      if (!TARGET_CATEGORIES.defence(m)) continue;
      if (dist(m.x, m.y, x, y) < 11) n++;
    }
    return n;
  }

  stagingPoint(target) {
    const p = this.player;
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];
    const t = 0.62;
    return {
      x: clamp(home.x + (target.x - home.x) * t, 4, this.world.width - 5),
      y: clamp(home.y + (target.y - home.y) * t, 4, this.world.height - 5),
    };
  }

  // ------------------------------------------------------------ sub-groups
  runScouts() {
    for (const u of this.groups.scout) {
      if (u.order.type === 'move' && !u.dead) {
        if (dist(u.x, u.y, u.order.x, u.order.y) > 3) continue;
      }
      if (u.order.type === 'attack') continue;
      const spot = this.explorationTarget();
      if (spot) issueOrder(this.game, u, { type: 'move', x: spot.x, y: spot.y });
    }
  }

  /** Pick somewhere worth looking at: unexplored, or a stale part of the picture. */
  explorationTarget(preferEnemy) {
    const g = this.game, me = this.player.index;
    const w = this.world;
    const enemies = g.enemiesOf(me);
    const candidates = [];
    for (const e of enemies) {
      const st = g.mapData.starts[e.startIndex];
      candidates.push({ x: st.x, y: st.y, w: preferEnemy ? 3 : 1.6 });
    }
    for (const n of w.neutrals) {
      if (n.type === 'objective') continue;
      candidates.push({ x: n.x, y: n.y, w: n.owner === me ? 0.15 : 1.3 });
    }
    for (let i = 0; i < 8; i++) {
      candidates.push({ x: 6 + this.rng() * (w.width - 12), y: 6 + this.rng() * (w.height - 12), w: 0.6 });
    }
    let best = null, bestScore = -1e9;
    for (const c of candidates) {
      const explored = g.fog.isExplored(me, c.x, c.y) ? 1 : 0;
      const visible = g.fog.isVisible(me, c.x, c.y) ? 1 : 0;
      let s = c.w * 100 - explored * 40 - visible * 70 + this.rng() * 25;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  }

  /** How much enemy combat power do we currently believe is inside our own base? */
  threatSeverity() {
    const p = this.player;
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];
    if (!home) return 0;
    let power = 0;
    for (const m of this.known.values()) {
      if (m.kind !== 'unit' || m.owner === p.index) continue;
      if (this.game.isAllied(p.index, m.owner)) continue;
      if (this.game.time - m.seenAt > 18) continue;
      if (dist(m.x, m.y, home.x, home.y) > 26) continue;
      power += (m.cost || 300) / 500;
    }
    return power;
  }

  runDefence() {
    const p = this.player;
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];
    if (!home) return;
    const underAttack = this.game.time - p.lastAttackedAt < 25 && p.lastAttackPos;
    const anchor = underAttack ? p.lastAttackPos : home;

    for (const u of this.groups.defence) {
      if (u.order.type === 'attack' && u.target && !u.target.dead) continue;
      const d = dist(u.x, u.y, anchor.x, anchor.y);
      if (underAttack && d > 6) {
        issueOrder(this.game, u, { type: 'attackMove', x: anchor.x + (this.rng() - 0.5) * 5, y: anchor.y + (this.rng() - 0.5) * 5 });
      } else if (!underAttack && d > 17) {
        issueOrder(this.game, u, { type: 'move', x: home.x + (this.rng() - 0.5) * 16, y: home.y + (this.rng() - 0.5) * 16 });
      } else if (u.order.type === 'idle') {
        issueOrder(this.game, u, { type: 'guard', x: u.x, y: u.y });
      }
    }

    // A serious incursion, or damage to the headquarters, recalls the field army.
    const severity = underAttack ? this.threatSeverity() : 0;
    const hqHurt = p.hq && !p.hq.dead && p.hq.hp < p.hq.hpMax * 0.94;
    const emergency = hqHurt || severity > 2.2;
    if (underAttack && emergency && this.attackState !== 'advancing') {
      for (const u of this.groups.main) {
        if (u.order.type === 'attack' && u.target && !u.target.dead && dist(u.x, u.y, home.x, home.y) < 24) continue;
        if (dist(u.x, u.y, anchor.x, anchor.y) > 9) {
          issueOrder(this.game, u, { type: 'attackMove', x: anchor.x + (this.rng() - 0.5) * 7, y: anchor.y + (this.rng() - 0.5) * 7 });
        }
      }
      if (this.attackState === 'gathering' || this.attackState === 'bombarding') {
        this.attackState = 'building';
        this.nextAttackAt = this.game.time + 40;
      }
      this.say('defend');
    } else if (underAttack && emergency && this.attackState === 'advancing') {
      // Already committed: finish the push unless the headquarters is in real danger.
      if (p.hq && !p.hq.dead && p.hq.hp < p.hq.hpMax * 0.62) {
        this.endAttack(true);
        this.say('losing');
      }
    }
    if (underAttack && this.c.army.counterAttack > 0.6 && this.attackState === 'building') {
      // Bastion-style: let them commit, then hit back sooner than planned.
      this.nextAttackAt = Math.min(this.nextAttackAt, this.game.time + 30);
    }
  }

  runHarass() {
    const harass = this.groups.harass;
    if (!harass.length) return;
    const busy = harass.filter((u) => u.order.type === 'attackMove' || (u.order.type === 'attack' && u.target && !u.target.dead));
    if (busy.length > harass.length * 0.6) return;

    // Soft targets: undefended oil, engineers, construction sites, lone artillery.
    let best = null, bestScore = -1e9;
    const cats = ['economy', 'construction', 'artillery', 'production'];
    for (let i = 0; i < cats.length; i++) {
      const f = TARGET_CATEGORIES[cats[i]];
      for (const m of this.knownList(f)) {
        if (m.kind === 'neutral' && m.owner < 0) continue;
        const guarded = this.defenceNear(m.x, m.y);
        const d = dist(harass[0].x, harass[0].y, m.x, m.y);
        const s = (cats.length - i) * 30 - d * 1.1 - guarded * 40;
        if (s > bestScore) { bestScore = s; best = m; }
      }
    }
    if (!best) {
      const spot = this.explorationTarget(true);
      if (spot) for (const u of harass) issueOrder(this.game, u, { type: 'attackMove', x: spot.x, y: spot.y });
      return;
    }
    const prong = this.c.army.multiProng ? 2 : 1;
    const per = Math.ceil(harass.length / prong);
    harass.forEach((u, i) => {
      const jitter = Math.floor(i / per);
      issueOrder(this.game, u, {
        type: 'attackMove',
        x: clamp(best.x + (jitter ? 6 : -6) + (this.rng() - 0.5) * 4, 3, this.world.width - 4),
        y: clamp(best.y + (this.rng() - 0.5) * 6, 3, this.world.height - 4),
      });
    });
  }

  // ------------------------------------------------------------------ micro
  microManage() {
    const p = this.player;
    const skill = this.diff.microSkill;
    if (skill <= 0.05) return;
    const thresh = this.c.army.retreatThreshold;
    const depot = p.buildings.find((b) => !b.dead && b.key === 'repair' && b.state === 'active');
    const home = p.hq && !p.hq.dead ? p.hq : p.buildings[0];

    for (const u of p.units) {
      if (u.dead || u.loaded) continue;
      const frac = u.hp / u.hpMax;
      const valuable = (u.def.cost || 0) >= 700 || u.def.role === 'artillery' || u.def.role === 'rocketArtillery';
      if (valuable && frac < thresh && this.rng() < skill) {
        const dest = depot || home;
        if (dest && dist(u.x, u.y, dest.x, dest.y) > 5) {
          if (u.order.type !== 'move' || !u.order.retreat) {
            issueOrder(this.game, u, { type: 'move', x: dest.x + (this.rng() - 0.5) * 4, y: dest.y + (this.rng() - 0.5) * 4, retreat: true });
          }
          continue;
        }
      }
      // Repaired and rearmed: back to the group.
      if (u.order.type === 'move' && u.order.retreat && frac > 0.86 && u.ammo >= u.ammoMax * 0.7) {
        issueOrder(this.game, u, { type: 'guard', x: u.x, y: u.y });
      }
      // Artillery that has run dry falls back to resupply rather than sitting exposed.
      if (u.ammoMax > 0 && u.ammo <= 0 && (u.def.role === 'artillery' || u.def.role === 'rocketArtillery')) {
        if (home && dist(u.x, u.y, home.x, home.y) > 12 && u.order.type !== 'move') {
          issueOrder(this.game, u, { type: 'move', x: home.x, y: home.y, retreat: true });
        }
      }
    }

    // Amphibious doctrine: load a landing force and put it ashore behind the line.
    if (this.c.army.amphibious && this.game.mapData.naval) this.runAmphibious();
  }

  runAmphibious() {
    const p = this.player;
    const craft = p.units.filter((u) => !u.dead && u.key === 'landing');
    if (!craft.length) return;
    for (const c of craft) {
      if (c.cargo.length === 0) {
        if (c.order.type !== 'idle' && c.order.type !== 'guard') continue;
        const passengers = this.groups.main.filter((u) => u.def.class === 'infantry' || u.def.class === 'vehicle').slice(0, c.def.cargo);
        if (passengers.length >= Math.min(4, c.def.cargo)) this.game.commandLoad(passengers, c);
      } else if (c.order.type === 'idle' || c.order.type === 'guard') {
        const tgt = this.chooseAttackTarget();
        if (!tgt) continue;
        const beach = this.findBeachNear(tgt.x, tgt.y);
        if (beach) { issueOrder(this.game, c, { type: 'unload', x: beach.x, y: beach.y }); this.say('attack'); }
      }
    }
  }

  findBeachNear(x, y) {
    const w = this.world;
    for (let r = 3; r < 26; r += 2) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * TAU;
        const nx = Math.round(x + Math.cos(ang) * r), ny = Math.round(y + Math.sin(ang) * r);
        if (!w.inBounds(nx, ny)) continue;
        if (w.passable(nx, ny, 'naval', false) && this.hasLandAdjacent(nx, ny)) return { x: nx + 0.5, y: ny + 0.5 };
      }
    }
    return null;
  }

  hasLandAdjacent(x, y) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (this.world.passable(x + dx, y + dy, 'land', false)) return true;
    }
    return false;
  }

  // -------------------------------------------------------------- reactions
  onAttacked(target, source) {
    const p = this.player;
    if (target.kind === 'building' && (target.def.critical || target.key === 'power' || target.key === 'artillery')) {
      this.threatAt = { x: target.x, y: target.y };
      this.threatUntil = this.game.time + 30;
      if (this.c.build.protectCritical > 0.7) this.say('defend');
    }
  }

  onUnitAttacked(target, source) {}

  onUnitLost(u, source) {
    if (u.owner !== this.player.index) return;
    const A = this.adapt;
    const killer = source && source.srcId ? this.world.byId.get(source.srcId) : null;
    const dtype = source ? source.damageType : null;
    if (killer && killer.kind === 'unit') {
      if (killer.def.role === 'antiArmour') { A.lostToAT++; if (u.def.class === 'vehicle') A.artilleryBoost += 0.35; }
      if (killer.def.role === 'artillery' || killer.def.role === 'rocketArtillery') A.lostToArtillery++;
      if (killer.def.role === 'mainArmour') A.lostToArmour = (A.lostToArmour || 0) + 1;
    } else if (killer && killer.kind === 'building') {
      A.lostToDefence++;
      if (A.lostToDefence > 3) A.siegeBoost += 0.3;
    }
    if (source && (source.threat === 'cruise' || source.threat === 'ballistic' || source.threat === 'aircraft' || source.threat === 'loiter')) {
      A.lostToAir++;
      A.airDefenceBoost += 0.4;
    }
    if (A.lostToAT > 4 && A.artilleryBoost < 0.4) A.artilleryBoost = 0.6;
  }

  onBuildingLost(b, source) {
    if (b.owner !== this.player.index) return;
    if (b.key === 'power' || b.key === 'data' || b.key === 'artillery') {
      this.buildIndex = Math.min(this.buildIndex, this.c.build.order.indexOf(b.key) >= 0 ? this.c.build.order.indexOf(b.key) : this.buildIndex);
    }
    if (source && (source.threat === 'cruise' || source.threat === 'ballistic' || source.threat === 'aircraft')) {
      this.adapt.airDefenceBoost += 0.9;
      this.say('losing');
    }
  }

  onEnemyStrike(byPlayer, key, x, y) {
    if (this.game.isAllied(this.player.index, byPlayer.index)) return;
    this.adapt.airDefenceBoost += 0.3;
  }

  /** Called when one of our own strikes gets shot down — Tempest changes plan. */
  onStrikeIntercepted() {
    this.adapt.strikesIntercepted++;
    if (this.adapt.strikesIntercepted >= 3 && this.c.army.seadFirst) {
      this.adapt.groundShift += 0.6;
      this.say('adapt');
    }
  }
}

export function createAIs(game) {
  const ais = [];
  for (const p of game.players) {
    if (p.isHuman || !p.commander) continue;
    ais.push(new AI(game, p));
  }
  game.ai = ais;
  return ais;
}
