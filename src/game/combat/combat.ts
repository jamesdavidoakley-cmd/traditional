/**
 * Combat (§6): Clockwork Legion enemies with personality noise, the boss
 * runtime driving BossBrain decisions into 3D, arena flow with barriers,
 * Quiz Orbs, projectiles, roar stuns. Defeated champions are FREED —
 * bonks, dizzy stars and confetti, never destruction.
 */
import * as THREE from 'three';
import type { Game } from '../game';
import { C } from '../ctx';
import { S } from '../../engine/loader';
import { audio } from '../../engine/audio';
import { music } from '../../engine/music';
import { bus } from '../../engine/events';
import { buildCogling, buildChampion, type Rig } from '../rigs';
import { BossBrain, type BrainContext, type DistanceBand } from '../ai/boss-brain';
import { makeRng, type Rng } from '../../engine/math';
import type { ArenaDef, BossDef, EnemyDef, MoveDef, TriggerDef } from '../content-types';
import type { Level } from '../world/level';
import { makeTextLabel } from '../world/generators';
import { toonMat } from '../../engine/renderer';
import { clamp01, damp, dampAngle } from '../../engine/math';

const upVec = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------ projectiles
class Projectile {
  mesh: THREE.Mesh;
  constructor(
    public pos: THREE.Vector3,
    public vel: THREE.Vector3,
    public fromPlayer: boolean,
    public damage: number,
    scene: THREE.Scene,
    colour: string,
  ) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshToonMaterial({ color: colour, emissive: '#442200' }));
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
  }
  update(dt: number): void {
    this.vel.y -= 14 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += dt * 8;
  }
  dispose(): void {
    this.mesh.removeFromParent();
  }
}

// --------------------------------------------------------------- enemies
type EnemyState = 'patrol' | 'aggro' | 'windup' | 'attack' | 'recover' | 'flee' | 'stunned' | 'dizzy' | 'captured';

export class EnemyEntity {
  rig: Rig;
  pos: THREE.Vector3;
  yaw = 0;
  hp: number;
  state: EnemyState = 'patrol';
  private t = 0;
  private stateT = 0;
  private wanderTarget: THREE.Vector3;
  private telegraphSprite: THREE.Sprite;
  private speedMul: number;
  aggro = false;
  private lastSpinId = -1;
  private healBeam: THREE.Line | null = null;

  constructor(
    public def: EnemyDef,
    public spawn: THREE.Vector3,
    private game: Game,
    rng: Rng,
  ) {
    this.pos = spawn.clone();
    this.wanderTarget = spawn.clone();
    this.hp = def.hp;
    // spawn-time personality noise (§6.2) — no two individuals identical
    this.speedMul = 1 + (rng() * 2 - 1) * 0.18;
    this.rig = buildCogling(def.behaviour === 'tinkerer' ? 'tinkerer' : def.behaviour === 'brute' ? 'brute' : 'scout', def.colour, def.accent ?? '#c9ccd8');
    if (def.scale) this.rig.root.scale.multiplyScalar(def.scale);
    C().renderer.scene.add(this.rig.root);
    C().renderer.addOutline(this.rig.root);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.font = '700 52px Verdana';
    g.textAlign = 'center';
    g.fillStyle = '#ffdd44';
    g.strokeStyle = '#2a2440';
    g.lineWidth = 8;
    g.strokeText('!', 32, 52);
    g.fillText('!', 32, 52);
    const tex = new THREE.CanvasTexture(c);
    this.telegraphSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    this.telegraphSprite.scale.setScalar(0.9);
    this.telegraphSprite.visible = false;
    this.telegraphSprite.position.y = 1.6;
    this.rig.root.add(this.telegraphSprite);
  }

  get alive(): boolean {
    return this.hp > 0 && this.state !== 'captured';
  }

  damage(n: number, from: THREE.Vector3, spinId = -1): boolean {
    if (!this.alive) return false;
    if (spinId >= 0 && spinId === this.lastSpinId) return false;
    this.lastSpinId = spinId;
    this.hp -= n;
    audio.play('hit');
    this.game.hitPause(60);
    C().particles.sparks(this.pos.clone().add(upVec), '#ffd75e');
    const kb = this.pos.clone().sub(from).setY(0).normalize().multiplyScalar(2.2);
    this.pos.add(kb);
    if (this.hp <= 0) {
      this.defeat();
    } else {
      this.aggroNow();
      if (this.def.behaviour === 'scout' && this.hp <= (this.def.fleeAtHp ?? 1)) {
        this.state = 'flee';
        this.stateT = 4;
      }
    }
    return true;
  }

  private defeat(): void {
    audio.play('bossHit');
    C().particles.confetti(this.pos.clone().add(upVec));
    C().particles.burst(this.pos, { count: 14, colours: ['#9aa3b8', '#B8863B'], speed: 5, life: 0.6 });
    bus.emit('EnemyDefeated', { enemyId: this.def.id, archetype: this.def.behaviour });
    // drops
    const lvl = this.game.level;
    if (lvl) {
      if (Math.random() < C().content.config.economy.heartDropChance) lvl.dropHeart(this.pos);
    }
    this.rig.root.removeFromParent();
    this.healBeam?.removeFromParent();
  }

  capture(): boolean {
    if (this.def.behaviour !== 'scout' || !this.alive) return false;
    this.state = 'captured';
    this.rig.root.removeFromParent();
    C().particles.burst(this.pos, { count: 8, colours: ['#ffffff'], speed: 2, life: 0.3 });
    return true;
  }

  stun(secs: number): void {
    if (!this.alive) return;
    this.state = 'stunned';
    this.stateT = secs;
    this.telegraphSprite.visible = false;
  }

