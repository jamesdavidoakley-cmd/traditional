/**
 * Level runtime: builds a LevelDef into scene + physics, then owns every
 * placed entity (platforms, chips, fossils, NPCs, doors, task stations,
 * hazards, triggers). Gameplay decisions bubble up through LevelHost.
 */
import * as THREE from 'three';
import type { CollectibleDef, DecorDef, FossilPlacement, LevelDef, NpcDef, PlatformDef, TriggerDef, HazardDef } from '../content-types';
import { C } from '../ctx';
import { buildDecor, buildGeometry, makeChipMesh, makeFossilMesh, makeHeartMesh, makeTextLabel } from './generators';
import { toonMat } from '../../engine/renderer';
import type { DynamicCollider } from '../../engine/physics';
import { buildCharacter, makeGearMesh, type Rig } from '../rigs';
import { S } from '../../engine/loader';

export interface LevelHost {
  collectChip(chipId: string): void;
  collectHeart(): boolean; // false if full (leave pickup)
  collectFossil(fossilId: string): void;
  npcInteract(npc: NpcEntity): void;
  doorInteract(worldId: string): void;
  taskInteract(taskRef: string): void;
  triggerFired(def: TriggerDef): void;
  hazardHit(damage: number, source: string): void;
  isChipCollected(chipId: string): boolean;
  isFossilCollected(fossilId: string): boolean;
  hasGadget(id: string): boolean;
}

const DEG = Math.PI / 180;

export class PlatformEntity {
  mesh: THREE.Mesh;
  collider: DynamicCollider;
  t: number;
  basePos: THREE.Vector3;
  crumbleTimer = -1;
  respawnTimer = -1;
  standTime = 0;
  broken = false;

