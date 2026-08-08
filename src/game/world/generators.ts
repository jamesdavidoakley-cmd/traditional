/**
 * Geometry recipes + decor builders used by level manifests (§7).
 * A level JSON says `{"type":"gen","gen":"ring",...}` or `{"type":"box",...}`;
 * this module turns those into meshes + collision geometry. Recipes are
 * world-agnostic engine features — worlds themselves stay pure data.
 */
import * as THREE from 'three';
import { toonMat } from '../../engine/renderer';
import { makeGearMesh } from '../rigs';
import type { DecorDef, GeomDef, Vec3 } from '../content-types';
import { makeRng, randRange, type Rng } from '../../engine/math';

export interface BuiltGeometry {
  visual: THREE.Object3D[];
  collision: THREE.BufferGeometry[]; // world-space baked
}

const DEG = Math.PI / 180;

function bakeCollision(geo: THREE.BufferGeometry, obj: THREE.Object3D): THREE.BufferGeometry {
  obj.updateMatrixWorld(true);
  const c = geo.clone();
  c.applyMatrix4(obj.matrixWorld);
  return c;
}

export function meshFor(def: GeomDef): THREE.Mesh {
  const colour = def.colour ?? '#888888';
  let geo: THREE.BufferGeometry;
  switch (def.type) {
    case 'cylinder': {
      const [rt, h, rb] = def.size ?? [2, 1, 2];
      geo = new THREE.CylinderGeometry(rt, rb ?? rt, h, def.segments ?? 20);
      break;
    }
    case 'ramp': {
      const [w, h, d] = def.size ?? [2, 1, 4];
      // wedge: box sheared — build from BufferGeometry prism
      geo = wedgeGeometry(w, h, d);
      break;
    }
    default: {
      const [w, h, d] = def.size ?? [1, 1, 1];
      geo = new THREE.BoxGeometry(w, h, d);
    }
  }
  const mesh = new THREE.Mesh(geo, toonMat(colour));
  if (def.pos) mesh.position.set(...def.pos);
  if (def.rot) mesh.rotation.set(def.rot[0] * DEG, def.rot[1] * DEG, def.rot[2] * DEG);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function wedgeGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  // triangular prism: slope rising toward +z
  const verts = [
    // bottom
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    // slope (from y0 at -z to h at +z)... build as two triangles
    -hw, 0, -hd, hw, h, hd, hw, 0, -hd, -hw, 0, -hd, -hw, h, hd, hw, h, hd,
    // back face (+z, vertical)
    -hw, 0, hd, hw, h, hd, -hw, h, hd, -hw, 0, hd, hw, 0, hd, hw, h, hd,
    // sides
    -hw, 0, -hd, -hw, 0, hd, -hw, h, hd, hw, 0, -hd, hw, h, hd, hw, 0, hd,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

type GenFn = (params: Record<string, unknown>, out: BuiltGeometry) => void;

const num = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);
const vec = (v: unknown, d: Vec3): Vec3 => (Array.isArray(v) && v.length === 3 ? (v as Vec3) : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);

function addBoxAt(
  out: BuiltGeometry,
  pos: Vec3,
  size: Vec3,
  colour: string,
  rotY = 0,
  collide = true,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), toonMat(colour));
  m.position.set(...pos);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  out.visual.push(m);
  if (collide) out.collision.push(bakeCollision(m.geometry as THREE.BufferGeometry, m));
  return m;
}

