/**
 * Education engine (§5): task archetype registry, the warm failure loop,
 * adaptive tiers, mastery events, spaced repetition surfaces (Quiz Orbs,
 * café). "Do first, quiz second" — most archetypes live in the world.
 */
import * as THREE from 'three';
import type { Game } from '../game';
import type { TaskDef } from '../content-types';
import { C } from '../ctx';
import { S } from '../../engine/loader';
import { bus } from '../../engine/events';
import { audio } from '../../engine/audio';
import {
  instantiateQuestion,
  nextSpeaker,
  pickQuestionDef,
  questionRng,
  recordAnswer,
  starsForXp,
  ensureProgress,
  weakestTopics,
  type RuntimeQuestion,
} from './questions';
import type { TaskStationEntity } from '../world/level';

export interface TaskCtx {
  game: Game;
  engine: EducationEngine;
  task: TaskDef;
  tier: 1 | 2 | 3;
  station: TaskStationEntity | null;
  origin: THREE.Vector3;
  forwardDeg: number;
  finish(completed: boolean): void;
}

export interface ActiveTask {
  modal: boolean;
  update?(dt: number): void;
  onStomp?(pos: THREE.Vector3): void;
  onChomp?(): void;
  dispose(): void;
}

export type TaskModuleFactory = (ctx: TaskCtx) => ActiveTask;

const registry = new Map<string, TaskModuleFactory>();
/** Task archetypes self-register here (§5.3); adding #9 = implement + register. */
export function registerArchetype(archetype: string, factory: TaskModuleFactory): void {
  registry.set(archetype, factory);
}
export function registeredArchetypes(): string[] {
  return [...registry.keys()];
}

export class EducationEngine {
  private active: ActiveTask | null = null;
  private activeTaskDef: TaskDef | null = null;
  taskOpen = false; // true while a MODAL task panel is up
  private recentQuestionIds = new Map<string, string[]>();

  constructor(public game: Game) {}

  // ------------------------------------------------------------- questions
  tierFor(topicId: string): 1 | 2 | 3 {
    const save = C().save.current;
    if (!save) return 1;
    return ensureProgress(save, topicId).tier;
  }

  createQuestion(topicId: string, opts?: { tier?: 1 | 2 | 3; speaker?: string }): RuntimeQuestion | null {
    const pack = C().content.topics.get(topicId);
    const save = C().save.current;
    if (!pack || !save) return null;
    const tier = opts?.tier ?? this.tierFor(topicId);
    const recent = this.recentQuestionIds.get(topicId) ?? [];
    const def = pickQuestionDef(pack, tier, recent, questionRng);
    if (!def) return null;
    recent.push(def.id);
    if (recent.length > 6) recent.shift();
    this.recentQuestionIds.set(topicId, recent);
    const speaker = opts?.speaker ?? nextSpeaker(save, topicId, def.askStyles);
    return instantiateQuestion(def, topicId, speaker, questionRng);
  }

  /** Speak the wrapped question in-character, then the question itself (§5.1.6). */
  async speakQuestion(q: RuntimeQuestion, withIntro = true): Promise<void> {
    const v = this.game.voice;
    if (withIntro) await v.say(q.speaker, 'ask_intro', { topic: S(C().content.topics.get(q.topicId)?.topicNameKey ?? '') }, 2);
    await v.sayText(q.speaker, q.text, 2, 'question');
  }

