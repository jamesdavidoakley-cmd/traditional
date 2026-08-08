/**
 * Action-based input: keyboard + gamepad, rebindable.
 * Gameplay code only ever asks about *actions* ("jump pressed?"),
 * never raw keys — bindings live in settings and can be remapped.
 */

export type Action =
  | 'jump'
  | 'attack' // tail spin; hold with full brain power = Mega Roar
  | 'stomp'
  | 'chomp'
  | 'interact'
  | 'pause'
  | 'hint'
  | 'recentre'
  | 'zoom';

export interface Bindings {
  keys: Record<string, Action>; // KeyboardEvent.code → action
  padButtons: Record<number, Action>; // gamepad button index → action
}

export const DEFAULT_BINDINGS: Bindings = {
  keys: {
    Space: 'jump',
    KeyJ: 'attack',
    KeyX: 'attack',
    KeyK: 'stomp',
    KeyB: 'stomp',
    KeyL: 'chomp',
    KeyC: 'chomp',
    KeyE: 'interact',
    Enter: 'interact',
    Escape: 'pause',
    KeyP: 'pause',
    KeyH: 'hint',
    KeyR: 'recentre',
    KeyV: 'zoom',
  },
  padButtons: {
    0: 'jump', // A / cross
    1: 'stomp', // B / circle
    2: 'attack', // X / square
    3: 'chomp', // Y / triangle
    9: 'pause', // start
    5: 'interact', // RB
    4: 'hint', // LB
    11: 'recentre', // R3
    10: 'zoom', // L3
  },
};

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const CAM_KEYS: Record<string, [number, number]> = {
  KeyQ: [-1, 0],
  KeyU: [-1, 0],
  KeyO: [1, 0],
  Comma: [0, -1],
  Period: [0, 1],
};

export class Input {
  bindings: Bindings = structuredClone(DEFAULT_BINDINGS);

  private down = new Set<Action>();
  private pressedSet = new Set<Action>();
  private releasedSet = new Set<Action>();
  private keysDown = new Set<string>();
  private padDown = new Set<number>();
  /** When true (menus open), gameplay reads all-zero input but menus still get key events. */
  uiCaptured = false;
  /** Set by settings: swap hold-to-X for toggle. */
  holdAlternatives = false;

  private moveVec: [number, number] = [0, 0];
  private camVec: [number, number] = [0, 0];
  gamepadConnected = false;
  lastDevice: 'keyboard' | 'gamepad' = 'keyboard';

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keysDown.add(e.code);
      const action = this.bindings.keys[e.code];
      if (action !== undefined && !this.uiCaptured) {
        this.down.add(action);
        this.pressedSet.add(action);
      }
      this.lastDevice = 'keyboard';
      if (!this.uiCaptured && (action !== undefined || MOVE_KEYS[e.code] || CAM_KEYS[e.code] || e.code === 'Space')) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
      const action = this.bindings.keys[e.code];
      if (action !== undefined) {
        this.down.delete(action);
        this.releasedSet.add(action);
      }
    });
    window.addEventListener('blur', () => this.clearAll());
    window.addEventListener('gamepadconnected', () => (this.gamepadConnected = true));
  }

  private clearAll(): void {
    this.down.clear();
    this.keysDown.clear();
    this.padDown.clear();
    this.moveVec = [0, 0];
  }

  /** Call once per frame, before gameplay reads input. */
  update(): void {
    // keyboard move vector
    let mx = 0;
    let my = 0;
    for (const [code, [x, y]] of Object.entries(MOVE_KEYS)) {
      if (this.keysDown.has(code)) {
        mx += x;
        my += y;
      }
    }
    let cx = 0;
    let cy = 0;
    for (const [code, [x, y]] of Object.entries(CAM_KEYS)) {
      if (this.keysDown.has(code)) {
        cx += x;
        cy += y;
      }
    }

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
      const gx = dz(pad.axes[0] ?? 0);
      const gy = dz(pad.axes[1] ?? 0);
      if (gx !== 0 || gy !== 0) {
        mx += gx;
        my += gy;
        this.lastDevice = 'gamepad';
      }
      cx += dz(pad.axes[2] ?? 0);
      cy += dz(pad.axes[3] ?? 0);
      for (const [idxStr, action] of Object.entries(this.bindings.padButtons)) {
        const idx = Number(idxStr);
        const b = pad.buttons[idx];
        const isDown = !!b && (b.pressed || b.value > 0.5);
        const was = this.padDown.has(idx);
        if (isDown && !was) {
          this.padDown.add(idx);
          this.lastDevice = 'gamepad';
          if (!this.uiCaptured) {
            this.down.add(action);
            this.pressedSet.add(action);
          }
        } else if (!isDown && was) {
          this.padDown.delete(idx);
          this.down.delete(action);
          this.releasedSet.add(action);
        }
      }
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.moveVec = this.uiCaptured ? [0, 0] : [mx, my];
    this.camVec = this.uiCaptured ? [0, 0] : [cx, cy];
  }

  /** Call at the END of the frame to clear edge states. */
  lateUpdate(): void {
    this.pressedSet.clear();
    this.releasedSet.clear();
  }

  pressed(a: Action): boolean {
    return this.pressedSet.has(a);
  }
  held(a: Action): boolean {
    return this.down.has(a);
  }
  released(a: Action): boolean {
    return this.releasedSet.has(a);
  }
  /** Movement input, x = right, y = forward (already normalised). */
  move(): { x: number; y: number } {
    return { x: this.moveVec[0], y: -this.moveVec[1] };
  }
  camera(): { x: number; y: number } {
    return { x: this.camVec[0], y: this.camVec[1] };
  }

  rebindKey(code: string, action: Action): void {
    // remove any existing key bound to this action first? No — allow several keys per action.
    this.bindings.keys[code] = action;
  }

  consume(a: Action): void {
    this.pressedSet.delete(a);
  }
}
