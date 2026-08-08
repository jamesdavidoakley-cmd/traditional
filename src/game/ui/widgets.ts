/**
 * DOM UI toolkit: panels, buttons, focus-ring keyboard/gamepad navigation,
 * toasts and banners. Big fonts, high contrast, controller-first (§9.1).
 */
import { audio } from '../../engine/audio';

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function button(label: string, onClick: () => void, cls = 'btn', testid?: string): HTMLButtonElement {
  const b = el('button', cls, label);
  if (testid) b.dataset.testid = testid;
  b.addEventListener('click', () => {
    audio.play('uiSelect');
    onClick();
  });
  return b;
}

/** A screen owns its element and its focusable list; screens stack. */
export class Screen {
  root: HTMLDivElement;
  focusables: HTMLElement[] = [];
  focusIndex = 0;
  onBack: (() => void) | null = null;

  constructor(cls = 'screen dim') {
    this.root = el('div', cls);
  }

  addFocusable(elem: HTMLElement): void {
    this.focusables.push(elem);
  }

  refreshFocus(): void {
    this.focusables = this.focusables.filter((f) => f.isConnected && !(f as HTMLButtonElement).disabled);
    this.focusables.forEach((f, i) => f.classList.toggle('focused', i === this.focusIndex));
  }

  moveFocus(delta: number): void {
    if (this.focusables.length === 0) return;
    audio.play('uiMove');
    this.focusIndex = (this.focusIndex + delta + this.focusables.length) % this.focusables.length;
    this.refreshFocus();
    this.focusables[this.focusIndex]?.scrollIntoView({ block: 'nearest' });
  }

  activate(): void {
    this.focusables[this.focusIndex]?.click();
  }
}

export class UIStack {
  private stack: Screen[] = [];
  constructor(
    private uiRoot: HTMLElement,
    private onCaptureChange: (captured: boolean) => void,
  ) {
    window.addEventListener('keydown', (e) => {
      const top = this.top();
      if (!top) return;
      switch (e.code) {
        case 'ArrowDown':
        case 'KeyS':
          top.moveFocus(1);
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'KeyW':
          top.moveFocus(-1);
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          top.moveFocus(1);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          top.moveFocus(-1);
          e.preventDefault();
          break;
        case 'Enter':
        case 'Space':
          top.activate();
          e.preventDefault();
          break;
        case 'Escape':
          if (top.onBack) {
            audio.play('uiBack');
            top.onBack();
          }
          e.preventDefault();
          break;
      }
    });
  }

  top(): Screen | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  push(screen: Screen): void {
    this.stack.push(screen);
    this.uiRoot.appendChild(screen.root);
    screen.refreshFocus();
    this.onCaptureChange(true);
  }

  pop(): void {
    const s = this.stack.pop();
    s?.root.remove();
    this.onCaptureChange(this.stack.length > 0);
  }

  popAll(): void {
    while (this.stack.length > 0) this.pop();
  }

  replace(screen: Screen): void {
    this.pop();
    this.push(screen);
  }

  get depth(): number {
    return this.stack.length;
  }
}

export class Toaster {
  private holder: HTMLDivElement;
  constructor(uiRoot: HTMLElement) {
    this.holder = el('div');
    this.holder.id = 'toast-holder';
    uiRoot.appendChild(this.holder);
  }
  toast(text: string, lifeMs = 2600): void {
    const t = el('div', 'toast', text);
    t.style.setProperty('--toast-life', `${lifeMs}ms`);
    this.holder.appendChild(t);
    audio.play('splashText');
    setTimeout(() => t.remove(), lifeMs + 600);
  }
  banner(text: string, lifeMs = 2800): void {
    const b = el('div', 'big-banner', text);
    this.holder.parentElement?.appendChild(b);
    setTimeout(() => b.remove(), lifeMs);
  }
}

export function slider(value: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLInputElement {
  const s = el('input') as HTMLInputElement;
  s.type = 'range';
  s.min = String(min);
  s.max = String(max);
  s.step = String(step);
  s.value = String(value);
  s.addEventListener('input', () => onChange(Number(s.value)));
  return s;
}

export function segToggle<T extends string>(
  options: { value: T; label: string }[],
  current: T,
  onChange: (v: T) => void,
): HTMLDivElement {
  const wrap = el('div', 'seg-toggle');
  const btns = new Map<T, HTMLButtonElement>();
  for (const o of options) {
    const b = button(
      o.label,
      () => {
        for (const [v, bb] of btns) bb.classList.toggle('on', v === o.value);
        onChange(o.value);
      },
      'btn',
    );
    b.classList.toggle('on', o.value === current);
    btns.set(o.value, b);
    wrap.appendChild(b);
  }
  return wrap;
}

export function onOff(current: boolean, onChange: (v: boolean) => void, onLabel: string, offLabel: string): HTMLDivElement {
  return segToggle(
    [
      { value: 'on', label: onLabel },
      { value: 'off', label: offLabel },
    ],
    current ? 'on' : 'off',
    (v) => onChange(v === 'on'),
  );
}