  constructor(
    public def: PlatformDef,
    parent: THREE.Group,
  ) {
    const size = def.size ?? [2.4, 0.5, 2.4];
    let colour = def.colour ?? '#c9a24a';
    let geo: THREE.BufferGeometry;
    if (def.type === 'rotor') {
      geo = new THREE.CylinderGeometry(def.radius ?? 3, def.radius ?? 3, size[1], 24);
    } else if (def.type === 'bounce') {
      geo = new THREE.CylinderGeometry(1.05, 1.35, 0.65, 14);
      colour = def.colour ?? '#ff7eb3';
    } else if (def.type === 'excavation') {
      geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
      colour = def.colour ?? '#a8764f';
    } else {
      geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    }
    this.mesh = new THREE.Mesh(geo, toonMat(colour));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.set(...def.pos);
    this.basePos = this.mesh.position.clone();
    this.t = def.phase ?? 0;
    parent.add(this.mesh);

    if (def.type === 'rotor') {
      // gear look: overlay a slightly larger gear silhouette
      const gear = makeGearMesh((def.radius ?? 3) * 1.12, 10, size[1] * 0.85, def.colour ?? '#a85c32');
      gear.rotation.x = Math.PI / 2;
      this.mesh.add(gear);
    }
    if (def.type === 'conveyor') {
      for (let i = 0; i < 4; i++) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(size[0] * 0.85, 0.08, 0.3), toonMat('#3a3348'));
        stud.position.y = size[1] / 2 + 0.03;
        this.mesh.add(stud);
      }
    }
    if (def.type === 'excavation') {
      // cracked-plate look
      const crack = new THREE.Mesh(new THREE.BoxGeometry(size[0] * 0.7, 0.06, 0.16), toonMat('#6e4a34'));
      crack.position.y = size[1] / 2 + 0.02;
      crack.rotation.y = 0.7;
      this.mesh.add(crack);
      const crack2 = crack.clone();
      crack2.rotation.y = -0.5;
      crack2.position.x = 0.3;
      this.mesh.add(crack2);
    }
    if (def.type === 'bounce') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toonMat('#ffffff'));
      cap.position.y = 0.3;
      cap.scale.y = 0.5;
      this.mesh.add(cap);
    }
    this.collider = C().physics.addDynamic(this.mesh);
    this.collider.mesh.userData.platform = this;
  }

  update(dt: number, playerStandingOn: boolean): void {
    const def = this.def;
    this.t += dt;
    switch (def.type) {
      case 'lift': {
        const axis = new THREE.Vector3(...(def.axis ?? [0, 1, 0]));
        const k = Math.sin(this.t * (def.speed ?? 0.8)) * (def.range ?? 3);
        this.mesh.position.copy(this.basePos).addScaledVector(axis, k);
        break;
      }
      case 'rotor': {
        this.mesh.rotation.y += (def.speed ?? 0.5) * dt;
        break;
      }
      case 'conveyor': {
        const dir = new THREE.Vector3(...(def.direction ?? [1, 0, 0])).normalize();
        this.collider.surfaceVelocity.copy(dir).multiplyScalar(def.speed ?? 2);
        // scroll the studs
        const size = def.size ?? [2.4, 0.5, 2.4];
        const len = Math.abs(dir.z) > 0.5 ? size[2] : size[0];
        this.mesh.children.forEach((c, i) => {
          const phase = ((this.t * (def.speed ?? 2) + (i * len) / 4) % len) - len / 2;
          if (Math.abs(dir.z) > 0.5) c.position.set(0, c.position.y, phase * Math.sign(dir.z));
          else c.position.set(phase * Math.sign(dir.x), c.position.y, 0);
          c.rotation.y = Math.abs(dir.z) > 0.5 ? 0 : Math.PI / 2;
        });
        break;
      }
      case 'crumble': {
        if (this.broken) {
          this.respawnTimer -= dt;
          if (this.respawnTimer <= 0) {
            this.broken = false;
            this.mesh.visible = true;
            this.collider.enabled = true;
            this.mesh.position.copy(this.basePos);
          }
          break;
        }
        if (playerStandingOn) {
          this.standTime += dt;
          this.mesh.position.x = this.basePos.x + Math.sin(this.t * 40) * Math.min(0.09, this.standTime * 0.1);
          if (this.standTime > 0.8) {
            this.broken = true;
            this.mesh.visible = false;
            this.collider.enabled = false;
            this.respawnTimer = 3;
            this.standTime = 0;
            C().particles.burst(this.mesh.position, { count: 12, colours: ['#c9a24a', '#8a6a4c'], speed: 3, life: 0.5 });
          }
        } else {
          this.standTime = Math.max(0, this.standTime - dt * 2);
          this.mesh.position.x = this.basePos.x;
        }
        break;
      }
      case 'bounce':
      case 'excavation':
        break;
      case 'pendulum': {
        const a = Math.sin(this.t * (def.speed ?? 1)) * 1.1;
        const r = def.range ?? 4;
        this.mesh.position.set(this.basePos.x + Math.sin(a) * r, this.basePos.y - Math.cos(a) * r + r, this.basePos.z);
        break;
      }
    }
    this.collider.commitMotion();
  }

  /** Excavation plates shatter under a stomp; returns true if broken now. */
  smash(): boolean {
    if (this.def.type !== 'excavation' || this.broken) return false;
    this.broken = true;
    this.mesh.visible = false;
    this.collider.enabled = false;
    C().particles.burst(this.mesh.position, { count: 22, colours: ['#a8764f', '#8a5a34', '#c99a5b'], speed: 4.5, life: 0.6 });
    return true;
  }
}

export class ChipEntity {
  mesh: THREE.Mesh;
  taken = false;
  constructor(
    public id: string,
    public pos: THREE.Vector3,
    parent: THREE.Group,
  ) {
    this.mesh = makeChipMesh();
    this.mesh.position.copy(pos);
    parent.add(this.mesh);
  }
  update(dt: number, t: number, playerPos: THREE.Vector3, host: LevelHost): void {
    if (this.taken) return;
    this.mesh.rotation.z = t * 2.4;
    this.mesh.position.y = this.pos.y + Math.sin(t * 2 + this.pos.x) * 0.08;
    const d = this.mesh.position.distanceTo(playerPos);
    if (d < 2.1) {
      // magnet
      this.mesh.position.lerp(playerPos.clone().setY(playerPos.y + 0.7), 1 - Math.exp(-10 * dt));
      this.pos.copy(this.mesh.position);
    }
    if (d < 0.85) {
      this.taken = true;
      this.mesh.visible = false;
      host.collectChip(this.id);
    }
  }
}

