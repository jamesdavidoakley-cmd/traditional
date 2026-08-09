/**
 * Max's kinematic controller (§4.1): analog run, double jump with coyote
 * time + jump buffering + variable height, tail spin, stomp, chomp, roar.
 * Headless-testable: takes a PlayerInputFrame, talks to PhysicsWorld only.
 */
import * as THREE from 'three';
import type { PhysicsWorld, DynamicCollider } from '../engine/physics';
import { clamp, dampAngle } from '../engine/math';
import type { GameConfig } from './content-types';

export interface PlayerInputFrame {
  moveX: number; // world-space desired direction, |v| ≤ 1
  moveZ: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  spinPressed: boolean;
  stompPressed: boolean;
  chompPressed: boolean;
  roarPressed: boolean;
}

export const NULL_INPUT: PlayerInputFrame = {
  moveX: 0,
  moveZ: 0,
  jumpPressed: false,
  jumpHeld: false,
  spinPressed: false,
  stompPressed: false,
  chompPressed: false,
  roarPressed: false,
};

export interface PlayerHooks {
  onJump?(kind: 'ground' | 'double'): void;
  onLand?(impact: number): void;
  onStep?(): void;
  onSpinStart?(): void;
  onStompSlam?(): void;
  onStompLand?(pos: THREE.Vector3): void;
  onChomp?(): void;
  onRoar?(): void;
  onBounce?(): void;
}

export type PlayerAction = 'none' | 'spin' | 'stompHop' | 'stompSlam' | 'chomp' | 'roar' | 'dizzy';

export class PlayerController {
  readonly body = {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    radius: 0.42,
    height: 1.3,
  };
  yaw = 0;
  grounded = false;
  action: PlayerAction = 'none';
  /** 0 on ground, 1 after first jump, 2 after double jump. */
  jumpsUsed = 0;
  squash = 1; // <1 squashed, >1 stretched
  carrying: string | null = null; // carried prop id (managed by Level)
  standingPlatform: DynamicCollider | null = null;
  /** Spin hitbox live this frame. */
  spinActive = false;
  controlEnabled = true;

  private coyote = 0;
  private buffer = 0;
  private spinT = 0;
  private spinCooldownT = 0;
  private stompT = 0;
  private roarT = 0;
  private stepT = 0;
  private squashVel = 0;
  private wasGrounded = false;
  private fallPeakSpeed = 0;
  private riderMat = new THREE.Matrix4();
  hooks: PlayerHooks = {};

  constructor(
    private cfg: GameConfig['movement'],
    private physics: PhysicsWorld,
  ) {}

  get position(): THREE.Vector3 {
    return this.body.position;
  }
  get velocity(): THREE.Vector3 {
    return this.body.velocity;
  }

  teleport(pos: THREE.Vector3 | [number, number, number], yaw = this.yaw): void {
    const p = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos;
    this.body.position.copy(p);
    this.body.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.standingPlatform = null;
    this.action = 'none';
    this.fallPeakSpeed = 0;
  }

  /** Launch upward (bounce pads, geysers). */
  launch(vy: number): void {
    this.body.velocity.y = vy;
    this.grounded = false;
    this.jumpsUsed = 1; // keep the double jump after a bounce
    this.squash = 1.35;
    this.hooks.onBounce?.();
  }

  update(dt: number, input: PlayerInputFrame): void {
    const cfg = this.cfg;
    if (!this.controlEnabled) input = NULL_INPUT;
    const vel = this.body.velocity;

    // ---- ride platform motion from last frame
    if (this.standingPlatform) {
      const d = this.standingPlatform.riderDelta(this.riderMat);
      this.body.position.applyMatrix4(d);
      // rotate facing with the platform's yaw delta
      const e = new THREE.Euler().setFromRotationMatrix(d);
      this.yaw += e.y;
      const sv = this.standingPlatform.surfaceVelocity;
      if (sv.lengthSq() > 0) this.body.position.addScaledVector(sv, dt);
    }

    // ---- timers
    this.coyote = Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);
    this.spinCooldownT = Math.max(0, this.spinCooldownT - dt);
    if (input.jumpPressed) this.buffer = cfg.jumpBuffer;

    // ---- actions
    if (this.action === 'spin') {
      this.spinT -= dt;
      this.spinActive = this.spinT > cfg.spinDuration * 0.15;
      if (this.spinT <= 0) {
        this.action = 'none';
        this.spinActive = false;
        this.spinCooldownT = this.cfg.spinCooldown;
      }
    } else {
      this.spinActive = false;
    }
    if (this.action === 'stompHop') {
      this.stompT -= dt;
      if (this.stompT <= 0) {
        this.action = 'stompSlam';
        this.hooks.onStompSlam?.();
      }
    }
    if (this.action === 'roar') {
      this.roarT -= dt;
      if (this.roarT <= 0) this.action = 'none';
    }
    if (this.action === 'chomp') {
      this.stompT -= dt;
      if (this.stompT <= 0) this.action = 'none';
    }

    const busy = this.action === 'stompSlam' || this.action === 'stompHop' || this.action === 'roar' || this.action === 'dizzy';

