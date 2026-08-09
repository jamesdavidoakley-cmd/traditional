/**
 * Primitive-built character rigs (§2.4): hierarchies of Object3D "bones"
 * with code-driven animation and swappable eye expressions. No external
 * art assets anywhere — geometry, colour and motion carry the charm.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonMat } from '../engine/renderer';

export type RigMode =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'spin'
  | 'stomp'
  | 'talk'
  | 'dizzy'
  | 'cheer'
  | 'attack'
  | 'block'
  | 'hurt'
  | 'kneel';

export type Expression = 'normal' | 'happy' | 'surprised' | 'dizzy' | 'determined';

export interface RigCtx {
  mode: RigMode;
  speed: number; // 0..1 of top speed
  talking: boolean;
  /** windup 0→1 then strike for attack-type modes */
  actionT: number;
}

interface Rest {
  pos: THREE.Vector3;
  rot: THREE.Euler;
}

const expressionCache = new Map<string, THREE.CanvasTexture>();
function eyeTexture(expr: Expression, iris = '#221c33'): THREE.CanvasTexture {
  const key = `${expr}|${iris}`;
  const hit = expressionCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#2a2440';
  g.lineWidth = 4;
  const dot = (x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  switch (expr) {
    case 'normal':
      dot(32, 32, 26);
      g.fillStyle = iris;
      dot(36, 34, 12);
      break;
    case 'happy': {
      g.lineWidth = 9;
      g.strokeStyle = '#2a2440';
      g.beginPath();
      g.arc(32, 40, 20, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      break;
    }
    case 'surprised':
      dot(32, 32, 30);
      g.fillStyle = iris;
      dot(32, 36, 9);
      break;
    case 'dizzy': {
      g.strokeStyle = '#2a2440';
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(12, 12);
      g.lineTo(52, 52);
      g.moveTo(52, 12);
      g.lineTo(12, 52);
      g.stroke();
      break;
    }
    case 'determined': {
      dot(32, 36, 24);
      g.fillStyle = iris;
      dot(36, 38, 11);
      g.fillStyle = '#2a2440';
      g.beginPath();
      g.moveTo(2, 20);
      g.lineTo(62, 6);
      g.lineTo(62, 22);
      g.lineTo(2, 34);
      g.fill();
      break;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  expressionCache.set(key, tex);
  return tex;
}

function makeEye(size: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: eyeTexture('normal'), transparent: true }),
  );
  m.renderOrder = 2;
  return m;
}

const box = (w: number, h: number, d: number, colour: string, r = 0.08): THREE.Mesh => {
  const radius = Math.min(r, w / 2.001, h / 2.001, d / 2.001);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), toonMat(colour));
  m.castShadow = true;
  return m;
};
const sphere = (r: number, colour: string): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), toonMat(colour));
  m.castShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, colour: string, seg = 14): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMat(colour));
  m.castShadow = true;
  return m;
};
const cone = (r: number, h: number, colour: string, seg = 14): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), toonMat(colour));
  m.castShadow = true;
  return m;
};

export class Rig {
  root = new THREE.Group();
  bones = new Map<string, THREE.Object3D>();
  private rest = new Map<string, Rest>();
  private eyes: THREE.Mesh[] = [];
  private expr: Expression = 'normal';
  private t = 0;
  private runPhase = 0;
  private blinkTimer = 2 + Math.random() * 3;
  private blinking = 0;
  kind: 'dino' | 'biped' | 'quad' | 'bot';
  /** Character-specific extra animation. */
  extra: ((rig: Rig, dt: number, ctx: RigCtx, t: number) => void) | null = null;
  seed = Math.random() * 10;

  constructor(kind: Rig['kind']) {
    this.kind = kind;
  }

  add(name: string, obj: THREE.Object3D, parent?: string): THREE.Object3D {
    this.bones.set(name, obj);
    if (parent) this.bones.get(parent)?.add(obj);
    else this.root.add(obj);
    return obj;
  }

  addEye(parent: string, x: number, y: number, z: number, size: number, yRot = 0): void {
    const eye = makeEye(size);
    eye.position.set(x, y, z);
    eye.rotation.y = yRot;
    this.bones.get(parent)?.add(eye);
    this.eyes.push(eye);
  }

  /** Capture rest pose — call once, after building. */
  bake(): void {
    for (const [name, obj] of this.bones) {
      this.rest.set(name, { pos: obj.position.clone(), rot: obj.rotation.clone() });
    }
  }

  setExpression(e: Expression): void {
    if (this.expr === e) return;
    this.expr = e;
    for (const eye of this.eyes) {
      (eye.material as THREE.MeshBasicMaterial).map = eyeTexture(e);
    }
  }

