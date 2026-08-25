// Three hand-laid isometric battlefields. Every feature is generated once and then
// stamped four times through a 90-degree rotation, so all four starting positions
// face a mathematically identical map. Only the exact centre tile is shared.

import { makeRng, clamp } from '../core/util.js';
import { T } from '../core/terrain.js';

export const MAP_SIZE = 128;
const N = MAP_SIZE;

class Canvas {
  constructor(size, fill) {
    this.n = size;
    this.t = new Uint8Array(size * size).fill(fill);
    this.bridge = new Uint8Array(size * size);
    this.decor = [];
  }
  get(x, y) { return (x < 0 || y < 0 || x >= this.n || y >= this.n) ? T.WATER : this.t[y * this.n + x]; }
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.n && y < this.n) this.t[y * this.n + x] = v; }
  rect(x0, y0, w, h, v) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, v); }

  /** Paint a disc directly. Centres on N/2 - 0.5 are exactly rotation-invariant. */
  disc(cx, cy, r, v, guard) {
    for (const [x, y] of discTiles(cx, cy, r)) {
      if (guard && !guard(x, y)) continue;
      this.set(x, y, v);
    }
  }
  /** Stamp a pre-rasterised integer tile list into all four quadrants. */
  stamp4(tiles, v, guard) {
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < tiles.length; i += 2) {
        const p = rot(tiles[i], tiles[i + 1], k);
        if (guard && !guard(p.x, p.y)) continue;
        this.set(p.x, p.y, v);
      }
    }
  }
}

/** Integer tiles covered by a disc. */
function discTiles(cx, cy, r) {
  const out = [];
  const r2 = r * r;
  for (let y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
    for (let x = Math.ceil(cx - r); x <= Math.floor(cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) out.push([x, y]);
    }
  }
  return out;
}

/** Flat integer tile list [x0,y0,x1,y1,...] for a disc, in quadrant coordinates. */
function discList(cx, cy, r, into) {
  const out = into || [];
  const r2 = r * r;
  for (let y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
    for (let x = Math.ceil(cx - r); x <= Math.floor(cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) { out.push(x, y); }
    }
  }
  return out;
}

/** Flat integer tile list for a thick polyline, de-duplicated. */
function pathList(pts, width) {
  const seen = new Set();
  const out = [];
  const push = (x, y) => { const k = x * 1000 + y; if (!seen.has(k)) { seen.add(k); out.push(x, y); } };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      for (const [x, y] of discTiles(cx, cy, width / 2)) push(x, y);
    }
  }
  return out;
}

function rot(x, y, k) {
  for (let i = 0; i < k; i++) { const nx = N - 1 - y; y = x; x = nx; }
  return { x, y };
}
const tfFor = (k) => (x, y) => rot(x, y, k);
function fourfold(fn) { for (let k = 0; k < 4; k++) fn(tfFor(k), k); }

// ------------------------------------------------------------------ base layout
// Pads are stored as tile CENTRES so the whole base block is exactly symmetric
// under the 90-degree rotation used to place the four starting positions.
const PAD_PITCH = 6;
const PAD_GRID = 5;                      // 25 construction points inside the perimeter
const PAD_OFF = [-12, -6, 0, 6, 12];
const FORWARD_OFF = [
  [0, -20], [0, 20], [-20, 0], [20, 0],
  [-17, -17], [17, -17], [-17, 17], [17, 17],
];
export const BASE_RADIUS = 15;

