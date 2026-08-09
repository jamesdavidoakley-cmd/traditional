/**
 * The four automated AI proofs (§6.6) — headless sims over the REAL
 * BossBrain + REAL content JSON. Personality must be systemic, not
 * scripted: same moveset, opposite fighters.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BossBrain, type BrainContext } from '../src/game/ai/boss-brain';
import type { BossDef, GameConfig, MovesetDef } from '../src/game/content-types';
import { makeRng } from '../src/engine/math';

const root = join(__dirname, '..');
const load = <T>(rel: string): T => JSON.parse(readFileSync(join(root, 'content', rel), 'utf8')) as T;

const config = load<GameConfig>('config.json');
const swordBoard = load<MovesetDef>('movesets/sword_and_board.json');
const daggers = load<MovesetDef>('movesets/twin_daggers.json');
const bruno = load<BossDef>('bosses/bruno.json');
const bastion = load<BossDef>('bosses/bastion.json');
const nightshade = load<BossDef>('bosses/nightshade.json');

// §6.4: the explicit shared-moveset requirement
it('Bruno and Dame Bastion share the sword_and_board moveset', () => {
  expect(bruno.moveset).toBe('sword_and_board');
  expect(bastion.moveset).toBe('sword_and_board');
});

interface SimResult {
  tagShare: (tags: string[]) => number;
  sequence: string[];
  blockShare(fromTick: number, toTick: number): number;
}

/**
 * Scripted player-bot fight: deterministic band/HP script per tick, player
 * habit stream provided by `habitAt`. Same script for every boss — only the
 * personality differs.
 */
function simulate(def: BossDef, moveset: MovesetDef, seed: number, ticks = 500, habitAt?: (tick: number) => string): SimResult {
  const brain = new BossBrain(def, moveset, config.ai, makeRng(seed));
  const habits: string[] = [];
  const counts = new Map<string, number>();
  const sequence: string[] = [];
  const perTick: string[][] = [];
  for (let i = 0; i < ticks; i++) {
    if (habitAt) {
      habits.push(habitAt(i));
      if (habits.length > config.ai.habitWindow) habits.shift();
    }
    const ctx: BrainContext = {
      selfHp: 1 - (i / ticks) * 0.7,
      playerHp: 0.8,
      band: i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2,
      bandHeldSecs: 1,
      playerHabits: [...habits],
      playerStreak: i % 7 === 0 ? 2 : 0,
      timeSinceFightStart: i * 0.6,
      recentThreat: 0,
      playerRecentDamage: 0,
    };
    const d = brain.decide(ctx);
    sequence.push(d.move.id);
    perTick.push(d.move.tags);
    for (const t of d.move.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return {
    tagShare: (tags) => {
      let n = 0;
      for (const moveTags of perTick) {
        if (tags.some((t) => moveTags.includes(t))) n++;
      }
      return n / ticks;
    },
    sequence,
    blockShare: (from, to) => {
      let n = 0;
      for (let i = from; i < to; i++) {
        if (perTick[i]?.includes('defend')) n++;
      }
      return n / (to - from);
    },
  };
}

describe('proof 1 — divergence: same moveset, opposite personalities (§6.6.1)', () => {
  it('Bruno attacks ≥2.5× as often as Bastion; Bastion defends/repositions ≥2× as often as Bruno', () => {
    let brunoAttack = 0;
    let bastionAttack = 0;
    let brunoDefend = 0;
    let bastionDefend = 0;
    const RUNS = 20;
    for (let run = 0; run < RUNS; run++) {
      const rb = simulate(bruno, swordBoard, 1000 + run);
      const rt = simulate(bastion, swordBoard, 1000 + run);
      brunoAttack += rb.tagShare(['strike']);
      bastionAttack += rt.tagShare(['strike']);
      brunoDefend += rb.tagShare(['defend', 'reposition']);
      bastionDefend += rt.tagShare(['defend', 'reposition']);
    }
    brunoAttack /= RUNS;
    bastionAttack /= RUNS;
    brunoDefend /= RUNS;
    bastionDefend /= RUNS;
    expect(brunoAttack).toBeGreaterThanOrEqual(bastionAttack * 2.5);
    expect(bastionDefend).toBeGreaterThanOrEqual(brunoDefend * 2.0);
  });
});

describe('proof 2 — trigger: Nightshade cloaks below 40% HP (§6.6.2)', () => {
  it('cloak fires within 2 s of crossing the threshold in ≥95% of runs', () => {
    const RUNS = 100;
    let onTime = 0;
    for (let run = 0; run < RUNS; run++) {
      const brain = new BossBrain(nightshade, daggers, config.ai, makeRng(500 + run));
      const dt = 0.1;
      let crossedAt = -1;
      let firedAt = -1;
      for (let t = 0; t < 60; t += dt) {
        const hp = Math.max(0.05, 1 - t / 40); // steady damage over the fight
        if (hp < 0.4 && crossedAt < 0) crossedAt = t;
        const fired = brain.tickAbilities(dt, {
          selfHp: hp,
          playerHp: 1,
          band: 1,
          bandHeldSecs: 0,
          playerHabits: [],
          playerStreak: 0,
          timeSinceFightStart: t,
          recentThreat: 0,
          playerRecentDamage: 0,
        });
        if (fired.some((a) => a.effect === 'invisible')) {
          firedAt = t;
          break;
        }
      }
      if (crossedAt >= 0 && firedAt >= 0 && firedAt - crossedAt <= 2) onTime++;
    }
    expect(onTime / RUNS).toBeGreaterThanOrEqual(0.95);
  });
});

describe('proof 3 — adaptation: cautious bosses learn to block spam (§6.6.3)', () => {
  it('a caution ≥0.8 boss raises its block rate ≥50% once the player starts spamming one attack', () => {
    expect(bastion.traits.caution).toBeGreaterThanOrEqual(0.8);
    const RUNS = 12;
    let early = 0;
    let late = 0;
    // varied play for 100 ticks, then pure spin-spam — the rolling habit
    // histogram should tilt the cautious boss toward blocking
    const habitAt = (tick: number) => (tick < 100 ? ['spin', 'stomp', 'chomp'][tick % 3] : 'spin');
    for (let run = 0; run < RUNS; run++) {
      const r = simulate(bastion, swordBoard, 2000 + run, 320, habitAt);
      early += r.blockShare(20, 100);
      late += r.blockShare(220, 300);
    }
    early /= RUNS;
    late /= RUNS;
    expect(late).toBeGreaterThanOrEqual(early * 1.5);
  });
});

describe('proof 4 — variety: no two fights identical (§6.6.4)', () => {
  it('across 20 runs of the same fight, action sequences differ (softmax jitter working)', () => {
    const sequences = new Set<string>();
    for (let run = 0; run < 20; run++) {
      const r = simulate(bruno, swordBoard, 3000 + run, 60);
      sequences.add(r.sequence.join(','));
    }
    expect(sequences.size).toBeGreaterThanOrEqual(18);
  });
});
