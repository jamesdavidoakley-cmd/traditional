/**
 * Content loader: gathers every JSON under /content (via Vite glob in the
 * browser, or an injected file map in tests), classifies by folder, and
 * validates against the JSON Schemas in /content/schemas with ajv.
 * Adding a world/boss/question pack is a pure content drop (§2.3) — this
 * module never mentions a specific world id.
 */
import { Ajv, type ValidateFunction } from 'ajv';
import type {
  BanterFile,
  BossDef,
  CharactersFile,
  ContentDB,
  DialogueFile,
  EnemyDef,
  GameConfig,
  LevelDef,
  MovesetDef,
  QuestionPack,
  Registry,
  TaskDef,
  VoicePackFile,
} from '../game/content-types';
import type { MusicDef } from './music';

export type FileMap = Record<string, unknown>; // "/content/…/file.json" → parsed JSON

/** Folder → schema id used for validation. */
const FOLDER_SCHEMAS: Record<string, string> = {
  voices: 'voicepack',
  dialogue: 'dialogue',
  questions: 'questions',
  tasks: 'task',
  enemies: 'enemy',
  movesets: 'moveset',
  bosses: 'boss',
  levels: 'level',
  music: 'music',
};

export interface ValidationIssue {
  file: string;
  message: string;
}

export function buildContentDB(files: FileMap): { db: ContentDB; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const db: ContentDB = {
    config: null as unknown as GameConfig,
    registry: null as unknown as Registry,
    characters: null as unknown as CharactersFile,
    strings: {},
    voices: new Map(),
    dialogue: new Map(),
    banter: null,
    questionPacks: new Map(),
    topics: new Map(),
    tasks: new Map(),
    enemies: new Map(),
    movesets: new Map(),
    bosses: new Map(),
    levels: new Map(),
    music: new Map(),
  };

  const schemas = new Map<string, object>();
  for (const [path, json] of Object.entries(files)) {
    const m = path.match(/\/content\/schemas\/([\w-]+)\.schema\.json$/);
    if (m) schemas.set(m[1], json as object);
  }

  const ajv = new Ajv({ allErrors: false, strict: false });
  const validators = new Map<string, ValidateFunction>();
  for (const [name, schema] of schemas) {
    try {
      validators.set(name, ajv.compile(schema));
    } catch (e) {
      issues.push({ file: `schemas/${name}`, message: `schema failed to compile: ${String(e)}` });
    }
  }

  const validate = (schemaName: string, path: string, json: unknown): boolean => {
    const v = validators.get(schemaName);
    if (!v) return true; // schema absent — allowed during authoring, caught by CI cross-checks
    if (v(json)) return true;
    const err = v.errors?.[0];
    issues.push({ file: path, message: `${err?.instancePath ?? ''} ${err?.message ?? 'invalid'}`.trim() });
    return false;
  };

  for (const [path, json] of Object.entries(files)) {
    if (path.includes('/schemas/')) continue;
    const rel = path.slice(path.indexOf('/content/') + '/content/'.length);
    const parts = rel.split('/');
    try {
      if (parts.length === 1) {
        const name = parts[0];
        if (name === 'config.json') {
          if (validate('config', rel, json)) db.config = json as GameConfig;
        } else if (name === 'registry.json') {
          if (validate('registry', rel, json)) db.registry = json as Registry;
        } else if (name === 'characters.json') {
          if (validate('characters', rel, json)) db.characters = json as CharactersFile;
        }
        continue;
      }
      const folder = parts[0];
      switch (folder) {
        case 'strings': {
          Object.assign(db.strings, json as Record<string, string>);
          break;
        }
        case 'voices': {
          if (validate('voicepack', rel, json)) {
            const pack = json as VoicePackFile;
            db.voices.set(pack.characterId, pack);
          }
          break;
        }
        case 'dialogue': {
          const d = json as DialogueFile | BanterFile;
          if (d.id === 'banter') {
            db.banter = d as BanterFile;
          } else if (validate('dialogue', rel, json)) {
            db.dialogue.set((d as DialogueFile).id, d as DialogueFile);
          }
          break;
        }
        case 'questions': {
          if (validate('questions', rel, json)) {
            const pack = json as QuestionPack;
            db.questionPacks.set(pack.id, pack);
            db.topics.set(pack.topic, pack);
          }
          break;
        }
        case 'tasks': {
          if (validate('task', rel, json)) {
            const t = json as TaskDef;
            db.tasks.set(t.id, t);
          }
          break;
        }
        case 'enemies': {
          if (validate('enemy', rel, json)) {
            const e = json as EnemyDef;
            db.enemies.set(e.id, e);
          }
          break;
        }
        case 'movesets': {
          if (validate('moveset', rel, json)) {
            const ms = json as MovesetDef;
            db.movesets.set(ms.id, ms);
          }
          break;
        }
        case 'bosses': {
          if (validate('boss', rel, json)) {
            const b = json as BossDef;
            db.bosses.set(b.id, b);
          }
          break;
        }
        case 'levels': {
          if (validate('level', rel, json)) {
            const lv = json as LevelDef;
            db.levels.set(lv.id, lv);
          }
          break;
        }
        case 'music': {
          if (validate('music', rel, json)) {
            const mu = json as MusicDef;
            db.music.set(mu.id, mu);
          }
          break;
        }
        default:
          break;
      }
    } catch (e) {
      issues.push({ file: rel, message: `failed to ingest: ${String(e)}` });
    }
  }

  if (!db.config) issues.push({ file: 'config.json', message: 'missing or invalid' });
  if (!db.registry) issues.push({ file: 'registry.json', message: 'missing or invalid' });
  if (!db.characters) issues.push({ file: 'characters.json', message: 'missing or invalid' });
  return { db, issues };
}

/** Browser entry: pulls the whole /content tree into the bundle via Vite glob. */
export function loadContentFromBundle(): { db: ContentDB; issues: ValidationIssue[] } {
  const files = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' }) as FileMap;
  return buildContentDB(files);
}

// ---------------------------------------------------------------- strings
let activeDB: ContentDB | null = null;
export function setActiveContent(db: ContentDB): void {
  activeDB = db;
}
export function getContent(): ContentDB {
  if (!activeDB) throw new Error('content not loaded');
  return activeDB;
}

const missingWarned = new Set<string>();

/** String-table lookup with {placeholder} interpolation. Never throws mid-game. */
export function S(key: string, params?: Record<string, string | number>): string {
  const table = activeDB?.strings ?? {};
  let s = table[key];
  if (s === undefined) {
    if (!missingWarned.has(key)) {
      missingWarned.add(key);
      console.warn(`[strings] missing key: ${key}`);
    }
    s = key;
  }
  return interpolate(s, params);
}

export function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
