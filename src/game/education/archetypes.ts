/**
 * Task archetype modules (§5.3): QUICK-FIRE (in-world podiums + modal
 * panel), SORT-IT (chomp & carry), NUMBER-PATH, MEASURE-IT (jug),
 * BUILD-IT (gears / counterweight / springs), café games, Quiz Orbs.
 * Each registers itself with the education engine — adding archetype #9
 * means writing a module like these and calling registerArchetype (§11).
 */
import * as THREE from 'three';
import { registerArchetype, type ActiveTask, type TaskCtx } from './engine';
import { C } from '../ctx';
import { S } from '../../engine/loader';
import { audio } from '../../engine/audio';
import { toonMat } from '../../engine/renderer';
import { makeTextLabel } from '../world/generators';
import { makeGearMesh } from '../rigs';
import type { DynamicCollider } from '../../engine/physics';
import { el, button } from '../ui/widgets';
import type { RuntimeQuestion } from './questions';
import { heroName } from '../game';

const DEG = Math.PI / 180;

// ============================================================ DOM helpers
function uiRoot(): HTMLElement {
  return document.getElementById('ui-root')!;
}

/** Non-modal question board pinned top-centre while a world task runs. */
class QuestionBoard {
  root: HTMLDivElement;
  private textEl: HTMLDivElement;
  private progressEl: HTMLDivElement;
  constructor(title: string) {
    this.root = el('div', 'panel');
    Object.assign(this.root.style, {
      position: 'absolute',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: 'min(680px, 92vw)',
      textAlign: 'center',
      padding: '12px 22px',
      pointerEvents: 'auto',
    });
    const t = el('div', '', title);
    t.style.fontWeight = '800';
    t.style.fontSize = '1.05rem';
    t.style.color = 'var(--warn)';
    this.textEl = el('div');
    this.textEl.style.fontSize = '1.35rem';
    this.textEl.style.fontWeight = '700';
    this.progressEl = el('div');
    this.progressEl.style.fontSize = '0.95rem';
    this.progressEl.style.color = '#5a5470';
    this.root.appendChild(t);
    this.root.appendChild(this.textEl);
    this.root.appendChild(this.progressEl);
    uiRoot().appendChild(this.root);
  }
  setText(t: string): void {
    this.textEl.textContent = t;
  }
  setProgress(t: string): void {
    this.progressEl.textContent = t;
  }
  dispose(): void {
    this.root.remove();
  }
}

/** Modal task panel with keyboard-reachable buttons. */
class ModalPanel {
  overlay: HTMLDivElement;
  panel: HTMLDivElement;
  constructor(title: string, testid?: string) {
    this.overlay = el('div', 'overlay-center');
    this.panel = el('div', 'panel task-panel');
    if (testid) this.panel.dataset.testid = testid;
    this.panel.appendChild(el('h3', '', title));
    this.overlay.appendChild(this.panel);
    uiRoot().appendChild(this.overlay);
    C().input.uiCaptured = true;
  }
  dispose(): void {
    this.overlay.remove();
    C().input.uiCaptured = false;
  }
}

function speakerChip(q: RuntimeQuestion): HTMLDivElement {
  const chip = el('div', '', `🗣 ${heroName(q.speaker)} · ${S(C().content.topics.get(q.topicId)?.topicNameKey ?? '')}`);
  chip.style.fontSize = '1rem';
  chip.style.color = '#5a5470';
  return chip;
}

// =========================================================== QUICK-FIRE =
/** In-world mode: three stompable answer podiums in front of the station. */
class WorldQuickfire implements ActiveTask {
  modal = false;
  private board: QuestionBoard;
  private podiums: { mesh: THREE.Mesh; collider: DynamicCollider; label: THREE.Sprite | null; option: string; standT: number }[] = [];
  private group = new THREE.Group();
  private resolvePick: ((opt: string | null) => void) | null = null;
  private done = 0;
  private disposed = false;

