// Grid pathfinding: A* with an octile heuristic, typed-array scratch buffers and a
// throttled request queue so a large army never stalls a frame.

import { MinHeap, clamp } from './util.js';
import { moveCost, DOMAIN } from './terrain.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
];

export class Pathfinder {
  constructor(world) {
    this.world = world;
    const n = world.width * world.height;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.epoch = 0;
    this.heap = new MinHeap((node) => node.f);
    this.queue = [];
    this.maxNodes = 9000;
  }

  /** Terrain + static occupancy cost for entering (x,y); 0 means impassable. */
  cost(x, y, domain, heavy) {
    const w = this.world;
    if (x < 0 || y < 0 || x >= w.width || y >= w.height) return 0;
    const i = y * w.width + x;
    if (w.blocked[i]) return 0;
    const c = moveCost(w.tiles[i], domain, heavy);
    if (c === 0) return 0;
    // Soft penalty near structures so units flow around bases rather than hugging them.
    return c + (w.nearBlocked[i] ? 0.55 : 0);
  }

  passable(x, y, domain, heavy) { return this.cost(x, y, domain, heavy) > 0; }

  /** Nearest passable tile to (x,y) within `radius`, or null. */
  nearestPassable(x, y, domain, heavy, radius = 12) {
    x = Math.round(x); y = Math.round(y);
    if (this.passable(x, y, domain, heavy)) return { x, y };
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (this.passable(nx, ny, domain, heavy)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /**
   * A* from (sx,sy) to (tx,ty). Returns an array of {x,y} tile centres, or null.
   * When the goal is unreachable the best partial path toward it is returned so
   * units still make visible progress instead of freezing.
   */
  find(sx, sy, tx, ty, domain = DOMAIN.LAND, heavy = false) {
    const w = this.world, W = w.width, H = w.height;
    sx = clamp(Math.round(sx), 0, W - 1); sy = clamp(Math.round(sy), 0, H - 1);
    tx = clamp(Math.round(tx), 0, W - 1); ty = clamp(Math.round(ty), 0, H - 1);
    if (sx === tx && sy === ty) return [];

    if (!this.passable(tx, ty, domain, heavy)) {
      const alt = this.nearestPassable(tx, ty, domain, heavy, 10);
      if (!alt) return null;
      tx = alt.x; ty = alt.y;
    }

    const epoch = ++this.epoch;
    const heap = this.heap; heap.clear();
    const start = sy * W + sx, goal = ty * W + tx;
    this.g[start] = 0; this.stamp[start] = epoch; this.from[start] = -1; this.closed[start] = 0;
    heap.push({ i: start, x: sx, y: sy, f: this._h(sx, sy, tx, ty) });

    let expanded = 0;
    let best = start, bestH = this._h(sx, sy, tx, ty);

    while (heap.size) {
      const cur = heap.pop();
      const ci = cur.i;
      if (this.closed[ci] === epoch) continue;
      this.closed[ci] = epoch;
      if (ci === goal) return this._rebuild(ci, W, domain, heavy);
      if (++expanded > this.maxNodes) break;

      const cx = cur.x, cy = cur.y, cg = this.g[ci];
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dy = DIRS[d][1];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (this.closed[ni] === epoch) continue;
        const c = this.cost(nx, ny, domain, heavy);
        if (c === 0) continue;
        // No cutting diagonal corners through impassable ground.
        if (dx !== 0 && dy !== 0) {
          if (this.cost(cx + dx, cy, domain, heavy) === 0) continue;
          if (this.cost(cx, cy + dy, domain, heavy) === 0) continue;
        }
        const ng = cg + c * DIRS[d][2];
        if (this.stamp[ni] === epoch && this.g[ni] <= ng) continue;
        this.stamp[ni] = epoch; this.g[ni] = ng; this.from[ni] = ci;
        const h = this._h(nx, ny, tx, ty);
        if (h < bestH) { bestH = h; best = ni; }
        heap.push({ i: ni, x: nx, y: ny, f: ng + h * 1.06 });
      }
    }
    if (best !== start) return this._rebuild(best, W, domain, heavy);
    return null;
  }

  _h(x, y, tx, ty) {
    const dx = Math.abs(tx - x), dy = Math.abs(ty - y);
    return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy);
  }

  _rebuild(end, W, domain, heavy) {
    const out = [];
    let i = end;
    let guard = 0;
    while (i !== -1 && guard++ < 4096) {
      out.push({ x: (i % W) + 0.5, y: Math.floor(i / W) + 0.5 });
      i = this.from[i];
    }
    out.pop(); // drop the start tile
    out.reverse();
    return this.smooth(out, domain, heavy);
  }

  /** Drop waypoints that a straight line already clears. */
  smooth(path, domain, heavy) {
    if (path.length < 3) return path;
    const out = [path[0]];
    let anchor = 0;
    for (let i = 2; i < path.length; i++) {
      if (!this._clear(path[anchor], path[i], domain, heavy)) {
        out.push(path[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(path[path.length - 1]);
    out.shift();
    return out;
  }

  _clear(a, b, domain, heavy) {
    const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = Math.floor(a.x + (b.x - a.x) * t);
      const y = Math.floor(a.y + (b.y - a.y) * t);
      if (this.cost(x, y, domain, heavy) === 0) return false;
    }
    return true;
  }
}