  private r(name: string): Rest | undefined {
    return this.rest.get(name);
  }
  b(name: string): THREE.Object3D | undefined {
    return this.bones.get(name);
  }
  /** reset a bone to rest then return it for offsetting */
  private rb(name: string): THREE.Object3D | null {
    const obj = this.bones.get(name);
    const rest = this.rest.get(name);
    if (!obj || !rest) return null;
    obj.position.copy(rest.pos);
    obj.rotation.copy(rest.rot);
    return obj;
  }

  update(dt: number, ctx: RigCtx): void {
    this.t += dt;
    const t = this.t + this.seed;
    this.runPhase += dt * (4 + ctx.speed * 9);
    // blink
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.13;
      this.blinkTimer = 1.8 + Math.random() * 3.4;
    }
    if (this.blinking > 0) this.blinking -= dt;
    for (const eye of this.eyes) eye.scale.y = this.blinking > 0 && ctx.mode !== 'dizzy' ? 0.12 : 1;

    if (this.kind === 'dino') this.animBiped(dt, ctx, t, true);
    else if (this.kind === 'biped') this.animBiped(dt, ctx, t, false);
    else if (this.kind === 'quad') this.animQuad(dt, ctx, t);
    else this.animBot(dt, ctx, t);
    this.extra?.(this, dt, ctx, t);
  }

  private animBiped(dt: number, ctx: RigCtx, t: number, dino: boolean): void {
    const body = this.rb('body');
    const head = this.rb('head');
    const armL = this.rb('armL');
    const armR = this.rb('armR');
    const legL = this.rb('legL');
    const legR = this.rb('legR');
    const jaw = this.rb('jaw');
    const ph = this.runPhase;
    const sp = ctx.speed;

    if (body) {
      body.position.y += Math.sin(t * 2.2) * 0.02 + (sp > 0.05 ? Math.abs(Math.sin(ph)) * 0.05 * sp : 0);
      body.rotation.x += sp * 0.14;
      if (ctx.mode === 'dizzy') body.rotation.z += Math.sin(t * 6) * 0.12;
      if (ctx.mode === 'kneel') {
        body.position.y -= 0.24;
        body.rotation.x += 0.4;
      }
    }
    if (head) {
      head.rotation.x += Math.sin(t * 2.2 + 0.4) * 0.03;
      if (ctx.talking) head.rotation.x += Math.sin(t * 11) * 0.05;
      if (ctx.mode === 'dizzy') head.rotation.z = Math.sin(t * 5) * 0.3;
      if (ctx.mode === 'cheer') head.rotation.x -= 0.25;
    }
    if (jaw) {
      jaw.rotation.x = ctx.talking ? 0.12 + Math.max(0, Math.sin(t * 12.5)) * 0.32 : jaw.rotation.x;
      if (ctx.mode === 'cheer' || ctx.mode === 'spin') jaw.rotation.x = 0.45;
    }
    const armSwing = dino ? 0.5 : 0.9;
    if (armL && armR) {
      if (ctx.mode === 'attack') {
        const a = ctx.actionT;
        armR.rotation.x = a < 0.4 ? -1.8 * (a / 0.4) : -1.8 + 3.1 * ((a - 0.4) / 0.6);
        armL.rotation.x = 0.3;
      } else if (ctx.mode === 'block') {
        armL.rotation.x = -1.2;
        armL.rotation.z = 0.5;
        armR.rotation.x = -0.4;
      } else if (ctx.mode === 'cheer') {
        armL.rotation.x = -2.6 + Math.sin(t * 8) * 0.2;
        armR.rotation.x = -2.6 - Math.sin(t * 8) * 0.2;
      } else if (ctx.talking) {
        armR.rotation.x = -0.5 + Math.sin(t * 5.4) * 0.3;
        armL.rotation.x = -0.3 + Math.cos(t * 4.7) * 0.25;
      } else if (ctx.mode === 'jump' || ctx.mode === 'fall') {
        armL.rotation.x = -1.9;
        armR.rotation.x = -1.9;
        armL.rotation.z = 0.5;
        armR.rotation.z = -0.5;
      } else {
        armL.rotation.x += Math.sin(ph) * armSwing * sp;
        armR.rotation.x += -Math.sin(ph) * armSwing * sp;
      }
    }
    if (legL && legR) {
      if (ctx.mode === 'jump') {
        legL.rotation.x = -0.7;
        legR.rotation.x = 0.4;
      } else if (ctx.mode === 'fall' || ctx.mode === 'stomp') {
        legL.rotation.x = 0.35;
        legR.rotation.x = 0.35;
      } else {
        legL.rotation.x += -Math.sin(ph) * 1.1 * sp;
        legR.rotation.x += Math.sin(ph) * 1.1 * sp;
      }
    }
    // tail follow-through (Max)
    for (let i = 1; i <= 3; i++) {
      const seg = this.rb(`tail${i}`);
      if (!seg) break;
      seg.rotation.y += Math.sin(t * 2.6 - i * 0.9) * 0.12 + Math.sin(ph - i * 0.8) * 0.1 * sp;
      if (ctx.mode === 'spin') seg.rotation.y += Math.sin(t * 30 - i) * 0.3;
    }
  }

  private animQuad(dt: number, ctx: RigCtx, t: number): void {
    const body = this.rb('body');
    const head = this.rb('head');
    const tail = this.rb('tail');
    const ph = this.runPhase;
    const sp = ctx.speed;
    if (body) {
      body.position.y += Math.sin(t * 2.8) * 0.015 + (sp > 0.05 ? Math.abs(Math.sin(ph)) * 0.06 * sp : 0);
      if (ctx.mode === 'cheer') body.rotation.x = -0.5 + Math.sin(t * 9) * 0.06;
    }
    if (head) {
      head.rotation.x += Math.sin(t * 2.8 + 1) * 0.05;
      if (ctx.talking) head.rotation.x += Math.sin(t * 10.5) * 0.09;
      if (ctx.mode === 'dizzy') head.rotation.z = Math.sin(t * 5) * 0.3;
    }
    if (tail) {
      // Digger's tail: always wagging; wags FAST when talking or cheering.
      const wag = ctx.talking || ctx.mode === 'cheer' ? 14 : 5;
      tail.rotation.y = Math.sin(t * wag) * 0.5;
    }
    const legs = ['legFL', 'legFR', 'legBL', 'legBR'];
    legs.forEach((name, i) => {
      const leg = this.rb(name);
      if (!leg) return;
      const offset = i === 0 || i === 3 ? 0 : Math.PI;
      if (ctx.mode === 'jump' || ctx.mode === 'fall') leg.rotation.x = i < 2 ? -0.6 : 0.6;
      else leg.rotation.x += Math.sin(ph + offset) * 0.9 * sp;
    });
  }

  private animBot(dt: number, ctx: RigCtx, t: number): void {
    const body = this.rb('body');
    const head = this.rb('head');
    if (body) {
      body.position.y += Math.sin(t * 3.1) * 0.05;
      if (ctx.mode === 'dizzy') body.rotation.z = Math.sin(t * 7) * 0.25;
      if (ctx.mode === 'attack') body.rotation.x = -0.3 + ctx.actionT * 0.6;
    }
    if (head) head.rotation.y = Math.sin(t * 1.7) * 0.4;
    const armL = this.rb('armL');
    const armR = this.rb('armR');
    if (armL && armR && ctx.mode === 'attack') {
      armR.rotation.x = -2 + ctx.actionT * 2.6;
    }
  }
}