const GENERATORS: Record<string, GenFn> = {
  /** Big ground disc or slab with an optional rim skirt. */
  floor(p, out) {
    const pos = vec(p.pos, [0, 0, 0]);
    const colour = str(p.colour, '#7dc95e');
    if (str(p.shape, 'cylinder') === 'cylinder') {
      const r = num(p.radius, 20);
      const h = num(p.height, 2);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, num(p.segments, 44)), toonMat(colour));
      m.position.set(pos[0], pos[1] - h / 2, pos[2]);
      m.receiveShadow = true;
      out.visual.push(m);
      out.collision.push(bakeCollision(m.geometry as THREE.BufferGeometry, m));
      if (p.rimColour) {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.07, r * 1.12, h * 0.6, 44), toonMat(str(p.rimColour, '#c99a5b')));
        rim.position.set(pos[0], pos[1] - h * 0.8, pos[2]);
        out.visual.push(rim);
      }
    } else {
      const size = vec(p.size, [20, 2, 20]);
      addBoxAt(out, [pos[0], pos[1] - size[1] / 2, pos[2]], size, colour);
    }
  },

  /** Ring of pillars or floating platforms. */
  ring(p, out) {
    const c = vec(p.center, [0, 0, 0]);
    const r = num(p.radius, 10);
    const count = num(p.count, 8);
    const size = vec(p.size, [2, 0.6, 2]);
    const colour = str(p.colour, '#c9a24a');
    const from = num(p.angleFrom, 0) * DEG;
    const to = num(p.angleTo, 360) * DEG;
    const yStep = num(p.yStep, 0);
    const rng = makeRng(num(p.seed, 7));
    for (let i = 0; i < count; i++) {
      const a = from + ((to - from) * i) / Math.max(1, count - (Math.abs(to - from - Math.PI * 2) < 0.01 ? 0 : 1));
      const jitter = num(p.yJitter, 0);
      addBoxAt(
        out,
        [c[0] + Math.cos(a) * r, c[1] + yStep * i + (jitter ? randRange(rng, -jitter, jitter) : 0), c[2] + Math.sin(a) * r],
        size,
        colour,
        -a,
      );
    }
  },

  /** Chain of floating platforms along a polyline, optional arc lift. */
  path(p, out) {
    const points = (p.points as Vec3[]) ?? [
      [0, 0, 0],
      [10, 0, 0],
    ];
    const count = num(p.count, 6);
    const size = vec(p.size, [2.2, 0.5, 2.2]);
    const colour = str(p.colour, '#c9a24a');
    const arc = num(p.arcHeight, 0);
    const total = count;
    for (let i = 0; i < total; i++) {
      const t = total === 1 ? 0 : i / (total - 1);
      const segF = t * (points.length - 1);
      const si = Math.min(points.length - 2, Math.floor(segF));
      const st = segF - si;
      const a = points[si];
      const b = points[si + 1];
      const x = a[0] + (b[0] - a[0]) * st;
      const y = a[1] + (b[1] - a[1]) * st + Math.sin(t * Math.PI) * arc;
      const z = a[2] + (b[2] - a[2]) * st;
      addBoxAt(out, [x, y, z], size, colour);
    }
  },

  /** Straight staircase of boxes. */
  stairs(p, out) {
    const from = vec(p.from, [0, 0, 0]);
    const ang = num(p.angleDeg, 0) * DEG;
    const steps = num(p.steps, 6);
    const rise = num(p.rise, 0.5);
    const run = num(p.run, 1.4);
    const width = num(p.width, 3);
    const colour = str(p.colour, '#c9a24a');
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    for (let i = 0; i < steps; i++) {
      addBoxAt(
        out,
        [from[0] + dx * run * i, from[1] + rise * i, from[2] + dz * run * i],
        [width, 0.4, run + 0.35],
        colour,
        ang,
      );
    }
  },

  /** Wall between two points. */
  wall(p, out) {
    const a = vec(p.from, [0, 0, 0]);
    const b = vec(p.to, [10, 0, 0]);
    const h = num(p.height, 4);
    const th = num(p.thickness, 1);
    const colour = str(p.colour, '#b0805a');
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const ang = Math.atan2(b[0] - a[0], b[2] - a[2]);
    addBoxAt(out, [(a[0] + b[0]) / 2, a[1] + h / 2, (a[2] + b[2]) / 2], [th, h, len], colour, ang);
  },

  /** Canyon rim: ring of tall rocky wall segments with gap openings. */
  canyon(p, out) {
    const c = vec(p.center, [0, 0, 0]);
    const r = num(p.radius, 40);
    const h = num(p.height, 14);
    const segs = num(p.segments, 22);
    const colour = str(p.colour, '#b0674a');
    const gaps = (p.gapAngles as number[]) ?? [];
    const gapWidth = num(p.gapWidth, 24);
    const rng = makeRng(num(p.seed, 3));
    for (let i = 0; i < segs; i++) {
      const aDeg = (i / segs) * 360;
      if (gaps.some((g) => Math.abs((((aDeg - g + 540) % 360) - 180)) < gapWidth / 2)) continue;
      const a = aDeg * DEG;
      const segH = h * randRange(rng, 0.85, 1.25);
      const w = ((Math.PI * 2 * r) / segs) * 1.15;
      addBoxAt(out, [c[0] + Math.cos(a) * r, c[1] + segH / 2 - 1, c[2] + Math.sin(a) * r], [4, segH, w], colour, -a + Math.PI / 2);
    }
  },
};

