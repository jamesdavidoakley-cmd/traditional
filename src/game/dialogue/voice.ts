/**
 * Voice director (§3.6): delivery pools with no-repeat memory, rotating
 * speakers, priorities ("don't talk over each other" with a combat-danger
 * exception), subtitles always, music ducking, TTS via VoiceProvider.
 */
import { audio } from '../../engine/audio';
import { bus } from '../../engine/events';
import { S, getContent, interpolate } from '../../engine/loader';
import type { SaveManager } from '../../engine/save';
import { createVoiceProvider, estimateMs, type SpeakHandle, type VoiceProvider } from '../../engine/tts';

export type Priority = 1 | 2 | 3; // 1 flavour · 2 hint/teaching · 3 combat danger

export interface SubtitleView {
  show(speakerId: string, name: string, colour: string, text: string): void;
  hide(): void;
}

/** Pure pool picker with no-repeat memory — unit-tested. */
export function pickLine(pool: string[], used: number[], rand: () => number = Math.random): { index: number; usedAfter: number[] } {
  if (pool.length === 0) return { index: -1, usedAfter: used };
  let candidates: number[] = [];
  for (let i = 0; i < pool.length; i++) if (!used.includes(i)) candidates.push(i);
  let usedAfter = used;
  if (candidates.length === 0) {
    // pool exhausted — reset, but avoid instantly repeating the very last line
    const last = used[used.length - 1];
    candidates = pool.map((_, i) => i).filter((i) => pool.length === 1 || i !== last);
    usedAfter = [];
  }
  const index = candidates[Math.floor(rand() * candidates.length)];
  return { index, usedAfter: [...usedAfter, index] };
}

interface QueueItem {
  speakerId: string;
  text: string;
  priority: Priority;
  resolve: () => void;
  poolKey: string;
}

export class VoiceDirector {
  private provider: VoiceProvider;
  private queue: QueueItem[] = [];
  private current: { item: QueueItem; handle: SpeakHandle; subTimer: number } | null = null;
  private lastSpokeAt = new Map<string, number>();
  private now = 0;
  subtitles: SubtitleView | null = null;
  enabled = true;
  rateMul = 1;
  volume = 1;
  /** Set false in menus that read text themselves. */
  private muted = false;

  constructor(private save: SaveManager) {
    this.provider = createVoiceProvider();
  }

  applySettings(): void {
    const s = this.save.settings;
    this.enabled = s.voiceOn;
    this.rateMul = s.speechRate;
    this.volume = s.voiceVol;
  }

  update(dt: number): void {
    this.now += dt;
    if (this.current) {
      this.current.subTimer -= dt;
      if (this.current.subTimer <= 0) {
        // subtitle outlives speech slightly; actual completion is promise-driven
      }
    } else if (this.queue.length > 0) {
      this.startNext();
    }
  }

  /** Speak a line from a character's delivery pool. Returns completion promise. */
  say(
    speakerId: string,
    poolKey: string,
    params?: Record<string, string | number>,
    priority: Priority = 2,
  ): Promise<void> {
    const pack = getContent().voices.get(speakerId);
    const pool = pack?.pools[poolKey];
    if (!pool || pool.length === 0) {
      return Promise.resolve();
    }
    const memKey = `${speakerId}:${poolKey}`;
    const save = this.save.current;
    const used = save?.voiceMemory[memKey] ?? [];
    const { index, usedAfter } = pickLine(pool, used);
    if (index < 0) return Promise.resolve();
    if (save) {
      save.voiceMemory[memKey] = usedAfter;
    }
    const playerName = save?.playerName ?? 'Max';
    const text = interpolate(pool[index], { playerName, ...params });
    return this.sayText(speakerId, text, priority, poolKey);
  }

  /** Speak literal text (cutscenes, questions, hints). */
  sayText(speakerId: string, text: string, priority: Priority = 2, poolKey = 'raw'): Promise<void> {
    return new Promise<void>((resolve) => {
      const item: QueueItem = { speakerId, text, priority, resolve, poolKey };
      if (this.current) {
        if (priority === 3 && this.current.item.priority < 3) {
          // combat danger barges in (§3.6 rule 4)
          this.cancelCurrent();
          this.queue.unshift(item);
        } else if (priority === 1 && (this.queue.length > 0 || this.current.item.priority > 1)) {
          // flavour never queues behind important speech — just drop it
          resolve();
          return;
        } else {
          this.queue.push(item);
          this.queue.sort((a, b) => b.priority - a.priority);
        }
      } else {
        this.queue.push(item);
      }
      if (!this.current) this.startNext();
    });
  }

  /** Flavour bark with per-character cooldown; silently dropped when busy. */
  bark(speakerId: string, poolKey: string, params?: Record<string, string | number>, priority: Priority = 1): void {
    const cfg = getContent().config.dialogue;
    const last = this.lastSpokeAt.get(speakerId) ?? -999;
    if (priority < 3 && this.now - last < cfg.barkCooldownSecs) return;
    if (priority === 1 && this.current) return;
    void this.say(speakerId, poolKey, params, priority);
  }

  private startNext(): void {
    const item = this.queue.shift();
    if (!item) return;
    const chars = getContent().characters;
    const all = [...chars.heroes, ...chars.cast];
    const cd = all.find((c) => c.id === item.speakerId);
    const name = cd ? S(cd.nameKey) : item.speakerId;
    const colour = cd?.subtitleColour ?? '#ffffff';
    this.subtitles?.show(item.speakerId, name, colour, item.text);
    audio.duckMusic(true);
    this.lastSpokeAt.set(item.speakerId, this.now);
    bus.emit('LineSpoken', { speaker: item.speakerId, text: item.text, poolKey: item.poolKey });

    const est = estimateMs(item.text, this.rateMul) / 1000;
    let handle: SpeakHandle;
    if (this.enabled && !this.muted && cd) {
      handle = this.provider.speak(item.text, cd.voice, this.rateMul, this.volume);
    } else {
      // silent pacing so subtitles read naturally
      let t: number;
      handle = {
        done: new Promise<void>((res) => {
          t = window.setTimeout(res, est * 1000);
        }),
        cancel: () => {
          clearTimeout(t);
        },
      };
      // ensure cancel resolves too
      const orig = handle.done;
      handle.done = orig;
    }
    this.current = { item, handle, subTimer: est + 0.4 };
    void handle.done.then(() => {
      if (this.current?.item !== item) return;
      this.finishCurrent();
    });
  }

  private finishCurrent(): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    cur.item.resolve();
    if (this.queue.length === 0) {
      this.subtitles?.hide();
      audio.duckMusic(false);
    } else {
      this.startNext();
    }
  }

  private cancelCurrent(): void {
    const cur = this.current;
    if (!cur) return;
    cur.handle.cancel();
    this.current = null;
    cur.item.resolve();
  }

  /** Stop everything (scene changes, skipped cutscenes). */
  stopAll(): void {
    this.cancelCurrent();
    for (const q of this.queue) q.resolve();
    this.queue = [];
    this.provider.cancelAll();
    this.subtitles?.hide();
    audio.duckMusic(false);
  }

  get speaking(): boolean {
    return this.current !== null;
  }
  get currentSpeaker(): string | null {
    return this.current?.item.speakerId ?? null;
  }
}
