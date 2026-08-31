// Procedural 3D models, built once per shape and drawn with instancing.
//
// Vertex colours here are greyscale *multipliers* rather than real colours —
// dark for tracks and rubber, bright for upper plating. The team colour arrives
// per instance and multiplies through, so a single material and a single draw
// call covers every tank of a given type on the field.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TRACK = 0.22, DARK = 0.46, BODY = 0.94, HIGH = 1.12, GLASS = 0.58, STEEL = 0.74;

function tinted(geo, v) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

function box(w, h, d, x, y, z, shade, rotY) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return tinted(g, shade);
}

// A cylinder stands on its Y axis by default: rotZ lays it along the hull (for
// gun barrels), rotX lays it across the hull (for road wheels).
function cyl(r1, r2, h, x, y, z, shade, rotZ, rotY, rotX) {
  const g = new THREE.CylinderGeometry(r1, r2, h, 10);
  if (rotZ) g.rotateZ(rotZ);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return tinted(g, shade);
}

/** A road wheel or roadwheel-sized tyre, lying on its axle across the hull. */
function wheel(r, thick, x, y, z, shade) {
  return cyl(r, r, thick, x, y, z, shade, 0, 0, Math.PI / 2);
}

function sph(r, x, y, z, shade) {
  const g = new THREE.SphereGeometry(r, 10, 8);
  g.translate(x, y, z);
  return tinted(g, shade);
}

/**
 * Track runs down both sides of a hull, with road wheels turning on their axles
 * inside them. `wid` is the centre-line of each run.
 */
function running(len, wid, n, y) {
  const parts = [];
  for (const side of [-1, 1]) {
    parts.push(box(len * 1.78, 0.32, 0.24, 0, y, side * wid, TRACK));
    parts.push(box(len * 1.62, 0.10, 0.26, 0, y + 0.17, side * wid, DARK));   // track guard
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * len * 1.42;
      parts.push(wheel(0.17, 0.20, t, y - 0.02, side * wid, DARK));
    }
    parts.push(wheel(0.11, 0.20, len * 0.82, y + 0.09, side * wid, STEEL));   // idler
    parts.push(wheel(0.11, 0.20, -len * 0.82, y + 0.09, side * wid, STEEL));  // sprocket
  }
  return parts;
}

// --------------------------------------------------------------- unit hulls
// Each returns { hull, turret }, where the turret is modelled about its own
// pivot so it can traverse independently of the hull.
/** One rifleman, facing +X, standing at (x, z). Appends to `out`. */
function soldier(out, x, z, turn) {
  // A man is roughly a quarter of a tank's length; the figure is modelled at a
  // comfortable size and scaled down to that.
  const K = 0.62;
  const put = (g) => { g.scale(K, K, K); if (turn) g.rotateY(turn); g.translate(x, 0, z); out.push(g); };
  const bx = (w, h, d, ox, oy, oz, sh) => put(box(w, h, d, ox, oy, oz, sh));
  bx(0.11, 0.30, 0.09, 0, 0.15, -0.06, DARK);      // legs
  bx(0.11, 0.30, 0.09, 0, 0.15, 0.06, DARK);
  bx(0.17, 0.30, 0.24, 0, 0.45, 0, BODY);          // torso
  bx(0.13, 0.20, 0.09, 0.02, 0.44, -0.16, BODY);   // arms
  bx(0.13, 0.20, 0.09, 0.02, 0.44, 0.16, BODY);
  bx(0.11, 0.22, 0.20, -0.13, 0.48, 0, DARK);      // pack
  bx(0.15, 0.10, 0.15, 0, 0.65, 0, HIGH);          // helmet
  put(cyl(0.018, 0.018, 0.42, 0.17, 0.44, -0.09, STEEL, Math.PI / 2));   // rifle
}