function layBase(cv, cx, cy, index, out, opts = {}) {
  const fill = opts.fill !== undefined ? opts.fill : T.GRASS;
  // Level anything unusable inside the perimeter, then lay an access-road grid and
  // a hardstanding apron under each construction point. The pads stay visible.
  for (let y = cy - BASE_RADIUS; y <= cy + BASE_RADIUS; y++) {
    for (let x = cx - BASE_RADIUS; x <= cx + BASE_RADIUS; x++) {
      const t = cv.get(x, y);
      if (t === T.WATER || t === T.SHALLOW || t === T.ROCK || t === T.WOOD || t === T.URBAN) cv.set(x, y, fill);
    }
  }
  // Access roads run down the gaps between the construction points.
  for (let i = 0; i < PAD_OFF.length - 1; i++) {
    const mid = (PAD_OFF[i] + PAD_OFF[i + 1]) / 2;
    cv.rect(cx - 14, cy + mid, 29, 1, T.ROAD);
    cv.rect(cx + mid, cy - 14, 1, 29, T.ROAD);
  }
  cv.rect(cx - 15, cy - 15, 31, 1, T.ROAD);
  cv.rect(cx - 15, cy + 15, 31, 1, T.ROAD);
  cv.rect(cx - 15, cy - 15, 1, 31, T.ROAD);
  cv.rect(cx + 15, cy - 15, 1, 31, T.ROAD);

  const pads = [];
  let id = 0;
  const apron = (px, py, r) => {
    for (let y = py - r; y <= py + r; y++) {
      for (let x = px - r; x <= px + r; x++) {
        const t = cv.get(x, y);
        if (t === T.WATER || t === T.SHALLOW) continue;   // naval pads keep their berth
        cv.set(x, y, T.CONCRETE);
      }
    }
  };
  for (let r = 0; r < PAD_GRID; r++) {
    for (let c = 0; c < PAD_GRID; c++) {
      const px = cx + PAD_OFF[c], py = cy + PAD_OFF[r];
      apron(px, py, 2);
      const edge = (r === 0 || c === 0 || r === PAD_GRID - 1 || c === PAD_GRID - 1);
      pads.push({ id: id++, cx: px, cy: py, type: 'structure', preferDefence: edge, hq: (r === 2 && c === 2) });
    }
  }
  for (const [ox, oy] of FORWARD_OFF) {
    const px = Math.round(clamp(cx + ox, 4, N - 5)), py = Math.round(clamp(cy + oy, 4, N - 5));
    for (let y = py - 3; y <= py + 3; y++) {
      for (let x = px - 3; x <= px + 3; x++) {
        const t = cv.get(x, y);
        if (t === T.WATER || t === T.SHALLOW || t === T.ROCK) cv.set(x, y, fill);
      }
    }
    apron(px, py, 2);
    pads.push({ id: id++, cx: px, cy: py, type: 'defence', preferDefence: true, forward: true });
  }
  if (opts.navalPads) {
    for (const [nx, ny] of opts.navalPads) {
      apron(Math.round(nx), Math.round(ny), 2);
      pads.push({ id: id++, cx: Math.round(nx), cy: Math.round(ny), type: 'naval', preferDefence: false });
    }
  }
  out.push({
    index, x: cx, y: cy, pads,
    zone: { x: cx - BASE_RADIUS, y: cy - BASE_RADIUS, w: BASE_RADIUS * 2 + 1, h: BASE_RADIUS * 2 + 1 },
  });
}

/** True when (x,y) falls inside any home base area — protects terrain features. */
function makeBaseGuard(centres, pad = 5) {
  const r = BASE_RADIUS + pad;
  return (x, y) => !centres.some(([cx, cy]) => Math.abs(x - cx) <= r && Math.abs(y - cy) <= r);
}

/** Roads painted over water become bridges: passable, and drawn as spans. */
function markBridges(cv, before) {
  for (let i = 0; i < cv.t.length; i++) {
    if (cv.t[i] === T.ROAD && (before[i] === T.WATER || before[i] === T.SHALLOW)) cv.bridge[i] = 1;
  }
}

// ---------------------------------------------------------------------- map one
const C = 63.5;   // exact rotational centre of a 128-tile map

