// The world: terrain, occupancy, entity registry, spatial index and fog of war.

import { SpatialHash, clamp, dist } from '../core/util.js';
import { T, TERRAIN, moveCost, DOMAIN } from '../core/terrain.js';
import { Pathfinder } from '../core/pathfinding.js';

export class World {
  constructor(mapData) {
    this.map = mapData;
    this.width = mapData.width;
    this.height = mapData.height;
    this.tiles = mapData.tiles;
    this.bridge = mapData.bridge;

    const n = this.width * this.height;
    this.blocked = new Uint8Array(n);       // structures and impassable props
    this.nearBlocked = new Uint8Array(n);   // soft avoidance ring around structures
    this.occupant = new Int32Array(n).fill(-1);
    this.scorch = [];                       // persistent ground decals
    this.wrecks = [];

    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.effects = [];
    this.neutrals = [];
    this.byId = new Map();
    this.nextId = 1;

    this.hash = new SpatialHash(this.width, this.height, 4);
    this.buildingHash = new SpatialHash(this.width, this.height, 8);
    this.pf = new Pathfinder(this);
    this._scratch = [];
  }

  idx(x, y) { return (y | 0) * this.width + (x | 0); }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : T.WATER; }
  terrainAt(x, y) { return TERRAIN[this.tileAt(x, y)]; }
  isBridge(x, y) { return this.inBounds(x, y) && this.bridge[this.idx(x, y)] === 1; }

  coverAt(x, y) {
    const t = this.tileAt(x, y);
    if (this.isBridge(x, y)) return 0;
    return TERRAIN[t].cover;
  }

  /** Movement multiplier for a unit standing here; 0 means it cannot be there. */
  speedFactor(x, y, domain, heavy) {
    if (this.isBridge(x, y) && domain !== DOMAIN.NAVAL) return 1 / 0.7;
    const c = moveCost(this.tileAt(x, y), domain, heavy);
    return c === 0 ? 0 : 1 / c;
  }

  passable(x, y, domain, heavy) {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.blocked[i]) return false;
    if (this.bridge[i] && domain !== DOMAIN.NAVAL) return true;
    return moveCost(this.tiles[i], domain, heavy) > 0;
  }

  // ------------------------------------------------------------ registration
  register(e) {
    e.id = this.nextId++;
    this.byId.set(e.id, e);
    if (e.kind === 'unit') this.units.push(e);
    else if (e.kind === 'building') { this.buildings.push(e); this.stampBuilding(e, true); }
    else if (e.kind === 'neutral') this.neutrals.push(e);
    return e;
  }

  remove(e) {
    e.dead = true;
    this.byId.delete(e.id);
    if (e.kind === 'building') this.stampBuilding(e, false);
  }

  /** Compact the entity arrays. Called once per tick rather than per removal. */
  sweep() {
    if (this.units.some((u) => u.dead)) this.units = this.units.filter((u) => !u.dead);
    if (this.buildings.some((b) => b.dead)) this.buildings = this.buildings.filter((b) => !b.dead);
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.effects.some((f) => f.dead)) this.effects = this.effects.filter((f) => !f.dead);
  }

  /** Mark or clear a building's tile footprint. */
  stampBuilding(b, on) {
    const s = b.size;
    const x0 = b.tx, y0 = b.ty;
    for (let y = y0; y < y0 + s; y++) {
      for (let x = x0; x < x0 + s; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        this.blocked[i] = on ? 1 : 0;
        this.occupant[i] = on ? b.id : -1;
      }
    }
    for (let y = y0 - 1; y <= y0 + s; y++) {
      for (let x = x0 - 1; x <= x0 + s; x++) {
        if (!this.inBounds(x, y)) continue;
        this.nearBlocked[this.idx(x, y)] = on ? 1 : 0;
      }
    }
    if (!on) {
      // Restore soft rings for any neighbouring structure we just cleared.
      for (const o of this.buildings) {
        if (o === b || o.dead) continue;
        if (Math.abs(o.tx - x0) > s + 4 || Math.abs(o.ty - y0) > s + 4) continue;
        for (let y = o.ty - 1; y <= o.ty + o.size; y++) {
          for (let x = o.tx - 1; x <= o.tx + o.size; x++) {
            if (this.inBounds(x, y)) this.nearBlocked[this.idx(x, y)] = 1;
          }
        }
        for (let y = o.ty; y < o.ty + o.size; y++) {
          for (let x = o.tx; x < o.tx + o.size; x++) {
            if (this.inBounds(x, y)) { this.blocked[this.idx(x, y)] = 1; this.occupant[this.idx(x, y)] = o.id; }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------- queries
  rebuildIndex() {
    this.hash.clear();
    for (const u of this.units) if (!u.dead && !u.loaded) this.hash.insert(u);
    this.buildingHash.clear();
    for (const b of this.buildings) if (!b.dead) this.buildingHash.insert(b);
    for (const n of this.neutrals) this.buildingHash.insert(n);
  }

  /** Units within radius. Returns a shared scratch array — copy it if you keep it. */
  unitsNear(x, y, radius, out) {
    const res = out || this._scratch;
    this.hash.query(x, y, radius, res);
    const r2 = radius * radius;
    let w = 0;
    for (let i = 0; i < res.length; i++) {
      const e = res[i];
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2) res[w++] = e;
    }
    res.length = w;
    return res;
  }

  buildingsNear(x, y, radius, out) {
    const res = out || [];
    this.buildingHash.query(x, y, radius + 3, res);
    let w = 0;
    for (let i = 0; i < res.length; i++) {
      const e = res[i];
      if (e.dead) continue;
      if (dist(e.x, e.y, x, y) <= radius + (e.radius || 1)) res[w++] = e;
    }
    res.length = w;
    return res;
  }

  addEffect(fx) { this.effects.push(fx); return fx; }

  addScorch(x, y, r) {
    this.scorch.push({ x, y, r, age: 0 });
    if (this.scorch.length > 260) this.scorch.shift();
    this.dirtyDecals = true;
  }

  addWreck(x, y, art, colour, facing) {
    this.wrecks.push({ x, y, art, colour, facing, age: 0 });
    if (this.wrecks.length > 160) this.wrecks.shift();
    this.dirtyDecals = true;
  }
}

// ------------------------------------------------------------------- fog
export class Fog {
  constructor(width, height, playerCount) {
    this.w = width; this.h = height;
    this.n = width * height;
    this.visible = [];
    this.explored = [];
    for (let i = 0; i < playerCount; i++) {
      this.visible.push(new Uint8Array(this.n));
      this.explored.push(new Uint8Array(this.n));
    }
    this._discs = new Map();
  }

  /** Cached tile offsets for a vision circle of the given radius. */
  disc(r) {
    const key = Math.round(r * 2);
    let d = this._discs.get(key);
    if (d) return d;
    const rr = key / 2, r2 = rr * rr, out = [];
    for (let y = -Math.ceil(rr); y <= Math.ceil(rr); y++) {
      for (let x = -Math.ceil(rr); x <= Math.ceil(rr); x++) {
        if (x * x + y * y <= r2) out.push(x, y);
      }
    }
    d = new Int16Array(out);
    this._discs.set(key, d);
    return d;
  }

  clearVisible(p) { this.visible[p].fill(0); }

  stamp(p, cx, cy, radius) {
    const vis = this.visible[p], exp = this.explored[p];
    const d = this.disc(radius);
    const ix = Math.round(cx), iy = Math.round(cy);
    for (let i = 0; i < d.length; i += 2) {
      const x = ix + d[i], y = iy + d[i + 1];
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      const k = y * this.w + x;
      vis[k] = 1; exp[k] = 1;
    }
  }

  isVisible(p, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.visible[p][y * this.w + x] === 1;
  }
  isExplored(p, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.explored[p][y * this.w + x] === 1;
  }
  revealAll(p) { this.visible[p].fill(1); this.explored[p].fill(1); }
}

export { DOMAIN, T, TERRAIN, clamp };
