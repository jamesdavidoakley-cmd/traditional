/**
 * Typed event bus — the only way systems talk to each other.
 * Education, dialogue, mastery, UI and audio all subscribe here;
 * none of them reach into each other directly (§2.3).
 */

export interface GameEvents {
  // Collectibles & economy
  FossilCollected: { fossilId: string; worldId: string; total: number };
  ChipCollected: { worldId: string; worldTotal: number };
  BonusFossilEarned: { worldId: string };
  BrainPowerChanged: { segments: number; max: number };
  SecretFound: { id: string; worldId: string };

  // Education
  QuestionAsked: { topicId: string; tier: number; taskId: string };
  QuestionAnswered: { topicId: string; correct: boolean; tier: number; firstTry: boolean; taskId: string };
  TaskStarted: { taskId: string; archetype: string };
  TaskCompleted: { taskId: string; archetype: string };
  MasteryChanged: { topicId: string; stars: number; xp: number };
  StreakChanged: { streak: number };

  // Combat
  PlayerDamaged: { amount: number; hp: number; source: string };
  PlayerHealed: { amount: number; hp: number };
  PlayerDizzy: Record<string, never>;
  EnemyDefeated: { enemyId: string; archetype: string };
  BossPhaseChanged: { bossId: string; phase: number };
  BossDefeated: { bossId: string };
  BossFightStarted: { bossId: string };
  ChampionFreed: { bossId: string };
  QuizOrbCaught: { worldId: string };

  // World & flow
  WorldEntered: { worldId: string };
  WorldLeft: { worldId: string };
  DoorUnlocked: { worldId: string };
  CheckpointReached: { id: string };
  GadgetBuilt: { gadgetId: string };
  CutsceneStarted: { id: string };
  CutsceneEnded: { id: string };
  GameSaved: { slot: number };

  // Dialogue
  LineSpoken: { speaker: string; text: string; poolKey: string };
}

export type EventName = keyof GameEvents;
type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

class EventBus {
  private handlers = new Map<EventName, Set<Handler<EventName>>>();

  on<K extends EventName>(name: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn as Handler<EventName>);
    return () => this.off(name, fn);
  }

  once<K extends EventName>(name: K, fn: Handler<K>): void {
    const off = this.on(name, (p) => {
      off();
      fn(p);
    });
  }

  off<K extends EventName>(name: K, fn: Handler<K>): void {
    this.handlers.get(name)?.delete(fn as Handler<EventName>);
  }

  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        (fn as Handler<K>)(payload);
      } catch (err) {
        console.error(`[events] handler for ${name} threw`, err);
      }
    }
  }

  /** Removes every handler — used between save-slot loads and in tests. */
  reset(): void {
    this.handlers.clear();
  }
}

export const bus = new EventBus();