  aggroNow(): void {
    if (this.state === 'patrol') {
      this.state = 'aggro';
      this.aggro = true;
    }
  }

  update(dt: number, allies: EnemyEntity[]): void {
    if (!this.alive) return;
    this.t += dt;
    const player = this.game.player;
    const toPlayer = player.position.clone().sub(this.pos);
    const dist = toPlayer.length();
    const def = this.def;
    let moveDir: THREE.Vector3 | null = null;
    let speed = def.speed * this.speedMul;
    let animMode: Parameters<Rig['update']>[1]['mode'] = 'idle';

    switch (this.state) {
      case 'patrol': {
        if (dist < def.aggroRange) {
          this.aggroNow();
          break;
        }
        if (this.pos.distanceTo(this.wanderTarget) < 0.5 || this.t % 5 < dt) {
          const a = Math.random() * Math.PI * 2;
          this.wanderTarget = this.spawn.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
        }
        moveDir = this.wanderTarget.clone().sub(this.pos).setY(0);
        speed *= 0.4;
        break;
      }
      case 'aggro': {
        this.aggro = true;
        if (def.behaviour === 'scout') {
          // keep distance, lob bolts
          if (dist < 5.5) moveDir = toPlayer.clone().negate().setY(0);
          else if (dist > 9.5) moveDir = toPlayer.clone().setY(0);
          if (this.t % 3.2 < dt && dist < 14) {
            this.state = 'windup';
            this.stateT = Math.max(0.6, 0.7);
            this.telegraphSprite.visible = true;
            audio.play('quizOrb');
          }
        } else if (def.behaviour === 'brute') {
          moveDir = toPlayer.clone().setY(0);
          if (dist < def.attackRange) {
            this.state = 'windup';
            this.stateT = this.game.telegraphSecs(0.9);
            this.telegraphSprite.visible = true;
            audio.play('quizOrb');
          }
        } else if (def.behaviour === 'tinkerer') {
          // stick near allies; repair them
          const hurt = allies.find((a) => a !== this && a.alive && a.hp < a.def.hp && a.pos.distanceTo(this.pos) < 8);
          const buddy = hurt ?? allies.find((a) => a !== this && a.alive && a.pos.distanceTo(this.pos) < 12);
          if (hurt) {
            if (this.pos.distanceTo(hurt.pos) > 2.5) moveDir = hurt.pos.clone().sub(this.pos).setY(0);
            else if (this.t % 2 < dt) {
              hurt.hp = Math.min(hurt.def.hp, hurt.hp + 1);
              C().particles.sparks(hurt.pos.clone().add(upVec), '#7dff8a');
              audio.play('gear');
            }
          } else if (buddy) {
            const behind = buddy.pos.clone().add(buddy.pos.clone().sub(player.position).setY(0).normalize().multiplyScalar(2));
            moveDir = behind.sub(this.pos).setY(0);
          } else {
            moveDir = toPlayer.clone().negate().setY(0); // cower away
          }
        }
        if (dist > def.aggroRange * 2.2) {
          this.state = 'patrol';
          this.aggro = false;
        }
        break;
      }
      case 'windup': {
        this.stateT -= dt;
        animMode = 'attack';
        if (this.stateT <= 0) {
          this.telegraphSprite.visible = false;
          if (def.behaviour === 'scout') {
            // lob a bolt
            const dir = toPlayer.clone().normalize();
            const v = dir.multiplyScalar(9);
            v.y = 5.5;
            this.game.combat.spawnProjectile(this.pos.clone().add(upVec), v, false, def.damage, '#c9a24a');
            audio.play('spit');
            this.state = 'aggro';
          } else {
            // brute swing
            this.state = 'attack';
            this.stateT = 0.25;
            audio.play('spin');
            if (dist < def.attackRange * 1.2) {
              this.game.damagePlayer(def.damage, def.id);
            } else {
              // missed — dizzy punish window (§6.2)
              this.state = 'dizzy';
              this.stateT = 1.7;
              audio.play('dizzy');
            }
          }
        }
        break;
      }
      case 'attack': {
        this.stateT -= dt;
        animMode = 'attack';
        if (this.stateT <= 0) this.state = 'aggro';
        break;
      }
      case 'flee': {
        this.stateT -= dt;
        moveDir = toPlayer.clone().negate().setY(0);
        speed *= 1.3;
        // alert friends (§6.2)
        for (const a of allies) {
          if (a !== this && a.alive && a.pos.distanceTo(this.pos) < 8) a.aggroNow();
        }
        if (this.stateT <= 0) this.state = 'aggro';
        break;
      }
      case 'stunned':
      case 'dizzy': {
        this.stateT -= dt;
        animMode = 'dizzy';
        this.rig.setExpression('dizzy');
        if (this.stateT <= 0) {
          this.state = 'aggro';
          this.rig.setExpression('normal');
        }
        break;
      }
      case 'recover':
      case 'captured':
        break;
    }

    // movement + ground snap
    if (moveDir && moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
      this.pos.addScaledVector(moveDir, speed * dt);
      this.yaw = dampAngle(this.yaw, Math.atan2(moveDir.x, moveDir.z), 8, dt);
      animMode = 'run';
    } else if (this.state === 'aggro' || this.state === 'windup') {
      this.yaw = dampAngle(this.yaw, Math.atan2(toPlayer.x, toPlayer.z), 6, dt);
    }
    const probe = new THREE.Vector3(this.pos.x, this.pos.y + 2.5, this.pos.z);
    const g = C().physics.groundBelow(probe, 20);
    if (isFinite(g)) this.pos.y = damp(this.pos.y, probe.y - g, 14, dt);

    // contact damage
    if (this.alive && dist < def.radius + 0.7 && this.state !== 'dizzy' && this.state !== 'stunned') {
      this.game.damagePlayer(C().content.config.combat.contactDamage, def.id);
    }

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.update(dt, { mode: animMode, speed: animMode === 'run' ? 0.8 : 0, talking: false, actionT: this.state === 'windup' ? 1 - this.stateT : 0 });
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.healBeam?.removeFromParent();
  }
}