// ===================================================================== MAX
export function buildMax(colour = '#2B6CFF', belly = '#7FE0D4'): Rig {
  const rig = new Rig('dino');
  const claw = '#F2E9D8';

  const body = rig.add('body', new THREE.Group());
  body.position.y = 0.62;
  const torso = box(0.62, 0.66, 0.52, colour, 0.16);
  body.add(torso);
  const bellyPatch = box(0.44, 0.5, 0.14, belly, 0.12);
  bellyPatch.position.set(0, -0.03, 0.22);
  body.add(bellyPatch);
  // back spikes
  for (let i = 0; i < 3; i++) {
    const s = cone(0.07, 0.14, belly, 6);
    s.position.set(0, 0.24 - i * 0.18, -0.28);
    s.rotation.x = -Math.PI / 2.4;
    body.add(s);
  }

  const head = rig.add('head', new THREE.Group(), 'body');
  head.position.set(0, 0.52, 0.06);
  const skull = box(0.56, 0.5, 0.62, colour, 0.18);
  skull.position.set(0, 0.1, 0.08);
  head.add(skull);
  const snoutTop = box(0.4, 0.22, 0.34, colour, 0.1);
  snoutTop.position.set(0, 0.03, 0.44);
  head.add(snoutTop);
  // teeth
  for (const sx of [-0.12, 0, 0.12]) {
    const tooth = cone(0.035, 0.07, '#ffffff', 5);
    tooth.rotation.x = Math.PI;
    tooth.position.set(sx, -0.07, 0.5);
    head.add(tooth);
  }
  const jaw = rig.add('jaw', new THREE.Group(), 'head');
  jaw.position.set(0, -0.08, 0.12);
  const jawBox = box(0.36, 0.14, 0.42, colour, 0.07);
  jawBox.position.set(0, -0.04, 0.22);
  jaw.add(jawBox);
  const jawIn = box(0.3, 0.06, 0.34, '#B84A5E', 0.03);
  jawIn.position.set(0, 0.02, 0.2);
  jaw.add(jawIn);
  rig.addEye('head', 0.235, 0.18, 0.31, 0.22, Math.PI / 5);
  rig.addEye('head', -0.235, 0.18, 0.31, 0.22, -Math.PI / 5);
  // nostrils
  for (const sx of [-0.09, 0.09]) {
    const n = sphere(0.025, '#1c3f8f');
    n.position.set(sx, 0.12, 0.6);
    head.add(n);
  }

  // tiny arms!
  for (const side of [-1, 1] as const) {
    const arm = rig.add(side < 0 ? 'armL' : 'armR', new THREE.Group(), 'body');
    arm.position.set(side * 0.32, 0.08, 0.16);
    const upper = box(0.1, 0.2, 0.1, colour, 0.04);
    upper.position.y = -0.08;
    arm.add(upper);
    const lower = box(0.08, 0.16, 0.08, colour, 0.03);
    lower.position.set(0, -0.18, 0.05);
    lower.rotation.x = -0.5;
    arm.add(lower);
    for (const c of [-0.02, 0.02]) {
      const clawC = cone(0.022, 0.06, claw, 5);
      clawC.position.set(c, -0.26, 0.12);
      clawC.rotation.x = -2.2;
      arm.add(clawC);
    }
  }
  // legs
  for (const side of [-1, 1] as const) {
    const leg = rig.add(side < 0 ? 'legL' : 'legR', new THREE.Group(), 'body');
    leg.position.set(side * 0.2, -0.32, 0);
    const thigh = box(0.22, 0.3, 0.28, colour, 0.09);
    thigh.position.y = -0.06;
    leg.add(thigh);
    const shin = box(0.14, 0.2, 0.16, colour, 0.05);
    shin.position.y = -0.26;
    leg.add(shin);
    const foot = box(0.2, 0.1, 0.3, colour, 0.04);
    foot.position.set(0, -0.36, 0.06);
    leg.add(foot);
    for (const c of [-0.06, 0, 0.06]) {
      const clawC = cone(0.03, 0.08, claw, 5);
      clawC.rotation.x = Math.PI / 2;
      clawC.position.set(c, -0.36, 0.24);
      leg.add(clawC);
    }
  }
  // tail
  let parent = 'body';
  const tailSizes: [number, number][] = [
    [0.24, 0.34],
    [0.17, 0.3],
    [0.1, 0.26],
  ];
  tailSizes.forEach(([r, len], i) => {
    const seg = rig.add(`tail${i + 1}`, new THREE.Group(), parent);
    seg.position.set(0, i === 0 ? -0.18 : 0, i === 0 ? -0.3 : -len + 0.04);
    const m = box(r * 2, r * 1.6, len, colour, r * 0.7);
    m.position.z = -len / 2;
    seg.add(m);
    parent = `tail${i + 1}`;
  });

  rig.bake();
  return rig;
}