export class HeartEntity {
  mesh: THREE.Mesh;
  taken = false;
  life = 999;
  constructor(
    public pos: THREE.Vector3,
    parent: THREE.Group,
    temporary = false,
  ) {
    this.mesh = makeHeartMesh();
    this.mesh.position.copy(pos);
    parent.add(this.mesh);
    if (temporary) this.life = 14;
  }
  update(dt: number, t: number, playerPos: THREE.Vector3, host: LevelHost): boolean {
    if (this.taken) return false;
    this.life -= dt;
    if (this.life <= 0) {
      this.mesh.removeFromParent();
      return false;
    }
    this.mesh.rotation.y = t * 2;
    this.mesh.position.y = this.pos.y + Math.sin(t * 2.6) * 0.1;
    if (this.life < 3) this.mesh.visible = Math.sin(t * 14) > -0.4;
    if (this.mesh.position.distanceTo(playerPos) < 1.0 && host.collectHeart()) {
      this.taken = true;
      this.mesh.removeFromParent();
      return false;
    }
    return true;
  }
}

export class FossilEntity {
  mesh: THREE.Group;
  taken = false;
  revealed: boolean;
  constructor(
    public def: FossilPlacement,
    public pos: THREE.Vector3,
    parent: THREE.Group,
    alreadyCollected: boolean,
  ) {
    this.mesh = makeFossilMesh();
    this.mesh.position.copy(pos);
    parent.add(this.mesh);
    this.revealed = def.kind !== 'secret' && def.kind !== 'garden';
    this.mesh.visible = this.revealed;
    if (alreadyCollected) {
      // collected fossils stay as faint ghosts so kids can revisit them
      this.mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
        if (m) {
          const clone = m.clone();
          clone.transparent = true;
          clone.opacity = 0.25;
          (o as THREE.Mesh).material = clone;
        }
      });
      this.taken = true;
    }
  }
  reveal(): void {
    if (!this.revealed) {
      this.revealed = true;
      this.mesh.visible = true;
      C().particles.confetti(this.mesh.position);
    }
  }
  update(dt: number, t: number, playerPos: THREE.Vector3, host: LevelHost): void {
    if (!this.revealed) return;
    this.mesh.rotation.y = t * 1.4;
    this.mesh.position.y = this.pos.y + Math.sin(t * 1.8) * 0.12;
    if (!this.taken) {
      if (Math.random() < dt * 4) C().particles.sparkle(this.mesh.position);
      if (this.mesh.position.distanceTo(playerPos) < 1.15) {
        this.taken = true;
        host.collectFossil(this.def.id);
        this.mesh.visible = false;
      }
    }
  }
}

