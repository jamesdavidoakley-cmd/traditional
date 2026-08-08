/**
 * Pooled particle system (§2.4): one Points draw call for up to POOL
 * particles, CPU-simulated, plus a small pool of expanding shockwave rings.
 */
import * as THREE from 'three';

const POOL = 2200;

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (240.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.32, d);
  gl_FragColor = vec4(vColor, vAlpha * soft);
}
`;

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  drag: number;
  size: number;
  endSize: number;
}

export interface BurstOpts {
  count: number;
  colours: (string | number)[];
  speed?: number;
  spread?: number; // 0 = up only, 1 = full sphere
  upBias?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  lifeJitter?: number;
  size?: number;
  endSize?: number;
  offsetY?: number;
}

export class Particles {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private parts: Particle[] = [];
  private cursor = 0;
  private geo: THREE.BufferGeometry;
  private rings: { mesh: THREE.Mesh; life: number; maxLife: number; grow: number }[] = [];
  private ringPool: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private colorTmp = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(POOL * 3);
    this.colors = new Float32Array(POOL * 3);
    this.sizes = new Float32Array(POOL);
    this.alphas = new Float32Array(POOL);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    for (let i = 0; i < POOL; i++) {
      this.parts.push({ alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0, size: 1, endSize: 1 });
      this.positions[i * 3 + 1] = -9999;
    }
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(pos: THREE.Vector3, opts: BurstOpts): void {
    const {
      count,
      colours,
      speed = 3,
      spread = 1,
      upBias = 0.5,
      gravity = -9,
      drag = 1.5,
      life = 0.6,
      lifeJitter = 0.3,
      size = 0.16,
      endSize = 0.02,
      offsetY = 0,
    } = opts;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % POOL;
      const p = this.parts[i];
      p.alive = true;
      p.maxLife = life * (1 + (Math.random() - 0.5) * 2 * lifeJitter);
      p.life = p.maxLife;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * spread);
      const s = speed * (0.5 + Math.random() * 0.7);
      p.vx = Math.sin(phi) * Math.cos(theta) * s;
      p.vz = Math.sin(phi) * Math.sin(theta) * s;
      p.vy = Math.cos(phi) * s + upBias * speed * Math.random();
      p.gravity = gravity;
      p.drag = drag;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.endSize = endSize;
      this.positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.2;
      this.positions[i * 3 + 1] = pos.y + offsetY + (Math.random() - 0.5) * 0.2;
      this.positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.2;
      this.colorTmp.set(colours[Math.floor(Math.random() * colours.length)] as THREE.ColorRepresentation);
      this.colors[i * 3] = this.colorTmp.r;
      this.colors[i * 3 + 1] = this.colorTmp.g;
      this.colors[i * 3 + 2] = this.colorTmp.b;
      this.sizes[i] = p.size;
      this.alphas[i] = 1;
    }
  }

  /** Expanding ground ring — stomp/roar shockwaves. */
  ring(pos: THREE.Vector3, colour: string | number, maxRadius: number, life = 0.4): void {
    let mesh = this.ringPool.pop();
    if (!mesh) {
      const g = new THREE.RingGeometry(0.85, 1, 40);
      g.rotateX(-Math.PI / 2);
      mesh = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      );
    }
    (mesh.material as THREE.MeshBasicMaterial).color.set(colour as THREE.ColorRepresentation);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
    mesh.position.copy(pos);
    mesh.position.y += 0.06;
    mesh.scale.setScalar(0.3);
    this.scene.add(mesh);
    this.rings.push({ mesh, life, maxLife: life, grow: maxRadius });
  }

  update(dt: number): void {
    for (let i = 0; i < POOL; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.positions[i * 3 + 1] = -9999;
        this.alphas[i] = 0;
        continue;
      }
      const dragMul = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragMul;
      p.vz *= dragMul;
      p.vy = p.vy * dragMul + p.gravity * dt;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      const t = p.life / p.maxLife;
      this.alphas[i] = Math.min(1, t * 2.5);
      this.sizes[i] = p.endSize + (p.size - p.endSize) * t;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(0.3 + t * r.grow);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        this.ringPool.push(r.mesh);
        this.rings.splice(i, 1);
      }
    }
  }

  // Convenience recipes -------------------------------------------------
  dust(pos: THREE.Vector3): void {
    this.burst(pos, { count: 5, colours: ['#d9b28a', '#c9a37b'], speed: 1.2, spread: 0.6, gravity: -2, life: 0.4, size: 0.12 });
  }
  sparks(pos: THREE.Vector3, colour: string | number = '#ffd75e'): void {
    this.burst(pos, { count: 14, colours: [colour, '#ffffff'], speed: 5, spread: 1, gravity: -12, life: 0.4, size: 0.1 });
  }
  sparkle(pos: THREE.Vector3, colour: string | number = '#ffe98a'): void {
    this.burst(pos, { count: 3, colours: [colour, '#ffffff'], speed: 0.7, spread: 1, gravity: 0.6, drag: 0.4, life: 0.7, size: 0.09 });
  }
  confetti(pos: THREE.Vector3): void {
    this.burst(pos, {
      count: 60,
      colours: ['#ff5e7e', '#ffd75e', '#5ee0ff', '#7dff8a', '#c58aff'],
      speed: 6,
      spread: 1,
      upBias: 1.2,
      gravity: -7,
      drag: 1.2,
      life: 1.3,
      size: 0.16,
    });
  }
  steam(pos: THREE.Vector3): void {
    this.burst(pos, { count: 4, colours: ['#ffffff', '#e8f4f4'], speed: 1.4, spread: 0.3, upBias: 2.2, gravity: 1.6, drag: 0.8, life: 1.0, size: 0.3, endSize: 0.5 });
  }
}