// ============================================================== HUMANOIDS
export interface HumanoidSpec {
  id: string;
  skin: string;
  outfit: string;
  accent: string;
  hair?: string;
  scale?: number;
  bulk?: number; // 1 = normal, marcus/bruno bigger
}

export function buildHumanoid(spec: HumanoidSpec): Rig {
  const rig = new Rig('biped');
  const bulk = spec.bulk ?? 1;
  const body = rig.add('body', new THREE.Group());
  body.position.y = 0.86;
  const torso = box(0.52 * bulk, 0.6, 0.34 * bulk, spec.outfit, 0.1);
  torso.position.y = 0.05;
  body.add(torso);
  const hips = box(0.44 * bulk, 0.2, 0.3 * bulk, spec.accent, 0.06);
  hips.position.y = -0.32;
  body.add(hips);

  const head = rig.add('head', new THREE.Group(), 'body');
  head.position.y = 0.52;
  const skull = box(0.4, 0.42, 0.4, spec.skin, 0.14);
  skull.position.y = 0.14;
  head.add(skull);
  if (spec.hair) {
    const hair = box(0.43, 0.16, 0.43, spec.hair, 0.07);
    hair.position.y = 0.33;
    head.add(hair);
  }
  rig.addEye('head', 0.11, 0.16, 0.205, 0.13);
  rig.addEye('head', -0.11, 0.16, 0.205, 0.13);

  for (const side of [-1, 1] as const) {
    const arm = rig.add(side < 0 ? 'armL' : 'armR', new THREE.Group(), 'body');
    arm.position.set(side * (0.31 * bulk), 0.28, 0);
    const upper = box(0.14 * bulk, 0.3, 0.14 * bulk, spec.outfit, 0.05);
    upper.position.y = -0.12;
    arm.add(upper);
    const lower = box(0.12 * bulk, 0.28, 0.12 * bulk, spec.skin, 0.05);
    lower.position.y = -0.4;
    arm.add(lower);
    const hand = rig.add(side < 0 ? 'handL' : 'handR', new THREE.Group(), side < 0 ? 'armL' : 'armR');
    hand.position.set(0, -0.56, 0);
    const fist = sphere(0.08 * bulk, spec.skin);
    hand.add(fist);
  }
  for (const side of [-1, 1] as const) {
    const leg = rig.add(side < 0 ? 'legL' : 'legR', new THREE.Group(), 'body');
    leg.position.set(side * 0.15 * bulk, -0.42, 0);
    const thigh = box(0.17 * bulk, 0.26, 0.19 * bulk, spec.accent, 0.06);
    thigh.position.y = -0.1;
    leg.add(thigh);
    const shin = box(0.14 * bulk, 0.24, 0.15 * bulk, spec.outfit, 0.05);
    shin.position.y = -0.32;
    leg.add(shin);
    const foot = box(0.16 * bulk, 0.09, 0.26 * bulk, '#3a3348', 0.04);
    foot.position.set(0, -0.46, 0.05);
    leg.add(foot);
  }
  if (spec.scale) rig.root.scale.setScalar(spec.scale);
  rig.bake();
  return rig;
}