export class NpcEntity {
  rig: Rig;
  root: THREE.Group;
  talking = false;
  mode: 'idle' | 'cheer' | 'talk' = 'idle';
  constructor(
    public def: NpcDef,
    parent: THREE.Group,
  ) {
    const chars = [...C().content.characters.heroes, ...C().content.characters.cast];
    const cd = chars.find((c) => c.id === def.character);
    this.rig = buildCharacter(def.character, cd?.colour ?? '#888', cd?.accent ?? '#aaa');
    this.root = new THREE.Group();
    this.root.position.set(...def.pos);
    this.root.rotation.y = (def.faceDeg ?? 0) * DEG;
    this.root.add(this.rig.root);
    const label = makeTextLabel(S(cd?.nameKey ?? def.character));
    label.position.y = 2.75;
    label.scale.multiplyScalar(0.48);
    this.root.add(label);
    parent.add(this.root);
    C().renderer.addOutline(this.rig.root);
  }
  get position(): THREE.Vector3 {
    return this.root.position;
  }
  update(dt: number, playerPos: THREE.Vector3): void {
    const d = this.root.position.distanceTo(playerPos);
    if (d < 6) {
      // face the player
      const target = Math.atan2(playerPos.x - this.root.position.x, playerPos.z - this.root.position.z);
      this.root.rotation.y += (((target - this.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6);
    }
    this.rig.update(dt, { mode: this.talking ? 'talk' : this.mode === 'cheer' ? 'cheer' : 'idle', speed: 0, talking: this.talking, actionT: 0 });
  }
}

export class DoorEntity {
  root: THREE.Group;
  locked = true;
  constructor(
    public worldId: string,
    pos: THREE.Vector3,
    faceDeg: number,
    parent: THREE.Group,
  ) {
    const reg = C().content.registry.worlds.find((w) => w.id === worldId);
    const colour = reg?.colour ?? '#8a6a4c';
    this.root = new THREE.Group();
    this.root.position.copy(pos);
    this.root.rotation.y = faceDeg * DEG;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.45, 10, 22, Math.PI), toonMat('#efe6d8'));
    frame.position.y = 0.1;
    this.root.add(frame);
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.4, 24, 1, false, 0, Math.PI), toonMat(colour));
    slab.rotation.z = Math.PI / 2;
    slab.rotation.y = Math.PI / 2;
    slab.position.y = 0.1;
    this.root.add(slab);
    const label = makeTextLabel(`${reg?.icon ?? ''} ${S(reg?.name ?? worldId)}`);
    label.position.y = 3.3;
    this.root.add(label);
    const cost = reg?.doorCost ?? 0;
    if (cost > 0) {
      const costLabel = makeTextLabel(`⭐ ${cost}`, '#ffffff', '#2a2440');
      costLabel.position.y = 2.45;
      costLabel.scale.multiplyScalar(0.7);
      this.root.add(costLabel);
    }
    parent.add(this.root);
  }
  get position(): THREE.Vector3 {
    return this.root.position;
  }
}

export class TaskStationEntity {
  root: THREE.Group;
  done = false;
  private icon: THREE.Mesh;
  constructor(
    public taskRef: string,
    pos: THREE.Vector3,
    parent: THREE.Group,
  ) {
    this.root = new THREE.Group();
    this.root.position.copy(pos);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 10), toonMat('#efe6d8'));
    base.position.y = 0.25;
    base.castShadow = true;
    this.root.add(base);
    this.icon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshToonMaterial({ color: '#7fe0d4', emissive: '#0a4a44' }),
    );
    this.icon.position.y = 1.3;
    this.root.add(this.icon);
    const task = C().content.tasks.get(taskRef);
    const label = makeTextLabel(task ? S(task.titleKey) : taskRef);
    label.position.y = 2.3;
    label.scale.multiplyScalar(0.8);
    this.root.add(label);
    parent.add(this.root);
  }
  get position(): THREE.Vector3 {
    return this.root.position;
  }
  update(dt: number, t: number): void {
    this.icon.rotation.y = t;
    this.icon.position.y = 1.3 + Math.sin(t * 2) * 0.08;
    (this.icon.material as THREE.MeshToonMaterial).color.set(this.done ? '#9ee89a' : '#7fe0d4');
  }
}

export class HazardEntity {
  root: THREE.Group;
  private t: number;
  active = false;
  constructor(
    public def: HazardDef,
    parent: THREE.Group,
  ) {
    this.root = new THREE.Group();
    this.root.position.set(...def.pos);
    this.t = def.phase ?? 0;
    if (def.type === 'steamVent') {
      const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.3, 10), toonMat('#6e5a3a'));
      grate.position.y = 0.15;
      this.root.add(grate);
    } else if (def.type === 'spikes') {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), toonMat('#c9ccd8'));
        spike.position.set((i % 3) * 0.4 - 0.4, 0.25, Math.floor(i / 3) * 0.4 - 0.2, );
        this.root.add(spike);
      }
    }
    parent.add(this.root);
  }
  update(dt: number, playerPos: THREE.Vector3, host: LevelHost): void {
    this.t += dt;
    const def = this.def;
    if (def.type === 'steamVent') {
      const interval = def.interval ?? 3;
      const cycle = this.t % interval;
      this.active = cycle > interval - 1.2;
      if (this.active && Math.random() < dt * 22) {
        C().particles.steam(this.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
      }
      if (this.active) {
        const d = playerPos.distanceTo(this.root.position);
        if (d < 1.1 && playerPos.y < this.root.position.y + 2.6) {
          host.hazardHit(def.damage ?? 0.5, 'steam');
        }
      }
    } else if (def.type === 'spikes') {
      const d2 = Math.hypot(playerPos.x - this.root.position.x, playerPos.z - this.root.position.z);
      if (d2 < 0.9 && Math.abs(playerPos.y - this.root.position.y) < 1) {
        host.hazardHit(def.damage ?? 0.5, 'spikes');
      }
    }
  }
}

