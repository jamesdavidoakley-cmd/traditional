/**
 * Orbit-follow camera (§4.1): 3 zoom steps, wall-collision probe, recentre,
 * gentle auto-frame, invert + sensitivity options, soft lock-on for arenas.
 */
import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle } from '../engine/math';
import type { PhysicsWorld } from '../engine/physics';
import type { GameConfig } from './content-types';

export class CameraRig {
  yaw = 0;
  pitch = 0.32;
  zoomIndex = 1;
  sensitivity = 1;
  invertX = false;
  invertY = false;
  lockOnTarget: THREE.Vector3 | null = null;
  private currentDist: number;
  private lookAt = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private dragActive = false;

  constructor(
    private cfg: GameConfig['camera'],
    private camera: THREE.PerspectiveCamera,
    private physics: PhysicsWorld,
  ) {
    this.currentDist = cfg.distances[this.zoomIndex];
    // mouse-drag orbit + wheel zoom for desktop players
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && (e.target as HTMLElement)?.id === 'game-canvas') this.dragActive = true;
    });
    window.addEventListener('mouseup', () => (this.dragActive = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.dragActive) return;
      this.rotate(e.movementX * 0.004, e.movementY * 0.003);
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if ((e.target as HTMLElement)?.id !== 'game-canvas') return;
        if (e.deltaY > 0) this.zoomIndex = Math.min(this.cfg.distances.length - 1, this.zoomIndex + 1);
        else this.zoomIndex = Math.max(0, this.zoomIndex - 1);
      },
      { passive: true },
    );
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity * (this.invertX ? -1 : 1);
    this.pitch = clamp(this.pitch + dy * this.sensitivity * (this.invertY ? -1 : 1), this.cfg.minPitch, this.cfg.maxPitch);
  }

  cycleZoom(): void {
    this.zoomIndex = (this.zoomIndex + 1) % this.cfg.distances.length;
  }

  recentre(behindYaw: number): void {
    this.yaw = behindYaw + Math.PI;
  }

  snapBehind(playerYaw: number, target: THREE.Vector3): void {
    this.yaw = playerYaw + Math.PI;
    this.update(1, target, playerYaw, { x: 0, y: 0 }, true);
  }

  update(
    dt: number,
    target: THREE.Vector3,
    playerYaw: number,
    stick: { x: number; y: number },
    snap = false,
  ): void {
    const cfg = this.cfg;
    if (Math.abs(stick.x) > 0.01 || Math.abs(stick.y) > 0.01) {
      this.rotate(stick.x * cfg.rotateSpeed * dt, stick.y * cfg.rotateSpeed * 0.7 * dt);
    }
    // soft lock-on: ease yaw toward facing the lock target (§4.1 boss arenas)
    if (this.lockOnTarget) {
      const toT = Math.atan2(this.lockOnTarget.x - target.x, this.lockOnTarget.z - target.z);
      this.yaw = dampAngle(this.yaw, toT + Math.PI, 1.6, dt);
      this.pitch = damp(this.pitch, 0.3, 2, dt);
    }
    this.yaw = wrapAngle(this.yaw);

    const wantDist = cfg.distances[this.zoomIndex];
    const focus = this.desired.set(target.x, target.y + cfg.height, target.z);

    // camera position on the orbit sphere
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);

    // wall probe — never clip level geometry (§4.1)
    let dist = wantDist;
    const hit = this.physics.raycast(focus, dir, wantDist + cfg.collisionRadius);
    if (hit) dist = Math.max(0.7, hit.distance - cfg.collisionRadius);
    this.currentDist = snap ? dist : damp(this.currentDist, dist, dist < this.currentDist ? 20 : 3.5, dt);

    const pos = focus.clone().addScaledVector(dir, this.currentDist);
    if (snap) {
      this.camera.position.copy(pos);
    } else {
      const r = cfg.followRate;
      this.camera.position.x = damp(this.camera.position.x, pos.x, r, dt);
      this.camera.position.y = damp(this.camera.position.y, pos.y, r * 1.15, dt);
      this.camera.position.z = damp(this.camera.position.z, pos.z, r, dt);
    }
    this.lookAt.lerp(focus, snap ? 1 : 1 - Math.exp(-12 * dt));
    this.camera.lookAt(this.lookAt);
  }
}
