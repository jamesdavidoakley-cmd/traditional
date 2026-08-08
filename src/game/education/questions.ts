/**
 * Question instantiation + adaptive difficulty + mastery (§5): parametric
 * templates with a tiny safe expression evaluator, distractor rules,
 * rotating ask-speakers, tier promotion/demotion, spaced-repetition
 * weighting. Pure logic — fully unit-testable.
 */
import type { GameConfig, QuestionDef, QuestionPack } from '../content-types';
import type { SaveData, TopicProgress } from '../../engine/save';
import { makeRng, randInt, type Rng } from '../../engine/math';

// ---------------------------------------------------- expression evaluator
/** Safe arithmetic evaluator: numbers, vars, + - * / % ( ), round/floor/abs. */
export function evalExpr(src: string, vars: Record<string, number>): number {
  let i = 0;
  const peek = () => src[i];
  const skip = () => {
    while (i < src.length && src[i] === ' ') i++;
  };
  function parseExpr(): number {
    let v = parseTerm();
    skip();
    while (i < src.length && (src[i] === '+' || src[i] === '-')) {
      const op = src[i++];
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
      skip();
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    skip();
    while (i < src.length && (src[i] === '*' || src[i] === '/' || src[i] === '%')) {
      const op = src[i++];
      const r = parseFactor();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      skip();
    }
    return v;
  }
  function parseFactor(): number {
    skip();
    if (peek() === '-') {
      i++;
      return -parseFactor();
    }
    if (peek() === '(') {
      i++;
      const v = parseExpr();
      skip();
      if (peek() === ')') i++;
      return v;
    }
    // number
    if (/[0-9.]/.test(peek() ?? '')) {
      let start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i++;
      return parseFloat(src.slice(start, i));
    }
    // identifier or function
    if (/[a-zA-Z_]/.test(peek() ?? '')) {
      const start = i;
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i])) i++;
      const name = src.slice(start, i);
      skip();
      if (peek() === '(') {
        i++;
        const arg = parseExpr();
        skip();
        if (peek() === ')') i++;
        switch (name) {
          case 'round':
            return Math.round(arg);
          case 'floor':
            return Math.floor(arg);
          case 'abs':
            return Math.abs(arg);
          default:
            return NaN;
        }
      }
      if (name in vars) return vars[name];
      return NaN;
    }
    return NaN;
  }
  const result = parseExpr();
  return result;
}

/** Replace {token} with var value or evaluated expression. */
export function fillTemplate(template: string, vars: Record<string, number | string>): string {
  return template.replace(/\{([^}]+)\}/g, (m, expr: string) => {
    if (expr in vars) return String(vars[expr]);
    const numericVars: Record<string, number> = {};
    for (const [k, v] of Object.entries(vars)) if (typeof v === 'number') numericVars[k] = v;
    const v = evalExpr(expr, numericVars);
    if (Number.isNaN(v)) return m;
    return String(roundNice(v));
  });
}

const roundNice = (v: number): number => Math.round(v * 100) / 100;

// -------------------------------------------------------------- questions
export interface RuntimeQuestion {
  defId: string;
  topicId: string;
  tier: 1 | 2 | 3;
  text: string;
  answer: string;
  options: string[]; // shuffled, includes answer
  hint: string;
  explain: string;
  speaker: string;
  unit?: string;
}

export function instantiateQuestion(
  def: QuestionDef,
  topicId: string,
  speaker: string,
  rng: Rng,
): RuntimeQuestion {
  const vars: Record<string, number> = {};
  for (const [name, spec] of Object.entries(def.params ?? {})) {
    let v: number;
    const mult = spec.multipleOf ?? spec.step;
    if (mult) {
      const lo = Math.ceil(spec.min / mult);
      const hi = Math.floor(spec.max / mult);
      v = randInt(rng, lo, hi) * mult;
    } else {
      v = randInt(rng, spec.min, spec.max);
    }
    vars[name] = v;
  }
  const answerNum = def.answerExpr !== undefined ? roundNice(evalExpr(def.answerExpr, vars)) : NaN;
  const answer = def.answerExpr !== undefined ? String(answerNum) : fillTemplate(def.answer ?? '?', vars);
  const allVars: Record<string, number | string> = { ...vars, answer };

  // distractors
  const distractors = new Set<string>();
  for (const rule of def.distractorRules ?? []) {
    const v = roundNice(evalExpr(rule, { ...vars, answer: answerNum }));
    const s = String(v);
    if (!Number.isNaN(v) && s !== answer) distractors.add(s);
  }
  for (const d of def.distractors ?? []) {
    const s = fillTemplate(d, allVars);
    if (s !== answer) distractors.add(s);
  }
  // top up numeric jitters if authoring left gaps
  let guard = 0;
  while (distractors.size < 2 && !Number.isNaN(answerNum) && guard++ < 30) {
    const jitter = [1, -1, 2, -2, 10, -10][randInt(rng, 0, 5)];
    const s = String(roundNice(answerNum + jitter));
    if (s !== answer && Number(s) >= 0) distractors.add(s);
  }
  const options = [answer, ...[...distractors].slice(0, 2)];
  // shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    defId: def.id,
    topicId,
    tier: def.tier,
    text: fillTemplate(def.template, allVars),
    answer,
    options,
    hint: fillTemplate(def.hint, allVars),
    explain: fillTemplate(def.explain, allVars),
    speaker,
    unit: def.unit,
  };
}