  /**
   * The warm failure loop (§5.1.3). `present` shows options and resolves with
   * the player's pick. Returns after: correct (1st or 2nd try) — or after the
   * teach step, in which case a fresh question re-rolls and the loop repeats.
   */
  async runWarmLoop(
    makeQ: () => RuntimeQuestion | null,
    present: (q: RuntimeQuestion, attempt: number) => Promise<string | null>,
  ): Promise<boolean> {
    const v = this.game.voice;
    for (let round = 0; round < 6; round++) {
      const q = makeQ();
      if (!q) return false;
      await this.speakQuestion(q, round === 0);
      // attempt 1
      let pick = await present(q, 1);
      if (pick === null) return false; // cancelled
      if (pick === q.answer) {
        this.applyAnswer(q, true, true);
        await v.say(q.speaker, 'correct_first_try', { answer: q.answer }, 2);
        return true;
      }
      this.applyAnswer(q, false, true);
      audio.play('incorrect');
      await v.say(q.speaker, 'incorrect_gentle', {}, 2);
      await v.say(q.speaker, 'hint_intro', {}, 2);
      await v.sayText(q.speaker, q.hint, 2, 'hint');
      // attempt 2
      pick = await present(q, 2);
      if (pick === null) return false;
      if (pick === q.answer) {
        this.applyAnswer(q, true, false);
        await v.say(q.speaker, 'correct_after_hint', { answer: q.answer }, 2);
        return true;
      }
      // teach, then re-roll and go again — nothing lost (§5.1.3)
      this.applyAnswer(q, false, false);
      audio.play('incorrect');
      await v.say(q.speaker, 'teach', {}, 2);
      await v.sayText(q.speaker, q.explain, 2, 'explain');
    }
    return false;
  }

  applyAnswer(q: RuntimeQuestion, correct: boolean, firstTry: boolean): void {
    const save = C().save.current;
    if (!save) return;
    const cfg = C().content.config.education;
    const result = recordAnswer(save, cfg, q.topicId, correct, firstTry);
    bus.emit('QuestionAnswered', {
      topicId: q.topicId,
      correct,
      tier: q.tier,
      firstTry,
      taskId: this.activeTaskDef?.id ?? 'freeplay',
    });
    if (correct) {
      audio.play('correct');
      this.game.addBrainPower(1);
      if (result.streak > 0 && result.streak % 5 === 0) {
        audio.play('streak');
        void this.game.voice.say(q.speaker, 'streak_5', {}, 1);
      } else if (result.streak > 0 && result.streak % 3 === 0) {
        audio.play('streak');
        void this.game.voice.say(q.speaker, 'streak_3', {}, 1);
      }
      if (result.promoted) {
        this.game.toaster.toast(S('edu.tierUp', { topic: S(C().content.topics.get(q.topicId)?.topicNameKey ?? '') }));
      }
    }
    const p = save.mastery[q.topicId];
    if (p) {
      const stars = starsForXp(p.xp, cfg);
      if (result.starEarned) {
        this.game.toaster.toast(`⭐ ${S('edu.masteryStar', { topic: S(C().content.topics.get(q.topicId)?.topicNameKey ?? '') })}`);
        bus.emit('MasteryChanged', { topicId: q.topicId, stars, xp: p.xp });
      }
    }
  }

  /** Record a non-quickfire learning action (sorting an item, testing a build…). */
  recordRaw(topicId: string, correct: boolean, firstTry: boolean, speaker = 'kenji'): void {
    const q: RuntimeQuestion = {
      defId: 'raw',
      topicId,
      tier: this.tierFor(topicId),
      text: '',
      answer: '',
      options: [],
      hint: '',
      explain: '',
      speaker,
    };
    this.applyAnswer(q, correct, firstTry);
  }

  topicsWithStars(): number {
    const save = C().save.current;
    if (!save) return 0;
    const cfg = C().content.config.education;
    let n = 0;
    for (const p of Object.values(save.mastery)) if (starsForXp(p.xp, cfg) >= 1) n++;
    return n;
  }

  weakTopicIds(count: number): string[] {
    const save = C().save.current;
    if (!save) return [];
    return weakestTopics(save, [...C().content.topics.keys()], count);
  }

