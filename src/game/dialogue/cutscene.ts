/**
 * Cutscene player: letterboxed, sequential spoken lines with talking rigs,
 * always skippable (§ kid-first).
 */
import { bus } from '../../engine/events';
import { S, getContent } from '../../engine/loader';
import type { DialogueLineDef } from '../content-types';
import type { VoiceDirector } from './voice';

export interface SpeakerRigControl {
  setTalking(speakerId: string, talking: boolean): void;
}

export class CutscenePlayer {
  private top: HTMLDivElement;
  private bottom: HTMLDivElement;
  private skipHint: HTMLDivElement;
  private skipRequested = false;
  playing = false;

  constructor(
    uiRoot: HTMLElement,
    private voice: VoiceDirector,
    private rigs: SpeakerRigControl,
  ) {
    this.top = document.createElement('div');
    this.top.className = 'letterbox top';
    this.bottom = document.createElement('div');
    this.bottom.className = 'letterbox bottom';
    this.skipHint = document.createElement('div');
    this.skipHint.id = 'skip-hint';
    this.skipHint.style.display = 'none';
    this.skipHint.innerHTML = `${S('ui.skipHint', { key: 'Esc' })}`;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn';
    skipBtn.style.marginLeft = '12px';
    skipBtn.style.fontSize = '0.95rem';
    skipBtn.style.padding = '6px 14px';
    skipBtn.dataset.testid = 'btn-skip-cutscene';
    skipBtn.textContent = S('ui.skip');
    skipBtn.addEventListener('click', () => (this.skipRequested = true));
    this.skipHint.appendChild(skipBtn);
    uiRoot.appendChild(this.top);
    uiRoot.appendChild(this.bottom);
    uiRoot.appendChild(this.skipHint);
    window.addEventListener('keydown', (e) => {
      if (this.playing && (e.code === 'Escape' || e.code === 'Enter')) this.skipRequested = true;
    });
  }

  async playById(id: string): Promise<void> {
    const d = getContent().dialogue.get(id);
    if (!d) return;
    await this.play(id, d.lines);
  }

  async play(id: string, lines: DialogueLineDef[]): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    this.skipRequested = false;
    this.top.classList.add('shown');
    this.bottom.classList.add('shown');
    this.skipHint.style.display = 'block';
    bus.emit('CutsceneStarted', { id });
    for (const line of lines) {
      if (this.skipRequested) break;
      this.rigs.setTalking(line.speaker, true);
      // race the line against a skip request
      await Promise.race([
        this.voice.sayText(line.speaker, line.text, 2, `cutscene:${id}`),
        this.waitForSkip(),
      ]);
      this.rigs.setTalking(line.speaker, false);
      if (this.skipRequested) break;
      await this.delay(180);
    }
    this.voice.stopAll();
    for (const line of lines) this.rigs.setTalking(line.speaker, false);
    this.top.classList.remove('shown');
    this.bottom.classList.remove('shown');
    this.skipHint.style.display = 'none';
    this.playing = false;
    bus.emit('CutsceneEnded', { id });
  }

  private waitForSkip(): Promise<void> {
    return new Promise((res) => {
      const check = () => {
        if (this.skipRequested || !this.playing) res();
        else setTimeout(check, 100);
      };
      check();
    });
  }
  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
