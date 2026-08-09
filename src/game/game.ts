/**
 * Game orchestrator: frame loop, level flow (title → hub → worlds), save
 * integration, dialogue/companion wiring, HUD state, kindness systems.
 * Implements LevelHost (world callbacks), GameFlow (UI callbacks) and
 * SpeakerRigControl (who gesticulates when speaking).
 */
import * as THREE from 'three';
import { C } from './ctx';
import { buildMax, buildVex, type Rig } from './rigs';
import { toonMat } from '../engine/renderer';
import { PlayerController, type PlayerInputFrame, NULL_INPUT } from './player';
import { CameraRig } from './camera';
import { Level, type LevelHost, type NpcEntity } from './world/level';
import type { TriggerDef, WorldEntry } from './content-types';
import { audio } from '../engine/audio';
import { music } from '../engine/music';
import { bus } from '../engine/events';
import { S } from '../engine/loader';
import { VoiceDirector } from './dialogue/voice';
import { Subtitles } from './dialogue/subtitles';
import { CutscenePlayer, type SpeakerRigControl } from './dialogue/cutscene';
import { BanterScheduler } from './dialogue/banter';
import { CompanionParty } from './companions';
import { UIStack, Toaster } from './ui/widgets';
import { Screens, type GameFlow } from './ui/screens';
import { Hud } from './ui/hud';
import { EducationEngine } from './education/engine';
import { CombatSystem } from './combat/combat';
import './education/archetypes'; // task archetype self-registration (§5.3)

export type GameMode = 'showcase' | 'play';

export class Game implements LevelHost, GameFlow, SpeakerRigControl {
  private clock = new THREE.Clock();
  mode: GameMode = 'showcase';
  private showcaseGroup: THREE.Group | null = null;
  private showcaseMax: Rig | null = null;

  player!: PlayerController;
  playerRig!: Rig;
  playerTalking = false;
  cameraRig!: CameraRig;
  level: Level | null = null;
  levelId = '';

  voice!: VoiceDirector;
  subtitles!: Subtitles;
  cutscenes!: CutscenePlayer;
  banter!: BanterScheduler;
  companions = new CompanionParty();
  uiStack!: UIStack;
  screens!: Screens;
  hud!: Hud;
  toaster!: Toaster;
  education!: EducationEngine;
  combat!: CombatSystem;

  hearts = 5;
  maxHearts = 5;
  private iframesT = 0;
  private spinVisT = 0;
  private hitPauseT = 0;
  private respawnPoint = new THREE.Vector3();
  private respawnYaw = 0;
  private autosaveT = 20;
  private idleT = 0;
  private currentHint: { key: string; speaker: string } | null = null;
  private guestRigs = new Map<string, Rig>(); // cutscene guests (Vex hologram…)
  private pendingGardenCheck = false;

  // ------------------------------------------------------------------ boot
  async start(): Promise<void> {
    const cfg = C().content.config;
    this.player = new PlayerController(cfg.movement, C().physics);
    this.playerRig = buildMax();
    this.cameraRig = new CameraRig(cfg.camera, C().renderer.camera, C().physics);
    this.wirePlayerHooks();

    const uiRoot = document.getElementById('ui-root')!;
    this.voice = new VoiceDirector(C().save);
    this.subtitles = new Subtitles(uiRoot);
    this.voice.subtitles = this.subtitles;
    this.cutscenes = new CutscenePlayer(uiRoot, this.voice, this);
    this.banter = new BanterScheduler(this.voice, this);
    this.uiStack = new UIStack(uiRoot, (captured) => (C().input.uiCaptured = captured));
    this.screens = new Screens(this.uiStack, this);
    this.hud = new Hud(uiRoot);
    this.toaster = new Toaster(uiRoot);
    this.education = new EducationEngine(this);
    this.combat = new CombatSystem(this);
    this.wireEvents();
    this.applySettings();

    const unlock = () => {
      audio.start();
      const s = C().save.settings;
      audio.setVolumes(s.musicVol, s.sfxVol, s.voiceVol);
      if (this.level) music.play(C().content.music.get(this.level.def.music) ?? null);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    const params = new URLSearchParams(location.search);
    const devLevel = params.get('level');
    if (devLevel) {
      // dev shortcut: throwaway save, straight into a level
      C().save.current = null;
      C().save.currentSlot = -1;
      const dev = C().save.startNew(-1, 'Max', 'explorer');
      dev.flags['dev'] = true;
      this.resetHearts();
      this.enterLevel(devLevel);
      this.hud.show(true);
      const at = params.get('at');
      if (at) {
        const [x, y, z, yawDeg] = at.split(',').map(Number);
        if ([x, y, z].every((v) => Number.isFinite(v))) {
          this.player.teleport(new THREE.Vector3(x, y, z), Number.isFinite(yawDeg) ? (yawDeg * Math.PI) / 180 : 0);
          this.cameraRig.snapBehind(this.player.yaw, this.player.position);
        }
      }
    } else {
      this.showTitle();
    }

    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.frame(dt);
    };
    loop();
  }