  constructor(private ctx: TaskCtx) {
    this.board = new QuestionBoard(S(ctx.task.titleKey));
    C().renderer.scene.add(this.group);
    const fwd = ctx.forwardDeg * DEG;
    for (let i = 0; i < 3; i++) {
      const a = fwd + (i - 1) * 0.5;
      const pos = new THREE.Vector3(
        ctx.origin.x + Math.sin(a) * 5.2,
        ctx.origin.y,
        ctx.origin.z + Math.cos(a) * 5.2,
      );
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.7, 12), toonMat(['#e86a6a', '#f5a04c', '#7aa8d0'][i]));
      mesh.position.copy(pos);
      mesh.castShadow = true;
      this.group.add(mesh);
      const collider = C().physics.addDynamic(mesh);
      this.podiums.push({ mesh, collider, label: null, option: '', standT: 0 });
    }
    void this.run();
  }

  private async run(): Promise<void> {
    const count = this.ctx.task.quickfire?.count ?? 3;
    const topicId = this.ctx.task.quickfire?.topicId ?? this.ctx.task.topicId;
    this.board.setProgress(`${this.done}/${count}`);
    for (let i = 0; i < count && !this.disposed; i++) {
      const ok = await this.ctx.engine.runWarmLoop(
        () => this.ctx.engine.createQuestion(topicId),
        (q) => this.present(q),
      );
      if (!ok || this.disposed) return;
      this.done++;
      this.board.setProgress(`${this.done}/${count}`);
    }
    if (!this.disposed) this.ctx.finish(true);
  }

  private present(q: RuntimeQuestion): Promise<string | null> {
    this.board.setText(q.text + (q.unit ? ` (${q.unit})` : ''));
    this.podiums.forEach((p, i) => {
      p.option = q.options[i] ?? '?';
      p.standT = 0;
      p.label?.removeFromParent();
      const label = makeTextLabel(p.option + (q.unit ? ` ${q.unit}` : ''));
      label.position.copy(p.mesh.position).add(new THREE.Vector3(0, 1.6, 0));
      label.scale.multiplyScalar(1.15);
      this.group.add(label);
      p.label = label;
      (p.mesh.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#000000');
    });
    return new Promise((res) => (this.resolvePick = res));
  }

  update(dt: number): void {
    if (!this.resolvePick) return;
    const player = this.ctx.game.player;
    for (const p of this.podiums) {
      if (player.standingPlatform === p.collider) {
        p.standT += dt;
        (p.mesh.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#2a5a2a');
        if (p.standT > 0.35) {
          const res = this.resolvePick;
          this.resolvePick = null;
          C().particles.ring(p.mesh.position, '#ffd75e', 1.6, 0.3);
          res?.(p.option);
          return;
        }
      } else {
        p.standT = 0;
        (p.mesh.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#000000');
      }
    }
    // wandering off cancels kindly
    if (player.position.distanceTo(this.ctx.origin) > 30) {
      const res = this.resolvePick;
      this.resolvePick = null;
      res?.(null);
      this.ctx.finish(false);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.resolvePick?.(null);
    this.board.dispose();
    for (const p of this.podiums) C().physics.removeDynamic(p.collider);
    C().renderer.scene.remove(this.group);
  }
}

/** Modal quiz panel used by café games and Quiz Orbs. */
class PanelQuickfire implements ActiveTask {
  modal = true;
  private panel: ModalPanel;
  private body: HTMLDivElement;
  private resolvePick: ((opt: string | null) => void) | null = null;
  private disposed = false;

  constructor(
    private ctx: TaskCtx,
    private opts: {
      title: string;
      count: number;
      topics: string[];
      speakerOverride?: string;
      onAllDone?: (correct: number) => void;
    },
  ) {
    this.panel = new ModalPanel(opts.title, 'quiz-panel');
    this.body = el('div');
    this.panel.panel.appendChild(this.body);
    const cancel = button(S('ui.back'), () => {
      this.resolvePick?.(null);
      this.ctx.finish(false);
    });
    cancel.style.marginTop = '10px';
    this.panel.panel.appendChild(cancel);
    void this.run();
  }

  private async run(): Promise<void> {
    let correct = 0;
    for (let i = 0; i < this.opts.count && !this.disposed; i++) {
      const topic = this.opts.topics[i % this.opts.topics.length];
      const ok = await this.ctx.engine.runWarmLoop(
        () => this.ctx.engine.createQuestion(topic, this.opts.speakerOverride ? { speaker: this.opts.speakerOverride } : undefined),
        (q) => this.present(q),
      );
      if (this.disposed) return;
      if (!ok) return; // cancelled
      correct++;
    }
    if (!this.disposed) {
      this.opts.onAllDone?.(correct);
      this.ctx.finish(true);
    }
  }

  private present(q: RuntimeQuestion): Promise<string | null> {
    this.body.innerHTML = '';
    this.body.appendChild(speakerChip(q));
    const question = el('div', '', q.text + (q.unit ? ` (${q.unit})` : ''));
    question.style.fontSize = '1.6rem';
    question.style.fontWeight = '800';
    question.style.margin = '14px 0';
    this.body.appendChild(question);
    const replay = button('🔊', () => void this.ctx.engine.speakQuestion(q, false));
    replay.style.fontSize = '1rem';
    this.body.appendChild(replay);
    const row = el('div', 'answer-row');
    this.body.appendChild(row);
    return new Promise((res) => {
      this.resolvePick = res;
      for (const opt of q.options) {
        row.appendChild(
          button(opt + (q.unit ? ` ${q.unit}` : ''), () => {
            this.resolvePick = null;
            res(opt);
          }, 'btn primary'),
        );
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.resolvePick?.(null);
    this.panel.dispose();
  }
}

registerArchetype('quickfire', (ctx) => new WorldQuickfire(ctx));

registerArchetype('quizorb', (ctx) => {
  const topics = ctx.engine.weakTopicIds(1);
  return new PanelQuickfire(ctx, {
    title: `✨ ${S('cafe.playRound', { n: 1 })}`,
    count: 1,
    topics: topics.length ? topics : [...C().content.topics.keys()].slice(0, 1),
    onAllDone: () => {
      ctx.game.healPlayer(1);
    },
  });
});

registerArchetype('cafe', (ctx) => {
  const save = C().save.current;
  const freed = save?.freedChampions ?? [];
  const host = freed[freed.length - 1] ?? 'bruno';
  const boss = C().content.bosses.get(host);
  const themed = (boss as unknown as { cafeTopics?: string[] })?.cafeTopics ?? [];
  const weak = ctx.engine.weakTopicIds(2);
  const topics = [...new Set([...themed, ...weak])].filter((t) => C().content.topics.has(t));
  return new PanelQuickfire(ctx, {
    title: `☕ ${S('cafe.title')} — ${heroName(host)}`,
    count: 4,
    topics: topics.length ? topics : [...C().content.topics.keys()].slice(0, 2),
    speakerOverride: C().content.voices.has(host) ? host : undefined,
    onAllDone: () => {
      ctx.game.healPlayer(1);
      if (C().content.voices.has(host)) void ctx.game.voice.say(host, 'cafe_farewell', {}, 2);
      else ctx.game.toaster.toast(S('cafe.thanks'));
    },
  });
});

// ============================================================== SORT-IT =
const ITEM_BUILDERS: Record<string, (colour: string) => THREE.Object3D> = {
  rock: (c) => new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), toonMat(c)),
  layerRock: (c) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.8 - i * 0.12, 0.2, 0.7 - i * 0.1), toonMat(i % 2 ? '#d9c9a8' : c));
      slab.position.y = i * 0.2;
      g.add(slab);
    }
    return g;
  },
  shinyRock: (c) => new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshToonMaterial({ color: c, emissive: '#223344' })),
  bone: (c) => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), toonMat(c));
    shaft.rotation.z = Math.PI / 2;
    g.add(shaft);
    for (const sx of [-0.35, 0.35]) {
      for (const sy of [-0.09, 0.09]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), toonMat(c));
        knob.position.set(sx, sy, 0);
        g.add(knob);
      }
    }
    return g;
  },
  skull: (c) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), toonMat(c));
    s.scale.set(1, 0.85, 1.1);
    g.add(s);
    for (const sx of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), toonMat('#3a3348'));
      eye.position.set(sx, 0.05, 0.28);
      g.add(eye);
    }
    return g;
  },
  cog: (c) => makeGearMesh(0.4, 8, 0.14, c),
  cogAsym: (c) => {
    const g = new THREE.Group();
    const gear = makeGearMesh(0.38, 7, 0.14, c);
    g.add(gear);
    const blob = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.22), toonMat(c));
    blob.position.set(0.34, 0, 0.1);
    g.add(blob);
    return g;
  },
  butterfly: (c) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 3), toonMat(c));
      wing.rotation.x = Math.PI / 2;
      wing.position.x = sx * 0.28;
      wing.rotation.y = sx * 0.4;
      g.add(wing);
    }
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), toonMat('#3a3348'));
    g.add(bodyM);
    return g;
  },
};

