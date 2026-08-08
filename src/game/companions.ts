/**
 * Companion party (§3): Kenji, Marcus and Digger follow Max, gesticulate
 * when talking, cheer at victories; Digger drifts toward nearby secrets —
 * his nose IS the hint system.
 */
import * as THREE from 'three';
import { C } from './ctx';
import { buildCharacter, type Rig } from './rigs';
import { damp, dampAngle } from '../engine/math';
import type { Level } from './world/level';
import { audio } from '../engine/audio';

const SLOT_OFFSETS: Record<string, [number, number]> = {
  kenji: [-1.6, -1.9],
  marcus: [1.7, -2.1],
  digger: [0.6, -3.0],
};

class Companion {
  rig: Rig;
  pos = new THREE.Vector3();
  yaw = 0;
  private vel = new THREE.Vector3();
  talking = false;
  cheerT = 0;
  private speed01 = 0;
  private sniffTarget: THREE.Vector3 | null = null;
  private sniffT = 0;
  private retargetT = 0;

  constructor(public id: string) {
    const cd = C().content.characters.heroes.find((c) => c.id === id);
    this.rig = buildCharacter(id, cd?.colour ?? '#888', cd?.accent ?? '#aaa');
    C().renderer.scene.add(this.rig.root);
    C().renderer.addOutline(this.rig.root);
  }

  place(playerPos: THREE.Vector3, playerYaw: number): void {
    const [ox, oz] = SLOT_OFFSETS[this.id] ?? [0, -2];
    const sin = Math.sin(playerYaw);
    const cos = Math.cos(playerYaw);
    this.pos.set(playerPos.x + cos * ox + sin * oz, playerPos.y, playerPos.z - sin * ox + cos * oz);
    this.yaw = playerYaw;
    this.rig.root.position.copy(this.pos);
  }

  update(dt: number, playerPos: THREE.Vector3, playerYaw: number, level: Level | null): void {
    const [ox, oz] = SLOT_OFFSETS[this.id] ?? [0, -2];
    const sin = Math.sin(playerYaw);
    const cos = Math.cos(playerYaw);
    let target = new THREE.Vector3(playerPos.x + cos * ox + sin * oz, playerPos.y, playerPos.z - sin * ox + cos * oz);

    // Digger's nose: drift toward unfound secrets nearby (§3.4)
    if (this.id === 'digger' && level) {
      this.retargetT -= dt;
      if (this.retargetT <= 0) {
        this.retargetT = 4 + Math.random() * 3;
        const secret = level.triggers.find(
          (t) => t.def.kind === 'secretSniff' && !t.fired && this.pos.distanceTo(new THREE.Vector3(...t.def.pos)) < 16,
        );
        this.sniffTarget = secret ? new THREE.Vector3(...secret.def.pos) : null;
        this.sniffT = this.sniffTarget ? 3.2 : 0;
      }
      if (this.sniffTarget && this.sniffT > 0) {
        this.sniffT -= dt;
        target = this.sniffTarget.clone();
        if (this.pos.distanceTo(this.sniffTarget) < 2.2) {
          // sniff on the spot
          if (Math.random() < dt * 1.4) {
            audio.play('sniff');
            C().particles.dust(this.pos);
          }
        }
      }
    }

    const dist = this.pos.distanceTo(target);
    if (dist > 26) {
      // teleport catch-up in a puff
      C().particles.burst(this.pos, { count: 8, colours: ['#ffffff'], speed: 1.5, life: 0.3 });
      this.pos.copy(target);
      this.vel.set(0, 0, 0);
    } else {
      const maxSpeed = 8.2;
      const desired = new THREE.Vector3().subVectors(target, this.pos);
      desired.y = 0;
      const d = desired.length();
      const speed = d > 4 ? maxSpeed : d > 0.4 ? maxSpeed * Math.min(1, (d - 0.3) / 3) : 0;
      if (d > 0.01) desired.normalize().multiplyScalar(speed);
      this.vel.x = damp(this.vel.x, desired.x, 8, dt);
      this.vel.z = damp(this.vel.z, desired.z, 8, dt);
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      // snap to ground
      const probe = new THREE.Vector3(this.pos.x, Math.max(this.pos.y, playerPos.y) + 3, this.pos.z);
      const g = C().physics.groundBelow(probe, 30);
      if (isFinite(g)) {
        const groundY = probe.y - g;
        this.pos.y = damp(this.pos.y, groundY, 12, dt);
      } else {
        this.pos.y = damp(this.pos.y, playerPos.y, 4, dt);
      }
    }

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.speed01 = Math.min(1, hSpeed / 8);
    if (hSpeed > 0.4) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
    } else {
      // face the player when idle
      const toPlayer = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
      this.yaw = dampAngle(this.yaw, toPlayer, 3, dt);
    }
    this.cheerT = Math.max(0, this.cheerT - dt);

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.update(dt, {
      mode: this.cheerT > 0 ? 'cheer' : this.talking ? 'talk' : this.speed01 > 0.05 ? 'run' : 'idle',
      speed: this.speed01,
      talking: this.talking,
      actionT: 0,
    });
    this.rig.setExpression(this.cheerT > 0 ? 'happy' : 'normal');
  }
}

export class CompanionParty {
  companions: Companion[] = [];
  visible = true;

  spawn(playerPos: THREE.Vector3, playerYaw: number): void {
    if (this.companions.length === 0) {
      this.companions = ['kenji', 'marcus', 'digger'].map((id) => new Companion(id));
    }
    for (const c of this.companions) c.place(playerPos, playerYaw);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    for (const c of this.companions) c.rig.root.visible = v;
  }

  setTalking(speakerId: string, talking: boolean): void {
    for (const c of this.companions) {
      if (c.id === speakerId) c.talking = talking;
    }
  }

  cheerAll(secs = 2.4): void {
    for (const c of this.companions) c.cheerT = secs;
  }

  get(id: string): Companion | undefined {
    return this.companions.find((c) => c.id === id);
  }

  update(dt: number, playerPos: THREE.Vector3, playerYaw: number, level: Level | null): void {
    if (!this.visible) return;
    for (const c of this.companions) c.update(dt, playerPos, playerYaw, level);
  }
}