const BUILDERS = {
  tank(a) {
    const L = a.len, W = a.wid;
    const hull = [
      ...running(L, W * 0.66, 7, 0.28),
      box(L * 1.72, 0.40, W * 1.42, 0, 0.54, 0, BODY),
      box(L * 0.90, 0.18, W * 1.24, L * 0.40, 0.76, 0, HIGH),   // glacis
      box(L * 1.5, 0.22, 0.05, 0, 0.46, W * 0.80, DARK),        // side skirts
      box(L * 1.5, 0.22, 0.05, 0, 0.46, -W * 0.80, DARK),
      box(L * 0.30, 0.16, W * 1.2, -L * 0.78, 0.86, 0, DARK),   // engine deck grille
      cyl(0.07, 0.07, 0.34, -L * 0.9, 0.62, W * 0.7, DARK, Math.PI / 2),  // exhaust
    ];
    const turret = [
      box(L * 0.95, 0.38, W * 1.15, -0.05, 0.20, 0, BODY),
      box(L * 0.34, 0.30, W * 0.95, -L * 0.52, 0.20, 0, DARK),  // stowage bustle
      box(L * 0.24, 0.20, W * 0.30, L * 0.34, 0.42, 0, HIGH),   // mantlet
      cyl(0.075, 0.075, L * 1.5, L * 0.82, 0.20, 0, STEEL, Math.PI / 2),
      cyl(0.11, 0.11, 0.26, L * 1.42, 0.20, 0, DARK, Math.PI / 2),   // muzzle brake
      cyl(0.16, 0.16, 0.12, -0.10, 0.45, W * 0.34, HIGH),       // commander's hatch
      cyl(0.14, 0.14, 0.10, -0.10, 0.44, -W * 0.34, HIGH),      // loader's hatch
      cyl(0.028, 0.028, 0.30, 0.02, 0.56, W * 0.34, STEEL, Math.PI / 2),  // pintle MG
      box(0.10, 0.16, 0.05, L * 0.1, 0.42, W * 0.68, DARK),     // smoke dischargers
      box(0.10, 0.16, 0.05, L * 0.1, 0.42, -W * 0.68, DARK),
      cyl(0.016, 0.016, 0.55, -L * 0.4, 0.52, -W * 0.55, STEEL),  // aerial
    ];
    return { hull, turret };
  },
  ifv(a) {
    const L = a.len, W = a.wid;
    const hull = [
      ...running(L, W * 0.64, 6, 0.26),
      box(L * 1.62, 0.52, W * 1.34, 0, 0.58, 0, BODY),
      box(L * 0.55, 0.22, W * 1.2, L * 0.62, 0.92, 0, HIGH),
      box(L * 1.36, 0.20, 0.05, 0, 0.44, W * 0.78, DARK),       // skirts
      box(L * 1.36, 0.20, 0.05, 0, 0.44, -W * 0.78, DARK),
      box(L * 0.34, 0.30, W * 1.1, -L * 0.72, 0.90, 0, DARK),  // rear ramp
      cyl(0.015, 0.015, 0.5, -L * 0.5, 1.1, W * 0.5, STEEL),   // aerial
    ];
    const turret = [
      box(L * 0.52, 0.30, W * 0.72, 0, 0.18, 0, BODY),
      cyl(0.045, 0.045, L * 0.95, L * 0.5, 0.18, 0, STEEL, Math.PI / 2),
      box(0.22, 0.16, 0.13, 0, 0.24, W * 0.42, DARK),          // ATGM box
      box(0.14, 0.12, 0.10, -L * 0.16, 0.32, 0, HIGH),         // sight
    ];
    return { hull, turret };
  },
  apc(a) {
    const L = a.len, W = a.wid;
    const hull = [
      box(L * 1.62, 0.62, W * 1.32, 0, 0.58, 0, BODY),
      box(L * 0.48, 0.22, W * 1.14, L * 0.58, 0.96, 0, HIGH),
    ];
    if (a.tracks) hull.push(...running(L, W * 0.64, 5, 0.26));
    else for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      hull.push(wheel(0.24, 0.18, (i / 3 - 0.5) * L * 1.35, 0.24, side * W * 0.66, TRACK));
    }
    const turret = [box(0.3, 0.22, 0.3, 0, 0.14, 0, DARK),
      cyl(0.035, 0.035, 0.5, 0.28, 0.2, 0, STEEL, Math.PI / 2)];
    return { hull, turret };
  },
  scout(a) {
    const L = a.len, W = a.wid;
    const hull = [
      box(L * 1.46, 0.46, W * 1.20, 0, 0.46, 0, BODY),
      box(L * 0.58, 0.32, W * 0.98, -L * 0.18, 0.80, 0, GLASS),
    ];
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
      hull.push(wheel(0.22, 0.16, (i - 0.5) * L * 1.05, 0.22, side * W * 0.62, TRACK));
    }
    return { hull, turret: [box(0.22, 0.16, 0.22, 0, 0.12, 0, DARK)] };
  },
  spg(a) {
    const L = a.len, W = a.wid;
    const hull = [...running(L, W * 0.66, 7, 0.26), box(L * 1.66, 0.44, W * 1.34, 0, 0.54, 0, BODY)];
    const turret = [
      box(L * 1.05, 0.60, W * 1.25, -L * 0.15, 0.34, 0, BODY),
      cyl(0.075, 0.065, L * 2.1, L * 1.05, 0.42, 0, STEEL, Math.PI / 2),
      cyl(0.12, 0.12, 0.2, L * 0.62, 0.42, 0, DARK, Math.PI / 2),
    ];
    return { hull, turret };
  },
  mlrs(a) {
    const L = a.len, W = a.wid;
    const hull = [
      a.tracks ? box(L * 1.8, 0.4, W * 1.45, 0, 0.5, 0, BODY) : box(L * 1.8, 0.4, W * 1.4, 0, 0.55, 0, BODY),
      box(L * 0.5, 0.42, W * 1.25, L * 0.62, 0.9, 0, HIGH),
    ];
    if (a.tracks) hull.push(...running(L, W * 0.66, 6, 0.26));
    else for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      hull.push(wheel(0.23, 0.18, (i / 2 - 0.5) * L * 1.32, 0.23, side * W * 0.66, TRACK));
    }
    const turret = [
      box(L * 0.75, 0.5, W * 1.1, -L * 0.2, 0.42, 0, DARK),
      box(L * 0.2, 0.42, W * 1.0, L * 0.2, 0.52, 0, STEEL),
    ];
    return { hull, turret };
  },
  aa(a) {
    const L = a.len, W = a.wid;
    const hull = [box(L * 1.62, 0.44, W * 1.32, 0, 0.52, 0, BODY)];
    if (a.tracks) hull.push(...running(L, W * 0.66, 6, 0.26));
    else for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      hull.push(wheel(0.23, 0.18, (i / 2 - 0.5) * L * 1.3, 0.23, side * W * 0.66, TRACK));
    }
    const turret = [
      box(L * 0.6, 0.34, W * 0.8, 0, 0.2, 0, BODY),
      box(0.24, 0.3, 0.16, 0, 0.38, W * 0.5, DARK),
      box(0.24, 0.3, 0.16, 0, 0.38, -W * 0.5, DARK),
      cyl(0.03, 0.03, 0.8, -L * 0.25, 0.62, 0, STEEL),      // radar mast
      box(0.5, 0.06, 0.16, -L * 0.25, 1.0, 0, HIGH),         // dish
    ];
    return { hull, turret };
  },
  engv(a) {
    const L = a.len, W = a.wid;
    const hull = [...running(L, W * 0.66, 6, 0.26), box(L * 1.62, 0.48, W * 1.32, 0, 0.56, 0, BODY)];
    const turret = [
      box(L * 0.5, 0.4, W * 0.9, -L * 0.1, 0.25, 0, BODY),
      cyl(0.06, 0.06, L * 1.6, L * 0.6, 0.62, 0, STEEL, Math.PI / 3),
    ];
    return { hull, turret };
  },
  rhomboid(a) {
    const L = a.len, W = a.wid;
    const hull = [
      box(L * 2.3, 0.9, W * 1.5, 0, 0.55, 0, TRACK),          // all-round track run
      box(L * 1.9, 0.72, W * 1.15, 0, 0.6, 0, BODY),
      box(L * 0.5, 0.3, W * 0.8, 0, 1.05, 0, HIGH),
      box(0.4, 0.36, 0.34, 0, 0.66, W * 0.82, DARK),          // sponsons
      box(0.4, 0.36, 0.34, 0, 0.66, -W * 0.82, DARK),
      cyl(0.05, 0.05, 0.8, 0, 0.66, W * 1.2, STEEL, 0, 0),
      cyl(0.05, 0.05, 0.8, 0, 0.66, -W * 1.2, STEEL, 0, 0),
    ];
    return { hull, turret: [] };
  },
  heavygun(a) {
    const L = a.len, W = a.wid;
    const hull = [
      box(L * 0.9, 0.22, W * 1.1, -L * 0.3, 0.3, 0, DARK),
      wheel(0.36, 0.12, 0, 0.36, W * 0.86, TRACK),
      wheel(0.36, 0.12, 0, 0.36, -W * 0.86, TRACK),
    ];
    const turret = [
      box(L * 0.5, 0.4, W * 0.9, 0, 0.5, 0, BODY),
      box(0.1, 0.6, W * 1.3, L * 0.3, 0.7, 0, STEEL),         // shield
      cyl(0.07, 0.06, L * 2.4, L * 1.2, 0.75, 0, STEEL, Math.PI / 2),
    ];
    return { hull, turret };
  },
  squad() {
    // A shallow wedge, all facing the way the section is facing, so a squad
    // reads as men on the ground rather than a cluster of markers.
    const parts = [];
    const posts = [[0.30, 0.02, 0], [-0.08, -0.34, 0.18], [-0.08, 0.34, -0.18], [-0.40, 0.0, 0.06]];
    for (const [x, z, turn] of posts) soldier(parts, x, z, turn);
    return { hull: parts, turret: [] };
  },
  boat(a) {
    const L = a.len, W = a.wid;
    return { hull: [
      box(L * 1.7, 0.34, W * 1.3, 0, 0.2, 0, BODY),
      box(L * 0.5, 0.32, W * 0.9, -L * 0.2, 0.5, 0, HIGH),
    ], turret: [cyl(0.04, 0.04, 0.6, 0.3, 0.1, 0, STEEL, Math.PI / 2)] };
  },
  ship(a) {
    const L = a.len, W = a.wid;
    return { hull: [
      box(L * 1.8, 0.5, W * 1.4, 0, 0.28, 0, BODY),
      box(L * 0.45, 0.34, W * 1.15, L * 0.75, 0.6, 0, BODY),
      box(L * 0.5, 0.7, W * 0.8, -L * 0.1, 0.85, 0, HIGH),
      cyl(0.05, 0.05, 1.3, -L * 0.1, 1.7, 0, STEEL),
    ], turret: [
      box(L * 0.3, 0.3, W * 0.7, 0, 0.2, 0, BODY),
      cyl(0.06, 0.06, L * 1.1, L * 0.55, 0.24, 0, STEEL, Math.PI / 2),
    ] };
  },
  landing(a) {
    const L = a.len, W = a.wid;
    return { hull: [
      box(L * 1.7, 0.42, W * 1.4, 0, 0.24, 0, BODY),
      box(L * 0.3, 0.5, W * 1.2, L * 0.8, 0.5, 0, DARK),
    ], turret: [] };
  },
};

