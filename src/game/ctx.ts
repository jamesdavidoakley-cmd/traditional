/**
 * Shared game context: one place every system reaches for engine services.
 * Populated once at boot by main.ts.
 */
import type { Renderer } from '../engine/renderer';
import type { Input } from '../engine/input';
import type { SaveManager } from '../engine/save';
import type { Particles } from '../engine/particles';
import type { PhysicsWorld } from '../engine/physics';
import type { ContentDB } from './content-types';

export interface Ctx {
  renderer: Renderer;
  input: Input;
  save: SaveManager;
  particles: Particles;
  physics: PhysicsWorld;
  content: ContentDB;
}

let ctx: Ctx | null = null;

export function initCtx(c: Ctx): void {
  ctx = c;
}

export function C(): Ctx {
  if (!ctx) throw new Error('ctx not initialised');
  return ctx;
}