// Weapon / accessory props ------------------------------------------------
export function propSword(colour = '#d8dce8', grip = '#7a4a2c'): THREE.Group {
  const g = new THREE.Group();
  const blade = box(0.07, 0.7, 0.16, colour, 0.03);
  blade.position.y = 0.45;
  g.add(blade);
  const tip = cone(0.075, 0.14, colour, 4);
  tip.position.y = 0.86;
  g.add(tip);
  const guard = box(0.24, 0.05, 0.2, '#c9a24a', 0.02);
  guard.position.y = 0.1;
  g.add(guard);
  const handle = cyl(0.035, 0.035, 0.18, grip, 8);
  g.add(handle);
  return g;
}
export function propShield(colour: string, emblem: string): THREE.Group {
  const g = new THREE.Group();
  const board = cyl(0.34, 0.34, 0.07, colour, 18);
  board.rotation.x = Math.PI / 2;
  g.add(board);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 20), toonMat('#c9a24a'));
  g.add(rim);
  const boss = sphere(0.09, emblem);
  boss.position.z = 0.06;
  g.add(boss);
  return g;
}
export function propLance(colour = '#B8863B'): THREE.Group {
  const g = new THREE.Group();
  const shaft = cyl(0.035, 0.035, 1.5, '#6e5a3a', 8);
  shaft.position.y = 0.45;
  g.add(shaft);
  const headGrp = new THREE.Group();
  headGrp.position.y = 1.25;
  const spanner = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 14, Math.PI * 1.4), toonMat(colour));
  spanner.rotation.z = Math.PI / 4;
  headGrp.add(spanner);
  const tipBox = box(0.1, 0.24, 0.1, colour, 0.03);
  tipBox.position.y = -0.1;
  headGrp.add(tipBox);
  g.add(headGrp);
  return g;
}
export function propWrench(colour = '#9aa3b8'): THREE.Group {
  const g = new THREE.Group();
  const shaft = cyl(0.04, 0.05, 0.5, colour, 8);
  shaft.position.y = 0.2;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 8, 12, Math.PI * 1.5), toonMat(colour));
  head.position.y = 0.5;
  head.rotation.z = Math.PI * 0.75;
  g.add(head);
  return g;
}
export function propGearBackpack(colour = '#B8863B', accent = '#4E9B8F'): THREE.Group {
  const g = new THREE.Group();
  const pack = box(0.34, 0.4, 0.18, '#6e5a3a', 0.05);
  g.add(pack);
  const gear = makeGearMesh(0.22, 8, 0.06, colour);
  gear.position.set(0, 0.1, -0.12);
  gear.rotation.x = Math.PI / 2;
  g.add(gear);
  const gear2 = makeGearMesh(0.13, 6, 0.05, accent);
  gear2.position.set(0.18, -0.08, -0.12);
  gear2.rotation.x = Math.PI / 2;
  g.add(gear2);
  return g;
}

/** Chunky toon gear used by props, W2 platforms and decorations. */
export function makeGearMesh(radius: number, teeth: number, thickness: number, colour: string): THREE.Mesh {
  const shape = new THREE.Shape();
  const inner = radius * 0.78;
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const seg = i % 4;
    const r = seg === 0 || seg === 3 ? inner : radius;
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.22, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.center();
  const mesh = new THREE.Mesh(geo, toonMat(colour));
  mesh.castShadow = true;
  return mesh;
}