// =========================================================== THE LEVEL ===
export class Level {
  group = new THREE.Group();
  platforms: PlatformEntity[] = [];
  chips: ChipEntity[] = [];
  hearts: HeartEntity[] = [];
  fossils: FossilEntity[] = [];
  npcs: NpcEntity[] = [];
  doors: DoorEntity[] = [];
  stations: TaskStationEntity[] = [];
  hazards: HazardEntity[] = [];
  triggers: { def: TriggerDef; fired: boolean }[] = [];
  spinningDecor: THREE.Object3D[] = [];
  private t = 0;

  constructor(
    public def: LevelDef,
    private host: LevelHost,
  ) {
    const { renderer, physics } = C();
    const built = buildGeometry(def.geometry);
    for (const v of built.visual) this.group.add(v);
    physics.buildStatic(built.collision);

    for (const d of def.decor ?? []) {
      const obj = buildDecor(d as DecorDef);
      this.group.add(obj);
      if (obj.userData.spin || obj.userData.spinZ) this.spinningDecor.push(obj);
    }
    for (const p of def.platforms ?? []) this.platforms.push(new PlatformEntity(p, this.group));
    this.expandCollectibles(def.collectibles ?? []);
    for (const f of def.fossils) {
      if (f.pos) {
        this.fossils.push(new FossilEntity(f, new THREE.Vector3(...f.pos), this.group, host.isFossilCollected(f.id)));
      }
    }
    for (const n of def.npcs ?? []) this.npcs.push(new NpcEntity(n, this.group));
    for (const d of def.doors ?? []) {
      this.doors.push(new DoorEntity(d.worldId, new THREE.Vector3(...d.pos), d.faceDeg ?? 0, this.group));
    }
    for (const tdef of def.triggers ?? []) this.triggers.push({ def: tdef, fired: false });
    for (const t of def.tasks ?? []) {
      this.stations.push(new TaskStationEntity(t.ref, new THREE.Vector3(...t.pos), this.group));
    }
    for (const h of def.hazards ?? []) this.hazards.push(new HazardEntity(h, this.group));

    renderer.scene.add(this.group);
    renderer.applyPalette(def.palette);
  }

  private expandCollectibles(defs: CollectibleDef[]): void {
    let i = 0;
    const place = (kind: 'chip' | 'heart', pos: THREE.Vector3) => {
      if (kind === 'chip') {
        const id = `${this.def.id}-chip-${i++}`;
        if (this.host.isChipCollected(id)) return;
        this.chips.push(new ChipEntity(id, pos, this.group));
      } else {
        this.hearts.push(new HeartEntity(pos, this.group));
      }
    };
    for (const c of defs) {
      if (c.pos) place(c.kind, new THREE.Vector3(...c.pos));
      if (c.arc) {
        const { center, radius, from, to, count, y } = c.arc;
        for (let k = 0; k < count; k++) {
          const a = (from + ((to - from) * k) / Math.max(1, count - 1)) * DEG;
          place(c.kind, new THREE.Vector3(center[0] + Math.cos(a) * radius, (y ?? center[1]) + 0.6, center[2] + Math.sin(a) * radius));
        }
      }
      if (c.line) {
        for (let k = 0; k < c.line.count; k++) {
          const t = c.line.count === 1 ? 0 : k / (c.line.count - 1);
          place(
            c.kind,
            new THREE.Vector3(
              c.line.from[0] + (c.line.to[0] - c.line.from[0]) * t,
              c.line.from[1] + (c.line.to[1] - c.line.from[1]) * t + 0.6,
              c.line.from[2] + (c.line.to[2] - c.line.from[2]) * t,
            ),
          );
        }
      }
    }
  }

