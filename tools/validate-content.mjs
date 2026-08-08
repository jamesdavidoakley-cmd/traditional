#!/usr/bin/env node
/**
 * Content validation (CI + `npm run validate`):
 *  1. every JSON parses;
 *  2. every file matches its folder's JSON Schema (/content/schemas);
 *  3. cross-checks: refs resolve, fossil counts, pool minimums, string keys,
 *     ask-style rotation, and the content-only expansion invariant.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const contentDir = join(root, 'content');
const errors = [];
const warns = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = new Map(); // rel path → json
for (const p of walk(contentDir)) {
  const rel = relative(contentDir, p).replaceAll('\\', '/');
  try {
    files.set(rel, JSON.parse(readFileSync(p, 'utf8')));
  } catch (e) {
    errors.push(`${rel}: JSON parse error — ${e.message}`);
  }
}

// ---- schema validation ----------------------------------------------------
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map();
for (const [rel, json] of files) {
  const m = rel.match(/^schemas\/([\w-]+)\.schema\.json$/);
  if (m) {
    try {
      validators.set(m[1], ajv.compile(json));
    } catch (e) {
      errors.push(`${rel}: schema compile error — ${e.message}`);
    }
  }
}
const folderSchema = {
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
const rootSchema = { 'config.json': 'config', 'registry.json': 'registry', 'characters.json': 'characters' };

function check(schemaName, rel, json) {
  const v = validators.get(schemaName);
  if (!v) {
    warns.push(`${rel}: no schema '${schemaName}' — skipped`);
    return;
  }
  if (!v(json)) {
    for (const err of v.errors.slice(0, 3)) {
      errors.push(`${rel}: ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

for (const [rel, json] of files) {
  if (rel.startsWith('schemas/')) continue;
  if (rootSchema[rel]) {
    check(rootSchema[rel], rel, json);
    continue;
  }
  const folder = rel.split('/')[0];
  if (folder === 'strings') {
    if (typeof json !== 'object' || Array.isArray(json)) errors.push(`${rel}: strings must be an object`);
    continue;
  }
  if (folderSchema[folder]) check(folderSchema[folder], rel, json);
}

// ---- cross-checks ---------------------------------------------------------
const registry = files.get('registry.json');
const strings = files.get('strings/en-GB.json') ?? {};
const characters = files.get('characters.json');
const heroIds = new Set((characters?.heroes ?? []).map((h) => h.id));
const allCharIds = new Set([...(characters?.heroes ?? []), ...(characters?.cast ?? [])].map((c) => c.id));
const levels = new Map();
const bosses = new Map();
const tasks = new Map();
const movesets = new Map();
const enemies = new Map();
const packs = new Map();
const musicDefs = new Set();
const voicePacks = new Map();
for (const [rel, json] of files) {
  const folder = rel.split('/')[0];
  if (folder === 'levels') levels.set(json.id, json);
  if (folder === 'bosses') bosses.set(json.id, json);
  if (folder === 'tasks') tasks.set(json.id, json);
  if (folder === 'movesets') movesets.set(json.id, json);
  if (folder === 'enemies') enemies.set(json.id, json);
  if (folder === 'questions') packs.set(json.topic, json);
  if (folder === 'music') musicDefs.add(json.id);
  if (folder === 'voices') voicePacks.set(json.characterId, json);
}

const str = (key, where) => {
  if (!(key in strings)) errors.push(`${where}: missing string key '${key}'`);
};

// registry ↔ levels: the world list is data; every playable world's level must exist.
if (registry) {
  for (const w of registry.worlds) {
    str(w.name, 'registry');
    if (!w.comingSoon && w.level && !levels.has(w.level)) {
      errors.push(`registry: world '${w.id}' references missing level '${w.level}'`);
    }
  }
}

// levels
const seenFossils = new Set();
for (const [id, lv] of levels) {
  str(lv.nameKey, `levels/${id}`);
  if (!musicDefs.has(lv.music)) errors.push(`levels/${id}: missing music '${lv.music}'`);
  const fossils = lv.fossils ?? [];
  for (const f of fossils) {
    if (seenFossils.has(f.id)) errors.push(`levels/${id}: duplicate fossil id '${f.id}'`);
    seenFossils.add(f.id);
    str(f.nameKey, `levels/${id}/${f.id}`);
    str(f.hintKey, `levels/${id}/${f.id}`);
    if (!allCharIds.has(f.hintSpeaker)) errors.push(`levels/${id}: fossil '${f.id}' unknown hintSpeaker`);
    if (f.kind === 'task' && f.taskRef && !tasks.has(f.taskRef)) {
      errors.push(`levels/${id}: fossil '${f.id}' references missing task '${f.taskRef}'`);
    }
    if ((f.kind === 'boss' || f.kind === 'arena') && f.bossRef && !bosses.has(f.bossRef)) {
      errors.push(`levels/${id}: fossil '${f.id}' references missing boss '${f.bossRef}'`);
    }
  }
  // Themed worlds carry 6 placed fossils (+1 bonus from chips); hub carries 3.
  if (id.startsWith('w') && fossils.length !== 6) {
    errors.push(`levels/${id}: expected 6 placed fossils (6+bonus rule §4.4), found ${fossils.length}`);
  }
  for (const t of lv.tasks ?? []) {
    if (!tasks.has(t.ref)) errors.push(`levels/${id}: task placement references missing task '${t.ref}'`);
  }
  for (const e of lv.enemies ?? []) {
    if (!enemies.has(e.ref)) errors.push(`levels/${id}: enemy spawn references missing enemy '${e.ref}'`);
  }
  for (const a of lv.arenas ?? []) {
    if (!bosses.has(a.bossRef)) errors.push(`levels/${id}: arena references missing boss '${a.bossRef}'`);
  }
  for (const n of lv.npcs ?? []) {
    if (!allCharIds.has(n.character)) errors.push(`levels/${id}: npc '${n.id}' unknown character '${n.character}'`);
  }
}

// bosses
for (const [id, b] of bosses) {
  str(b.nameKey, `bosses/${id}`);
  if (!movesets.has(b.moveset.replace(/\.json$/, ''))) {
    errors.push(`bosses/${id}: missing moveset '${b.moveset}'`);
  }
  const packId = b.voicePack.replace(/^voices\//, '').replace(/\.json$/, '');
  if (!voicePacks.has(packId) && !voicePacks.has(id)) {
    errors.push(`bosses/${id}: missing voice pack '${b.voicePack}'`);
  }
}

// tasks: topics must exist so mastery + adaptive difficulty can track them
for (const [id, t] of tasks) {
  str(t.titleKey, `tasks/${id}`);
  if (!packs.has(t.topicId)) errors.push(`tasks/${id}: topicId '${t.topicId}' has no question pack`);
  if (!heroIds.has(t.companion)) errors.push(`tasks/${id}: unknown companion '${t.companion}'`);
  if (t.archetype === 'sort' && t.sort) {
    const cats = new Set(t.sort.categories.map((c) => c.id));
    for (const item of t.sort.items) {
      if (!cats.has(item.category)) errors.push(`tasks/${id}: item '${item.id}' unknown category '${item.category}'`);
    }
    for (const c of t.sort.categories) str(c.labelKey, `tasks/${id}`);
  }
}

// questions: askStyles must be hero ids (rotating speakers, §3.6)
for (const [topic, pack] of packs) {
  const ids = new Set();
  for (const q of pack.questions) {
    if (ids.has(q.id)) errors.push(`questions/${pack.id}: duplicate question id '${q.id}'`);
    ids.add(q.id);
    for (const s of q.askStyles) {
      if (!heroIds.has(s)) errors.push(`questions/${pack.id}: ${q.id} askStyle '${s}' is not a companion`);
    }
  }
  str(pack.topicNameKey, `questions/${pack.id}`);
  for (const tier of [1, 2, 3]) {
    const n = pack.questions.filter((q) => q.tier === tier).length;
    if (n === 0) warns.push(`questions/${pack.id}: no tier-${tier} questions for '${topic}'`);
  }
}

// voice pool minimum sizes (§3.6) — companions need ≥6 ask_intro etc.
const POOL_MIN = { ask_intro: 6, correct_first_try: 4, correct_after_hint: 4, incorrect_gentle: 4, fossil_get: 4, idle_nudge: 6 };
for (const heroId of heroIds) {
  if (heroId === 'max') continue;
  const pack = voicePacks.get(heroId);
  if (!pack) {
    errors.push(`voices: companion '${heroId}' has no voice pack`);
    continue;
  }
  for (const [pool, min] of Object.entries(POOL_MIN)) {
    const n = (pack.pools[pool] ?? []).length;
    if (n < min) errors.push(`voices/${heroId}: pool '${pool}' has ${n} lines, needs ≥${min} (§3.6)`);
  }
}

// content-only expansion invariant (§2.3): no level/world ids hardcoded in src.
import { readFileSync as rf } from 'node:fs';
const srcFiles = walk(join(root, 'src')).filter((p) => p.endsWith('.ts'));
const banned = [/['"`]w\d+['"`]\s*(?:===|!==)/, /levels\/w\d+/];
for (const p of srcFiles) {
  const text = rf(p, 'utf8');
  for (const re of banned) {
    if (re.test(text)) {
      errors.push(`${relative(root, p)}: hardcoded world/level reference (${re}) — registry must stay data-driven`);
    }
  }
}

// ---- report ---------------------------------------------------------------
for (const w of warns) console.log(`  ⚠ ${w}`);
if (errors.length > 0) {
  console.error(`\nContent validation FAILED with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`\n✓ Content valid: ${files.size} files, ${levels.size} levels, ${bosses.size} bosses, ${tasks.size} tasks, ${packs.size} topics, ${seenFossils.size} placed fossils.`);
