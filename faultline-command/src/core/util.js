// FAULTLINE COMMAND - core utilities
// Deterministic RNG, math helpers, small data structures.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }

/** Shortest signed angular difference from a to b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

/** Mulberry32 — small, fast, seedable PRNG. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const rng = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  return rng;
}

/** Binary min-heap keyed by a numeric score stored on the node. */
export class MinHeap {
  constructor(key) { this.items = []; this.key = key; }
  get size() { return this.items.length; }
  clear() { this.items.length = 0; }
  push(node) {
    const a = this.items; a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.key(a[p]) <= this.key(a[i])) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  }
  pop() {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < a.length && this.key(a[l]) < this.key(a[s])) s = l;
        if (r < a.length && this.key(a[r]) < this.key(a[s])) s = r;
        if (s === i) break;
        const t = a[s]; a[s] = a[i]; a[i] = t; i = s;
      }
    }
    return top;
  }
}

/** Uniform-grid spatial index for entity queries. */
export class SpatialHash {
  constructor(width, height, cell = 4) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }
  clear() { for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0; }
  _idx(x, y) {
    const cx = clamp(Math.floor(x / this.cell), 0, this.cols - 1);
    const cy = clamp(Math.floor(y / this.cell), 0, this.rows - 1);
    return cy * this.cols + cx;
  }
  insert(e) { this.buckets[this._idx(e.x, e.y)].push(e); }
  /** Collect entities whose cell overlaps the radius; caller filters precisely. */
  query(x, y, radius, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = clamp(Math.floor((x - radius) / c), 0, this.cols - 1);
    const x1 = clamp(Math.floor((x + radius) / c), 0, this.cols - 1);
    const y0 = clamp(Math.floor((y - radius) / c), 0, this.rows - 1);
    const y1 = clamp(Math.floor((y + radius) / c), 0, this.rows - 1);
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[row + cx];
        for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  }
}

export function formatMoney(n) {
  return '$' + Math.max(0, Math.floor(n)).toLocaleString('en-GB');
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Mix two hex colours. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

export function shadeHex(hex, amount) {
  return mixHex(hex, amount > 0 ? '#ffffff' : '#000000', Math.abs(amount));
}