  /** A stomp landed at pos — smash excavation plates, notify puzzles. */
  stompAt(pos: THREE.Vector3): boolean {
    let any = false;
    for (const p of this.platforms) {
      if (p.def.type === 'excavation' && p.mesh.position.distanceTo(pos) < 2.2) {
        if (p.smash()) {
          any = true;
          const data = p.def as unknown as { reveals?: string; chips?: number };
          if (data.reveals) {
            const f = this.fossils.find((fo) => fo.def.id === data.reveals);
            f?.reveal();
            const trig = this.triggers.find((tr) => tr.def.id === data.reveals);
            if (trig && !trig.fired) {
              trig.fired = true;
              this.host.triggerFired(trig.def);
            }
          }
        }
      }
    }
    return any;
  }

  revealFossil(id: string): void {
    this.fossils.find((f) => f.def.id === id)?.reveal();
  }

  dropHeart(pos: THREE.Vector3): void {
    this.hearts.push(new HeartEntity(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), this.group, true));
  }

  update(dt: number, playerPos: THREE.Vector3, playerPlatform: DynamicCollider | null): void {
    this.t += dt;
    for (const p of this.platforms) {
      p.update(dt, playerPlatform === p.collider);
    }
    for (const c of this.chips) c.update(dt, this.t, playerPos, this.host);
    this.hearts = this.hearts.filter((h) => h.update(dt, this.t, playerPos, this.host));
    for (const f of this.fossils) f.update(dt, this.t, playerPos, this.host);
    for (const n of this.npcs) n.update(dt, playerPos);
    for (const s of this.stations) s.update(dt, this.t);
    for (const h of this.hazards) h.update(dt, playerPos, this.host);
    for (const d of this.spinningDecor) {
      if (d.userData.spin) d.rotation.y += d.userData.spin * dt;
      if (d.userData.spinZ) d.children[0].rotation.z += d.userData.spinZ * dt;
    }
    for (const tr of this.triggers) {
      if (tr.fired && tr.def.kind !== 'exit' && tr.def.kind !== 'cafe' && tr.def.kind !== 'workshop') continue;
      const p = tr.def.pos;
      const d = Math.hypot(playerPos.x - p[0], playerPos.y - p[1], playerPos.z - p[2]);
      if (d < tr.def.radius) {
        if (!tr.fired) {
          tr.fired = true;
          this.host.triggerFired(tr.def);
        }
      } else if (tr.def.kind === 'exit' || tr.def.kind === 'cafe' || tr.def.kind === 'workshop') {
        tr.fired = false; // re-armable zone triggers
      }
    }
  }

  /** Nearest interactable within range: door, npc or task station. */
  nearestInteractable(playerPos: THREE.Vector3): { kind: 'door' | 'npc' | 'task'; label: string; act: () => void } | null {
    let best: { kind: 'door' | 'npc' | 'task'; label: string; act: () => void; d: number } | null = null;
    const consider = (kind: 'door' | 'npc' | 'task', pos: THREE.Vector3, range: number, label: string, act: () => void) => {
      const d = pos.distanceTo(playerPos);
      if (d < range && (!best || d < best.d)) best = { kind, label, act, d };
    };
    for (const door of this.doors) {
      consider('door', door.position, 3.4, S('ui.enterDoor'), () => this.host.doorInteract(door.worldId));
    }
    for (const npc of this.npcs) {
      consider('npc', npc.position, 2.8, S('ui.interact'), () => this.host.npcInteract(npc));
    }
    for (const st of this.stations) {
      consider('task', st.position, 2.9, S('ui.interact'), () => this.host.taskInteract(st.taskRef));
    }
    return best;
  }

  dispose(): void {
    C().renderer.scene.remove(this.group);
    C().physics.disposeStatic();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
      }
    });
  }
}
