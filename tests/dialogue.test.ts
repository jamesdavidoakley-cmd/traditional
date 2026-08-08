/**
 * P2 gate: the no-repeat memory rule (§3.6.1) proven — a line never repeats
 * until its pool is exhausted; reset avoids instant repetition.
 */
import { describe, expect, it } from 'vitest';
import { pickLine } from '../src/game/dialogue/voice';
import { makeRng } from '../src/engine/math';

describe('voice no-repeat memory', () => {
  it('never repeats a line until the pool is exhausted', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const rng = makeRng(1234);
    let used: number[] = [];
    const firstCycle: number[] = [];
    for (let i = 0; i < pool.length; i++) {
      const r = pickLine(pool, used, rng);
      expect(firstCycle).not.toContain(r.index);
      firstCycle.push(r.index);
      used = r.usedAfter;
    }
    expect([...firstCycle].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('resets after exhaustion without instantly repeating the last line', () => {
    const pool = ['a', 'b', 'c'];
    for (let seed = 1; seed < 40; seed++) {
      const rng = makeRng(seed);
      let used: number[] = [];
      let last = -1;
      for (let i = 0; i < 30; i++) {
        const r = pickLine(pool, used, rng);
        expect(r.index).not.toBe(last);
        last = r.index;
        used = r.usedAfter;
      }
    }
  });

  it('across many draws every line gets used evenly-ish', () => {
    const pool = ['a', 'b', 'c', 'd'];
    const rng = makeRng(77);
    let used: number[] = [];
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      const r = pickLine(pool, used, rng);
      counts[r.index]++;
      used = r.usedAfter;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(80);
      expect(c).toBeLessThan(120);
    }
  });

  it('handles a single-line pool without infinite loops', () => {
    const rng = makeRng(5);
    let used: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = pickLine(['only'], used, rng);
      expect(r.index).toBe(0);
      used = r.usedAfter;
    }
  });
});