// ------------------------------------------------------------------ boss
type BossMoveExec = {
  move: MoveDef;
  phase: 'windup' | 'active' | 'recover';
  t: number;
  feinted?: boolean;
};

export class BossEntity {
  rig: Rig;
  pos: THREE.Vector3;
  yaw = 0;
  hp: number;
  brain: BossBrain;
  private exec: BossMoveExec | null = null;
  private decideT = 0.8;
  private stunT = 0;
  talking = false;
  defending = false;
  shielded = false;
  private vulnerableT = 0;
  private lowHpSaid = false;
  private habitWindow: string[] = [];
  private bandHeld = 0;
  private lastBand: DistanceBand = 1;
  playerStreak = 0;
  private threatEvents: { t: number; dmg: number }[] = [];
  private playerDamageEvents: { t: number; dmg: number }[] = [];
  private t = 0;
  private telegraphRing: THREE.Mesh;
  private shieldBubble: THREE.Mesh;
  private velY = 0;
  private lungeVel = new THREE.Vector3();
  phaseStartHp: number;

  constructor(
    public def: BossDef,
    spawn: THREE.Vector3,
    private game: Game,
    public arena: ArenaDef,
  ) {
    this.pos = spawn.clone();
    this.hp = def.hp;
    this.phaseStartHp = def.hp;
    const moveset = C().content.movesets.get(def.moveset.replace(/\.json$/, ''))!;
    const noise = def.randomTraits ? C().content.config.ai.traitNoise : 0;
    this.brain = new BossBrain(def, moveset, C().content.config.ai, makeRng(Math.floor(Math.random() * 1e9)), noise);
    this.rig = buildChampion(def.id, def.colour, def.accent ?? '#c9a24a', def.scale ?? 1);
    C().renderer.scene.add(this.rig.root);
    C().renderer.addOutline(this.rig.root);
    this.telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.05, 32),
      new THREE.MeshBasicMaterial({ color: '#ff5e5e', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.telegraphRing.rotation.x = -Math.PI / 2;
    C().renderer.scene.add(this.telegraphRing);
    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 18, 14),
      new THREE.MeshBasicMaterial({ color: '#7fe0d4', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.shieldBubble.visible = false;
    C().renderer.scene.add(this.shieldBubble);
    if (def.gimmick === 'gear_shield_puzzle') this.shielded = true;
  }

  get alive(): boolean {
    return this.hp > 0;
  }
  get maxHp(): number {
    return this.def.hp;
  }
  get phase(): number {
    if (this.def.phases <= 1) return 1;
    const frac = this.hp / this.def.hp;
    return frac > 2 / 3 ? 1 : frac > 1 / 3 || this.def.phases < 3 ? Math.min(2, this.def.phases) : 3;
  }

  recordPlayerAction(id: string): void {
    this.habitWindow.push(id);
    if (this.habitWindow.length > C().content.config.ai.habitWindow) this.habitWindow.shift();
  }

  damage(n: number, from: THREE.Vector3, isStomp = false): boolean {
    if (!this.alive) return false;
    if (this.shielded) {
      audio.play('doorLocked');
      C().particles.sparks(this.pos.clone().add(upVec), '#7fe0d4');
      return false;
    }
    if (this.defending && !isStomp) {
      audio.play('doorLocked');
      C().particles.sparks(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#c9ccd8');
      this.game.voice.bark(this.def.id, 'hit_react', {}, 1);
      return false;
    }
    const mult = this.vulnerableT > 0 ? 2 : 1;
    const phaseBefore = this.phase;
    this.hp -= n * mult;
    this.playerStreak++;
    audio.play('bossHit');
    this.game.hitPause(80);
    C().particles.sparks(this.pos.clone().add(upVec), '#ffd75e');
    C().renderer.shake(0.4);
    const kb = this.pos.clone().sub(from).setY(0).normalize().multiplyScalar(1.2);
    this.pos.add(kb);
    if (Math.random() < 0.4) this.game.voice.bark(this.def.id, 'hit_react', {}, 1);
    if (!this.lowHpSaid && this.hp / this.def.hp < 0.3) {
      this.lowHpSaid = true;
      void this.game.voice.say(this.def.id, 'low_hp', {}, 2);
      const who = ['kenji', 'marcus', 'digger'][Math.floor(Math.random() * 3)];
      this.game.voice.bark(who, 'boss_low_hp', {}, 2);
    }
    if (this.alive && this.phase !== phaseBefore) {
      this.phaseStartHp = this.hp;
      this.stunT = Math.max(this.stunT, 1.2);
      bus.emit('BossPhaseChanged', { bossId: this.def.id, phase: this.phase });
      this.game.toaster.banner(S('bossui.phase', { n: this.phase }), 1800);
      this.brain.setPhase(this.phase);
      if (this.def.gimmick === 'gear_shield_puzzle') {
        this.shielded = true; // shield re-arms each phase — solve the cogs again
        this.game.voice.bark(this.def.id, 'taunt_mid', {}, 2);
      }
    }
    return true;
  }

  /** Explorer kindness: on player dizzy, boss resets only to phase start. */
  resetForRetry(explorer: boolean): void {
    this.hp = explorer ? this.phaseStartHp : this.def.hp;
    this.exec = null;
    this.stunT = 0;
    this.playerStreak = 0;
    if (this.def.gimmick === 'gear_shield_puzzle') this.shielded = true;
  }

  stun(secs: number): void {
    this.stunT = Math.max(this.stunT, secs);
    this.exec = null;
    this.defending = false;
  }

  breakShield(): void {
    this.shielded = false;
    audio.play('shieldBreak');
    C().particles.burst(this.pos.clone().add(upVec), { count: 30, colours: ['#7fe0d4', '#ffffff'], speed: 6, life: 0.7 });
  }

  private brainCtx(): BrainContext {
    const player = this.game.player;
    const dist = this.pos.distanceTo(player.position);
    const band: DistanceBand = dist < 3.2 ? 0 : dist < 8 ? 1 : 2;
    if (band === this.lastBand) this.bandHeld += 0;
    const now = this.t;
    const window = C().content.config.ai.threatBudgetWindow;
    this.threatEvents = this.threatEvents.filter((e) => now - e.t < window);
    this.playerDamageEvents = this.playerDamageEvents.filter((e) => now - e.t < window * 2);
    return {
      selfHp: clamp01(this.hp / this.def.hp),
      playerHp: clamp01(this.game.hearts / this.game.maxHearts),
      band,
      bandHeldSecs: this.bandHeld,
      playerHabits: [...this.habitWindow],
      playerStreak: this.playerStreak,
      timeSinceFightStart: this.t,
      recentThreat: this.threatEvents.reduce((a, b) => a + b.dmg, 0),
      playerRecentDamage: this.playerDamageEvents.reduce((a, b) => a + b.dmg, 0),
    };
  }

  notePlayerDamaged(dmg: number): void {
    this.threatEvents.push({ t: this.t, dmg });
    this.playerDamageEvents.push({ t: this.t, dmg });
    this.playerStreak = 0;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.t += dt;
    const player = this.game.player;
    const toPlayer = player.position.clone().sub(this.pos);
    const dist = toPlayer.length();
    const band: DistanceBand = dist < 3.2 ? 0 : dist < 8 ? 1 : 2;
    if (band === this.lastBand) this.bandHeld += dt;
    else {
      this.lastBand = band;
      this.bandHeld = 0;
    }
    this.vulnerableT = Math.max(0, this.vulnerableT - dt);

    let animMode: Parameters<Rig['update']>[1]['mode'] = 'idle';
    let actionT = 0;

    if (this.stunT > 0) {
      this.stunT -= dt;
      animMode = 'dizzy';
      this.rig.setExpression('dizzy');
    } else {
      this.rig.setExpression(this.hp / this.def.hp < 0.3 ? 'surprised' : 'determined');
      // ability triggers (data-driven, §6.3)
      const fired = this.brain.tickAbilities(dt, this.brainCtx());
      for (const a of fired) this.game.combat.runBossAbility(this, a.effect);

      if (this.exec) {
        this.execMove(dt, dist, toPlayer);
        animMode = this.exec?.phase === 'recover' ? (this.vulnerableT > 0 ? 'dizzy' : 'idle') : 'attack';
        actionT = this.execProgress();
      } else {
        this.decideT -= dt;
        // drift: face player, keep natural spacing
        this.yaw = dampAngle(this.yaw, Math.atan2(toPlayer.x, toPlayer.z), 5, dt);
        if (this.decideT <= 0) {
          const cfg = C().content.config.ai;
          this.decideT = cfg.decisionIntervalMin + Math.random() * (cfg.decisionIntervalMax - cfg.decisionIntervalMin);
          const decision = this.brain.decide(this.brainCtx());
          this.startMove(decision.move);
        }
      }
    }

    // simple gravity/ground snap
    const probe = new THREE.Vector3(this.pos.x, this.pos.y + 2.5, this.pos.z);
    const g = C().physics.groundBelow(probe, 20);
    if (isFinite(g)) this.pos.y = damp(this.pos.y, probe.y - g, 16, dt);
    // stay inside arena
    const toCenter = new THREE.Vector3(this.arena.center[0] - this.pos.x, 0, this.arena.center[2] - this.pos.z);
    const rDist = Math.hypot(toCenter.x, toCenter.z);
    if (rDist > this.arena.radius - 1.5) {
      this.pos.addScaledVector(toCenter.normalize(), (rDist - (this.arena.radius - 1.5)));
    }

    // contact damage
    if (dist < 1.35 && this.exec?.phase !== 'recover' && this.stunT <= 0) {
      if (this.game.damagePlayer(this.def.contactDamage ?? 0.5, this.def.id)) {
        this.notePlayerDamaged(this.def.contactDamage ?? 0.5);
      }
    }

    this.shieldBubble.visible = this.shielded;
    this.shieldBubble.position.copy(this.pos).add(new THREE.Vector3(0, 1.1, 0));
    this.shieldBubble.rotation.y = this.t * 0.6;

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    this.rig.update(dt, {
      mode: this.talking ? 'talk' : this.defending ? 'block' : animMode,
      speed: this.lungeVel.length() > 1 ? 0.8 : 0,
      talking: this.talking,
      actionT,
    });
  }

  private execProgress(): number {
    const e = this.exec;
    if (!e) return 0;
    const total = e.phase === 'windup' ? this.windupFor(e.move) : e.phase === 'active' ? e.move.active : e.move.recover;
    return total > 0 ? clamp01(1 - e.t / total) : 1;
  }

  private windupFor(move: MoveDef): number {
    const cfg = C().content.config.combat;
    const explorer = (C().save.current?.difficulty ?? 'explorer') === 'explorer';
    const base = Math.max(move.windup, move.damage ? cfg.telegraphMinSecs : move.windup);
    return explorer && move.damage ? base * cfg.explorerWindupMul : base;
  }

  private startMove(move: MoveDef): void {
    this.exec = { move, phase: 'windup', t: this.windupFor(move) };
    this.defending = false;
    if (move.tags.includes('flourish')) {
      this.game.voice.bark(this.def.id, 'taunt_mid', {}, 1);
    }
    if (move.damage && this.windupFor(move) >= 0.4) {
      // paired audio + visual telegraph — never colour-only (§6.1)
      audio.play('quizOrb');
      const mat = this.telegraphRing.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.85;
      this.telegraphRing.scale.setScalar(Math.max(1.4, (move.bandWeights[0] > 0.5 ? 2.4 : 3.6)));
    }
  }

  private execMove(dt: number, dist: number, toPlayer: THREE.Vector3): void {
    const e = this.exec!;
    e.t -= dt;
    const move = e.move;
    const mat = this.telegraphRing.material as THREE.MeshBasicMaterial;
    this.telegraphRing.position.copy(this.pos).add(new THREE.Vector3(0, 0.05, 0));

    if (e.phase === 'windup') {
      this.yaw = dampAngle(this.yaw, Math.atan2(toPlayer.x, toPlayer.z), move.tags.includes('feint') ? 12 : 4, dt);
      mat.opacity = 0.4 + 0.5 * Math.abs(Math.sin(this.t * 10));
      if (e.t <= 0) {
        e.phase = 'active';
        e.t = move.active;
        mat.opacity = 0;
        this.applyMoveActive(move, dist, toPlayer);
      }
      return;
    }
    if (e.phase === 'active') {
      if (move.motion === 'lunge' || move.motion === 'chase') {
        this.pos.addScaledVector(this.lungeVel, dt);
      } else if (move.motion === 'stepback') {
        this.pos.addScaledVector(this.lungeVel, dt);
      } else if (move.motion === 'circle') {
        const side = new THREE.Vector3(toPlayer.z, 0, -toPlayer.x).normalize();
        this.pos.addScaledVector(side, (this.def.speed ?? 3.4) * dt);
        this.yaw = dampAngle(this.yaw, Math.atan2(toPlayer.x, toPlayer.z), 8, dt);
      }
      if (move.tags.includes('defend')) this.defending = true;
      // strike check at the midpoint of active frames
      if (move.damage && !e.feinted && e.t <= move.active * 0.6) {
        e.feinted = true; // reuse flag as "strike resolved"
        const reach = move.bandWeights[2] > 0.5 ? 20 : move.bandWeights[0] > 0.5 ? 2.6 : 4.2;
        if (move.projectile) {
          const dir = toPlayer.clone().normalize();
          const v = dir.multiplyScalar(11);
          v.y = 4;
          this.game.combat.spawnProjectile(this.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), v, false, move.damage, '#a85c32');
          audio.play('spit');
        } else if (dist < reach) {
          if (this.game.damagePlayer(move.damage, this.def.id)) {
            this.notePlayerDamaged(move.damage);
          }
          audio.play('spin');
        } else {
          audio.play('spin');
        }
      }
      if (e.t <= 0) {
        e.phase = 'recover';
        e.t = move.recover;
        this.lungeVel.set(0, 0, 0);
        // heavy misses leave an opening — the classic tell (Bruno's combo, §6.7)
        if ((move.tags.includes('combo') || move.tags.includes('heavy')) && move.recover >= 1.2) {
          this.vulnerableT = move.recover;
        }
      }
      return;
    }
    // recover
    this.defending = this.defending && move.tags.includes('defend') && e.t > 0;
    if (e.t <= 0) {
      this.exec = null;
      this.defending = false;
    }
  }

  private applyMoveActive(move: MoveDef, dist: number, toPlayer: THREE.Vector3): void {
    const dir = toPlayer.clone().setY(0).normalize();
    switch (move.motion) {
      case 'lunge':
        this.lungeVel.copy(dir).multiplyScalar(Math.min(11, Math.max(5, dist * 2.2)));
        break;
      case 'chase':
        this.lungeVel.copy(dir).multiplyScalar(this.def.speed ?? 4);
        break;
      case 'stepback':
        this.lungeVel.copy(dir).multiplyScalar(-5);
        break;
      default:
        this.lungeVel.set(0, 0, 0);
    }
    if (move.tags.includes('feint')) {
      // dart sideways instead of committing — trickery made visible
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(Math.random() < 0.5 ? 6 : -6);
      this.lungeVel.add(side);
    }
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.telegraphRing.removeFromParent();
    this.shieldBubble.removeFromParent();
  }
}

// ------------------------------------------------------------ the system
export class CombatSystem {
  enemies: EnemyEntity[] = [];
  boss: BossEntity | null = null;
  private projectiles: Projectile[] = [];
  private quizOrbs: { mesh: THREE.Mesh; angle: number; taken: boolean }[] = [];
  private arenaBarrier: THREE.Group | null = null;
  private activeArena: ArenaDef | null = null;
  private victoryRunning = false;
  private spinId = 0;
  private mouthful = false;
  private gimmickStation: { mesh: THREE.Group; solved: boolean } | null = null;
  private rng = makeRng(1337);

  constructor(private game: Game) {
    bus.on('PlayerDamaged', ({ amount }) => this.boss?.notePlayerDamaged(amount));
  }

  get inCombat(): boolean {
    return this.boss !== null || this.enemies.some((e) => e.alive && e.aggro);
  }

  clear(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    this.endArena(false);
    for (const p of this.projectiles) p.dispose();
    this.projectiles = [];
    this.mouthful = false;
  }

  spawnFromLevel(level: Level): void {
    for (const spawn of level.def.enemies ?? []) {
      const def = C().content.enemies.get(spawn.ref);
      if (!def) continue;
      this.enemies.push(new EnemyEntity(def, new THREE.Vector3(...spawn.pos), this.game, this.rng));
    }
  }

  spawnProjectile(pos: THREE.Vector3, vel: THREE.Vector3, fromPlayer: boolean, damage: number, colour: string): void {
    this.projectiles.push(new Projectile(pos, vel, fromPlayer, damage, C().renderer.scene, colour));
  }

  telegraph(secs: number): number {
    return this.game.telegraphSecs(secs);
  }

  // ------------------------------------------------------------- arenas
  arenaGateTouched(trigger: TriggerDef): void {
    const arenaId = (trigger.data as { arenaId?: string } | undefined)?.arenaId;
    const arena = this.game.level?.def.arenas?.find((a) => a.id === arenaId);
    if (!arena || this.activeArena) return;
    const bossDef = C().content.bosses.get(arena.bossRef);
    if (!bossDef) return;
    this.startArena(arena, bossDef);
  }

  private startArena(arena: ArenaDef, bossDef: BossDef): void {
    this.activeArena = arena;
    const center = new THREE.Vector3(...arena.center);
    // barrier ring
    const barrier = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 3.4, 8),
        new THREE.MeshToonMaterial({ color: '#7B5CD6', emissive: '#2a1a5a' }),
      );
      post.position.set(center.x + Math.cos(a) * arena.radius, center.y + 1.7, center.z + Math.sin(a) * arena.radius);
      barrier.add(post);
    }
    C().renderer.scene.add(barrier);
    this.arenaBarrier = barrier;