  private wireEvents(): void {
    bus.on('BrainPowerChanged', ({ segments, max }) => {
      this.hud.setBrain(segments, max);
      if (segments >= max) this.hud.setPrompt(`🧠 ${S('hud.roarReady', { key: 'J' })}`);
    });
    bus.on('MasteryChanged', () => {
      this.pendingGardenCheck = true;
    });
  }

  // -------------------------------------------------------------- settings
  applySettings(): void {
    const s = C().save.settings;
    audio.setVolumes(s.musicVol, s.sfxVol, s.voiceVol);
    this.voice.applySettings();
    this.subtitles.setScale(s.subtitleSize === 'small' ? 0.85 : s.subtitleSize === 'large' ? 1.35 : 1);
    document.documentElement.classList.toggle('dyslexia-font', s.dyslexiaFont);
    document.body.classList.toggle('reduce-flash', s.reduceFlash);
    C().renderer.reduceShake = s.reduceShake;
    this.cameraRig.sensitivity = s.cameraSensitivity;
    this.cameraRig.invertX = s.invertCameraX;
    this.cameraRig.invertY = s.invertCameraY;
    if (s.quality !== 'auto') {
      C().renderer.disableAutoDetect();
      if (C().renderer.quality !== s.quality) C().renderer.setQuality(s.quality);
    }
    this.resetHearts(false);
  }

  private resetHearts(refill = true): void {
    const cfg = C().content.config.combat;
    const diff = C().save.current?.difficulty ?? 'explorer';
    this.maxHearts = cfg.maxHearts + (diff === 'explorer' ? cfg.explorerBonusHearts : 0);
    if (refill) this.hearts = this.maxHearts;
    this.hearts = Math.min(this.hearts, this.maxHearts);
    this.hud.setHearts(this.hearts, this.maxHearts);
  }

  readMenuLine(text: string): void {
    if (C().save.settings.readMenus) {
      this.voice.stopAll();
      void this.voice.sayText('digger', text, 1, 'menu');
    }
  }

  // ------------------------------------------------------------ title flow
  showTitle(): void {
    this.level?.dispose();
    this.level = null;
    this.mode = 'showcase';
    this.hud.show(false);
    this.companions.setVisible(false);
    if (this.playerRig.root.parent) this.playerRig.root.removeFromParent();
    this.buildShowcase();
    this.uiStack.popAll();
    this.uiStack.push(this.screens.title());
    music.play(C().content.music.get('hub') ?? null);
  }

  startNewGame(slot: number, difficulty: 'explorer' | 'hero'): void {
    C().save.startNew(slot, 'Max', difficulty);
    this.resetHearts();
    this.uiStack.popAll();
    this.enterHubWorld();
    void this.playIntro();
  }

  continueGame(slot: number): void {
    const data = C().save.load(slot);
    if (!data) return;
    this.resetHearts();
    this.uiStack.popAll();
    const target = C().content.registry.worlds.find((w) => w.id === data.lastWorld && w.level && !w.comingSoon)
      ? data.lastWorld
      : this.hubWorldId();
    this.travelTo(target);
  }

  resume(): void {
    this.uiStack.popAll();
  }

  quitToTitle(): void {
    this.persistNow();
    this.voice.stopAll();
    this.showTitle();
  }

