/**
 * Subtitle renderer: speaker portrait + colour-coded name + line (§3.6.6).
 * Subtitles can be resized but never fully disabled (readability floor).
 */
import type { SubtitleView } from './voice';

const PORTRAITS: Record<string, string> = {
  max: '🦖',
  kenji: '🔧',
  marcus: '🛡️',
  digger: '🐕',
  vex: '⚙️',
  bruno: '⛏️',
  cogwheel: '🔩',
  quarry_foreman: '🚧',
  tinkerer_prime: '🛠️',
  bastion: '🏰',
  nightshade: '🌙',
};

export class Subtitles implements SubtitleView {
  private holder: HTMLDivElement;
  private current: HTMLDivElement | null = null;

  constructor(uiRoot: HTMLElement) {
    this.holder = document.createElement('div');
    this.holder.id = 'subtitles';
    uiRoot.appendChild(this.holder);
  }

  setScale(scale: number): void {
    document.documentElement.style.setProperty('--subtitle-scale', String(scale));
  }

  show(speakerId: string, name: string, colour: string, text: string): void {
    this.hide();
    const el = document.createElement('div');
    el.className = 'subtitle';
    const portrait = document.createElement('div');
    portrait.className = 'portrait';
    portrait.textContent = PORTRAITS[speakerId] ?? '💬';
    portrait.style.borderColor = colour;
    portrait.style.background = 'rgba(255,255,255,0.12)';
    const body = document.createElement('div');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = name;
    who.style.color = colour;
    const line = document.createElement('span');
    line.textContent = text;
    body.appendChild(who);
    body.appendChild(line);
    el.appendChild(portrait);
    el.appendChild(body);
    this.holder.appendChild(el);
    this.current = el;
  }

  hide(): void {
    this.current?.remove();
    this.current = null;
  }
}
