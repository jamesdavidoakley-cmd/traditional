/** Small math helpers shared by gameplay and AI. Pure — safe in headless tests. */

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential smoothing. `rate` ≈ how fast it converges per second. */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-rate * dt));

export const dampAngle = (a: number, b: number, rate: number, dt: number): number => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-rate * dt));
};

export const wrapAngle = (a: number): number => {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** Deterministic RNG (mulberry32) — every simulation and test threads one of these through. */
export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo);
export const randInt = (rng: Rng, lo: number, hi: number): number => Math.floor(randRange(rng, lo, hi + 1));
export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export function shuffled<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Softmax-sample an index from scores at the given temperature.
 * Higher temperature → more adventurous picks (used by boss AI, §6.3).
 */
export function softmaxPick(rng: Rng, scores: number[], temperature: number): number {
  if (scores.length === 0) return -1;
  const t = Math.max(0.05, temperature);
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < exps.length; i++) {
    r -= exps[i];
    if (r <= 0) return i;
  }
  return exps.length - 1;
}

/** Format an integer with thin spaces for young readers: 1234 → "1 234" (UK KS2 convention friendly). */
export const formatNumber = (n: number): string =>
  Math.abs(n) >= 10000 ? n.toLocaleString('en-GB') : String(n);