  exportSave(): void {
    const blob = new Blob([C().save.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `star-fossils-save-${(C().save.current?.playerName ?? 'max').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    audio.play('save');
  }

  async importSave(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const saved = C().save.currentSlot;
      // import into the first empty slot, or slot 3
      let slot = 2;
      for (let i = 0; i < 3; i++) {
        if (!C().save.slotSummary(i).exists) {
          slot = i;
          break;
        }
      }
      C().save.currentSlot = slot;
      const ok = C().save.importJson(text);
      if (!ok) {
        C().save.currentSlot = saved;
        this.toaster.toast(S('ui.importBad'));
      }
      return ok;
    } catch {
      this.toaster.toast(S('ui.importBad'));
      return false;
    }
  }

  private hubWorldId(): string {
    // the first registry world with doorCost 0 that owns doors — by convention the hub entry
    return C().content.registry.worlds[0]?.id ?? 'hub';
  }

  fossilsOwned(): number {
    return C().save.current?.fossils.length ?? 0;
  }

  private enterHubWorld(): void {
    this.travelTo(this.hubWorldId());
  }

  private async playIntro(): Promise<void> {
    // Vex appears as a crackling hologram in the plaza for the opening scene
    const vex = buildVex();
    vex.root.position.set(0, 1.6, -6);
    vex.root.scale.setScalar(1.35);
    vex.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = (mesh.material as THREE.Material).clone() as THREE.MeshToonMaterial;
        m.transparent = true;
        m.opacity = 0.75;
        mesh.material = m;
      }
    });
    C().renderer.scene.add(vex.root);
    this.guestRigs.set('vex', vex);
    await this.cutscenes.playById('intro');
    this.guestRigs.delete('vex');
    C().renderer.scene.remove(vex.root);
    this.persistNow();
  }

  // ---------------------------------------------------------------- levels
  enterLevel(id: string, spawnOverride?: THREE.Vector3): void {
    const def = C().content.levels.get(id);
    if (!def) {
      console.warn(`[game] no level '${id}'`);
      return;
    }
    this.education.stopActive();
    this.combat.clear();
    this.level?.dispose();
    this.disposeShowcase();
    this.level = new Level(def, this);
    this.levelId = id;
    this.mode = 'play';
    const spawn = spawnOverride ?? new THREE.Vector3(...def.spawn);
    const yaw = ((def.spawnFaceDeg ?? 0) * Math.PI) / 180;
    this.player.teleport(spawn, yaw);
    this.respawnPoint.copy(spawn);
    this.respawnYaw = yaw;
    if (!this.playerRig.root.parent) {
      C().renderer.scene.add(this.playerRig.root);
      C().renderer.addOutline(this.playerRig.root);
    }
    this.companions.spawn(this.player.position, yaw);
    this.companions.setVisible(true);
    this.cameraRig.snapBehind(yaw, this.player.position);
    music.play(C().content.music.get(def.music) ?? null);
    music.setIntensity(0);
    this.hud.show(true);
    this.refreshHudCounters();
    this.combat.spawnFromLevel(this.level);
    const save = C().save.current;
    if (save) {
      save.lastWorld = id;
    }
    this.toaster.toast(S(def.nameKey), 2400);
    this.pendingGardenCheck = true; // garden fossil may have been earned elsewhere
    // fun fact on entry — instant loads, so the "loading screen fact" (§2.5)
    // arrives as a toast a moment after the world name
    if (def.factsKey) {
      const facts: string[] = [];
      for (let i = 1; i <= 9; i++) {
        const key = `${def.factsKey}.${i}`;
        if (C().content.strings[key]) facts.push(S(key));
      }
      if (facts.length > 0) {
        const fact = facts[Math.floor(Math.random() * facts.length)];
        window.setTimeout(() => {
          if (this.levelId === id) this.toaster.toast(`💡 ${fact}`, 5200);
        }, 2800);
      }
    }
    bus.emit('WorldEntered', { worldId: id });
  }

  travelTo(worldId: string, fossilHintId?: string): void {
    const world = C().content.registry.worlds.find((w) => w.id === worldId);
    if (!world || !world.level || world.comingSoon) return;
    this.voice.stopAll();
    this.enterLevel(world.level);
    this.persistNow();
    if (fossilHintId) this.speakFossilHint(fossilHintId);
    if (worldId !== this.hubWorldId()) {
      this.voice.bark('max', 'world_enter', {}, 1);
    }
  }

  private speakFossilHint(fossilId: string): void {
    const level = this.level;
    if (!level) return;
    const f = level.def.fossils.find((x) => x.id === fossilId);
    if (f) {
      this.currentHint = { key: f.hintKey, speaker: f.hintSpeaker };
      void this.voice.sayText(f.hintSpeaker, S(f.hintKey), 2, 'fossil-hint');
    }
  }

  private buildShowcase(): void {
    if (this.showcaseGroup) return;
    const { renderer } = C();
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 40), toonMat('#7dc95e'));
    disc.position.y = -0.3;
    disc.receiveShadow = true;
    g.add(disc);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.65, 4.8, 0.35, 40), toonMat('#c99a5b'));
    rim.position.y = -0.5;
    g.add(rim);
    const max = buildMax();
    max.root.position.y = 0.02;
    g.add(max.root);
    renderer.addOutline(max.root);
    this.showcaseMax = max;
    renderer.scene.add(g);
    this.showcaseGroup = g;
    renderer.camera.position.set(0, 2.2, 5.2);
    renderer.camera.lookAt(0, 1, 0);
    renderer.applyPalette({
      sky: ['#5aa2e8', '#ffe6b3'],
      fog: '#bcd8f0',
      fogNear: 30,
      fogFar: 120,
      sun: '#fff3d6',
      sunIntensity: 2.2,
      ambient: '#bfd9ff',
      ambientIntensity: 0.9,
      ground: '#8a6a4c',
    });
    renderer.trackTarget(new THREE.Vector3(0, 0, 0));
  }

  private disposeShowcase(): void {
    if (this.showcaseGroup) {
      C().renderer.scene.remove(this.showcaseGroup);
      this.showcaseGroup = null;
      this.showcaseMax = null;
    }
  }

  // ------------------------------------------------------------ per frame
  private frame(rawDt: number): void {
    const { input, renderer, particles } = C();
    input.update();
    let dt = rawDt;
    if (this.hitPauseT > 0) {
      this.hitPauseT -= rawDt;
      dt = 0;
    }

    if (this.mode === 'showcase') {
      if (this.showcaseGroup && this.showcaseMax) {
        this.showcaseGroup.rotation.y += rawDt * 0.5;
        this.showcaseMax.update(rawDt, { mode: 'idle', speed: 0, talking: false, actionT: 0 });
      }
    } else if (this.mode === 'play' && this.level) {
      this.playFrame(dt, rawDt);
    }

    // guests (cutscene holograms)
    for (const rig of this.guestRigs.values()) {
      rig.update(rawDt, { mode: 'talk', speed: 0, talking: this.voice.currentSpeaker === 'vex', actionT: 0 });
      rig.root.position.y = 1.6 + Math.sin(this.clock.elapsedTime * 1.3) * 0.15;
    }

    this.voice.update(rawDt);
    particles.update(rawDt);

    // playtime + autosave
    const save = C().save.current;
    if (save && this.mode === 'play') {
      save.playtimeMs += rawDt * 1000;
      this.autosaveT -= rawDt;
      if (this.autosaveT <= 0) {
        this.autosaveT = 25;
        this.persistNow(false);
      }
    }

    renderer.render(rawDt);
    input.lateUpdate();
  }

  private playFrame(dt: number, rawDt: number): void {
    const { input, renderer } = C();
    const level = this.level!;
    const blocked = this.gameplayBlocked();

    // pause
    if (!blocked && input.pressed('pause')) {
      input.consume('pause');
      this.uiStack.push(this.screens.pause());
      return;
    }

    let frame: PlayerInputFrame = NULL_INPUT;
    if (!blocked && dt > 0) {
      const mv = input.move();
      const yaw = this.cameraRig.yaw;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      frame = {
        moveX: fx * mv.y - fz * mv.x,
        moveZ: fz * mv.y + fx * mv.x,
        jumpPressed: input.pressed('jump'),
        jumpHeld: input.held('jump'),
        spinPressed: input.pressed('attack'),
        stompPressed: input.pressed('stomp'),
        chompPressed: input.pressed('chomp'),
        roarPressed: this.canRoar() && input.pressed('attack'),
      };
      this.idleT = Math.abs(mv.x) + Math.abs(mv.y) > 0.02 ? 0 : this.idleT + dt;
    }

    // sim pauses while menus / modal tasks are up (Quiz Orbs pause combat, §4.3)
    const simDt = blocked ? 0 : dt;
    if (simDt > 0) {
      this.iframesT = Math.max(0, this.iframesT - simDt);
      this.player.update(simDt, frame);
      level.update(simDt, this.player.position, this.player.standingPlatform);
      this.combat.update(simDt);
      this.education.updateWorldTasks(simDt);
      this.checkPlatformSpecials();
      if (this.player.position.y < level.def.killY) this.fellOut();
    }

    if (!blocked) {
      if (input.pressed('recentre')) this.cameraRig.recentre(this.player.yaw);
      if (input.pressed('zoom')) this.cameraRig.cycleZoom();
      // interact
      const hint = this.interactHint();
      if (hint && dt > 0) {
        this.hud.setPrompt(`<kbd>E</kbd> ${hint.label}`);
        if (input.pressed('interact')) {
          input.consume('interact');
          hint.act();
        }
      } else if (this.canRoar()) {
        this.hud.setPrompt(`🧠 ${S('hud.roarReady', { key: 'J' })}`);
      } else {
        this.hud.setPrompt(null);
      }
      // ask digger
      if (input.pressed('hint')) this.askDigger();
      this.cameraRig.update(rawDt, this.player.position, this.player.yaw, input.camera());
    }
    renderer.trackTarget(this.player.position);
    this.syncPlayerRig(rawDt);
    this.companions.update(rawDt, this.player.position, this.player.yaw, level);

    // ambient banter + idle nudges
    const quiet = !blocked && !this.cutscenes.playing && !this.combat.inCombat && dt > 0;
    const nudge = this.banter.update(rawDt, this.levelId, quiet, this.idleT > 2);
    if (nudge === 'idle_nudge') {
      const who = ['kenji', 'marcus', 'digger'][Math.floor(Math.random() * 3)];
      this.voice.bark(who, 'idle_nudge', {}, 1);
    }
    if (this.pendingGardenCheck) {
      this.pendingGardenCheck = false;
      this.checkGardenFossil();
    }
  }

  gameplayBlocked(): boolean {
    return this.uiStack.depth > 0 || this.cutscenes.playing || this.education.taskOpen;
  }

  canRoar(): boolean {
    const save = C().save.current;
    const cfg = C().content.config.economy;
    return !!save && save.brainPower >= cfg.brainPowerSegments && this.player.grounded && this.player.action === 'none';
  }

  private askDigger(): void {
    if (this.currentHint) {
      void this.voice.say('digger', 'hint_intro', {}, 2).then(() => {
        if (this.currentHint) void this.voice.sayText(this.currentHint.speaker, S(this.currentHint.key), 2, 'hint');
      });
    } else {
      this.voice.bark('digger', 'idle_nudge', {}, 2);
    }
  }

  // ---------------------------------------------------------- player feel
  private wirePlayerHooks(): void {
    const P = () => C().particles;
    const foot = () => this.player.position.clone();
    this.player.hooks = {
      onJump: (kind) => {
        audio.play(kind === 'ground' ? 'jump' : 'doubleJump');
        if (kind === 'double') P().ring(foot(), '#7fe0d4', 1.2, 0.3);
        P().dust(foot());
      },
      onLand: (impact) => {
        audio.play('land');
        P().dust(foot());
        if (impact > 0.5) C().renderer.shake(impact * 0.5);
      },
      onStep: () => P().dust(foot()),
      onSpinStart: () => audio.play('spin'),
      onStompSlam: () => audio.play('spit'),
      onStompLand: (pos) => {
        audio.play('stomp');
        P().ring(pos, '#ffd75e', 3, 0.35);
        P().burst(pos, { count: 16, colours: ['#d9b28a', '#c9a37b'], speed: 4, life: 0.5 });
        C().renderer.shake(0.7);
        this.hitPause(60);
        this.level?.stompAt(pos);
        this.combat.playerStomp(pos);
        this.education.notifyStomp(pos);
      },
      onChomp: () => {
        audio.play('chomp');
        this.education.notifyChomp();
        this.combat.playerChomp();
      },
      onRoar: () => this.doRoar(),
      onBounce: () => audio.play('bounce'),
    };
  }

  private doRoar(): void {
    const save = C().save.current;
    if (!save) return;
    const cfg = C().content.config;
    save.brainPower = 0;
    bus.emit('BrainPowerChanged', { segments: 0, max: cfg.economy.brainPowerSegments });
    audio.play('roar');
    void this.voice.say('max', 'roar', {}, 2);
    C().particles.ring(this.player.position, '#2B6CFF', cfg.movement.roarRadius, 0.7);
    C().particles.ring(this.player.position, '#7fe0d4', cfg.movement.roarRadius * 0.7, 0.55);
    C().renderer.shake(1);
    this.hitPause(90);
    this.combat.roarStun(this.player.position, cfg.movement.roarRadius, cfg.movement.roarStunSecs);
  }

  hitPause(ms: number): void {
    this.hitPauseT = Math.max(this.hitPauseT, ms / 1000);
  }

  private syncPlayerRig(dt: number): void {
    const rig = this.playerRig;
    const p = this.player;
    rig.root.position.copy(p.position);
    if (p.action === 'spin') this.spinVisT += dt * 16;
    else this.spinVisT *= Math.exp(-10 * dt);
    rig.root.rotation.y = p.yaw + this.spinVisT;
    const s = Math.max(0.4, Math.min(1.5, p.squash));
    rig.root.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

    let mode: Parameters<Rig['update']>[1]['mode'] = 'idle';
    if (p.action === 'dizzy') mode = 'dizzy';
    else if (p.action === 'spin') mode = 'spin';
    else if (p.action === 'stompHop' || p.action === 'stompSlam') mode = 'stomp';
    else if (p.action === 'roar') mode = 'cheer';
    else if (this.playerTalking) mode = 'talk';
    else if (!p.grounded) mode = p.velocity.y > 0.5 ? 'jump' : 'fall';
    else if (p.speed01 > 0.04) mode = 'run';
    rig.setExpression(
      p.action === 'dizzy' ? 'dizzy' : p.action === 'spin' || p.action === 'stompSlam' ? 'determined' : this.iframesT > 0 ? 'surprised' : 'normal',
    );
    // hurt flash
    rig.root.visible = this.iframesT <= 0 || Math.sin(this.clock.elapsedTime * 30) > -0.3;
    rig.update(dt, { mode, speed: p.speed01, talking: this.playerTalking, actionT: 0 });
  }

  private checkPlatformSpecials(): void {
    const plat = this.player.standingPlatform;
    if (!plat) return;
    const ent = plat.mesh.userData.platform as { def?: { type?: string } } | undefined;
    if (ent?.def?.type === 'bounce') {
      const cfg = C().content.config.movement;
      const boots = this.hasGadget('springboots');
      this.player.launch(cfg.bouncePadVelocity * (boots ? cfg.springBootsMul : 1));
      C().particles.ring(this.player.position, '#ff7eb3', 1.6, 0.3);
    }
  }

  private fellOut(): void {
    this.player.teleport(this.respawnPoint, this.respawnYaw);
    this.cameraRig.snapBehind(this.respawnYaw, this.player.position);
    C().particles.burst(this.player.position, { count: 20, colours: ['#7fe0d4', '#ffffff'], speed: 3, life: 0.5 });
  }

  setRespawn(pos: THREE.Vector3, yaw = this.player.yaw): void {
    this.respawnPoint.copy(pos);
    this.respawnYaw = yaw;
  }

  // --------------------------------------------------------------- combat
  /** Damage from any source. Returns true if it landed (not i-framed). */
  damagePlayer(amount: number, source: string): boolean {
    if (this.iframesT > 0 || this.player.action === 'dizzy') return false;
    const cfg = C().content.config.combat;
    this.iframesT = cfg.iframesSecs;
    this.hearts = Math.max(0, this.hearts - amount);
    this.hud.setHearts(this.hearts, this.maxHearts);
    audio.play('hurt');
    C().renderer.shake(0.5);
    this.hitPause(cfg.hitPauseMs * 0.7);
    bus.emit('PlayerDamaged', { amount, hp: this.hearts, source });
    if (this.hearts <= 0) this.dizzyOut();
    return true;
  }

  private dizzyOut(): void {
    this.player.action = 'dizzy';
    audio.play('dizzy');
    bus.emit('PlayerDizzy', {});
    this.combat.onPlayerDizzy();
    void this.voice.say('max', 'dizzy', {}, 2);
    window.setTimeout(() => {
      void this.voice.say('digger', 'dizzy_rescue', {}, 2).then(() => {
        this.hearts = this.maxHearts;
        this.hud.setHearts(this.hearts, this.maxHearts);
        this.player.action = 'none';
        this.player.teleport(this.respawnPoint, this.respawnYaw);
        this.cameraRig.snapBehind(this.respawnYaw, this.player.position);
        this.toaster.toast(S('ui.dizzy'));
      });
    }, 1100);
  }

  addBrainPower(n = 1): void {
    const save = C().save.current;
    if (!save) return;
    const max = C().content.config.economy.brainPowerSegments;
    save.brainPower = Math.min(max, save.brainPower + n);
    bus.emit('BrainPowerChanged', { segments: save.brainPower, max });
  }

  healPlayer(n: number): void {
    this.hearts = Math.min(this.maxHearts, this.hearts + n);
    this.hud.setHearts(this.hearts, this.maxHearts);
    audio.play('heart');
  }

  // ------------------------------------------------------------- LevelHost
  private refreshHudCounters(): void {
    const save = C().save.current;
    this.hud.setFossils(save?.fossils.length ?? 0);
    this.hud.setChips(save?.chips[this.levelId]?.length ?? 0);
    this.hud.setBrain(save?.brainPower ?? 0, C().content.config.economy.brainPowerSegments);
  }

  collectChip(chipId: string): void {
    const save = C().save.current;
    if (!save) return;
    const list = (save.chips[this.levelId] ??= []);
    if (!list.includes(chipId)) list.push(chipId);
    audio.play('chip');
    this.hud.setChips(list.length);
    bus.emit('ChipCollected', { worldId: this.levelId, worldTotal: list.length });
    const target = C().content.config.economy.bonusChipTarget;
    const bonusId = this.level?.def.bonusFossilId;
    if (bonusId && list.length >= target && !save.fossils.includes(bonusId)) {
      this.toaster.toast(S('ui.bonusFossilToast'));
      bus.emit('BonusFossilEarned', { worldId: this.levelId });
      this.awardFossil(bonusId);
    }
  }

  collectHeart(): boolean {
    if (this.hearts >= this.maxHearts) return false;
    this.healPlayer(1);
    return true;
  }

  collectFossil(fossilId: string): void {
    this.awardFossil(fossilId);
  }

  awardFossil(fossilId: string): void {
    const save = C().save.current;
    if (!save || save.fossils.includes(fossilId)) return;
    save.fossils.push(fossilId);
    audio.play('fossil');
    C().particles.confetti(this.player.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    this.toaster.banner(`⭐ ${S('ui.newFossil')}`);
    this.toaster.toast(S(`fossil.${fossilId}.name`));
    this.companions.cheerAll();
    void this.voice.say('max', 'fossil_get', {}, 2).then(() => {
      const who = ['kenji', 'marcus', 'digger'][Math.floor(Math.random() * 3)];
      void this.voice.say(who, 'fossil_get', {}, 1);
    });
    this.refreshHudCounters();
    this.persistNow();
    bus.emit('FossilCollected', { fossilId, worldId: this.levelId, total: save.fossils.length });
    this.currentHint = null;
  }

  npcInteract(npc: NpcEntity): void {
    const id = npc.def.character;
    if (npc.def.role === 'digsite') {
      const stars = this.education.topicsWithStars();
      void this.voice.say(id, 'greeting', {}, 2).then(() => {
        void this.voice.sayText(id, S('garden.progress', { n: stars }), 2, 'garden');
      });
      return;
    }
    this.voice.bark(id, 'greeting', {}, 2);
  }

  doorInteract(worldId: string): void {
    const reg = C().content.registry;
    const world = reg.worlds.find((w) => w.id === worldId);
    if (!world) return;
    const owned = this.fossilsOwned();
    const isFinale = world.doorCost >= reg.finaleGateCost;
    if (world.doorCost > owned) {
      audio.play('doorLocked');
      this.toaster.toast(S('ui.doorNeeds', { count: world.doorCost, have: owned }));
      if (isFinale) this.voice.bark('vex', 'gate_locked', {}, 2);
      else this.voice.bark('digger', 'idle_nudge', {}, 1);
      return;
    }
    if (world.comingSoon || !world.level) {
      if (isFinale) this.voice.bark('vex', 'gate_locked', {}, 2);
      this.screens.comingSoon(world);
      return;
    }
    if (worldId === this.hubWorldId()) {
      this.travelTo(worldId);
      return;
    }
    audio.play('doorOpen');
    this.uiStack.push(
      this.screens.fossilSelect(
        world,
        (fossilId) => {
          if (fossilId !== null) this.travelTo(worldId, fossilId);
        },
        (fossilId) => {
          const lv = C().content.levels.get(world.level!);
          const f = lv?.fossils.find((x) => x.id === fossilId);
          if (f && !this.voice.speaking) void this.voice.sayText(f.hintSpeaker, S(f.hintKey), 1, 'hover-hint');
        },
      ),
    );
  }

  taskInteract(taskRef: string): void {
    this.education.startTask(taskRef);
  }

  triggerFired(def: TriggerDef): void {
    switch (def.kind) {
      case 'checkpoint': {
        this.setRespawn(new THREE.Vector3(def.pos[0], def.pos[1] + 0.5, def.pos[2]));
        audio.play('checkpoint');
        this.toaster.toast(S('ui.checkpoint'), 2000);
        break;
      }
      case 'secretSniff': {
        const data = def.data as { fossilId?: string } | undefined;
        audio.play('quizOrb');
        bus.emit('SecretFound', { id: def.id, worldId: this.levelId });
        const save = C().save.current;
        if (save && !save.secretsFound.includes(def.id)) save.secretsFound.push(def.id);
        void this.voice.say('digger', 'secret_found', {}, 2);
        if (data?.fossilId) this.level?.revealFossil(data.fossilId);
        break;
      }
      case 'zoneName': {
        const data = def.data as { nameKey?: string } | undefined;
        if (data?.nameKey) this.toaster.toast(S(data.nameKey), 2200);
        break;
      }
      case 'exit': {
        this.travelTo(this.hubWorldId());
        break;
      }
      case 'cafe': {
        this.enterCafe();
        break;
      }
      case 'arenaGate': {
        this.combat.arenaGateTouched(def);
        break;
      }
      default:
        break;
    }
  }

  protected enterCafe(): void {
    const save = C().save.current;
    if (!save || save.freedChampions.length === 0) {
      this.toaster.toast(S('cafe.empty'), 3200);
      return;
    }
    this.education.openCafe(save.freedChampions);
  }

  hazardHit(damage: number, source: string): void {
    this.damagePlayer(damage, source);
  }

  isChipCollected(chipId: string): boolean {
    return C().save.current?.chips[this.levelId]?.includes(chipId) ?? false;
  }
  isFossilCollected(fossilId: string): boolean {
    return C().save.current?.fossils.includes(fossilId) ?? false;
  }
  hasGadget(id: string): boolean {
    return C().save.current?.gadgets.includes(id) ?? false;
  }

  private checkGardenFossil(): void {
    // Digger's garden: 3 topics with a mastery star → hub garden fossil (§7.9)
    const save = C().save.current;
    if (!save) return;
    const gardenFossil = this.level?.def.fossils.find((f) => f.kind === 'garden');
    if (!gardenFossil) return;
    if (!save.fossils.includes(gardenFossil.id) && this.education.topicsWithStars() >= 3) {
      this.level?.revealFossil(gardenFossil.id);
      const ent = this.level?.fossils.find((f) => f.def.id === gardenFossil.id);
      if (ent) ent.revealed = true;
    }
  }

  interactHint(): { label: string; act: () => void } | null {
    if (!this.level || this.mode !== 'play') return null;
    const gim = this.combat.gimmickInteract();
    if (gim && gim.pos.distanceTo(this.player.position) < 3) return { label: gim.label, act: gim.act };
    const n = this.level.nearestInteractable(this.player.position);
    return n ? { label: n.label, act: n.act } : null;
  }

  /** Telegraph duration honouring the accessibility floor + Explorer slow-down. */
  telegraphSecs(base: number): number {
    const cfg = C().content.config.combat;
    const explorer = (C().save.current?.difficulty ?? 'explorer') === 'explorer';
    return Math.max(cfg.telegraphMinSecs, base) * (explorer ? cfg.explorerWindupMul : 1);
  }

  // ------------------------------------------------- SpeakerRigControl
  setTalking(speakerId: string, talking: boolean): void {
    if (speakerId === 'max') {
      this.playerTalking = talking;
      return;
    }
    this.companions.setTalking(speakerId, talking);
    for (const npc of this.level?.npcs ?? []) {
      if (npc.def.character === speakerId) npc.talking = talking;
    }
    this.combat.setBossTalking(speakerId, talking);
  }

  persistNow(sfx = false): void {
    const save = C().save;
    if (!save.current || save.currentSlot < 0) return;
    save.persist();
    if (sfx) audio.play('save');
    bus.emit('GameSaved', { slot: save.currentSlot });
  }
}

export function heroName(id: string): string {
  const chars = C().content.characters;
  const h = chars.heroes.find((c) => c.id === id) ?? chars.cast.find((c) => c.id === id);
  return h ? S(h.nameKey) : id;
}