class SortTask implements ActiveTask {
  modal = false;
  private board: QuestionBoard;
  private group = new THREE.Group();
  private pads: { id: string; mesh: THREE.Mesh; collider: DynamicCollider; stacked: number }[] = [];
  private items: {
    id: string;
    category: string;
    label: string;
    fact?: string;
    obj: THREE.Object3D;
    home: THREE.Vector3;
    state: 'free' | 'carried' | 'locked' | 'returning';
    firstTry: boolean;
  }[] = [];
  private carried: (typeof this.items)[number] | null = null;
  private lockedCount = 0;
  private speakGuard = 0;

  constructor(private ctx: TaskCtx) {
    const def = ctx.task.sort!;
    this.board = new QuestionBoard(S(ctx.task.titleKey));
    this.board.setText(S('sort.instructions', { chomp: 'L' }));
    C().renderer.scene.add(this.group);
    const fwd = ctx.forwardDeg * DEG;

    // category pads in an arc in front of the station
    def.categories.forEach((cat, i) => {
      const a = fwd + (i - (def.categories.length - 1) / 2) * 0.62;
      const pos = new THREE.Vector3(ctx.origin.x + Math.sin(a) * 6.4, ctx.origin.y + 0.15, ctx.origin.z + Math.cos(a) * 6.4);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.35, 3), toonMat(cat.colour));
      mesh.position.copy(pos);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      const label = makeTextLabel(S(cat.labelKey));
      label.position.copy(pos).add(new THREE.Vector3(0, 2.1, 0));
      this.group.add(label);
      const collider = C().physics.addDynamic(mesh);
      this.pads.push({ id: cat.id, mesh, collider, stacked: 0 });
    });

    // pick round items: at least one per category, then random fill
    const perRound = def.itemsPerRound[String(ctx.tier)] ?? 6;
    const chosen: typeof def.items = [];
    for (const cat of def.categories) {
      const options = def.items.filter((it) => it.category === cat.id);
      if (options.length) chosen.push(options[Math.floor(Math.random() * options.length)]);
    }
    const rest = def.items.filter((it) => !chosen.includes(it));
    while (chosen.length < perRound && rest.length > 0) {
      chosen.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    }

    chosen.forEach((it, i) => {
      const a = fwd + Math.PI + (i - (chosen.length - 1) / 2) * 0.5;
      const home = new THREE.Vector3(ctx.origin.x + Math.sin(a) * 4.4, ctx.origin.y + 0.5, ctx.origin.z + Math.cos(a) * 4.4);
      const builder = ITEM_BUILDERS[it.shape ?? 'rock'] ?? ITEM_BUILDERS.rock;
      const obj = new THREE.Group();
      obj.add(builder(it.colour ?? '#b0805a'));
      const label = makeTextLabel(it.label);
      label.scale.multiplyScalar(0.62);
      label.position.y = 1.0;
      obj.add(label);
      obj.position.copy(home);
      this.group.add(obj);
      this.items.push({ id: it.id, category: it.category, label: it.label, fact: it.fact, obj, home, state: 'free', firstTry: true });
    });
    void ctx.game.voice.say(ctx.task.companion, 'ask_intro', {}, 2);
  }

  onChomp(): void {
    const player = this.ctx.game.player;
    if (this.carried) {
      // drop — over a pad?
      const item = this.carried;
      this.carried = null;
      player.carrying = null;
      const pad = this.pads.find((p) => {
        const d = Math.hypot(p.mesh.position.x - player.position.x, p.mesh.position.z - player.position.z);
        return d < 2.2;
      });
      if (pad) {
        this.evaluate(item, pad);
      } else {
        item.state = 'returning';
      }
      return;
    }
    // pick nearest free item
    let best: (typeof this.items)[number] | null = null;
    let bestD = 2.4;
    for (const it of this.items) {
      if (it.state !== 'free') continue;
      const d = it.obj.position.distanceTo(player.position);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    if (best) {
      best.state = 'carried';
      this.carried = best;
      player.carrying = best.id;
      audio.play('chomp');
    }
  }

  private evaluate(item: (typeof this.items)[number], pad: (typeof this.pads)[number]): void {
    const correct = item.category === pad.id;
    this.ctx.engine.recordRaw(this.ctx.task.topicId, correct, item.firstTry, this.ctx.task.companion);
    if (correct) {
      item.state = 'locked';
      this.lockedCount++;
      const slot = pad.stacked++;
      item.obj.position.set(
        pad.mesh.position.x + ((slot % 3) - 1) * 0.8,
        pad.mesh.position.y + 0.45 + Math.floor(slot / 3) * 0.55,
        pad.mesh.position.z + (Math.floor(slot / 3) - 0.5) * 0.5,
      );
      C().particles.sparks(item.obj.position, '#7dff8a');
      if (item.fact && this.speakGuard++ % 2 === 0) {
        void this.ctx.game.voice.sayText(this.ctx.task.companion, item.fact, 1, 'fact');
      }
      if (this.lockedCount >= this.items.length) {
        window.setTimeout(() => this.ctx.finish(true), 600);
      }
    } else {
      item.firstTry = false;
      item.state = 'returning';
      audio.play('incorrect');
      void this.ctx.game.voice.say(this.ctx.task.companion, 'incorrect_gentle', {}, 2).then(() => {
        if (item.fact) void this.ctx.game.voice.sayText(this.ctx.task.companion, item.fact, 2, 'hint');
      });
    }
  }

  update(dt: number): void {
    const player = this.ctx.game.player;
    for (const it of this.items) {
      if (it.state === 'carried') {
        const target = player.position.clone().add(new THREE.Vector3(Math.sin(player.yaw) * 0.5, 1.95, Math.cos(player.yaw) * 0.5));
        it.obj.position.lerp(target, 1 - Math.exp(-14 * dt));
        it.obj.rotation.y += dt * 2;
      } else if (it.state === 'returning') {
        it.obj.position.lerp(it.home, 1 - Math.exp(-6 * dt));
        if (it.obj.position.distanceTo(it.home) < 0.1) it.state = 'free';
      } else if (it.state === 'free') {
        it.obj.position.y = it.home.y + Math.sin(performance.now() / 500 + it.home.x) * 0.08;
      }
    }
  }

  dispose(): void {
    if (this.carried) {
      this.ctx.game.player.carrying = null;
    }
    this.board.dispose();
    for (const p of this.pads) C().physics.removeDynamic(p.collider);
    C().renderer.scene.remove(this.group);
  }
}