export function buildGeometry(defs: GeomDef[]): BuiltGeometry {
  const out: BuiltGeometry = { visual: [], collision: [] };
  for (const def of defs) {
    if (def.type === 'gen' && def.gen) {
      const fn = GENERATORS[def.gen];
      if (!fn) {
        console.warn(`[level] unknown generator '${def.gen}'`);
        continue;
      }
      fn(def.params ?? {}, out);
    } else {
      const mesh = meshFor(def);
      out.visual.push(mesh);
      if (def.collide !== false) {
        out.collision.push(bakeCollision(mesh.geometry as THREE.BufferGeometry, mesh));
      }
    }
  }
  return out;
}

// ============================================================== DECOR ====
const decorRng: Rng = makeRng(42);

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}
function m(geo: THREE.BufferGeometry, colour: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, toonMat(colour));
  mesh.castShadow = true;
  return mesh;
}
function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, ry = 0): T {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

export function makeTextLabel(text: string, colour = '#2a2440', bg = '#fff6e3'): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = '700 46px "Comic Sans MS", Verdana, sans-serif';
  const w = Math.max(120, g.measureText(text).width + 56);
  c.width = w;
  c.height = 84;
  const ctx2 = c.getContext('2d')!;
  const r = 26;
  ctx2.fillStyle = bg;
  ctx2.strokeStyle = colour;
  ctx2.lineWidth = 7;
  ctx2.beginPath();
  ctx2.roundRect(6, 6, w - 12, 72, r);
  ctx2.fill();
  ctx2.stroke();
  ctx2.font = '700 42px "Comic Sans MS", Verdana, sans-serif';
  ctx2.fillStyle = colour;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, w / 2, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sprite.scale.set(w / 84, 1, 1);
  return sprite;
}