function buildArdenne() {
  const BASE_FILL = T.GRASS;
  const rng = makeRng(0x51ded1);
  const cv = new Canvas(N, T.GRASS);
  const centres = [[24, 24], [103, 24], [103, 103], [24, 103]];
  const guard = makeBaseGuard(centres, 5);

  // Rolled once, stamped four times: identical countryside in every quadrant.
  const farmTiles = [], woodTiles = [];
  for (let i = 0; i < 20; i++) {
    const x = rng.int(8, 60), y = rng.int(8, 60), r = rng.range(4, 8);
    discList(x, y, r, rng() < 0.45 ? farmTiles : woodTiles);
  }
  cv.stamp4(farmTiles, T.FARM, guard);
  cv.stamp4(woodTiles, T.WOOD, guard);

  // A pinwheel of four rivers running in from the map edge toward the town.
  const riverPts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    riverPts.push({ x: -2 + t * 50, y: 44 + Math.sin(t * 2.6) * 8 - t * 4 });
  }
  cv.stamp4(pathList(riverPts, 4.2), T.WATER);

  const beforeRoads = cv.t.slice();
  cv.stamp4(pathList([{ x: 24, y: 24 }, { x: 40, y: 44 }, { x: 56, y: 58 }, { x: 63, y: 63 }], 2.6), T.ROAD);
  cv.stamp4(pathList([{ x: 24, y: 24 }, { x: 22, y: 56 }, { x: 34, y: 84 }, { x: 62, y: 96 }], 2.2), T.ROAD);
  markBridges(cv, beforeRoads);

  // Villers-sur-Faille, the small town in the middle.
  cv.disc(C, C, 12, T.URBAN);
  cv.disc(C, C, 4.5, T.CONCRETE);
  for (let i = 0; i < 30; i++) {
    const a = rng() * Math.PI * 2, r = rng.range(5.5, 11);
    cv.decor.push({ x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, type: 'house', rot: rng() * 6.28 });
  }

  const farmyard = discList(34, 54, 5);
  cv.stamp4(farmyard, T.FARM, guard);
  const trench = [];
  for (let i = 0; i < 8; i++) trench.push(46 + i - 4, 32);
  cv.stamp4(trench, T.TRENCH, guard);
  fourfold((tf) => {
    cv.decor.push(Object.assign(tf(34, 54), { type: 'farm', rot: 0 }));
  });

  const starts = [];
  centres.forEach(([x, y], i) => layBase(cv, x, y, i, starts, { fill: BASE_FILL }));

  const oil = [];
  fourfold((tf) => {
    oil.push(Object.assign(tf(48, 18), { type: 'derrick' }));
    oil.push(Object.assign(tf(18, 48), { type: 'derrick' }));
    oil.push(Object.assign(tf(74, 52), { type: 'refinery' }));
  });
  const objectives = [];
  fourfold((tf) => objectives.push(tf(64, 42)));

  return { canvas: cv, starts, oil, objectives };
}

// ---------------------------------------------------------------------- map two
function buildKhazir() {
  const BASE_FILL = T.SAND;
  const rng = makeRng(0xd35e27);
  const cv = new Canvas(N, T.SAND);
  const centres = [[24, 24], [103, 24], [103, 103], [24, 103]];
  const guard = makeBaseGuard(centres, 5);

  const duneTiles = [], rockTiles = [];
  for (let i = 0; i < 22; i++) discList(rng.int(6, 62), rng.int(6, 62), rng.range(4.5, 9), duneTiles);
  for (let i = 0; i < 9; i++) discList(rng.int(14, 58), rng.int(14, 58), rng.range(2.2, 4), rockTiles);
  cv.stamp4(duneTiles, T.DUNE, guard);
  cv.stamp4(rockTiles, T.ROCK, guard);

  // The pipeline network doubles as this map's road system.
  const pipeA = [{ x: 26, y: 32 }, { x: 48, y: 36 }, { x: 62, y: 54 }, { x: 63, y: 63 }];
  const pipeB = [{ x: 32, y: 26 }, { x: 36, y: 48 }, { x: 54, y: 62 }, { x: 63, y: 63 }];
  cv.stamp4(pathList(pipeA, 2.4), T.CONCRETE, guard);
  cv.stamp4(pathList(pipeB, 2.4), T.CONCRETE, guard);
  fourfold((tf) => {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = pipeA[0].x + (pipeA[2].x - pipeA[0].x) * t, y = pipeA[0].y + (pipeA[2].y - pipeA[0].y) * t;
      cv.decor.push(Object.assign(tf(x, y), { type: 'pipe', rot: Math.atan2(pipeA[2].y - pipeA[0].y, pipeA[2].x - pipeA[0].x) + k90(tf) }));
    }
  });

  // The exposed central plain: total visibility, all the value, nowhere to hide.
  cv.disc(C, C, 16, T.SAND);
  cv.disc(C, C, 7, T.CONCRETE);

  cv.stamp4(discList(56, 72, 5.5), T.CONCRETE, guard);
  const trench = [];
  for (let i = 0; i < 9; i++) trench.push(42 + i - 4, 42);
  cv.stamp4(trench, T.TRENCH, guard);
  fourfold((tf) => cv.decor.push(Object.assign(tf(56, 72), { type: 'refinery', rot: 0 })));

  const starts = [];
  centres.forEach(([x, y], i) => layBase(cv, x, y, i, starts, { fill: BASE_FILL }));

  const oil = [];
  fourfold((tf) => {
    oil.push(Object.assign(tf(46, 16), { type: 'derrick' }));
    oil.push(Object.assign(tf(16, 46), { type: 'derrick' }));
    oil.push(Object.assign(tf(52, 48), { type: 'derrick' }));
    oil.push(Object.assign(tf(56, 72), { type: 'refinery' }));
  });
  const objectives = [];
  fourfold((tf) => objectives.push(tf(64, 46)));

  return { canvas: cv, starts, oil, objectives };
}