// ---------------------------------------------------------------- mastery
export function ensureProgress(save: SaveData, topicId: string): TopicProgress {
  let p = save.mastery[topicId];
  if (!p) {
    p = { xp: 0, tier: 1, correct: 0, wrong: 0, streak: 0, missStreak: 0, lastSeen: 0 };
    save.mastery[topicId] = p;
  }
  return p;
}

export function starsForXp(xp: number, cfg: GameConfig['education']): number {
  let stars = 0;
  for (const t of cfg.masteryStarXp) if (xp >= t) stars++;
  return stars;
}

/** Apply an answer to the mastery model. Returns state-change flags for UI/voice. */
export function recordAnswer(
  save: SaveData,
  cfg: GameConfig['education'],
  topicId: string,
  correct: boolean,
  firstTry: boolean,
): { promoted: boolean; demoted: boolean; starEarned: boolean; streak: number } {
  const p = ensureProgress(save, topicId);
  p.lastSeen = save.playtimeMs;
  const starsBefore = starsForXp(p.xp, cfg);
  let promoted = false;
  let demoted = false;
  if (correct) {
    p.correct++;
    p.streak++;
    p.missStreak = 0;
    p.xp += cfg.xpPerCorrect + (firstTry ? cfg.xpFirstTryBonus : 0);
    if (p.streak >= cfg.promoteStreak && p.tier < 3) {
      p.tier = (p.tier + 1) as TopicProgress['tier'];
      p.streak = 0;
      promoted = true;
    }
  } else {
    p.wrong++;
    p.streak = 0;
    p.missStreak++;
    p.xp = Math.max(0, p.xp + 1); // trying still nudges xp — effort counts
    if (p.missStreak >= cfg.demoteMisses && p.tier > 1) {
      p.tier = (p.tier - 1) as TopicProgress['tier'];
      p.missStreak = 0;
      demoted = true; // soft & invisible — no UI shaming (§5.1.4)
    }
  }
  const starEarned = starsForXp(p.xp, cfg) > starsBefore;
  return { promoted, demoted, starEarned, streak: p.streak };
}

/** Pick this player's weakest topics (for Quiz Orbs, café, loading facts — §5.1.5). */
export function weakestTopics(save: SaveData, topicIds: string[], count: number): string[] {
  const scored = topicIds.map((id) => {
    const p = save.mastery[id];
    if (!p) return { id, score: 50 }; // unseen: medium priority
    const total = p.correct + p.wrong;
    const acc = total > 0 ? p.correct / total : 0.5;
    const staleness = Math.min(1, (save.playtimeMs - p.lastSeen) / 1200000);
    return { id, score: acc * 100 - staleness * 30 - p.wrong * 2 };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.id);
}

/** Rotating ask-speakers (§3.6.2): same fact, different companion each time. */
export function nextSpeaker(save: SaveData, topicId: string, askStyles: string[]): string {
  if (askStyles.length === 0) return 'kenji';
  const key = `rot:${topicId}`;
  const idx = Number(save.flags[key] ?? -1);
  const next = (idx + 1) % askStyles.length;
  save.flags[key] = next;
  return askStyles[next];
}

/** Choose a question def at the topic's current tier (fallback to neighbours). */
export function pickQuestionDef(
  pack: QuestionPack,
  tier: 1 | 2 | 3,
  recentIds: string[],
  rng: Rng,
): QuestionDef | null {
  const byTier = (t: number) => pack.questions.filter((q) => q.tier === t);
  let pool = byTier(tier);
  if (pool.length === 0) pool = byTier(tier - 1);
  if (pool.length === 0) pool = byTier(tier + 1);
  if (pool.length === 0) pool = pack.questions;
  if (pool.length === 0) return null;
  const fresh = pool.filter((q) => !recentIds.includes(q.id));
  const usePool = fresh.length > 0 ? fresh : pool;
  return usePool[Math.floor(rng() * usePool.length)];
}

export const questionRng = makeRng(Date.now() % 2147483647);
