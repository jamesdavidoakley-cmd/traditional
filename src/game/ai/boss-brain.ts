/**
 * The Boss Personality Framework (§6.3) — pure, headless utility AI.
 * Personality EMERGES from a trait vector scoring a shared moveset:
 * the same sword_and_board kit produces Bruno's landslide and Bastion's
 * fortress purely through numbers. Proven by tests/ai-sim.test.ts.
 */
import type { AbilityDef, BossDef, GameConfig, MoveDef, MovesetDef, TraitVector } from '../content-types';
import { clamp01, softmaxPick, type Rng } from '../../engine/math';

export type DistanceBand = 0 | 1 | 2; // close · mid · far

export interface BrainContext {
  /** 0..1 of own max HP */
  selfHp: number;
  playerHp: number;
  band: DistanceBand;
  /** seconds the player has stayed in the current band */
  bandHeldSecs: number;
  /** player's recent action ids, newest last (rolling window) */
  playerHabits: string[];
  /** consecutive hits the player has landed without being hit */
  playerStreak: number;
  timeSinceFightStart: number;
  alliesDown?: number;
  /** damage dealt to player within the threat window (fairness governor) */
  recentThreat: number;
  /** damage the player has taken recently overall (rubber-banding) */
  playerRecentDamage: number;
}

export interface Decision {
  move: MoveDef;
  /** why — top scores for debugging/telemetry */
  scores: { id: string; score: number }[];
}

/** Tag families each trait amplifies (§6.3). */
const TRAIT_TAG_AFFINITY: Record<keyof TraitVector, Partial<Record<string, number>>> = {
  aggression: { strike: 1.0, heavy: 0.8, combo: 0.9, approach: 0.7, ranged: 0.3 },
  // NB: caution's defend affinity is deliberately moderate — a cautious boss
  // WALLS UP reactively (habit reading, player streaks) rather than blocking
  // on a timer. Keeps the adaptation signal visible (§6.6.3).
  caution: { defend: 0.55, reposition: 0.75, retreat: 0.8, heal: 0.6, ranged: 0.4 },
  trickery: { feint: 1.0, reposition: 0.4, ranged: 0.3, summon: 0.3 },
  patience: { wait: 1.0, defend: 0.35, ranged: 0.25 },
  showmanship: { flourish: 1.0, summon: 0.4, heavy: 0.2 },
};

export function traitMultiplier(tags: string[], traits: TraitVector): number {
  let mul = 1;
  for (const [traitName, affinities] of Object.entries(TRAIT_TAG_AFFINITY) as [keyof TraitVector, Partial<Record<string, number>>][]) {
    const t = traits[traitName];
    for (const tag of tags) {
      const a = affinities[tag];
      if (a !== undefined) {
        // trait 0.5 is neutral; above amplifies, below dampens
        mul *= 1 + (t - 0.5) * 2 * a;
      }
    }
  }
  return Math.max(0.02, mul);
}

export function contextMultiplier(move: MoveDef, ctx: BrainContext, traits: TraitVector, cfg: GameConfig['ai']): number {
  let mul = move.bandWeights[ctx.band] ?? 1;

  // low own HP: cautious types defend/retreat/heal more, aggressive types go harder
  if (ctx.selfHp < 0.35) {
    if (move.tags.includes('defend') || move.tags.includes('retreat') || move.tags.includes('heal')) {
      mul *= 1 + traits.caution * 1.2;
    }
    if (move.tags.includes('strike') || move.tags.includes('combo')) {
      mul *= 1 + traits.aggression * 0.6;
    }
  }
  // player on a hit streak: cautious bosses answer with defence, tricky ones with feints
  if (ctx.playerStreak >= 2) {
    if (move.tags.includes('defend')) mul *= 1 + traits.caution * 0.9;
    if (move.tags.includes('feint')) mul *= 1 + traits.trickery * 0.8;
  }
  // habit reading (§6.3): habitual attacker → block/feint weighting scales with history depth
  const habitDepth = Math.min(1, ctx.playerHabits.length / cfg.habitWindow);
  if (habitDepth > 0.3) {
    const counts = new Map<string, number>();
    for (const h of ctx.playerHabits) counts.set(h, (counts.get(h) ?? 0) + 1);
    const top = [...counts.values()].sort((a, b) => b - a)[0] ?? 0;
    const dominance = top / Math.max(1, ctx.playerHabits.length); // 1 = pure spam
    if (dominance > 0.5) {
      if (move.tags.includes('defend')) mul *= 1 + traits.caution * dominance * 2.2 * habitDepth;
      if (move.tags.includes('feint')) mul *= 1 + traits.trickery * dominance * 1.6 * habitDepth;
    }
  }
  // patient types happily wait out far players; impatient ones close in
  if (ctx.band === 2) {
    if (move.tags.includes('wait')) mul *= 1 + traits.patience * 0.9;
    if (move.tags.includes('approach')) mul *= 1 + (1 - traits.patience) * 0.9;
  }
  // fairness governor (§6.3): threat budget over rolling window
  const budget = cfg.threatBudgetBase * (1 + (1 - clamp01(ctx.playerRecentDamage * cfg.rubberbandDamageScale)));
  if (ctx.recentThreat >= budget) {
    if (move.tags.includes('strike') || move.tags.includes('heavy') || move.tags.includes('combo') || move.tags.includes('ranged')) {
      mul *= 0.15; // back off — let the kid breathe
    }
    if (move.tags.includes('flourish') || move.tags.includes('wait') || move.tags.includes('reposition')) {
      mul *= 1.6;
    }
  }
  return Math.max(0.01, mul);
}