// -------------------------------------------------------------------- map three
function buildCoral() {
  const rng = makeRng(0x0cea15);
  const cv = new Canvas(N, T.WATER);
  const centres = [[26, 26], [101, 26], [101, 101], [26, 101]];

  // Four peninsulas around a contested central island.
  const grassTiles = [], sandTiles = [];
  for (let y = -2; y < 60; y++) {
    for (let x = -2; x < 60; x++) {
      const d = Math.hypot(x - 24, y - 24);
      const wob = Math.sin(x * 0.29) * 2.6 + Math.cos(y * 0.24) * 2.8;
      if (d + wob < 31) (d + wob > 27.5 ? sandTiles : grassTiles).push(x, y);
    }
  }
  cv.stamp4(grassTiles, T.GRASS);
  cv.stamp4(sandTiles, T.SAND);
  cv.stamp4(pathList([{ x: 44, y: 44 }, { x: 56, y: 56 }], 6.5), T.SAND);

  cv.disc(C, C, 16, T.SAND);
  cv.disc(C, C, 11, T.GRASS);
  cv.disc(C, C, 4, T.CONCRETE);

  const guard = makeBaseGuard(centres, 4);
  const woodTiles = [];
  for (let i = 0; i < 14; i++) discList(rng.int(6, 52), rng.int(6, 52), rng.range(2.8, 5.5), woodTiles);
  cv.stamp4(woodTiles, T.WOOD, (x, y) => guard(x, y) && cv.get(x, y) === T.GRASS);
  cv.stamp4(pathList([{ x: 26, y: 26 }, { x: 36, y: 40 }, { x: 48, y: 48 }], 2.4), T.ROAD, (x, y) => cv.get(x, y) !== T.WATER);

  // Shallow water rings every coastline: beaches, landings, shore bombardment.
  const copy = cv.t.slice();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (copy[y * N + x] !== T.WATER) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (copy[clamp(y + dy, 0, N - 1) * N + clamp(x + dx, 0, N - 1)] !== T.WATER) { near = true; break; }
        }
      }
      if (near) cv.set(x, y, T.SHALLOW);
    }
  }

  cv.stamp4(discList(46, 16, 4.5), T.CONCRETE);
  const portPts = [];
  fourfold((tf) => portPts.push(tf(46, 16)));

  const starts = [];
  const shore0 = findShorePads(cv, centres[0][0], centres[0][1], 3);
  centres.forEach(([x, y], i) => {
    const navalPads = shore0.map(([sx, sy]) => { const p = rot(sx, sy, i); return [p.x, p.y]; });
    layBase(cv, x, y, i, starts, { navalPads, fill: T.GRASS });
  });

  const oil = [];
  fourfold((tf) => {
    oil.push(Object.assign(tf(48, 12), { type: 'derrick' }));
    oil.push(Object.assign(tf(12, 48), { type: 'derrick' }));
    oil.push(Object.assign(tf(56, 56), { type: 'derrick' }));
  });
  portPts.forEach((p) => oil.push({ x: p.x, y: p.y, type: 'port' }));
  const objectives = [];
  fourfold((tf) => objectives.push(tf(64, 44)));

  return { canvas: cv, starts, oil, objectives };
}

/** Rotation angle carried by a quadrant transform, for orienting decorative props. */
function k90(tf) {
  const a = tf(0, 0), b = tf(1, 0);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Shoreline construction points for naval yards and coastal batteries. */
function findShorePads(cv, cx, cy, want) {
  const found = [];
  for (let r = 20; r < 44 && found.length < want; r += 2) {
    for (let a = 0; a < 40 && found.length < want; a++) {
      const ang = (a / 40) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(ang) * r), y = Math.round(cy + Math.sin(ang) * r);
      if (x < 5 || y < 5 || x > N - 9 || y > N - 9) continue;
      let land = 0, water = 0;
      for (let dy = -2; dy <= 5; dy++) for (let dx = -2; dx <= 5; dx++) {
        const t = cv.get(x + dx, y + dy);
        if (t === T.WATER || t === T.SHALLOW) water++; else land++;
      }
      if (water < 14 || land < 24) continue;
      if (found.some((f) => Math.hypot(f[0] - x, f[1] - y) < 13)) continue;
      // Do not paint here: layBase stamps the apron for all four bases symmetrically.
      found.push([x, y]);
    }
  }
  return found;
}