const ALIAS = {
  tank90: 'tank', ifv90: 'ifv', apc90: 'apc', spg90: 'spg', mlrs90: 'mlrs', aa90: 'aa',
  himars: 'mlrs', phl16: 'mlrs',
};

const cache = new Map();

/** Merged hull and turret geometry for a unit's art definition. */
export function unitGeometry(art) {
  const bodyKey = ALIAS[art.body] || art.body;
  const key = bodyKey + '|' + (art.len || 1).toFixed(2) + '|' + (art.wid || 1).toFixed(2) + '|' + (art.tracks ? 1 : 0);
  let hit = cache.get(key);
  if (hit) return hit;
  const build = BUILDERS[bodyKey] || BUILDERS.tank;
  const { hull, turret } = build({ len: art.len || 0.8, wid: art.wid || 0.5, tracks: art.tracks !== false });
  hit = {
    hull: hull.length ? mergeGeometries(hull) : null,
    turret: turret && turret.length ? mergeGeometries(turret) : null,
  };
  // Scale from tile units into world units: a tile is one unit across.
  cache.set(key, hit);
  return hit;
}

// Defensive structures are a squat emplacement plus a mount that traverses, so
// a gun line visibly tracks whatever is coming at it.
const DEFENCES = {
  mg:       { pit: 0.42, turret: () => [box(0.5, 0.34, 0.44, 0, 0.17, 0, BODY), cyl(0.045, 0.045, 0.8, 0.42, 0.20, 0, STEEL, Math.PI / 2)] },
  atgun:    { pit: 0.46, turret: () => [box(0.62, 0.34, 0.5, 0, 0.17, 0, BODY), cyl(0.055, 0.05, 1.25, 0.68, 0.22, 0, STEEL, Math.PI / 2), box(0.1, 0.42, 0.62, -0.16, 0.3, 0, DARK)] },
  coastal:  { pit: 0.5,  turret: () => [box(0.8, 0.44, 0.68, 0, 0.22, 0, BODY), cyl(0.07, 0.06, 1.6, 0.9, 0.28, 0, STEEL, Math.PI / 2)] },
  sam:      { pit: 0.5,  turret: () => [box(0.66, 0.3, 0.58, 0, 0.15, 0, DARK), box(0.7, 0.5, 0.16, 0.06, 0.5, -0.17, HIGH, 0), box(0.7, 0.5, 0.16, 0.06, 0.5, 0.17, HIGH, 0)] },
  patriot:  { pit: 0.5,  turret: () => [box(0.7, 0.3, 0.62, 0, 0.15, 0, DARK), box(0.9, 0.62, 0.5, 0.1, 0.58, 0, HIGH)] },
  s400:     { pit: 0.5,  turret: () => [box(0.7, 0.3, 0.62, 0, 0.15, 0, DARK), box(0.95, 0.58, 0.52, 0.1, 0.56, 0, HIGH)] },
  hq9:      { pit: 0.5,  turret: () => [box(0.7, 0.3, 0.62, 0, 0.15, 0, DARK), box(0.92, 0.6, 0.5, 0.1, 0.57, 0, HIGH)] },
  irondome: { pit: 0.48, turret: () => [box(0.66, 0.28, 0.6, 0, 0.14, 0, DARK), box(0.62, 0.66, 0.62, 0.08, 0.6, 0, HIGH)] },
};