export function buildDecor(def: DecorDef): THREE.Object3D {
  const scale = def.scale ?? 1;
  const colour = def.colour;
  let obj: THREE.Object3D;
  switch (def.type) {
    case 'boneArch': {
      const arch = m(new THREE.TorusGeometry(3, 0.45, 10, 20, Math.PI), colour ?? '#efe6d8');
      arch.position.y = 0.2;
      obj = group(arch);
      break;
    }
    case 'ribs': {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const rib = m(new THREE.TorusGeometry(1.6 - i * 0.16, 0.16, 8, 16, Math.PI), '#efe6d8');
        rib.position.set(0, 0.1, i * 1.1);
        g.add(rib);
      }
      obj = g;
      break;
    }
    case 'skullRock': {
      const skull = m(new THREE.SphereGeometry(1.4, 14, 12), '#efe6d8');
      skull.scale.set(1, 0.85, 1.1);
      const eyeL = m(new THREE.SphereGeometry(0.34, 8, 8), '#3a3348');
      const eyeR = eyeL.clone();
      at(eyeL, -0.5, 0.2, 1.05);
      at(eyeR, 0.5, 0.2, 1.05);
      obj = group(skull, eyeL, eyeR);
      break;
    }
    case 'cactus': {
      const trunk = m(new THREE.CylinderGeometry(0.32, 0.4, 2.4, 8), '#4f9e51');
      trunk.position.y = 1.2;
      const armL = m(new THREE.CylinderGeometry(0.2, 0.22, 1, 8), '#4f9e51');
      at(armL, -0.55, 1.4, 0);
      armL.rotation.z = 0.9;
      const armUp = m(new THREE.CylinderGeometry(0.18, 0.2, 0.8, 8), '#4f9e51');
      at(armUp, -0.95, 1.85, 0);
      obj = group(trunk, armL, armUp);
      break;
    }
    case 'crystal': {
      const g = new THREE.Group();
      const n = 3;
      for (let i = 0; i < n; i++) {
        const h = randRange(decorRng, 0.8, 2.2) * scale;
        const cr = m(new THREE.ConeGeometry(0.3 * scale, h, 5), colour ?? '#8ae0ff');
        at(cr, randRange(decorRng, -0.5, 0.5), h / 2, randRange(decorRng, -0.5, 0.5));
        cr.rotation.z = randRange(decorRng, -0.2, 0.2);
        g.add(cr);
      }
      obj = g;
      break;
    }
    case 'bigGear': {
      const gear = makeGearMesh(2 * scale, 10, 0.5, colour ?? '#B8863B');
      gear.rotation.x = Math.PI / 2;
      gear.position.y = 0.3;
      const gg = group(gear);
      gg.userData.spin = 0.15;
      obj = gg;
      break;
    }
    case 'standGear': {
      const gear = makeGearMesh(1.6 * scale, 9, 0.4, colour ?? '#a85c32');
      gear.position.y = 1.6 * scale;
      const gg = group(gear);
      gg.userData.spinZ = 0.25;
      obj = gg;
      break;
    }
    case 'pipe': {
      const v = m(new THREE.CylinderGeometry(0.4, 0.4, 3, 10), colour ?? '#7a8aa0');
      v.position.y = 1.5;
      const elbow = m(new THREE.TorusGeometry(0.7, 0.4, 8, 10, Math.PI / 2), colour ?? '#7a8aa0');
      at(elbow, 0, 3, 0.7);
      elbow.rotation.x = Math.PI;
      obj = group(v, elbow);
      break;
    }
    case 'chimney': {
      const c1 = m(new THREE.CylinderGeometry(0.7, 0.9, 4.4, 10), colour ?? '#8a5a44');
      c1.position.y = 2.2;
      const rim = m(new THREE.CylinderGeometry(0.85, 0.85, 0.4, 10), '#3a3348');
      rim.position.y = 4.4;
      obj = group(c1, rim);
      break;
    }
    case 'sign': {
      const post = m(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 8), '#7a4a2c');
      post.position.y = 0.8;
      const label = makeTextLabel(def.text ?? '?');
      label.position.y = 1.9;
      obj = group(post, label);
      break;
    }
    case 'lamp': {
      const post = m(new THREE.CylinderGeometry(0.09, 0.12, 2.6, 8), '#3a3348');
      post.position.y = 1.3;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 10),
        new THREE.MeshBasicMaterial({ color: '#ffe98a' }),
      );
      bulb.position.y = 2.75;
      obj = group(post, bulb);
      break;
    }
    case 'tree': {
      const trunk = m(new THREE.CylinderGeometry(0.28, 0.4, 1.8, 8), '#7a4a2c');
      trunk.position.y = 0.9;
      const g = group(trunk);
      for (let i = 0; i < 3; i++) {
        const puff = m(new THREE.SphereGeometry(1.15 - i * 0.22, 10, 10), colour ?? '#5cb860');
        puff.position.set(randRange(decorRng, -0.4, 0.4), 2 + i * 0.7, randRange(decorRng, -0.4, 0.4));
        g.add(puff);
      }
      obj = g;
      break;
    }
    case 'palm': {
      const trunk = m(new THREE.CylinderGeometry(0.2, 0.32, 3.2, 8), '#9a6a44');
      trunk.position.y = 1.6;
      trunk.rotation.z = 0.12;
      const g = group(trunk);
      for (let i = 0; i < 5; i++) {
        const frond = m(new THREE.BoxGeometry(2.2, 0.06, 0.5), '#4f9e51');
        frond.position.set(Math.cos((i / 5) * Math.PI * 2) * 0.9, 3.3, Math.sin((i / 5) * Math.PI * 2) * 0.9);
        frond.rotation.y = -(i / 5) * Math.PI * 2;
        frond.rotation.z = 0.35;
        g.add(frond);
      }
      obj = g;
      break;
    }
    case 'rock': {
      const r = m(new THREE.DodecahedronGeometry(0.8 * scale, 0), colour ?? '#b0805a');
      r.position.y = 0.5 * scale;
      r.rotation.set(randRange(decorRng, 0, 3), randRange(decorRng, 0, 3), 0);
      obj = group(r);
      break;
    }
    case 'bush': {
      const b = m(new THREE.SphereGeometry(0.7 * scale, 9, 8), colour ?? '#4f9e51');
      b.position.y = 0.45 * scale;
      b.scale.y = 0.75;
      obj = group(b);
      break;
    }
    case 'flower': {
      const stem = m(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6), '#4f9e51');
      stem.position.y = 0.35;
      const head = m(new THREE.SphereGeometry(0.16, 8, 8), colour ?? '#ff7eb3');
      head.position.y = 0.78;
      obj = group(stem, head);
      break;
    }
    case 'umbrella': {
      const pole = m(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), '#efe6d8');
      pole.position.y = 1.3;
      const top = m(new THREE.ConeGeometry(1.7, 0.8, 10), colour ?? '#ff7e6a');
      top.position.y = 2.7;
      obj = group(pole, top);
      break;
    }
    case 'table': {
      const top = m(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 12), '#c99a5b');
      top.position.y = 0.75;
      const leg = m(new THREE.CylinderGeometry(0.08, 0.1, 0.75, 8), '#7a4a2c');
      leg.position.y = 0.37;
      obj = group(top, leg);
      break;
    }
    case 'crate': {
      const c = m(new THREE.BoxGeometry(1, 1, 1), colour ?? '#c99a5b');
      c.position.y = 0.5;
      obj = group(c);
      break;
    }
    case 'barrel': {
      const b = m(new THREE.CylinderGeometry(0.5, 0.55, 1.1, 12), colour ?? '#8a5a34');
      b.position.y = 0.55;
      obj = group(b);
      break;
    }
    case 'cogPile': {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const gear = makeGearMesh(randRange(decorRng, 0.3, 0.7), 8, 0.16, i % 2 ? '#a85c32' : '#B8863B');
        gear.rotation.x = Math.PI / 2 + randRange(decorRng, -0.4, 0.4);
        gear.position.set(randRange(decorRng, -0.7, 0.7), 0.1 + i * 0.16, randRange(decorRng, -0.7, 0.7));
        g.add(gear);
      }
      obj = g;
      break;
    }
    case 'banner': {
      const pole = m(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 8), '#3a3348');
      pole.position.y = 1.7;
      const flag = m(new THREE.BoxGeometry(1.3, 0.8, 0.05), colour ?? '#C43D3D');
      at(flag, 0.72, 2.9, 0);
      obj = group(pole, flag);
      break;
    }
    case 'fence': {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const post = m(new THREE.BoxGeometry(0.14, 0.9, 0.14), '#7a4a2c');
        post.position.set(i * 0.9, 0.45, 0);
        g.add(post);
      }
      const rail = m(new THREE.BoxGeometry(3.4, 0.12, 0.1), '#9a6a44');
      rail.position.set(1.35, 0.68, 0);
      g.add(rail);
      obj = g;
      break;
    }
    case 'steamStack': {
      const base = m(new THREE.CylinderGeometry(0.8, 1, 1.6, 10), '#6e5a3a');
      base.position.y = 0.8;
      const grate = m(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 10), '#3a3348');
      grate.position.y = 1.7;
      obj = group(base, grate);
      break;
    }
    default: {
      obj = group(m(new THREE.BoxGeometry(0.5, 0.5, 0.5), '#ff00ff'));
      console.warn(`[level] unknown decor '${def.type}'`);
    }
  }
  obj.position.set(...def.pos);
  if (def.rot) obj.rotation.set(def.rot[0] * DEG, def.rot[1] * DEG, def.rot[2] * DEG);
  if (def.scale && def.type !== 'crystal' && def.type !== 'rock') obj.scale.multiplyScalar(def.scale);
  return obj;
}

/** Star-fossil pickup mesh: a chunky star on a little stone tablet. */
export function makeFossilMesh(colour = '#ffd75e'): THREE.Group {
  const shape = new THREE.Shape();
  const R = 0.55;
  const r = 0.24;
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 });
  geo.center();
  const star = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({ color: colour, emissive: '#8a6a10', gradientMap: null }),
  );
  star.castShadow = true;
  const g = new THREE.Group();
  g.add(star);
  g.userData.star = star;
  return g;
}

export function makeChipMesh(): THREE.Mesh {
  const chip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.1, 6),
    new THREE.MeshToonMaterial({ color: '#ffb545', emissive: '#5a3a00' }),
  );
  chip.rotation.x = Math.PI / 2;
  return chip;
}

export function makeHeartMesh(): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.3);
  shape.bezierCurveTo(-0.5, 0.1, -0.3, 0.45, 0, 0.2);
  shape.bezierCurveTo(0.3, 0.45, 0.5, 0.1, 0, -0.3);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
  geo.center();
  return new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#ff5e7e', emissive: '#5a1020' }));
}
