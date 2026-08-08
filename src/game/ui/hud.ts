/**
 * HUD (§9.1): hearts, fossil + chip counters, Brain Power meter,
 * interact prompt. Diegetic-leaning, chunky, readable.
 */
import { el } from './widgets';
import { S } from '../../engine/loader';

export class Hud {
  root: HTMLDivElement;
  private heartsEl: HTMLDivElement;
  private fossilPill: HTMLDivElement;
  private chipPill: HTMLDivElement;
  private brainEl: HTMLDivElement;
  private prompt: HTMLDivElement;
  private segs: HTMLDivElement[] = [];

  constructor(uiRoot: HTMLElement) {
    this.root = el('div');
    this.root.id = 'hud';
    this.root.classList.add('hidden');

    this.heartsEl = el('div', 'hud-corner');
    this.heartsEl.id = 'hud-hearts';
    const counters = el('div', 'hud-corner');
    counters.id = 'hud-counters';
    this.fossilPill = el('div', 'hud-pill', '⭐ 0');
    this.chipPill = el('div', 'hud-pill', '🟡 0');
    counters.appendChild(this.fossilPill);
    counters.appendChild(this.chipPill);

    this.brainEl = el('div', 'hud-corner');
    this.brainEl.id = 'hud-brain';
    const label = el('div', 'hud-pill', `🧠 ${S('hud.brain')}`);
    label.style.fontSize = '0.95rem';
    this.brainEl.appendChild(label);

    this.prompt = el('div');
    this.prompt.id = 'hud-prompt';
    this.prompt.classList.add('hidden');

    this.root.appendChild(this.heartsEl);
    this.root.appendChild(counters);
    this.root.appendChild(this.brainEl);
    this.root.appendChild(this.prompt);
    uiRoot.appendChild(this.root);
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  setHearts(hp: number, max: number): void {
    let s = '';
    for (let i = 0; i < max; i++) {
      const v = hp - i;
      s += v >= 1 ? '❤️' : v >= 0.5 ? '💔' : '🖤';
    }
    this.heartsEl.textContent = s;
  }

  setFossils(n: number): void {
    this.fossilPill.textContent = `⭐ ${n}`;
  }

  setChips(n: number): void {
    this.chipPill.textContent = `🟡 ${n}`;
  }

  setBrain(segments: number, max: number): void {
    while (this.segs.length < max) {
      const seg = el('div', 'brain-seg');
      this.segs.push(seg);
      this.brainEl.appendChild(seg);
    }
    this.segs.forEach((seg, i) => {
      seg.classList.toggle('full', i < segments);
      seg.classList.toggle('pulse', segments >= max);
    });
  }

  setPrompt(html: string | null): void {
    if (html === null) {
      this.prompt.classList.add('hidden');
    } else {
      this.prompt.innerHTML = html;
      this.prompt.classList.remove('hidden');
    }
  }
}