/** A blocky but properly massed building, sized from its footprint. */
export function buildingGeometry(key, size, height) {
  const ck = 'b|' + key + '|' + size + '|' + height.toFixed(2);
  let hit = cache.get(ck);
  if (hit) return hit;
  const s = size * 0.44;
  const def = DEFENCES[key];
  if (def) {
    const emplacement = [
      box(s * 2, 0.22, s * 2, 0, 0.11, 0, DARK),
      box(s * 1.55, def.pit, s * 1.55, 0, 0.11 + def.pit / 2, 0, BODY),
      // Sandbag revetment on the two forward corners.
      box(s * 0.5, 0.2, s * 1.9, -s * 0.85, 0.21, 0, STEEL),
      box(s * 1.9, 0.2, s * 0.5, 0, 0.21, -s * 0.85, STEEL),
    ];
    const trim = [box(s * 1.75, 0.14, s * 1.75, 0, 0.11 + def.pit + 0.05, 0, HIGH)];
    const t = def.turret();
    for (const g of t) g.translate(0, 0.11 + def.pit + 0.12, 0);
    hit = { hull: mergeGeometries(emplacement), trim: mergeGeometries(trim), turret: mergeGeometries(t) };
    cache.set(ck, hit);
    return hit;
  }
  const top = 0.12 + height;
  // The body is concrete and steel; only the roof cap and a waist band carry
  // the owner's colour, which is what a real installation looks like from the
  // air — and it keeps four coalitions on one map from reading as one hue.
  const trim = [
    box(s * 1.94, 0.16, s * 1.94, 0, top + 0.06, 0, BODY),           // roof cap
    box(s * 1.84, 0.12, s * 1.84, 0, 0.29 + height * 0.34, 0, BODY), // waist band
  ];
  const parts = [
    box(s * 2, 0.24, s * 2, 0, 0.12, 0, DARK),                       // apron
    box(s * 1.86, 0.18, s * 1.86, 0, 0.29, 0, STEEL),                // plinth
    box(s * 1.8, height, s * 1.8, 0, 0.12 + height / 2, 0, BODY),
    box(s * 1.2, 0.1, s * 1.2, 0, top + 0.18, 0, STEEL),             // roof deck
  ];
  // Corner pilasters and a shadow line under the eaves, so a big slab of wall
  // has something for the sun to catch.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(box(s * 0.28, height * 0.96, s * 0.28, sx * s * 0.82, 0.12 + height / 2, sz * s * 0.82, HIGH));
    }
  }
  parts.push(box(s * 1.84, 0.09, s * 0.1, 0, top - 0.22, -s * 0.92, DARK));
  parts.push(box(s * 0.1, 0.09, s * 1.84, -s * 0.92, top - 0.22, 0, DARK));
  // Vehicle door on the south face.
  parts.push(box(s * 0.85, Math.min(0.75, height * 0.66), s * 0.09,
    0, 0.29 + Math.min(0.75, height * 0.66) / 2, s * 0.92, DARK));
  // Roof plant: vents and a service block.
  parts.push(box(s * 0.42, 0.22, s * 0.42, -s * 0.5, top + 0.29, -s * 0.4, DARK));
  parts.push(cyl(s * 0.16, s * 0.16, 0.34, s * 0.5, top + 0.35, s * 0.35, STEEL));
  if (key === 'power') {
    parts.push(cyl(s * 0.34, s * 0.4, height * 1.5, s * 0.7, 0.12 + height * 0.75, s * 0.7, STEEL));
    parts.push(cyl(s * 0.34, s * 0.4, height * 1.5, -s * 0.7, 0.12 + height * 0.75, -s * 0.7, STEEL));
  } else if (key === 'radar' || key === 'data') {
    parts.push(cyl(0.06, 0.06, height * 1.2, 0, 0.12 + height * 1.4, 0, STEEL));
    parts.push(box(s * 0.9, 0.1, s * 0.5, 0, 0.12 + height * 2.0, 0, HIGH));
  } else if (key === 'hq') {
    parts.push(box(s * 1.1, height * 0.5, s * 1.1, 0, 0.12 + height * 1.2, 0, HIGH));
    parts.push(cyl(0.05, 0.05, height * 0.9, s * 0.8, 0.12 + height * 1.4, s * 0.8, STEEL));
  } else if (key === 'factory' || key === 'navalyard' || key === 'artillery') {
    parts.push(box(s * 1.95, 0.3, s * 0.5, 0, 0.12 + height + 0.2, -s * 0.6, STEEL));
    parts.push(box(s * 1.95, 0.3, s * 0.5, 0, 0.12 + height + 0.2, s * 0.6, STEEL));
  }
  hit = { hull: mergeGeometries(parts), trim: mergeGeometries(trim), turret: null };
  cache.set(ck, hit);
  return hit;
}

