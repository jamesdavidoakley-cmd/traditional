/**
 * Ambient companion banter (§3.6.5): paired lines during quiet exploration,
 * at most once per banterCooldownSecs, never over other speech.
 */
import { getContent } from '../../engine/loader';
import type { VoiceDirector } from './voice';
import type { SpeakerRigControl } from './cutscene';

export class BanterScheduler {
  private cooldown: number;
  private seen = new Set<string>();
  private running = false;
  private idleT = 0;

  constructor(
    private voice: VoiceDirector,
    private rigs: SpeakerRigControl,
  ) {
    this.cooldown = getContent().config.dialogue.banterCooldownSecs * 0.45; // first banter arrives sooner
  }

  /** quiet = exploring, no combat, no menus. */
  update(dt: number, worldId: string, quiet: boolean, playerIdle: boolean): 'idle_nudge' | null {
    if (!quiet || this.voice.speaking || this.running) {
      this.idleT = 0;
      return null;
    }
    const cfg = getContent().config.dialogue;
    this.cooldown -= dt;
    if (playerIdle) this.idleT += dt;
    else this.idleT = 0;

    if (this.idleT > cfg.idleNudgeSecs) {
      this.idleT = 0;
      return 'idle_nudge';
    }
    if (this.cooldown <= 0) {
      this.playOne(worldId);
      this.cooldown = cfg.banterCooldownSecs;
    }
    return null;
  }

  private playOne(worldId: string): void {
    const banter = getContent().banter;
    if (!banter) return;
    const eligible = banter.pairs.filter(
      (p) => (!p.worlds || p.worlds.includes(worldId)) && !this.seen.has(p.id),
    );
    const pool = eligible.length > 0 ? eligible : banter.pairs.filter((p) => !p.worlds || p.worlds.includes(worldId));
    if (pool.length === 0) return;
    const pair = pool[Math.floor(Math.random() * pool.length)];
    this.seen.add(pair.id);
    this.running = true;
    void (async () => {
      for (const line of pair.lines) {
        this.rigs.setTalking(line.speaker, true);
        await this.voice.sayText(line.speaker, line.text, 1, `banter:${pair.id}`);
        this.rigs.setTalking(line.speaker, false);
      }
      this.running = false;
    })();
  }
}
