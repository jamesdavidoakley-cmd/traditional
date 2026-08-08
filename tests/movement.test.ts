/**
 * P1 gate: coyote time + jump buffering verified against the real
 * controller + real BVH physics, headless (§10).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/engine/physics';
import { PlayerController, NULL_INPUT, type PlayerInputFrame } from '../src/game/player';
import config from '../content/config.json';

const MOVE = config.movement;
const DT = 1 / 120;

function makeWorld(): PhysicsWorld {
  const physics = new PhysicsWorld();
  // 10×10 platform whose top surface is y=0, with a cliff edge at x=5
  const ground = new THREE.BoxGeometry(10, 2, 10);
  ground.translate(0, -1, 0);
  physics.buildStatic([ground]);
  return physics;
}

function spawn(physics: PhysicsWorld): PlayerController {
  const p = new PlayerController(MOVE, physics);
  p.teleport(new THREE.Vector3(0, 0.05, 0));
  for (let i = 0; i < 30; i++) p.update(DT, NULL_INPUT);
  expect(p.grounded).toBe(true);
  return p;
}

const frame = (o: Partial<PlayerInputFrame>): PlayerInputFrame => ({ ...NULL_INPUT, ...o });

function runUntil(p: PlayerController, cond: () => boolean, input = NULL_INPUT, maxSteps = 1200): number {
  for (let i = 0; i < maxSteps; i++) {
    p.update(DT, input);
    if (cond()) return i * DT;
  }
  return -1;
}

describe('player movement', () => {
  it('grounds on the platform and runs at top speed', () => {
    const p = spawn(makeWorld());
    for (let i = 0; i < 240; i++) p.update(DT, frame({ moveZ: 1 }));
    const hSpeed = Math.hypot(p.velocity.x, p.velocity.z);
    expect(hSpeed).toBeGreaterThan(MOVE.runSpeed * 0.95);
    expect(hSpeed).toBeLessThan(MOVE.runSpeed * 1.05);
  });

  it('coyote time: can still ground-jump shortly after walking off a ledge', () => {
    const p = spawn(makeWorld());
    // run off the +x edge
    const t = runUntil(p, () => !p.grounded, frame({ moveX: 1 }));
    expect(t).toBeGreaterThanOrEqual(0);
    // wait half the coyote window, then press jump
    const wait = Math.floor((MOVE.coyoteTime * 0.5) / DT);
    for (let i = 0; i < wait; i++) p.update(DT, frame({ moveX: 1 }));
    let jumped: 'ground' | 'double' | null = null;
    p.hooks = { onJump: (k) => (jumped = k) };
    p.update(DT, frame({ moveX: 1, jumpPressed: true, jumpHeld: true }));
    expect(jumped).toBe('ground');
    expect(p.velocity.y).toBeGreaterThan(MOVE.jumpVelocity * 0.92); // gravity nibbles the same frame
  });

  it('after coyote time expires, the press spends the air jump instead', () => {
    const p = spawn(makeWorld());
    runUntil(p, () => !p.grounded, frame({ moveX: 1 }));
    const wait = Math.ceil((MOVE.coyoteTime * 2) / DT);
    for (let i = 0; i < wait; i++) p.update(DT, frame({ moveX: 1 }));
    let jumped: 'ground' | 'double' | null = null;
    p.hooks = { onJump: (k) => (jumped = k) };
    p.update(DT, frame({ moveX: 1, jumpPressed: true, jumpHeld: true }));
    expect(jumped).toBe('double');
    expect(p.jumpsUsed).toBe(2);
  });

  it('jump buffer: a press just before landing fires the jump on touchdown', () => {
    const p = spawn(makeWorld());
    // hop, then press jump again while still airborne but close to the ground
    p.update(DT, frame({ jumpPressed: true, jumpHeld: true }));
    expect(p.grounded).toBe(false);
    // use up the double jump so only a buffered ground jump can explain the result
    for (let i = 0; i < 12; i++) p.update(DT, NULL_INPUT);
    p.update(DT, frame({ jumpPressed: true }));
    expect(p.jumpsUsed).toBe(2);
    // fall until close to ground, press jump within the buffer window
    runUntil(p, () => p.position.y < 0.9 && p.velocity.y < 0);
    let jumped: 'ground' | 'double' | null = null;
    p.hooks = { onJump: (k) => (jumped = k) };
    p.update(DT, frame({ jumpPressed: true }));
    expect(p.grounded).toBe(false);
    expect(jumped).toBeNull();
    // land within the buffer window → jump fires
    const t = runUntil(p, () => jumped !== null);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(MOVE.jumpBuffer + 0.05);
    expect(jumped).toBe('ground');
  });

  it('variable jump height: releasing early gives a lower apex', () => {
    const apex = (hold: boolean): number => {
      const p = spawn(makeWorld());
      let top = 0;
      p.update(DT, frame({ jumpPressed: true, jumpHeld: true }));
      for (let i = 0; i < 300; i++) {
        p.update(DT, frame({ jumpHeld: hold }));
        top = Math.max(top, p.position.y);
        if (p.grounded) break;
      }
      return top;
    };
    const full = apex(true);
    const short = apex(false);
    expect(full).toBeGreaterThan(2.0); // ≈2.3m apex per §4.1
    expect(full).toBeLessThan(2.7);
    expect(short).toBeLessThan(full * 0.75);
  });

  it('double jump rises again mid-air and a third press does nothing', () => {
    const p = spawn(makeWorld());
    p.update(DT, frame({ jumpPressed: true, jumpHeld: true }));
    for (let i = 0; i < 30; i++) p.update(DT, NULL_INPUT);
    p.update(DT, frame({ jumpPressed: true }));
    expect(p.jumpsUsed).toBe(2);
    expect(p.velocity.y).toBeGreaterThan(MOVE.doubleJumpVelocity * 0.92);
    for (let i = 0; i < 10; i++) p.update(DT, NULL_INPUT);
    const vyBefore = p.velocity.y;
    p.update(DT, frame({ jumpPressed: true }));
    expect(p.velocity.y).toBeLessThan(vyBefore + 0.1);
  });

  it('stomp slams straight down and lands', () => {
    const p = spawn(makeWorld());
    p.update(DT, frame({ jumpPressed: true, jumpHeld: true }));
    for (let i = 0; i < 25; i++) p.update(DT, NULL_INPUT);
    let stompLanded = false;
    p.hooks = { onStompLand: () => (stompLanded = true) };
    p.update(DT, frame({ stompPressed: true }));
    expect(p.action).toBe('stompHop');
    const t = runUntil(p, () => stompLanded);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(p.grounded).toBe(true);
  });
});