/** Oil derricks, refineries, ports and the rest of the capturable furniture. */
export function neutralGeometry(type) {
  const ck = 'n|' + type;
  let hit = cache.get(ck);
  if (hit) return hit;
  let parts;
  if (type === 'derrick') {
    parts = [
      box(1.4, 0.16, 1.4, 0, 0.08, 0, DARK),
      cyl(0.09, 0.16, 2.2, 0, 1.2, 0, STEEL),
      box(0.9, 0.2, 0.3, 0.3, 0.4, 0, BODY),
    ];
  } else if (type === 'refinery' || type === 'fieldrefinery') {
    const s = type === 'refinery' ? 1 : 0.72;
    parts = [
      box(2.4 * s, 0.16, 2.0 * s, 0, 0.08, 0, DARK),
      cyl(0.42 * s, 0.42 * s, 1.5 * s, -0.5 * s, 0.85 * s, 0.4 * s, BODY),
      cyl(0.16 * s, 0.16 * s, 2.2 * s, 0.5 * s, 1.2 * s, -0.3 * s, STEEL),
      box(1.0 * s, 0.6 * s, 0.8 * s, 0.3 * s, 0.42 * s, 0.6 * s, BODY),
    ];
  } else if (type === 'port') {
    parts = [
      box(2.6, 0.2, 2.2, 0, 0.1, 0, DARK),
      box(1.0, 0.8, 0.9, -0.6, 0.5, 0, BODY),
      cyl(0.07, 0.07, 2.0, 0.5, 1.1, -0.4, STEEL),
      box(1.2, 0.08, 0.16, 1.0, 2.0, -0.4, HIGH),
    ];
  } else if (type === 'railyard') {
    parts = [
      box(3.0, 0.14, 2.4, 0, 0.07, 0, DARK),
      box(2.8, 0.06, 0.12, 0, 0.16, 0.5, STEEL),
      box(2.8, 0.06, 0.12, 0, 0.16, -0.5, STEEL),
      box(0.8, 0.5, 0.4, -0.8, 0.4, 0.5, BODY),
      box(0.8, 0.5, 0.4, 0.4, 0.4, -0.5, BODY),
      cyl(0.34, 0.34, 0.7, 1.0, 1.3, 0.7, HIGH),
      cyl(0.06, 0.06, 1.0, 1.0, 0.6, 0.7, STEEL),
    ];
  } else {
    parts = [
      box(1.6, 0.16, 1.6, 0, 0.08, 0, DARK),
      box(0.9, 0.6, 0.9, 0, 0.42, 0, BODY),
    ];
  }
  hit = { hull: mergeGeometries(parts), turret: null };
  cache.set(ck, hit);
  return hit;
}