// ================================================================= DIGGER
export function buildDigger(colour = '#5a7d9e', accent = '#c9d6e8'): Rig {
  const rig = new Rig('quad');
  const body = rig.add('body', new THREE.Group());
  body.position.y = 0.42;
  const torso = box(0.36, 0.34, 0.72, colour, 0.12);
  body.add(torso);
  const chest = box(0.3, 0.24, 0.2, accent, 0.08);
  chest.position.set(0, -0.04, 0.34);
  body.add(chest);
  // speckles
  for (let i = 0; i < 6; i++) {
    const sp = sphere(0.035, accent);
    sp.position.set((Math.random() - 0.5) * 0.3, 0.1 + Math.random() * 0.08, (Math.random() - 0.5) * 0.6);
    body.add(sp);
  }
  const head = rig.add('head', new THREE.Group(), 'body');
  head.position.set(0, 0.22, 0.4);
  const skull = box(0.34, 0.3, 0.34, colour, 0.1);
  head.add(skull);
  const snout = box(0.18, 0.16, 0.22, accent, 0.06);
  snout.position.set(0, -0.05, 0.24);
  head.add(snout);
  const nose = sphere(0.05, '#2a2440');
  nose.position.set(0, 0, 0.36);
  head.add(nose);
  // one tan eyebrow patch — classic heeler
  const patch = box(0.12, 0.1, 0.05, '#c99a5b', 0.02);
  patch.position.set(0.11, 0.14, 0.15);
  head.add(patch);
  for (const side of [-1, 1] as const) {
    const ear = cone(0.09, 0.18, colour, 4);
    ear.position.set(side * 0.13, 0.24, 0);
    ear.rotation.z = side * -0.2;
    head.add(ear);
  }
  rig.addEye('head', 0.1, 0.05, 0.18, 0.11);
  rig.addEye('head', -0.1, 0.05, 0.18, 0.11);
  const tail = rig.add('tail', new THREE.Group(), 'body');
  tail.position.set(0, 0.08, -0.36);
  const tailM = box(0.1, 0.1, 0.3, accent, 0.04);
  tailM.position.z = -0.14;
  tailM.rotation.x = -0.5;
  tail.add(tailM);
  const legPos: [string, number, number][] = [
    ['legFL', -0.13, 0.24],
    ['legFR', 0.13, 0.24],
    ['legBL', -0.13, -0.26],
    ['legBR', 0.13, -0.26],
  ];
  for (const [name, x, z] of legPos) {
    const leg = rig.add(name, new THREE.Group(), 'body');
    leg.position.set(x, -0.16, z);
    const upper = box(0.11, 0.22, 0.13, colour, 0.04);
    upper.position.y = -0.08;
    leg.add(upper);
    const paw = box(0.11, 0.08, 0.14, '#c99a5b', 0.03);
    paw.position.set(0, -0.22, 0.02);
    leg.add(paw);
  }
  rig.bake();
  return rig;
}

// ================================================================ COGLING
export function buildCogling(variant: 'scout' | 'brute' | 'tinkerer', colour: string, accent: string): Rig {
  const rig = new Rig('bot');
  const body = rig.add('body', new THREE.Group());
  const bulk = variant === 'brute' ? 1.5 : 1;
  body.position.y = 0.5 * bulk;
  const shell = sphere(0.32 * bulk, colour);
  shell.scale.y = 0.92;
  body.add(shell);
  const belt = cyl(0.33 * bulk, 0.33 * bulk, 0.08, accent, 16);
  body.add(belt);
  const head = rig.add('head', new THREE.Group(), 'body');
  head.position.y = 0.34 * bulk;
  const dome = sphere(0.17 * bulk, accent);
  dome.scale.y = 0.7;
  head.add(dome);
  rig.addEye('head', 0, 0.05, 0.15 * bulk, 0.16 * bulk);
  const antenna = cyl(0.015, 0.015, 0.18, '#3a3348', 6);
  antenna.position.y = 0.16 * bulk;
  head.add(antenna);
  const bulb = sphere(0.04, '#ffd75e');
  bulb.position.y = 0.26 * bulk;
  head.add(bulb);
  for (const side of [-1, 1] as const) {
    const arm = rig.add(side < 0 ? 'armL' : 'armR', new THREE.Group(), 'body');
    arm.position.set(side * 0.3 * bulk, 0.05, 0);
    const seg = box(0.08 * bulk, variant === 'brute' ? 0.34 : 0.2, 0.08 * bulk, accent, 0.03);
    seg.position.y = -0.1;
    arm.add(seg);
    const fist = sphere((variant === 'brute' ? 0.12 : 0.07) * bulk, '#3a3348');
    fist.position.y = variant === 'brute' ? -0.32 : -0.2;
    arm.add(fist);
  }
  for (const side of [-1, 1] as const) {
    const leg = rig.add(side < 0 ? 'legL' : 'legR', new THREE.Group(), 'body');
    leg.position.set(side * 0.14 * bulk, -0.28 * bulk, 0);
    const foot = box(0.12 * bulk, 0.14, 0.18 * bulk, '#3a3348', 0.04);
    foot.position.y = -0.1;
    leg.add(foot);
  }
  if (variant === 'tinkerer') {
    const pack = box(0.24, 0.3, 0.14, '#6e5a3a', 0.04);
    pack.position.set(0, 0.05, -0.32);
    body.add(pack);
    const wrench = propWrench();
    wrench.scale.setScalar(0.7);
    wrench.position.set(0.05, 0.2, -0.36);
    wrench.rotation.z = 0.6;
    body.add(wrench);
  }
  if (variant === 'scout') {
    const satchel = box(0.16, 0.12, 0.08, '#6e5a3a', 0.03);
    satchel.position.set(0.2, -0.1, 0.2);
    body.add(satchel);
  }
  rig.bake();
  return rig;
}