  // ----------------------------------------------------------------- tasks
  startTask(taskRef: string): void {
    const task = C().content.tasks.get(taskRef);
    if (!task) return;
    this.stopActive();
    const factory = registry.get(task.archetype);
    if (!factory) {
      console.warn(`[edu] no archetype module '${task.archetype}'`);
      return;
    }
    const station = this.game.level?.stations.find((s) => s.taskRef === taskRef) ?? null;
    const placement = this.game.level?.def.tasks?.find((t) => t.ref === taskRef);
    const origin = station ? station.position.clone() : this.game.player.position.clone();
    const ctx: TaskCtx = {
      game: this.game,
      engine: this,
      task,
      tier: this.tierFor(task.topicId),
      station,
      origin,
      forwardDeg: placement?.faceDeg ?? 0,
      finish: (completed) => this.finishTask(ctx, completed),
    };
    this.activeTaskDef = task;
    const active = factory(ctx);
    this.active = active;
    this.taskOpen = active.modal;
    bus.emit('TaskStarted', { taskId: task.id, archetype: task.archetype });
  }

  private finishTask(ctx: TaskCtx, completed: boolean): void {
    const task = ctx.task;
    if (completed) {
      audio.play('correct');
      bus.emit('TaskCompleted', { taskId: task.id, archetype: task.archetype });
      void this.game.voice.say(task.companion, 'task_complete', {}, 2);
      if (ctx.station) ctx.station.done = true;
      const reward = task.reward;
      if (reward?.brainPower) this.game.addBrainPower(reward.brainPower);
      if (reward?.gadgetId) {
        const save = C().save.current;
        if (save && !save.gadgets.includes(reward.gadgetId)) {
          save.gadgets.push(reward.gadgetId);
          this.game.toaster.banner(`🥾 ${S(`gadget.${reward.gadgetId}.name`)}`);
          this.game.toaster.toast(S(`gadget.${reward.gadgetId}.got`), 3400);
          bus.emit('GadgetBuilt', { gadgetId: reward.gadgetId });
        }
      }
      if (reward?.fossilId) {
        window.setTimeout(() => this.game.awardFossil(reward.fossilId!), 500);
      }
      this.game.persistNow();
    }
    this.stopActive();
  }

  stopActive(): void {
    this.active?.dispose();
    this.active = null;
    this.activeTaskDef = null;
    this.taskOpen = false;
  }

  updateWorldTasks(dt: number): void {
    this.active?.update?.(dt);
  }
  notifyStomp(pos: THREE.Vector3): void {
    this.active?.onStomp?.(pos);
  }
  notifyChomp(): void {
    this.active?.onChomp?.();
  }

  // ------------------------------------------------------ café & quiz orbs
  openCafe(freedIds: string[]): void {
    // implemented by the cafe archetype module (registered as 'cafe')
    const factory = registry.get('cafe');
    if (!factory) return;
    this.stopActive();
    const ctx: TaskCtx = {
      game: this.game,
      engine: this,
      task: { id: 'cafe', archetype: 'quickfire', titleKey: 'cafe.title', topicId: freedIds[0] ?? '', companion: 'digger' },
      tier: 1,
      station: null,
      origin: this.game.player.position.clone(),
      forwardDeg: 0,
      finish: () => this.stopActive(),
    };
    const active = factory(ctx);
    this.active = active;
    this.taskOpen = active.modal;
  }

  /** Quiz Orb caught mid-combat (§4.3): one quick question, big reward. */
  quizOrb(): void {
    const factory = registry.get('quizorb');
    if (!factory) return;
    this.stopActive();
    const ctx: TaskCtx = {
      game: this.game,
      engine: this,
      task: { id: 'quizorb', archetype: 'quickfire', titleKey: 'ui.quizOrbPrompt', topicId: '', companion: 'kenji' },
      tier: 1,
      station: null,
      origin: this.game.player.position.clone(),
      forwardDeg: 0,
      finish: () => this.stopActive(),
    };
    const active = factory(ctx);
    this.active = active;
    this.taskOpen = active.modal;
  }
}