registerArchetype('sort', (ctx) => new SortTask(ctx));

// =========================================================== NUMBER-PATH =
class PathTask implements ActiveTask {
  modal = false;
  private board: QuestionBoard;
  private group = new THREE.Group();
  private tiles: { mesh: THREE.Mesh; collider: DynamicCollider; row: number; correct: boolean; cleared: boolean; value: number }[] = [];
  private row = 0;
  private length: number;
  private firstTryRow = true;
  private instructionsKey: string;
  private instructionsParams: Record<string, string | number>;

  constructor(private ctx: TaskCtx) {
    const def = ctx.task.path!;
    const tierCfg = def.tiers[String(ctx.tier)] ?? def.tiers['1'];
    this.length = tierCfg.length;
    this.board = new QuestionBoard(S(ctx.task.titleKey));
    const table = tierCfg.table ?? 4;
    const start = tierCfg.start ?? table;
    const step = tierCfg.step ?? table;
    if (def.mode === 'multiples') {
      this.instructionsKey = 'path.instructions.multiples';
      this.instructionsParams = { table };
    } else {
      this.instructionsKey = 'path.instructions.sequence';
      this.instructionsParams = { start, step };
    }
    this.board.setText(S(this.instructionsKey, this.instructionsParams));
    this.board.setProgress(S('path.progress', { n: 0, len: this.length }));
    C().renderer.scene.add(this.group);

    const fwd = ctx.forwardDeg * DEG;
    const dir = new THREE.Vector3(Math.sin(fwd), 0, Math.cos(fwd));
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    for (let r = 0; r < this.length; r++) {
      const value = def.mode === 'multiples' ? table * (r + 1) : start + step * r;
      const correctCol = Math.floor(Math.random() * 3);
      for (let c = 0; c < 3; c++) {
        let v = value;
        if (c !== correctCol) {
          // plausible decoys that are definitely wrong
          let guard = 0;
          do {
            const jitter = [1, -1, 2, -2, table > 2 ? Math.floor(table / 2) : 3][Math.floor(Math.random() * 5)];
            v = value + jitter + (c === 2 ? 1 : 0) * 0;
            guard++;
          } while ((def.mode === 'multiples' ? v % table === 0 : v === value) && guard < 10);
          if (v === value) v = value + 1;
        }
        const pos = ctx.origin
          .clone()
          .add(dir.clone().multiplyScalar(4.5 + r * 3.0))
          .add(side.clone().multiplyScalar((c - 1) * 3.0));
        pos.y = ctx.origin.y + 0.4 + r * 0.28;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.4, 2.3), toonMat('#e8d9b0'));
        mesh.position.copy(pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        const label = makeTextLabel(String(v));
        label.position.copy(pos).add(new THREE.Vector3(0, 1.35, 0));
        this.group.add(label);
        const collider = C().physics.addDynamic(mesh);
        this.tiles.push({ mesh, collider, row: r, correct: c === correctCol, cleared: false, value: v });
      }
    }
    void ctx.game.voice.say(ctx.task.companion, 'ask_intro', {}, 2).then(() => {
      void ctx.game.voice.sayText(ctx.task.companion, S(this.instructionsKey, this.instructionsParams), 2, 'path');
    });
  }

  update(dt: number): void {
    void dt;
    const player = this.ctx.game.player;
    const standing = player.standingPlatform;
    if (!standing) return;
    const tile = this.tiles.find((t) => t.collider === standing);
    if (!tile || tile.cleared) return;
    if (tile.row !== this.row) {
      if (tile.row > this.row && !tile.correct) this.boing(tile);
      return;
    }
    if (tile.correct) {
      tile.cleared = true;
      this.row++;
      (tile.mesh.material as THREE.MeshToonMaterial) = new THREE.MeshToonMaterial({ color: '#9ee89a', emissive: '#1d5a1d' });
      tile.mesh.material = tile.mesh.material;
      audio.play('correct');
      C().particles.sparks(tile.mesh.position, '#7dff8a');
      this.ctx.engine.recordRaw(this.ctx.task.topicId, true, this.firstTryRow, this.ctx.task.companion);
      this.firstTryRow = true;
      this.board.setProgress(S('path.progress', { n: this.row, len: this.length }));
      if (this.row >= this.length) {
        window.setTimeout(() => this.ctx.finish(true), 500);
      }
    } else {
      this.boing(tile);
      this.ctx.engine.recordRaw(this.ctx.task.topicId, false, this.firstTryRow, this.ctx.task.companion);
      this.firstTryRow = false;
    }
  }

  private boing(tile: (typeof this.tiles)[number]): void {
    const player = this.ctx.game.player;
    player.launch(7.5);
    const back = new THREE.Vector3().subVectors(this.ctx.origin, player.position).setY(0).normalize().multiplyScalar(6);
    player.velocity.x = back.x;
    player.velocity.z = back.z;
    audio.play('bounce');
    (tile.mesh.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#5a2a2a');
    window.setTimeout(() => ((tile.mesh.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#000000')), 400);
    this.ctx.game.voice.bark(this.ctx.task.companion, 'incorrect_gentle', {}, 1);
  }

  dispose(): void {
    this.board.dispose();
    for (const t of this.tiles) C().physics.removeDynamic(t.collider);
    C().renderer.scene.remove(this.group);
  }
}

registerArchetype('path', (ctx) => new PathTask(ctx));

// ============================================================ MEASURE-IT =
class MeasureTask implements ActiveTask {
  modal = true;
  private panel: ModalPanel;
  private amount = 0;
  private amountEl!: HTMLDivElement;
  private fill!: HTMLDivElement;
  private promptIdx = 0;
  private prompts: NonNullable<TaskCtx['task']['measure']>['prompts'];
  private attempt = 1;

  constructor(private ctx: TaskCtx) {
    const def = ctx.task.measure!;
    this.prompts = def.prompts.filter((p) => p.tier <= ctx.tier);
    if (this.prompts.length === 0) this.prompts = def.prompts;
    this.panel = new ModalPanel(S(ctx.task.titleKey), 'measure-panel');
    this.buildUI();
    this.askCurrent();
  }

  private get prompt() {
    return this.prompts[this.promptIdx % this.prompts.length];
  }

  private buildUI(): void {
    const p = this.panel.panel;
    const wrap = el('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '26px';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    // jug visual
    const jug = el('div');
    Object.assign(jug.style, {
      width: '120px',
      height: '200px',
      border: '5px solid var(--ink)',
      borderTop: 'none',
      borderRadius: '0 0 26px 26px',
      position: 'relative',
      overflow: 'hidden',
      background: '#fff',
    });
    this.fill = el('div');
    Object.assign(this.fill.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      right: '0',
      height: '0%',
      background: 'linear-gradient(#7fd0e0, #4aa8c0)',
      transition: 'height 0.25s',
    });
    jug.appendChild(this.fill);
    for (let i = 1; i <= 4; i++) {
      const mark = el('div');
      Object.assign(mark.style, {
        position: 'absolute',
        left: '0',
        width: '26px',
        height: '3px',
        background: 'var(--ink)',
        bottom: `${i * 20}%`,
      });
      jug.appendChild(mark);
    }
    const col = el('div');
    const target = el('div');
    target.id = 'measure-target';
    target.style.fontSize = '1.4rem';
    target.style.fontWeight = '800';
    col.appendChild(target);
    this.amountEl = el('div');
    this.amountEl.style.fontSize = '1.2rem';
    this.amountEl.style.margin = '8px 0';
    col.appendChild(this.amountEl);
    const rows = el('div', 'answer-row');
    for (const step of [100, 10]) {
      rows.appendChild(
        button(`+${step}`, () => this.pour(step), 'btn'),
      );
    }
    rows.appendChild(button(`-10`, () => this.pour(-10), 'btn'));
    rows.appendChild(button(S('measure.tipOut'), () => this.setAmount(0), 'btn'));
    col.appendChild(rows);
    const serve = button(S('measure.done'), () => this.serve(), 'btn primary big');
    serve.style.marginTop = '12px';
    col.appendChild(serve);
    wrap.appendChild(jug);
    wrap.appendChild(col);
    p.appendChild(wrap);
    const cancel = button(S('ui.back'), () => this.ctx.finish(false));
    cancel.style.marginTop = '14px';
    p.appendChild(cancel);
  }

  private askCurrent(): void {
    this.setAmount(0);
    this.attempt = 1;
    const t = this.prompt;
    const targetEl = this.panel.panel.querySelector('#measure-target')!;
    targetEl.textContent = t.text;
    void this.ctx.game.voice.say(this.ctx.task.companion, 'ask_intro', {}, 2).then(() => {
      void this.ctx.game.voice.sayText(this.ctx.task.companion, this.prompt.text, 2, 'measure');
    });
  }

  private pour(n: number): void {
    audio.play(n > 0 ? 'buildTest' : 'uiBack');
    this.setAmount(Math.max(0, this.amount + n));
  }

  private setAmount(n: number): void {
    this.amount = n;
    const t = this.prompt;
    const cap = Math.max(t.target * 1.5, 500);
    this.fill.style.height = `${Math.min(100, (n / cap) * 100)}%`;
    this.amountEl.textContent = S('measure.current', { n: this.amount, unit: t.unit });
  }

  private serve(): void {
    const t = this.prompt;
    const correct = this.amount === t.target;
    this.ctx.engine.recordRaw(this.ctx.task.topicId, correct, this.attempt === 1, this.ctx.task.companion);
    if (correct) {
      audio.play('correct');
      C().particles.confetti(this.ctx.game.player.position);
      void this.ctx.game.voice.say(this.ctx.task.companion, this.attempt === 1 ? 'correct_first_try' : 'correct_after_hint', {}, 2);
      this.promptIdx++;
      if (this.promptIdx >= Math.min(2, this.prompts.length)) {
        this.ctx.finish(true);
      } else {
        this.askCurrent();
      }
    } else {
      audio.play('incorrect');
      if (this.attempt === 1) {
        this.attempt = 2;
        void this.ctx.game.voice.say(this.ctx.task.companion, 'incorrect_gentle', {}, 2).then(() => {
          void this.ctx.game.voice.sayText(this.ctx.task.companion, t.hint, 2, 'hint');
        });
      } else {
        void this.ctx.game.voice.say(this.ctx.task.companion, 'teach', {}, 2).then(() => {
          void this.ctx.game.voice.sayText(this.ctx.task.companion, t.explain, 2, 'explain');
        });
        this.promptIdx++; // fresh values — nothing lost
        this.askCurrent();
      }
    }
  }

  dispose(): void {
    this.panel.dispose();
  }
}

registerArchetype('measure', (ctx) => new MeasureTask(ctx));

// ============================================================= BUILD-IT =
interface GearTierCfg {
  driver: number;
  goal: 'speed' | 'force' | 'ratio';
  targetRatio?: number;
  slots: number;
}

class BuildTask implements ActiveTask {
  modal = true;
  private panel: ModalPanel;
  private mode: string;
  private attempt = 1;
  private group = new THREE.Group();
  private worldGears: THREE.Mesh[] = [];
  private spinT = 0;
  private spinning = false;
  private speeds: number[] = [];

  // gears state
  private gearOptions = [6, 8, 12, 16, 24];
  private chosen: number[] = [];
  private gearCfg!: GearTierCfg;
  // counterweight state
  private target = 0;
  private loaded: number[] = [];
  // springs state
  private spring = 1;
  private lever = 1;

  constructor(private ctx: TaskCtx) {
    const def = ctx.task.build!;
    this.mode = def.mode;
    this.panel = new ModalPanel(S(ctx.task.titleKey), 'build-panel');
    C().renderer.scene.add(this.group);
    const tierCfg = (def.tiers[String(ctx.tier)] ?? def.tiers['1']) as Record<string, number | string>;
    if (this.mode === 'gears') {
      this.gearCfg = {
        driver: Number(tierCfg.driver ?? 8),
        goal: (tierCfg.goal as GearTierCfg['goal']) ?? 'speed',
        targetRatio: tierCfg.targetRatio !== undefined ? Number(tierCfg.targetRatio) : undefined,
        slots: Number(tierCfg.slots ?? 1),
      };
      this.chosen = new Array(this.gearCfg.slots).fill(12);
      this.buildGearsUI();
    } else if (this.mode === 'counterweight') {
      this.target = Number(tierCfg.target ?? 135);
      this.buildCounterweightUI();
    } else {
      this.buildSpringsUI(Number(tierCfg.target ?? 4), Number(tierCfg.wobbleAbove ?? 6));
    }
    void ctx.game.voice.say(ctx.task.companion, 'ask_intro', {}, 2).then(() => {
      const goalText = this.goalText();
      void ctx.game.voice.sayText(ctx.task.companion, goalText, 2, 'build');
    });
  }

  private goalText(): string {
    if (this.mode === 'gears') {
      if (this.gearCfg.goal === 'ratio' && this.gearCfg.targetRatio) {
        return `Make the last gear spin exactly ${this.gearCfg.targetRatio} times as fast as the driver.`;
      }
      return this.gearCfg.goal === 'speed' ? S('build.gears.goal.speed') : S('build.gears.goal.force');
    }
    if (this.mode === 'counterweight') return S('build.counterweight.goal', { target: this.target });
    return S('build.springs.goal', { target: 4 });
  }

  // ----- gears
  private buildGearsUI(): void {
    const p = this.panel.panel;
    p.appendChild(el('p', '', this.goalText()));
    const row = el('div', 'answer-row');
    row.style.alignItems = 'center';
    const mkGear = (teeth: number, fixed: boolean, idx?: number): HTMLDivElement => {
      const g = el('div');
      g.style.textAlign = 'center';
      const circle = el('div', '', `⚙️`);
      circle.style.fontSize = `${Math.max(2, teeth / 6)}rem`;
      const label = el('div', '', S('build.gears.teeth', { n: teeth }));
      label.style.fontWeight = '800';
      g.appendChild(circle);
      g.appendChild(label);
      if (!fixed && idx !== undefined) {
        const btns = el('div');
        const minus = button('−', () => this.cycleGear(idx, -1));
        const plus = button('+', () => this.cycleGear(idx, 1));
        for (const b of [minus, plus]) {
          b.style.padding = '2px 12px';
          b.style.fontSize = '1rem';
        }
        btns.appendChild(minus);
        btns.appendChild(plus);
        g.appendChild(btns);
      }
      return g;
    };
    const render = () => {
      row.innerHTML = '';
      row.appendChild(mkGear(this.gearCfg.driver, true));
      this.chosen.forEach((t, i) => row.appendChild(mkGear(t, false, i)));
      const ratioNow = this.currentRatio();
      const info = el('div', '', this.ctx.tier < 3 ? `${this.gearCfg.driver} ÷ ${this.chosen[this.chosen.length - 1]} → ×${round2(ratioNow)} speed` : '·');
      info.style.fontWeight = '700';
      row.appendChild(info);
    };
    (this as unknown as { renderGears: () => void }).renderGears = render;
    render();
    p.appendChild(row);
    const test = button(S('build.test'), () => this.testGears(), 'btn primary big');
    p.appendChild(test);
    const cancel = button(S('ui.back'), () => this.ctx.finish(false));
    cancel.style.marginLeft = '12px';
    p.appendChild(cancel);
    this.spawnWorldGears();
  }

  private cycleGear(idx: number, dir: number): void {
    const cur = this.gearOptions.indexOf(this.chosen[idx]);
    this.chosen[idx] = this.gearOptions[(cur + dir + this.gearOptions.length) % this.gearOptions.length];
    audio.play('buildPlace');
    (this as unknown as { renderGears: () => void }).renderGears();
    this.spawnWorldGears();
  }

  /** speed multiplier of final gear vs driver: driver/driven per meshing pair. */
  private currentRatio(): number {
    let ratio = 1;
    let prev = this.gearCfg.driver;
    for (const g of this.chosen) {
      ratio *= prev / g;
      prev = g;
    }
    return ratio;
  }

  private spawnWorldGears(): void {
    for (const g of this.worldGears) g.removeFromParent();
    this.worldGears = [];
    this.speeds = [];
    const teeth = [this.gearCfg.driver, ...this.chosen];
    let x = 0;
    let speed = 1;
    let prev = this.gearCfg.driver;
    teeth.forEach((t, i) => {
      if (i > 0) {
        speed *= prev / t;
        prev = t;
      }
      const radius = 0.35 + t * 0.045;
      const gear = makeGearMesh(radius, t, 0.3, i === 0 ? '#a85c32' : '#B8863B');
      const prevRadius = i === 0 ? 0 : 0.35 + teeth[i - 1] * 0.045;
      x += i === 0 ? 0 : prevRadius + radius + 0.02;
      gear.position.set(this.ctx.origin.x + x - 1.2, this.ctx.origin.y + 2.1, this.ctx.origin.z);
      this.group.add(gear);
      this.worldGears.push(gear);
      this.speeds.push(speed * (i % 2 === 0 ? 1 : -1));
    });
  }

  private testGears(): void {
    this.spinning = true;
    this.spinT = 2.6;
    audio.play('buildTest');
    window.setTimeout(() => {
      const ratio = this.currentRatio();
      let ok: boolean;
      if (this.gearCfg.goal === 'speed') ok = ratio > 1.01;
      else if (this.gearCfg.goal === 'force') ok = ratio < 0.99;
      else ok = Math.abs(ratio - (this.gearCfg.targetRatio ?? 1)) < 0.01;
      this.resolveBuild(ok, `A ${this.gearCfg.driver}-tooth gear driving ${this.chosen[this.chosen.length - 1]} teeth turns ×${round2(this.currentRatio())} as fast.`);
    }, 2700);
  }

  // ----- counterweight
  private buildCounterweightUI(): void {
    const p = this.panel.panel;
    p.appendChild(el('p', '', this.goalText()));
    const current = el('div', '', S('build.counterweight.current', { n: 0 }));
    current.style.fontSize = '1.4rem';
    current.style.fontWeight = '800';
    current.id = 'cw-current';
    p.appendChild(current);
    const row = el('div', 'answer-row');
    for (const w of [100, 50, 20, 10, 5, 1]) {
      row.appendChild(
        button(`+${w} kg`, () => {
          this.loaded.push(w);
          audio.play('buildPlace');
          this.refreshCw();
        }),
      );
    }
    row.appendChild(
      button('↩ undo', () => {
        this.loaded.pop();
        audio.play('uiBack');
        this.refreshCw();
      }),
    );
    p.appendChild(row);
    const test = button(S('build.test'), () => this.testCw(), 'btn primary big');
    p.appendChild(test);
    const cancel = button(S('ui.back'), () => this.ctx.finish(false));
    cancel.style.marginLeft = '12px';
    p.appendChild(cancel);
  }

  private cwSum(): number {
    return this.loaded.reduce((a, b) => a + b, 0);
  }
  private refreshCw(): void {
    const c = this.panel.panel.querySelector('#cw-current')!;
    c.textContent = S('build.counterweight.current', { n: this.cwSum() });
  }
  private testCw(): void {
    audio.play('buildTest');
    const ok = this.cwSum() === this.target;
    this.resolveBuild(ok, `${this.loaded.join(' + ') || 0} = ${this.cwSum()} kg. The car needs exactly ${this.target} kg.`);
  }

  // ----- springs
  private buildSpringsUI(target: number, wobbleAbove: number): void {
    const p = this.panel.panel;
    p.appendChild(el('p', '', S('build.springs.goal', { target })));
    const springRow = el('div', 'answer-row');
    const levers = el('div', 'answer-row');
    const info = el('div', '');
    info.style.fontWeight = '800';
    info.style.fontSize = '1.25rem';
    const refresh = () => {
      info.textContent = `×${this.spring} spring · ×${this.lever} lever → ×${round2(this.spring * this.lever)} bounce`;
    };
    const springs: [string, number][] = [['Soft ×2', 2], ['Springy ×3', 3], ['Mighty ×4', 4]];
    for (const [label, v] of springs) {
      springRow.appendChild(button(label, () => ((this.spring = v), audio.play('buildPlace'), refresh())));
    }
    const leverOpts: [string, number][] = [['Short ×1', 1], ['Middle ×1.5', 1.5], ['Long ×2', 2]];
    for (const [label, v] of leverOpts) {
      levers.appendChild(button(label, () => ((this.lever = v), audio.play('buildPlace'), refresh())));
    }
    refresh();
    p.appendChild(el('p', '', S('build.springs.spring')));
    p.appendChild(springRow);
    p.appendChild(el('p', '', S('build.springs.lever')));
    p.appendChild(levers);
    p.appendChild(info);
    const test = button(S('build.test'), () => {
      audio.play('buildTest');
      const power = this.spring * this.lever;
      if (power > wobbleAbove) {
        this.resolveBuild(false, `×${round2(power)} is TOO bouncy — the boots wobble apart! Try a gentler mix over ×${target}.`);
      } else {
        this.resolveBuild(power >= target, `×${this.spring} × ×${this.lever} = ×${round2(power)}. We need at least ×${target} without passing ×${wobbleAbove}.`);
      }
    }, 'btn primary big');
    p.appendChild(test);
    const cancel = button(S('ui.back'), () => this.ctx.finish(false));
    cancel.style.marginLeft = '12px';
    p.appendChild(cancel);
  }

  // ----- shared warm loop for builds (the design loop is celebrated §5.3)
  private resolveBuild(ok: boolean, explain: string): void {
    this.ctx.engine.recordRaw(this.ctx.task.topicId, ok, this.attempt === 1, this.ctx.task.companion);
    if (ok) {
      audio.play('correct');
      C().particles.confetti(this.ctx.game.player.position);
      void this.ctx.game.voice.say(this.ctx.task.companion, this.attempt === 1 ? 'correct_first_try' : 'correct_after_hint', {}, 2).then(() => {
        void this.ctx.game.voice.sayText(this.ctx.task.companion, explain, 2, 'explain');
      });
      window.setTimeout(() => this.ctx.finish(true), 900);
    } else {
      audio.play('incorrect');
      this.attempt++;
      void this.ctx.game.voice.say(this.ctx.task.companion, 'incorrect_gentle', {}, 2).then(() => {
        void this.ctx.game.voice.sayText(this.ctx.task.companion, explain, 2, 'hint').then(() => {
          void this.ctx.game.voice.sayText(this.ctx.task.companion, S('build.tryAgain'), 2, 'loop');
        });
      });
    }
  }

  update(dt: number): void {
    if (this.spinning && this.worldGears.length > 0) {
      this.spinT -= dt;
      this.worldGears.forEach((g, i) => {
        g.rotation.z += dt * 2.4 * (this.speeds[i] ?? 1);
      });
      if (Math.random() < dt * 8) audio.play('gear');
      if (this.spinT <= 0) this.spinning = false;
    }
  }

  dispose(): void {
    this.panel.dispose();
    C().renderer.scene.remove(this.group);
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

registerArchetype('build', (ctx) => new BuildTask(ctx));