// ============================================================ NAMED CAST
export function buildKenji(): Rig {
  const rig = buildHumanoid({ id: 'kenji', skin: '#e8b88a', outfit: '#E8842A', accent: '#4a5568', hair: '#2a2440' });
  // hard hat
  const hat = cyl(0.24, 0.26, 0.12, '#ffd75e', 14);
  hat.position.y = 0.36;
  rig.b('head')?.add(hat);
  const brim = cyl(0.32, 0.32, 0.03, '#ffd75e', 14);
  brim.position.y = 0.3;
  rig.b('head')?.add(brim);
  // tool belt
  const belt = cyl(0.3, 0.3, 0.1, '#7a4a2c', 12);
  belt.position.y = -0.24;
  rig.b('body')?.add(belt);
  for (const a of [0.5, 1.1, 2.0]) {
    const tool = box(0.05, 0.14, 0.05, '#9aa3b8', 0.02);
    tool.position.set(Math.cos(a) * 0.28, -0.28, Math.sin(a) * 0.28);
    rig.b('body')?.add(tool);
  }
  // Botto the drone — hovers beside him
  const botto = new THREE.Group();
  const bottoBody = box(0.2, 0.16, 0.2, '#ffd75e', 0.05);
  botto.add(bottoBody);
  const bottoEye = sphere(0.05, '#2a2440');
  bottoEye.position.set(0, 0.02, 0.11);
  botto.add(bottoEye);
  const rotor = box(0.26, 0.02, 0.05, '#9aa3b8', 0.01);
  rotor.position.y = 0.12;
  botto.add(rotor);
  botto.position.set(0.55, 1.7, 0.1);
  rig.add('botto', botto);
  rig.extra = (r, dt, ctx, t) => {
    const b = r.b('botto');
    if (b) {
      b.position.y = 1.7 + Math.sin(t * 2.4) * 0.08;
      b.rotation.y = t * 0.7;
      const rot = b.children[2];
      if (rot) rot.rotation.y = t * 30;
    }
  };
  rig.bake();
  return rig;
}

export function buildMarcus(): Rig {
  const rig = buildHumanoid({ id: 'marcus', skin: '#b07445', outfit: '#C43D3D', accent: '#c9a24a', bulk: 1.35 });
  // crested helmet
  const helm = cyl(0.25, 0.27, 0.2, '#c9a24a', 14);
  helm.position.y = 0.34;
  rig.b('head')?.add(helm);
  const crest = box(0.06, 0.16, 0.4, '#C43D3D', 0.03);
  crest.position.y = 0.48;
  rig.b('head')?.add(crest);
  // pauldron + skirt
  const pauldron = sphere(0.16, '#c9a24a');
  pauldron.position.set(0.42, 0.42, 0);
  rig.b('body')?.add(pauldron);
  for (let i = 0; i < 6; i++) {
    const strap = box(0.1, 0.18, 0.04, '#8a6a4c', 0.02);
    const a = (i / 6) * Math.PI * 2;
    strap.position.set(Math.cos(a) * 0.26, -0.46, Math.sin(a) * 0.22);
    rig.b('body')?.add(strap);
  }
  const sword = propSword();
  sword.scale.setScalar(0.8);
  sword.rotation.x = Math.PI / 2.3;
  rig.b('handR')?.add(sword);
  const shield = propShield('#C43D3D', '#c9a24a');
  shield.scale.setScalar(0.8);
  shield.position.set(-0.1, 0, 0.05);
  rig.b('handL')?.add(shield);
  rig.bake();
  return rig;
}

