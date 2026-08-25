// Particle and decal effects. Deliberately cheap: flat shapes, hard caps, and
// smoke that thins out automatically when a lot is happening at once.

import { TAU, clamp } from '../core/util.js';

const MAX_PARTICLES = 1100;

export class Effects {
  constructor(game) {
    this.game = game;
    this.particles = [];
    this.flashes = [];
    this.texts = [];
    this.shake = 0;
    this.quality = 1;
  }

  get busy() { return this.particles.length / MAX_PARTICLES; }

  _add(p) {
    if (this.particles.length >= MAX_PARTICLES) {
      // Drop the oldest smoke rather than refusing new, more informative effects.
      const i = this.particles.findIndex((q) => q.type === 'smoke');
      if (i >= 0) this.particles.splice(i, 1); else this.particles.shift();
    }
    this.particles.push(p);
    return p;
  }

  _rng() { return this.game ? this.game.rng() : Math.random(); }

  update(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.maxLife) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      p.vz -= (p.gravity || 0) * dt;
      p.vx *= (1 - (p.drag || 0) * dt);
      p.vy *= (1 - (p.drag || 0) * dt);
      if (p.type === 'smoke') { p.size += p.grow * dt; }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life += dt;
      if (f.life >= f.maxLife) this.flashes.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt; t.y -= dt * 0.7;
      if (t.life >= t.maxLife) this.texts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 2.6);
  }

  muzzle(src, tx, ty) {
    const a = Math.atan2(ty - src.y, tx - src.x);
    this.flashes.push({ x: src.x + Math.cos(a) * 0.45, y: src.y + Math.sin(a) * 0.45, a, life: 0, maxLife: 0.09, size: 0.5 });
    for (let i = 0; i < 2; i++) {
      this._add({
        type: 'spark', x: src.x + Math.cos(a) * 0.5, y: src.y + Math.sin(a) * 0.5, z: 0.4,
        vx: Math.cos(a) * 3 + (this._rng() - 0.5), vy: Math.sin(a) * 3 + (this._rng() - 0.5), vz: 0.4,
        life: 0, maxLife: 0.16, size: 0.1, colour: '#ffd88a', gravity: 2, drag: 3,
      });
    }
  }

  impact(x, y, type) {
    const colour = type === 'small' ? '#d8d2c0' : '#ffb066';
    for (let i = 0; i < 4; i++) {
      const a = this._rng() * TAU, s = 1.2 + this._rng() * 2.4;
      this._add({
        type: 'spark', x, y, z: 0.15, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1.6 + this._rng(),
        life: 0, maxLife: 0.3 + this._rng() * 0.2, size: 0.09, colour, gravity: 7, drag: 1.6,
      });
    }
    this._add({
      type: 'dust', x, y, z: 0.1, vx: 0, vy: 0, vz: 0.5, life: 0, maxLife: 0.45,
      size: 0.28, grow: 0.9, colour: 'rgba(190,178,150,0.5)', gravity: 0, drag: 2,
    });
  }

  explosion(x, y, radius, type) {
    const n = Math.round(clamp(radius * 7, 6, 26) * this.quality);
    this.flashes.push({ x, y, a: 0, life: 0, maxLife: 0.16, size: radius * 1.1, big: true });
    for (let i = 0; i < n; i++) {
      const a = this._rng() * TAU, s = (0.7 + this._rng() * 2.2) * radius;
      this._add({
        type: 'ember', x, y, z: 0.2 + this._rng() * 0.4,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1.5 + this._rng() * 4.5,
        life: 0, maxLife: 0.4 + this._rng() * 0.5, size: 0.11 + this._rng() * 0.12,
        colour: this._rng() < 0.45 ? '#ffd257' : '#ff7a2e', gravity: 9, drag: 1.5,
      });
    }
    const smokeN = Math.round(clamp(radius * 3.2, 3, 12) * this.quality);
    for (let i = 0; i < smokeN; i++) {
      const a = this._rng() * TAU, s = this._rng() * radius * 0.7;
      this._add({
        type: 'smoke', x: x + Math.cos(a) * s * 0.4, y: y + Math.sin(a) * s * 0.4, z: 0.3,
        vx: Math.cos(a) * s * 0.35, vy: Math.sin(a) * s * 0.35, vz: 0.8 + this._rng() * 0.8,
        life: 0, maxLife: 1.5 + this._rng() * 1.6, size: radius * 0.42, grow: radius * 0.5,
        colour: 'rgba(58,54,50,0.44)', gravity: -0.15, drag: 1.1,
      });
    }
    this.shake = Math.min(1.2, this.shake + radius * 0.12);
  }

  sparks(x, y, colour) {
    for (let i = 0; i < 5; i++) {
      const a = this._rng() * TAU, s = 1 + this._rng() * 2;
      this._add({
        type: 'spark', x, y, z: 0.35, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1.6,
        life: 0, maxLife: 0.4, size: 0.08, colour: colour || '#ffcc66', gravity: 6, drag: 1.4,
      });
    }
  }

  repairSpark(x, y) {
    if (this._rng() > 0.14) return;
    this._add({
      type: 'spark', x: x + (this._rng() - 0.5) * 0.6, y: y + (this._rng() - 0.5) * 0.6, z: 0.4,
      vx: 0, vy: 0, vz: 1.1, life: 0, maxLife: 0.32, size: 0.09, colour: '#8ff2b0', gravity: 3, drag: 2,
    });
  }

  airburst(x, y, success) {
    this.flashes.push({ x, y, a: 0, life: 0, maxLife: 0.2, size: success ? 1.5 : 0.9, big: true, air: true, z: 5 });
    const n = success ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const a = this._rng() * TAU, s = 1.5 + this._rng() * 3;
      this._add({
        type: 'ember', x, y, z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (this._rng() - 0.5) * 3,
        life: 0, maxLife: 0.5 + this._rng() * 0.4, size: 0.12,
        colour: success ? '#ffe08a' : '#c9c2b4', gravity: 4.5, drag: 1.2,
      });
    }
    if (success) this.text(x, y, 'INTERCEPTED', '#8ff2b0');
  }

  buildingDestroyed(b) {
    const r = b.size * 0.6;
    this.explosion(b.x, b.y, r + 1.2, 'he');
    for (let i = 0; i < 10; i++) {
      const a = this._rng() * TAU, s = this._rng() * r * 1.6;
      this._add({
        type: 'debris', x: b.x, y: b.y, z: 0.4 + this._rng() * 1.2,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 2 + this._rng() * 4,
        life: 0, maxLife: 1.0 + this._rng() * 0.7, size: 0.16 + this._rng() * 0.16,
        colour: '#6c6459', gravity: 11, drag: 0.6,
      });
    }
    this.shake = Math.min(1.6, this.shake + 0.75);
  }

  dust(x, y, amount) {
    if (this._rng() > amount) return;
    this._add({
      type: 'dust', x, y, z: 0.05, vx: (this._rng() - 0.5) * 0.3, vy: (this._rng() - 0.5) * 0.3, vz: 0.25,
      life: 0, maxLife: 0.75, size: 0.18, grow: 0.55, colour: 'rgba(176,164,138,0.32)', gravity: 0, drag: 2.2,
    });
  }

  smokeColumn(x, y) {
    this._add({
      type: 'smoke', x: x + (this._rng() - 0.5) * 0.5, y: y + (this._rng() - 0.5) * 0.5, z: 0.4,
      vx: (this._rng() - 0.5) * 0.2, vy: (this._rng() - 0.5) * 0.2, vz: 0.9,
      life: 0, maxLife: 2.4, size: 0.35, grow: 0.6, colour: 'rgba(48,44,40,0.35)', gravity: -0.1, drag: 0.8,
    });
  }

  text(x, y, str, colour) {
    this.texts.push({ x, y, text: str, colour: colour || '#fff', life: 0, maxLife: 1.5 });
  }
}