/** Trees and the rest of the scenery. */
export function propGeometry(type) {
  const ck = 'p|' + type;
  let hit = cache.get(ck);
  if (hit) return hit;
  let parts;
  if (type === 'tree') {
    const trunk = new THREE.CylinderGeometry(0.09, 0.14, 0.95, 6).toNonIndexed();
    trunk.translate(0, 0.47, 0);
    const crown = new THREE.IcosahedronGeometry(0.66, 0);
    crown.scale(1, 1.15, 1); crown.translate(0, 1.4, 0);
    const top = new THREE.IcosahedronGeometry(0.42, 0);
    top.translate(0.16, 1.9, 0.08);
    parts = [tinted(trunk, 0.45), tinted(crown, 0.95), tinted(top, 1.12)];
  } else if (type === 'house') {
    // Walls, a hipped roof and a chimney: enough massing that a village reads
    // as buildings from above rather than as scattered pale slabs.
    const roof = new THREE.ConeGeometry(0.62, 0.34, 4);
    roof.rotateY(Math.PI / 4);
    roof.scale(1.15, 1, 0.95);
    roof.translate(0, 0.72, 0);
    parts = [
      box(0.72, 0.56, 0.60, 0, 0.28, 0, 0.92),
      box(0.78, 0.06, 0.66, 0, 0.55, 0, 0.7),        // eaves
      tinted(roof, 0.62),
      box(0.10, 0.30, 0.10, -0.20, 0.86, 0.14, 0.5), // chimney
    ];
  } else if (type === 'barn') {
    const roof = new THREE.ConeGeometry(0.85, 0.42, 4);
    roof.rotateY(Math.PI / 4);
    roof.scale(1.35, 1, 0.78);
    roof.translate(0, 0.92, 0);
    parts = [
      box(1.45, 0.72, 0.86, 0, 0.36, 0, 0.86),
      box(1.52, 0.07, 0.94, 0, 0.72, 0, 0.62),
      tinted(roof, 0.55),
      box(0.34, 0.5, 0.06, 0.2, 0.25, 0.45, 0.4),    // barn doors
    ];
  } else if (type === 'stack') {
    parts = [cyl(0.22, 0.3, 2.6, 0, 1.3, 0, 0.85)];
  } else {
    parts = [box(1.0, 0.5, 1.0, 0, 0.25, 0, 0.9)];
  }
  hit = { hull: mergeGeometries(parts), turret: null };
  cache.set(ck, hit);
  return hit;
}
