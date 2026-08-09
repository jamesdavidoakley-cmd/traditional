/**
 * Content pipeline tests: the real /content tree loads clean through the
 * real loader, and the content-only expansion invariant (§2.3, §11) holds —
 * a new world is a pure JSON drop, no engine code changes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildContentDB, type FileMap } from '../src/engine/loader';

const root = join(__dirname, '..');
const contentDir = join(root, 'content');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

function realFiles(): FileMap {
  const files: FileMap = {};
  for (const p of walk(contentDir)) {
    files[`/content/${relative(contentDir, p).replaceAll('\\', '/')}`] = JSON.parse(readFileSync(p, 'utf8'));
  }
  return files;
}

describe('content pipeline', () => {
  it('the shipped content tree loads with zero validation issues', () => {
    const { db, issues } = buildContentDB(realFiles());
    expect(issues).toEqual([]);
    expect(db.levels.size).toBeGreaterThanOrEqual(3);
    expect(db.registry.worlds.length).toBeGreaterThanOrEqual(9);
    expect(db.questionPacks.size).toBeGreaterThanOrEqual(8);
    // every companion voice pack meets the §3.6 minimums checked in CI too
    for (const id of ['kenji', 'marcus', 'digger']) {
      const pack = db.voices.get(id);
      expect(pack, id).toBeTruthy();
      expect(pack!.pools['ask_intro'].length).toBeGreaterThanOrEqual(6);
    }
  });

  it('content-only expansion: dropping a w9 level JSON + registry row makes a playable world', () => {
    const files = realFiles();
    // simulate a designer adding World 9 purely under /content (§11 recipe)
    const registry = JSON.parse(JSON.stringify(files['/content/registry.json'])) as {
      worlds: { id: string; name: string; doorCost: number; level?: string }[];
    };
    registry.worlds.push({ id: 'w9', name: 'world.hub.name', doorCost: 44, level: 'w9' });
    files['/content/registry.json'] = registry;
    files['/content/levels/w9.json'] = {
      id: 'w9',
      nameKey: 'world.hub.name',
      music: 'hub',
      palette: {
        sky: ['#111111', '#222222'],
        fog: '#333333',
        fogNear: 10,
        fogFar: 100,
        sun: '#ffffff',
        sunIntensity: 1,
        ambient: '#888888',
        ambientIntensity: 1,
        ground: '#444444',
      },
      spawn: [0, 1, 0],
      killY: -10,
      geometry: [{ type: 'box', pos: [0, -1, 0], size: [10, 2, 10], colour: '#555555' }],
      fossils: [],
    };
    const { db, issues } = buildContentDB(files);
    expect(issues).toEqual([]);
    expect(db.levels.has('w9')).toBe(true);
    expect(db.registry.worlds.find((w) => w.id === 'w9')?.level).toBe('w9');
  });

  it('schemas catch broken content (missing hint on a question)', () => {
    const files = realFiles();
    files['/content/questions/broken.json'] = {
      id: 'broken',
      strand: 'maths',
      topic: 'broken',
      topicNameKey: 'x',
      questions: [
        { id: 'b1', tier: 1, type: 'quickfire', template: 'What is 1+1?', answer: '2', askStyles: ['kenji', 'digger'], explain: 'sums' },
      ],
    };
    const { issues } = buildContentDB(files);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].file).toContain('broken');
  });
});
