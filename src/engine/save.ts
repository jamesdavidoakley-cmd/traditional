/**
 * Save system: 3 slots in localStorage plus JSON export/import (§9.4).
 * Settings are global (shared across slots); everything else is per-slot.
 */

export interface TopicProgress {
  xp: number;
  tier: 1 | 2 | 3;
  correct: number;
  wrong: number;
  streak: number; // correct-in-a-row at current tier (promotion counter)
  missStreak: number;
  lastSeen: number; // playtime ms when last practised — spaced repetition
}

export interface SaveData {
  version: number;
  playerName: string;
  difficulty: 'explorer' | 'hero';
  createdAt: number;
  playtimeMs: number;
  fossils: string[];
  chips: Record<string, string[]>; // worldId → collected chip ids
  bankedBonus: string[]; // worldIds whose 80-chip bonus fossil is earned
  brainPower: number; // 0..5 segments
  gadgets: string[];
  freedChampions: string[];
  bossesDefeated: string[];
  secretsFound: string[];
  mastery: Record<string, TopicProgress>;
  voiceMemory: Record<string, number[]>; // poolKey → indices already spoken (no-repeat, §3.6)
  flags: Record<string, boolean | number | string>;
  lastWorld: string;
  sessionStartMs?: number;
}

export interface Settings {
  version: number;
  musicVol: number;
  sfxVol: number;
  voiceVol: number;
  voiceOn: boolean;
  speechRate: number; // global multiplier
  readMenus: boolean;
  subtitleSize: 'small' | 'medium' | 'large';
  dyslexiaFont: boolean;
  reduceShake: boolean;
  reduceFlash: boolean;
  cameraSensitivity: number;
  invertCameraX: boolean;
  invertCameraY: boolean;
  holdToggles: boolean;
  colourAssist: boolean; // colour-blind-safe accent set
  quality: 'auto' | 'low' | 'medium' | 'high';
  keyBindings?: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  musicVol: 0.7,
  sfxVol: 0.9,
  voiceVol: 1.0,
  voiceOn: true,
  speechRate: 1.0,
  readMenus: false,
  subtitleSize: 'medium',
  dyslexiaFont: false,
  reduceShake: false,
  reduceFlash: false,
  cameraSensitivity: 1.0,
  invertCameraX: false,
  invertCameraY: false,
  holdToggles: false,
  colourAssist: false,
  quality: 'auto',
};

export function newSave(playerName: string, difficulty: 'explorer' | 'hero'): SaveData {
  return {
    version: 1,
    playerName,
    difficulty,
    createdAt: Date.now(),
    playtimeMs: 0,
    fossils: [],
    chips: {},
    bankedBonus: [],
    brainPower: 0,
    gadgets: [],
    freedChampions: [],
    bossesDefeated: [],
    secretsFound: [],
    mastery: {},
    voiceMemory: {},
    flags: {},
    lastWorld: 'hub',
  };
}

const SLOT_KEY = (n: number) => `msf.save.${n}`;
const SETTINGS_KEY = 'msf.settings';

export class SaveManager {
  current: SaveData | null = null;
  currentSlot = -1;
  settings: Settings;
  private storage: Storage | null;

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.settings = this.loadSettings();
  }

  private loadSettings(): Settings {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch (e) {
      console.warn('[save] settings unreadable, using defaults', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(): void {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[save] could not persist settings', e);
    }
  }

  slotSummary(n: number): { exists: boolean; name?: string; fossils?: number; playtimeMs?: number } {
    try {
      const raw = this.storage?.getItem(SLOT_KEY(n));
      if (!raw) return { exists: false };
      const data = JSON.parse(raw) as SaveData;
      return { exists: true, name: data.playerName, fossils: data.fossils.length, playtimeMs: data.playtimeMs };
    } catch {
      return { exists: false };
    }
  }

  startNew(slot: number, playerName: string, difficulty: 'explorer' | 'hero'): SaveData {
    this.current = newSave(playerName, difficulty);
    this.currentSlot = slot;
    this.persist();
    return this.current;
  }

  load(slot: number): SaveData | null {
    try {
      const raw = this.storage?.getItem(SLOT_KEY(slot));
      if (!raw) return null;
      this.current = JSON.parse(raw) as SaveData;
      this.currentSlot = slot;
      return this.current;
    } catch (e) {
      console.warn(`[save] slot ${slot} unreadable`, e);
      return null;
    }
  }

  persist(): void {
    if (!this.current || this.currentSlot < 0) return;
    try {
      this.storage?.setItem(SLOT_KEY(this.currentSlot), JSON.stringify(this.current));
    } catch (e) {
      console.warn('[save] could not persist', e);
    }
  }

  erase(slot: number): void {
    this.storage?.removeItem(SLOT_KEY(slot));
  }

  exportJson(): string {
    return JSON.stringify({ kind: 'max-star-fossils-save', data: this.current }, null, 2);
  }

  importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as { kind?: string; data?: SaveData };
      if (parsed.kind !== 'max-star-fossils-save' || !parsed.data || !Array.isArray(parsed.data.fossils)) {
        return false;
      }
      this.current = parsed.data;
      this.persist();
      return true;
    } catch {
      return false;
    }
  }
}