    // ---- start actions (roar outranks spin — both share the attack button)
    if (!busy && input.roarPressed && this.grounded && this.action === 'none') {
      this.action = 'roar';
      this.roarT = 0.9;
      this.hooks.onRoar?.();
    }
    if (!busy && input.spinPressed && !input.roarPressed && this.spinCooldownT <= 0 && this.action !== 'spin' && this.action !== 'roar') {
      this.action = 'spin';
      this.spinT = cfg.spinDuration;
      this.hooks.onSpinStart?.();
    }
    if (!busy && input.stompPressed && !this.grounded && this.action !== 'spin') {
      this.action = 'stompHop';
      this.stompT = cfg.stompHopTime;
      vel.set(0, 3.2, 0);
    }
    if (!busy && input.chompPressed && this.action === 'none') {
      this.action = 'chomp';
      this.stompT = 0.22;
      this.hooks.onChomp?.();
    }

    // ---- horizontal movement
    const inSlam = this.action === 'stompSlam';
    const inHop = this.action === 'stompHop';
    if (!inSlam && !inHop && this.action !== 'dizzy') {
      const targetX = input.moveX * cfg.runSpeed;
      const targetZ = input.moveZ * cfg.runSpeed;
      const accel = (cfg.runSpeed / cfg.accelTime) * (this.grounded ? 1 : cfg.airControl);
      const decel = (cfg.runSpeed / cfg.decelTime) * (this.grounded ? 1 : cfg.airControl * 0.8);
      const moving = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.01;
      const rate = moving ? accel : decel;
      vel.x = approach(vel.x, targetX, rate * dt);
      vel.z = approach(vel.z, targetZ, rate * dt);
      if (moving) {
        const targetYaw = Math.atan2(input.moveX, input.moveZ);
        this.yaw = dampAngle(this.yaw, targetYaw, cfg.turnRate, dt);
      }
    } else if (inSlam) {
      vel.x = 0;
      vel.z = 0;
    }

    // ---- jumping
    if (this.buffer > 0 && this.action !== 'stompSlam' && this.action !== 'dizzy') {
      if (this.grounded || this.coyote > 0) {
        vel.y = cfg.jumpVelocity;
        this.grounded = false;
        this.coyote = 0;
        this.buffer = 0;
        this.jumpsUsed = 1;
        this.squash = 1.28;
        this.standingPlatform = null;
        if (this.action === 'stompHop') this.action = 'none';
        this.hooks.onJump?.('ground');
      } else if (this.jumpsUsed <= 1) {
        // airborne without a grounded jump left (incl. walking off a ledge
        // past coyote time) — spend the air jump. Kid-fair: always one rescue.
        vel.y = cfg.doubleJumpVelocity;
        this.buffer = 0;
        this.jumpsUsed = 2;
        this.squash = 1.3;
        this.hooks.onJump?.('double');
      }
    }

    // ---- gravity
    if (inSlam) {
      vel.y = -cfg.stompSlamSpeed;
    } else if (!this.grounded || vel.y > 0) {
      let g = cfg.gravity;
      if (vel.y < 0) g *= cfg.fallGravityMul;
      else if (!input.jumpHeld) g *= cfg.lowJumpGravityMul;
      vel.y = Math.max(-cfg.maxFallSpeed, vel.y + g * dt);
    }
    if (!this.grounded && vel.y < 0) this.fallPeakSpeed = Math.max(this.fallPeakSpeed, -vel.y);

    // ---- integrate + resolve
    this.body.position.addScaledVector(vel, dt);
    const res = this.physics.resolveCapsule(this.body);
    this.wasGrounded = this.grounded;
    this.grounded = res.grounded;
    this.standingPlatform = res.platform;
    if (res.hitCeiling && vel.y > 0) vel.y = 0;

    if (this.grounded) {
      if (!this.wasGrounded) {
        // landing
        const impact = clamp(this.fallPeakSpeed / cfg.maxFallSpeed, 0, 1);
        this.squash = 1 - 0.35 * impact - 0.05;
        if (this.action === 'stompSlam') {
          this.action = 'none';
          this.hooks.onStompLand?.(this.body.position.clone());
          this.squash = 0.55;
        } else {
          this.hooks.onLand?.(impact);
        }
        this.fallPeakSpeed = 0;
      }
      if (vel.y < 0) vel.y = -0.5; // stick to slopes
      this.jumpsUsed = 0;
      this.coyote = cfg.coyoteTime;
    } else if (this.wasGrounded && vel.y <= 0) {
      // walked off a ledge — coyote window already charged
    }

    // ---- footsteps
    const hSpeed = Math.hypot(vel.x, vel.z);
    if (this.grounded && hSpeed > 2) {
      this.stepT -= dt * (hSpeed / cfg.runSpeed);
      if (this.stepT <= 0) {
        this.stepT = 0.32;
        this.hooks.onStep?.();
      }
    }

    // ---- squash spring back to 1
    const spring = 14;
    this.squashVel += (1 - this.squash) * spring * dt;
    this.squashVel *= Math.exp(-8 * dt);
    this.squash += this.squashVel;

    // spin visual flag handled by Game via action
  }

  /** Normalised speed for animation (0..1). */
  get speed01(): number {
    return clamp(Math.hypot(this.body.velocity.x, this.body.velocity.z) / this.cfg.runSpeed, 0, 1);
  }
}

function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return Math.min(target, v + maxDelta);
  return Math.max(target, v - maxDelta);
}