export interface AbilityState {
  def: AbilityDef;
  firedCount: number;
  cooldownLeft: number;
  distanceHeldAccum: number;
  timerAccum: number;
}

export class BossBrain {
  traits: TraitVector;
  private lastMoves: string[] = [];
  abilities: AbilityState[];
  phase = 1;
  private rng: Rng;

  constructor(
    public def: BossDef,
    private moveset: MovesetDef,
    private cfg: GameConfig['ai'],
    rng: Rng,
    traitNoise = 0,
  ) {
    this.rng = rng;
    this.traits = { ...def.traits };
    if (traitNoise > 0) {
      for (const k of Object.keys(this.traits) as (keyof TraitVector)[]) {
        this.traits[k] = clamp01(this.traits[k] + (rng() * 2 - 1) * traitNoise);
      }
    }
    this.abilities = def.abilities.map((a) => ({
      def: a,
      firedCount: 0,
      cooldownLeft: 0,
      distanceHeldAccum: 0,
      timerAccum: 0,
    }));
  }

  /** Ban-repeat rule: no move 3× consecutively unless very aggressive (§6.3). */
  private banRepeat(moveId: string): boolean {
    if (this.traits.aggression > this.cfg.banRepeatAggressionExempt) return false;
    const n = this.cfg.banRepeatCount;
    if (this.lastMoves.length < n - 1) return false;
    const recent = this.lastMoves.slice(-(n - 1));
    return recent.every((m) => m === moveId);
  }

  decide(ctx: BrainContext): Decision {
    const scored = this.moveset.moves
      .filter((m) => !this.banRepeat(m.id))
      .map((m) => ({
        move: m,
        score:
          m.baseWeight *
          traitMultiplier(m.tags, this.traits) *
          contextMultiplier(m, ctx, this.traits, this.cfg),
      }));
    if (scored.length === 0) {
      // everything banned (tiny movesets) — fall back to full list
      scored.push(
        ...this.moveset.moves.map((m) => ({
          move: m,
          score: m.baseWeight,
        })),
      );
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);
    const temperature = this.cfg.softmaxBase + this.traits.trickery * this.cfg.softmaxTrickeryScale;
    const idx = softmaxPick(this.rng, top.map((s) => s.score), temperature);
    const chosen = top[Math.max(0, idx)];
    this.lastMoves.push(chosen.move.id);
    if (this.lastMoves.length > 6) this.lastMoves.shift();
    return { move: chosen.move, scores: scored.map((s) => ({ id: s.move.id, score: s.score })) };
  }

  /** Data-driven ability triggers (§6.3). Call every sim tick. Returns fired abilities. */
  tickAbilities(dt: number, ctx: BrainContext): AbilityDef[] {
    const fired: AbilityDef[] = [];
    for (const st of this.abilities) {
      const a = st.def;
      if (a.once !== false && st.firedCount > 0 && a.trigger.type !== 'onTimer' && a.trigger.type !== 'onPlayerStreak') continue;
      if (st.cooldownLeft > 0) {
        st.cooldownLeft -= dt;
        continue;
      }
      let fire = false;
      switch (a.trigger.type) {
        case 'onHpBelow':
          fire = ctx.selfHp < a.trigger.value;
          break;
        case 'onTimer':
          st.timerAccum += dt;
          if (st.timerAccum >= a.trigger.value) {
            fire = true;
            st.timerAccum = 0;
          }
          break;
        case 'onPlayerStreak':
          fire = ctx.playerStreak >= a.trigger.value;
          break;
        case 'onDistanceHeld': {
          const inBand = a.trigger.range === 'far' ? ctx.band === 2 : ctx.band === 0;
          st.distanceHeldAccum = inBand ? st.distanceHeldAccum + dt : 0;
          fire = st.distanceHeldAccum >= a.trigger.value;
          if (fire) st.distanceHeldAccum = 0;
          break;
        }
        case 'onPhaseEnter':
          fire = this.phase >= a.trigger.value && st.firedCount === 0;
          break;
        case 'onAllyDown':
          fire = (ctx.alliesDown ?? 0) >= a.trigger.value;
          break;
      }
      if (fire) {
        st.firedCount++;
        st.cooldownLeft = a.cooldown ?? 6;
        fired.push(a);
      }
    }
    return fired;
  }

  setPhase(p: number): void {
    this.phase = p;
  }
}