export function buildVex(): Rig {
  const rig = buildHumanoid({ id: 'vex', skin: '#d8b6a4', outfit: '#4a3f66', accent: '#7B5CD6', hair: '#efe6d8' });
  // clockwork coat: cone skirt
  const coat = cone(0.5, 0.8, '#4a3f66', 12);
  coat.position.y = -0.5;
  rig.b('body')?.add(coat);
  const collar = cyl(0.3, 0.2, 0.14, '#7B5CD6', 10);
  collar.position.y = 0.42;
  rig.b('body')?.add(collar);
  // gear monocle
  const monocle = makeGearMesh(0.09, 6, 0.03, '#c9a24a');
  monocle.position.set(0.12, 0.16, 0.22);
  rig.b('head')?.add(monocle);
  // floating cog halo
  const halo = makeGearMesh(0.16, 8, 0.04, '#7B5CD6');
  halo.position.y = 0.62;
  halo.rotation.x = Math.PI / 2;
  rig.b('head')?.add(halo);
  rig.extra = (r, dt, ctx, t) => {
    const h = r.b('head')?.children.find((c) => c.position.y > 0.6);
    if (h) h.rotation.z = t * 0.8;
  };
  rig.bake();
  return rig;
}

export function buildChampion(id: string, colour: string, accent: string, scale = 1): Rig {
  switch (id) {
    case 'bruno': {
      const rig = buildHumanoid({ id, skin: '#c98a5b', outfit: colour, accent, bulk: 1.6 });
      const helm = box(0.5, 0.2, 0.5, '#ffd75e', 0.06);
      helm.position.y = 0.38;
      rig.b('head')?.add(helm);
      const sword = propSword('#c9ccd8');
      sword.scale.setScalar(1.15);
      sword.rotation.x = Math.PI / 2.5;
      rig.b('handR')?.add(sword);
      const shield = propShield(colour, accent);
      shield.scale.setScalar(1.3);
      shield.position.set(-0.12, 0, 0.06);
      rig.b('handL')?.add(shield);
      rig.root.scale.setScalar(scale);
      rig.bake();
      return rig;
    }
    case 'cogwheel': {
      const rig = buildHumanoid({ id, skin: '#e8c9a4', outfit: colour, accent, hair: '#b8b2c9' });
      const skirt = cone(0.46, 0.7, colour, 10);
      skirt.position.y = -0.55;
      rig.b('body')?.add(skirt);
      const goggles = cyl(0.09, 0.09, 0.06, accent, 10);
      goggles.rotation.x = Math.PI / 2;
      goggles.position.set(0, 0.34, 0.16);
      rig.b('head')?.add(goggles);
      const pack = propGearBackpack(accent, '#4E9B8F');
      pack.position.set(0, 0.15, -0.26);
      rig.b('body')?.add(pack);
      const lance = propLance(accent);
      lance.rotation.x = Math.PI / 2.6;
      rig.b('handR')?.add(lance);
      rig.root.scale.setScalar(scale);
      rig.extra = (r, dt, ctx, t) => {
        const p = r.b('body')?.children.find((c) => c.position.z < -0.2);
        if (p && p.children[1]) p.children[1].rotation.z = t * 1.4;
        if (p && p.children[2]) p.children[2].rotation.z = -t * 2.2;
      };
      rig.bake();
      return rig;
    }
    case 'quarry_foreman': {
      const rig = buildCogling('brute', colour, accent);
      const helm = box(0.6, 0.16, 0.6, '#ffd75e', 0.05);
      helm.position.y = 0.44;
      rig.b('head')?.add(helm);
      const pick = propWrench('#8a6a4c');
      pick.rotation.z = 1.2;
      pick.position.set(0.1, -0.3, 0);
      rig.b('armR')?.add(pick);
      rig.root.scale.setScalar(scale);
      rig.bake();
      return rig;
    }
    case 'tinkerer_prime': {
      const rig = buildCogling('tinkerer', colour, accent);
      const hat = cone(0.16, 0.24, accent, 8);
      hat.position.y = 0.2;
      rig.b('head')?.add(hat);
      const gear = makeGearMesh(0.14, 6, 0.05, '#B8863B');
      gear.position.set(0, 0.55, -0.3);
      gear.rotation.x = Math.PI / 2;
      rig.b('body')?.add(gear);
      rig.root.scale.setScalar(scale * 1.25);
      rig.bake();
      return rig;
    }
    default: {
      const rig = buildHumanoid({ id, skin: '#d8b6a4', outfit: colour, accent });
      rig.root.scale.setScalar(scale);
      return rig;
    }
  }
}

export function buildCharacter(id: string, colour: string, accent: string): Rig {
  switch (id) {
    case 'max':
      return buildMax(colour, accent);
    case 'kenji':
      return buildKenji();
    case 'marcus':
      return buildMarcus();
    case 'digger':
      return buildDigger(colour, accent);
    case 'vex':
      return buildVex();
    default:
      return buildChampion(id, colour, accent);
  }
}