    const spawnPos = center.clone().add(new THREE.Vector3(0, 0, -arena.radius * 0.4));
    this.boss = new BossEntity(bossDef, spawnPos, this.game, arena);
    this.game.cameraRig.lockOnTarget = this.boss.pos;
    music.play(C().content.music.get('boss') ?? null);
    music.setIntensity(1);
    audio.play('doorLocked');
    this.game.setRespawn(new THREE.Vector3(...arena.entrance));
    bus.emit('BossFightStarted', { bossId: bossDef.id });
    this.game.toaster.banner(`${S(bossDef.nameKey)}${bossDef.titleKey ? ' — ' + S(bossDef.titleKey) : ''}`, 3000);
    void this.game.voice.say(bossDef.id, 'boss_intro', {}, 2).then(() => {
      const who = ['kenji', 'marcus', 'digger'][Math.floor(Math.random() * 3)];
      this.game.voice.bark(who, 'boss_intro', {}, 2);
    });

    // quiz orbs orbiting the arena (§4.3 — optional, never forced)
    for (let i = 0; i < (arena.quizOrbs ?? 2); i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 14, 12),
        new THREE.MeshToonMaterial({ color: '#7fe0d4', emissive: '#0a4a44' }),
      );
      C().renderer.scene.add(mesh);
      this.quizOrbs.push({ mesh, angle: (i / (arena.quizOrbs ?? 2)) * Math.PI * 2, taken: false });
    }
    // gear-shield gimmick station at the arena edge (Cogwheel, §6.7)
    if (bossDef.gimmick === 'gear_shield_puzzle') {
      const g = new THREE.Group();
      const pos = arena.gimmickPos?.[0] ? new THREE.Vector3(...arena.gimmickPos[0]) : center.clone().add(new THREE.Vector3(arena.radius * 0.75, 0, 0));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 1, 10), toonMat('#6e5a3a'));
      base.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
      g.add(base);
      const label = makeTextLabel('⚙️ ' + S('fossil.w2-f6.name'));
      label.position.copy(pos).add(new THREE.Vector3(0, 2.6, 0));
      g.add(label);
      C().renderer.scene.add(g);
      this.gimmickStation = { mesh: g, solved: false };
      g.userData.pos = pos;
    }
  }

  /** Interactable for the gear puzzle — surfaced through Game.interactHint. */
  gimmickInteract(): { label: string; act: () => void; pos: THREE.Vector3 } | null {
    if (!this.gimmickStation || !this.boss || !this.boss.shielded) return null;
    const pos = this.gimmickStation.mesh.userData.pos as THREE.Vector3;
    return {
      label: S('ui.interact'),
      pos,
      act: () => this.openGearPuzzle(),
    };
  }

  private openGearPuzzle(): void {
    // three cogs, one gap: which tooth-count meshes both neighbours?
    const driver = [8, 12][Math.floor(Math.random() * 2)];
    const driven = [16, 24][Math.floor(Math.random() * 2)];
    const answer = (driver + driven) / 2;
    const opts = [answer, answer + 4, Math.max(4, answer - 4)].sort(() => Math.random() - 0.5);
    const overlay = document.createElement('div');
    overlay.className = 'overlay-center';
    const panel = document.createElement('div');
    panel.className = 'panel task-panel';
    panel.innerHTML = `<h3>⚙️ ${S('build.gears.title')}</h3><p>The shield generator runs on a ${driver}-tooth and a ${driven}-tooth cog with a gap between. Which middle cog bridges the gap exactly? (Hint: halfway between them!)</p>`;
    const row = document.createElement('div');
    row.className = 'answer-row';
    C().input.uiCaptured = true;
    const close = () => {
      overlay.remove();
      C().input.uiCaptured = false;
    };
    for (const o of opts) {
      const b = document.createElement('button');
      b.className = 'btn primary';
      b.textContent = `${o} teeth`;
      b.addEventListener('click', () => {
        if (o === answer) {
          close();
          this.gimmickStation!.solved = true;
          this.boss?.breakShield();
          this.game.toaster.toast(S('edu.taskComplete'));
          this.game.education.recordRaw('gears', true, true, 'kenji');
          void this.game.voice.say('kenji', 'correct_first_try', {}, 2);
        } else {
          audio.play('incorrect');
          this.game.education.recordRaw('gears', false, true, 'kenji');
          void this.game.voice.say('kenji', 'incorrect_gentle', {}, 2).then(() => {
            void this.game.voice.sayText('kenji', `Half of ${driver} is ${driver / 2}, half of ${driven} is ${driven / 2} — add them together!`, 2, 'hint');
          });
        }
      });
      row.appendChild(b);
    }
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = S('ui.back');
    back.addEventListener('click', close);
    panel.appendChild(row);
    panel.appendChild(back);
    overlay.appendChild(panel);
    document.getElementById('ui-root')!.appendChild(overlay);
  }

  runBossAbility(boss: BossEntity, effect: string): void {
    switch (effect) {
      case 'quake': {
        // three expanding shockwave rings — jump them!
        audio.play('stomp');
        C().renderer.shake(0.8);
        for (let i = 0; i < 3; i++) {
          window.setTimeout(() => {
            if (!this.boss) return;
            C().particles.ring(boss.pos, '#c96f4a', boss.arena.radius, 1.1);
            const start = performance.now();
            const origin = boss.pos.clone();
            const check = () => {
              if (!this.boss) return;
              const t = (performance.now() - start) / 1000;
              const r = t * (boss.arena.radius / 1.1);
              const d = Math.hypot(this.game.player.position.x - origin.x, this.game.player.position.z - origin.z);
              if (Math.abs(d - r) < 0.9 && this.game.player.grounded) {
                if (this.game.damagePlayer(1, 'quake')) boss.notePlayerDamaged(1);
                return;
              }
              if (t < 1.1) requestAnimationFrame(check);
            };
            check();
          }, i * 900);
        }
        this.game.voice.bark('digger', 'battle_warn', {}, 3);
        break;
      }
      case 'repair_swarm': {
        boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.12);
        C().particles.burst(boss.pos.clone().add(upVec), { count: 20, colours: ['#7dff8a'], speed: 3, life: 0.8 });
        audio.play('gear');
        this.game.voice.bark('kenji', 'battle_analyse', {}, 2);
        break;
      }
      case 'summon_turrets': {
        const def = C().content.enemies.get('cogling_scout');
        if (def) {
          for (const side of [-1, 1]) {
            const pos = boss.pos.clone().add(new THREE.Vector3(side * 4, 0, 2));
            const e = new EnemyEntity(def, pos, this.game, this.rng);
            e.aggroNow();
            this.enemies.push(e);
          }
        }
        this.game.voice.bark('marcus', 'battle_coach', {}, 2);
        break;
      }
      case 'invisible': {
        // Nightshade's cloak (W5): data + trigger live now, full counter ships with her world
        break;
      }
      default:
        break;
    }
  }

  private endArena(victory: boolean): void {
    if (this.arenaBarrier) {
      C().renderer.scene.remove(this.arenaBarrier);
      this.arenaBarrier = null;
    }
    for (const o of this.quizOrbs) o.mesh.removeFromParent();
    this.quizOrbs = [];
    if (this.gimmickStation) {
      C().renderer.scene.remove(this.gimmickStation.mesh);
      this.gimmickStation = null;
    }
    this.game.cameraRig.lockOnTarget = null;
    const arena = this.activeArena;
    this.activeArena = null;
    const boss = this.boss;
    this.boss = null;
    if (boss) boss.dispose();
    if (this.game.level) {
      music.play(C().content.music.get(victory ? this.game.level.def.music : this.game.level.def.music) ?? null);
      music.setIntensity(0);
    }
    void arena;
  }

  private async victory(): Promise<void> {
    const boss = this.boss!;
    const arena = this.activeArena!;
    const def = boss.def;
    audio.play('fossil');
    C().particles.confetti(boss.pos.clone().add(upVec));
    C().particles.ring(boss.pos, '#ffd75e', 6, 0.8);
    boss.stun(999);
    bus.emit('BossDefeated', { bossId: def.id });
    const save = C().save.current;
    if (save && !save.bossesDefeated.includes(def.id)) save.bossesDefeated.push(def.id);
    // the Obedience Cog shatters — champion freed, never destroyed (§1.2)
    if (!def.miniBoss) {
      this.game.toaster.banner(S('bossui.freed', { name: S(def.nameKey) }), 3200);
      if (save && !save.freedChampions.includes(def.id)) save.freedChampions.push(def.id);
      bus.emit('ChampionFreed', { bossId: def.id });
      await this.game.voice.say(def.id, 'defeat_freed', {}, 2);
      this.game.toaster.toast(S('bossui.freedBody', { name: S(def.nameKey) }), 4200);
    } else {
      await this.game.voice.say(def.id, 'defeat_freed', {}, 2);
    }
    void this.game.voice.say('max', 'victory', {}, 2).then(() => {
      const who = ['kenji', 'marcus', 'digger'][Math.floor(Math.random() * 3)];
      this.game.voice.bark(who, 'victory', {}, 2);
    });
    this.game.companions.cheerAll(3);
    this.game.awardFossil(arena.fossilId);
    this.game.persistNow();
    this.endArena(true);
  }

  onPlayerDizzy(): void {
    if (this.boss && this.activeArena) {
      const explorer = (C().save.current?.difficulty ?? 'explorer') === 'explorer';
      this.boss.resetForRetry(explorer);
      this.boss.pos.set(...this.activeArena.center);
    }
  }

  // ------------------------------------------------------- player attacks
  playerStomp(pos: THREE.Vector3): void {
    this.boss?.recordPlayerAction('stomp');
    for (const e of this.enemies) {
      if (e.alive && e.pos.distanceTo(pos) < 2.4) {
        e.damage(C().content.config.combat.stompDamage, pos);
      }
    }
    if (this.boss && this.boss.pos.distanceTo(pos) < 2.6) {
      this.boss.damage(C().content.config.combat.stompDamage, pos, true);
    }
  }

  playerChomp(): void {
    this.boss?.recordPlayerAction('chomp');
    const player = this.game.player;
    if (this.mouthful) {
      // spit! (§4.1)
      const dir = new THREE.Vector3(Math.sin(player.yaw), 0.25, Math.cos(player.yaw)).normalize();
      this.spawnProjectile(
        player.position.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(dir, 0.6),
        dir.multiplyScalar(14),
        true,
        C().content.config.combat.spitDamage,
        '#9aa3b8',
      );
      audio.play('spit');
      this.mouthful = false;
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(player.position);
      const facing = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const toE = e.pos.clone().sub(player.position).setY(0).normalize();
      if (d < 2.1 && facing.dot(toE) > 0.4 && e.capture()) {
        this.mouthful = true;
        return;
      }
    }
  }

  roarStun(pos: THREE.Vector3, radius: number, secs: number): void {
    this.boss?.recordPlayerAction('roar');
    for (const e of this.enemies) {
      if (e.alive && e.pos.distanceTo(pos) < radius) e.stun(secs);
    }
    if (this.boss && this.boss.pos.distanceTo(pos) < radius) this.boss.stun(secs * 0.7);
  }

  setBossTalking(speakerId: string, talking: boolean): void {
    if (this.boss?.def.id === speakerId) this.boss.talking = talking;
  }

  // --------------------------------------------------------------- update
  update(dt: number): void {
    const player = this.game.player;
    // spin hits
    if (player.spinActive) {
      if (player.action === 'spin') this.boss?.recordPlayerAction('spin');
      for (const e of this.enemies) {
        if (e.alive && e.pos.distanceTo(player.position) < 2.0) {
          e.damage(C().content.config.combat.spinDamage, player.position, this.spinId);
        }
      }
      if (this.boss && this.boss.pos.distanceTo(player.position) < 2.3) {
        if (this.boss.damage(C().content.config.combat.spinDamage, player.position)) {
          // spin id dedup for boss: use vulnerable window naturally; simple cooldown via spinActive lifecycle
          player.spinActive = false;
        }
      }
    } else if (player.action !== 'spin') {
      this.spinId++;
    }
    this.boss?.recordPlayerAction; // (habits recorded on action starts)

    for (const e of this.enemies) e.update(dt, this.enemies);
    this.enemies = this.enemies.filter((e) => {
      if (!e.alive && e.state !== 'captured' && e.hp <= 0) return false;
      return e.state !== 'captured';
    });

    if (this.boss) {
      this.boss.update(dt);
      if (!this.boss.alive && !this.victoryRunning) {
        this.victoryRunning = true;
        void this.victory().finally(() => (this.victoryRunning = false));
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      let dead = false;
      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (e.alive && e.pos.clone().add(upVec).distanceTo(p.pos) < 1.0) {
            e.damage(p.damage, p.pos);
            dead = true;
            break;
          }
        }
        if (!dead && this.boss && this.boss.pos.clone().add(upVec).distanceTo(p.pos) < 1.4) {
          this.boss.damage(p.damage, p.pos);
          dead = true;
        }
      } else {
        const d = p.pos.distanceTo(player.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
        if (d < 0.85) {
          if (this.game.damagePlayer(p.damage, 'bolt')) this.boss?.notePlayerDamaged(p.damage);
          dead = true;
        }
      }
      if (p.pos.y < (this.game.level?.def.killY ?? -20) + 10 || p.vel.length() < 0.1) dead = dead || p.pos.y < 0.05;
      if (p.pos.y <= (this.game.level ? -30 : -30)) dead = true;
      if (C().physics.groundBelow(p.pos, 0.3) < 0.3) {
        C().particles.dust(p.pos);
        dead = true;
      }
      if (dead) {
        p.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // quiz orbs
    if (this.activeArena) {
      const center = new THREE.Vector3(...this.activeArena.center);
      for (const o of this.quizOrbs) {
        if (o.taken) continue;
        o.angle += dt * 0.35;
        o.mesh.position.set(
          center.x + Math.cos(o.angle) * this.activeArena.radius * 0.6,
          center.y + 1.2 + Math.sin(o.angle * 3) * 0.3,
          center.z + Math.sin(o.angle) * this.activeArena.radius * 0.6,
        );
        o.mesh.rotation.y += dt * 2;
        if (o.mesh.position.distanceTo(player.position.clone().add(upVec)) < 1.1) {
          o.taken = true;
          o.mesh.visible = false;
          audio.play('quizOrb');
          bus.emit('QuizOrbCaught', { worldId: this.game.levelId });
          const who = ['kenji', 'marcus', 'digger'][Math.floor(Math.random() * 3)];
          this.game.voice.bark(who, 'quiz_orb', {}, 2);
          this.game.education.quizOrb();
        }
      }
    }

    music.setIntensity(this.inCombat ? 1 : 0);
  }
}