export const MAPS = {
  ardenne: {
    key: 'ardenne', name: 'Ardenne Line', region: 'Verrand Frontier',
    subtitle: 'European countryside — roads, woodland, farms, rivers and a small town',
    blurb: 'Four rivers spiral out from the town of Villers-sur-Faille, and the bridges decide who moves where. The town itself is heavy cover, terrible ground for armour, and the fastest road link between every base. Woodland along the trunk roads gives infantry everything they need to ruin an armoured column.',
    naval: false, hasWater: true, navigable: false,
    tips: [
      'Roads cut movement time by nearly 40% — and every commander knows exactly where they run.',
      'Woodland and the town give infantry heavy cover. Sending tanks in unescorted is how you lose them.',
      'The bridges are the real chokepoints. Hold one and you hold a quarter of the map.',
    ],
    build: buildArdenne,
  },
  khazir: {
    key: 'khazir', name: 'Khazir Basin', region: 'Tarshan Oil Concession',
    subtitle: 'Desert and oil field — dunes, pipelines, refineries and exposed strategic ground',
    blurb: 'The richest ground on any map and the least forgiving. Twelve derricks, four refineries, almost no cover, and dune fields that bog heavy armour down while wheeled reconnaissance sails along the pipelines. Artillery duels here are decided by whoever spots first.',
    naval: false, hasWater: false, navigable: false,
    tips: [
      'Dune fields punish tracked vehicles. The pipelines are the fast lanes.',
      'There is almost no cover, so reconnaissance range and artillery range decide engagements.',
      'The four refineries pay far more than a derrick. Expect them contested all match.',
    ],
    build: buildKhazir,
  },
  coral: {
    key: 'coral', name: 'Coral Approaches', region: 'Compact Maritime Territory',
    subtitle: 'Coastal and island — beaches, ports, sea lanes and naval construction areas',
    blurb: 'Four peninsulas around a contested central island. Causeways connect the land, but the sea lanes are faster and completely undefended unless you pay for them. Naval yards, coastal batteries and landing craft are all live here, and an amphibious force can appear behind any defensive line on the map.',
    naval: true, hasWater: true, navigable: true,
    tips: [
      'Naval units, naval yards and coastal batteries are only available on this map.',
      'The causeways are obvious. The sea lanes are not.',
      'Four ports pay very well and are almost impossible to hold from land alone.',
    ],
    build: buildCoral,
  },
};

export const MAP_KEYS = Object.keys(MAPS);
const built = new Map();

export function loadMap(key) {
  if (built.has(key)) return built.get(key);
  const meta = MAPS[key];
  const r = meta.build();
  const data = {
    key, name: meta.name, subtitle: meta.subtitle, blurb: meta.blurb, region: meta.region,
    tips: meta.tips, naval: meta.naval, hasWater: meta.hasWater, navigable: meta.navigable,
    width: N, height: N,
    tiles: r.canvas.t, bridge: r.canvas.bridge, decor: r.canvas.decor,
    starts: r.starts,
    oil: r.oil.map((o, i) => ({ id: i, x: Math.round(o.x), y: Math.round(o.y), type: o.type })),
    objectives: r.objectives.map((o) => ({ x: Math.round(o.x), y: Math.round(o.y) })),
  };
  sanitise(data);
  built.set(key, data);
  return data;
}

function sanitise(data) {
  const { tiles } = data;
  const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < N && y < N) tiles[y * N + x] = v; };
  for (const s of data.starts) {
    for (const pad of s.pads) {
      pad.cx = clamp(pad.cx, 4, N - 5); pad.cy = clamp(pad.cy, 4, N - 5);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = pad.cx + dx, y = pad.cy + dy;
        const t = tiles[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
        if (pad.type === 'naval' && (t === T.WATER || t === T.SHALLOW)) continue;
        if (t === T.WATER || t === T.SHALLOW || t === T.ROCK || t === T.WOOD) put(x, y, T.CONCRETE);
      }
    }
  }
  for (const o of data.oil) {
    o.x = clamp(o.x, 3, N - 5); o.y = clamp(o.y, 3, N - 5);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = o.x + dx, y = o.y + dy;
      const t = tiles[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
      if (t === T.WATER || t === T.SHALLOW || t === T.ROCK) put(x, y, o.type === 'port' ? T.CONCRETE : T.SAND);
      else if (t === T.WOOD) put(x, y, T.GRASS);
    }
  }
  for (const ob of data.objectives) {
    ob.x = clamp(ob.x, 4, N - 6); ob.y = clamp(ob.y, 4, N - 6);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ob.x + dx, y = ob.y + dy;
      const t = tiles[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
      if (t === T.WATER || t === T.SHALLOW || t === T.ROCK) put(x, y, T.CONCRETE);
    }
  }
}
