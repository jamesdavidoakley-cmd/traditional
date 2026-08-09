/**
 * Types for everything under /content — the single vocabulary shared by the
 * loader, the validate script (mirrored in JSON Schema), and gameplay code.
 * Designers only ever touch /content; these shapes are the contract.
 */
import type { MusicDef } from '../engine/music';
import type { VoiceProfile } from '../engine/tts';

// ------------------------------------------------------------------ config
export interface GameConfig {
  movement: {
    runSpeed: number;
    accelTime: number;
    decelTime: number;
    airControl: number;
    jumpVelocity: number;
    doubleJumpVelocity: number;
    gravity: number;
    fallGravityMul: number;
    lowJumpGravityMul: number;
    maxFallSpeed: number;
    coyoteTime: number;
    jumpBuffer: number;
    turnRate: number;
    spinDuration: number;
    spinCooldown: number;
    stompHopTime: number;
    stompSlamSpeed: number;
    roarStunSecs: number;
    roarRadius: number;
    bouncePadVelocity: number;
    springBootsMul: number;
  };
  combat: {
    maxHearts: number;
    explorerBonusHearts: number;
    iframesSecs: number;
    hitPauseMs: number;
    spinDamage: number;
    stompDamage: number;
    spitDamage: number;
    knockback: number;
    telegraphMinSecs: number;
    explorerWindupMul: number;
    quizOrbHeal: number;
    contactDamage: number;
  };
  camera: {
    distances: number[];
    height: number;
    minPitch: number;
    maxPitch: number;
    followRate: number;
    rotateSpeed: number;
    collisionRadius: number;
  };
  economy: {
    chipsPerWorld: number;
    bonusChipTarget: number;
    brainPowerSegments: number;
    heartDropChance: number;
  };
  education: {
    promoteStreak: number;
    demoteMisses: number;
    xpPerCorrect: number;
    xpFirstTryBonus: number;
    masteryStarXp: number[];
    quizOrbWeakTopicBias: number;
  };
  dialogue: {
    banterCooldownSecs: number;
    idleNudgeSecs: number;
    barkCooldownSecs: number;
    subtitleMinMs: number;
  };
  ai: {
    decisionIntervalMin: number;
    decisionIntervalMax: number;
    softmaxBase: number;
    softmaxTrickeryScale: number;
    banRepeatCount: number;
    banRepeatAggressionExempt: number;
    habitWindow: number;
    threatBudgetWindow: number;
    threatBudgetBase: number;
    rubberbandDamageScale: number;
    traitNoise: number;
  };
}

// ---------------------------------------------------------------- registry
export interface WorldEntry {
  id: string;
  name: string; // string-table key
  doorCost: number;
  level?: string; // levels/<file>.json id; absent → comingSoon
  comingSoon?: boolean;
  hubDoorAngle?: number; // where its door sits on the plaza ring (degrees)
  colour?: string;
  icon?: string;
}
export interface Registry {
  finaleGateCost: number;
  worlds: WorldEntry[];
}

// -------------------------------------------------------------- characters
export interface CharacterDef {
  id: string;
  nameKey: string;
  colour: string;
  accent?: string;
  subtitleColour: string;
  voice: VoiceProfile;
  role?: string;
}
export interface CharactersFile {
  heroes: CharacterDef[];
  cast: CharacterDef[];
}

// ------------------------------------------------------------------ voices
/** Delivery pools keyed by context (§3.6). */
export interface VoicePackFile {
  characterId: string;
  pools: Record<string, string[]>;
}

// ---------------------------------------------------------------- dialogue
export interface DialogueLineDef {
  speaker: string;
  text: string;
  anim?: string;
}
export interface DialogueFile {
  id: string;
  skippable?: boolean;
  lines: DialogueLineDef[];
}
export interface BanterFile {
  id: 'banter';
  pairs: { id: string; worlds?: string[]; lines: DialogueLineDef[] }[];
}

// --------------------------------------------------------------- questions
export interface QuestionDef {
  id: string;
  subtopic?: string;
  tier: 1 | 2 | 3;
  type: 'quickfire';
  template: string;
  params?: Record<string, { min: number; max: number; step?: number; multipleOf?: number }>;
  /** JS-less arithmetic expression over params, e.g. "a*4" (safe mini-evaluator). */
  answerExpr?: string;
  answer?: string; // fixed-answer alternative
  distractorRules?: string[];
  distractors?: string[];
  askStyles: string[];
  hint: string;
  explain: string;
  unit?: string;
}
export interface QuestionPack {
  id: string;
  strand: 'maths' | 'science' | 'engineering';
  topic: string;
  topicNameKey: string;
  questions: QuestionDef[];
}

// ------------------------------------------------------------------- tasks
export type TaskArchetypeId = 'sort' | 'measure' | 'path' | 'quickfire' | 'build' | 'circuit' | 'shadow' | 'fraction';

export interface SortItemDef {
  id: string;
  label: string;
  category: string;
  shape?: string;
  colour?: string;
  fact?: string;
}
export interface TaskDef {
  id: string;
  archetype: TaskArchetypeId;
  titleKey: string;
  topicId: string;
  companion: string; // preferred teacher; ask rotation still applies
  introKey?: string;
  sort?: {
    categories: { id: string; labelKey: string; colour: string }[];
    items: SortItemDef[];
    itemsPerRound: Record<string, number>; // per tier: "1" | "2" | "3"
  };
  measure?: {
    mode: 'jug' | 'scales' | 'money';
    prompts: { tier: number; target: number; unit: string; text: string; hint: string; explain: string }[];
  };
  path?: {
    mode: 'multiples' | 'sequence' | 'coordinates';
    tiers: Record<string, { table?: number; start?: number; step?: number; length: number; decoys?: number }>;
  };
  quickfire?: { topicId?: string; count: number };
  build?: {
    mode: 'gears' | 'counterweight' | 'springs' | 'bridge';
    tiers: Record<string, Record<string, number | string | boolean>>;
  };
  reward?: { fossilId?: string; gadgetId?: string; brainPower?: number };
}

// ----------------------------------------------------------------- enemies
export interface EnemyDef {
  id: string;
  nameKey: string;
  behaviour: 'scout' | 'brute' | 'tinkerer' | 'buzzer';
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  height: number;
  aggroRange: number;
  attackRange: number;
  colour: string;
  accent?: string;
  scale?: number;
  fleeAtHp?: number;
  traits?: Partial<TraitVector>;
  chipDrop?: number;
}

// ---------------------------------------------------------------- movesets
export type MoveTag =
  | 'strike'
  | 'heavy'
  | 'combo'
  | 'ranged'
  | 'defend'
  | 'reposition'
  | 'approach'
  | 'retreat'
  | 'flourish'
  | 'feint'
  | 'wait'
  | 'summon'
  | 'heal';

export interface MoveDef {
  id: string;
  nameKey?: string;
  tags: MoveTag[];
  /** Preferred engagement distance band: 0 close · 1 mid · 2 far (multiplier per band). */
  bandWeights: [number, number, number];
  baseWeight: number;
  windup: number;
  active: number;
  recover: number;
  damage?: number;
  motion?: 'lunge' | 'hold' | 'stepback' | 'circle' | 'jump' | 'none' | 'chase';
  projectile?: boolean;
  telegraph?: string; // visual style id
}
export interface MovesetDef {
  id: string;
  moves: MoveDef[];
}

// ------------------------------------------------------------------ bosses
export interface TraitVector {
  aggression: number;
  caution: number;
  trickery: number;
  patience: number;
  showmanship: number;
}
export interface AbilityTriggerDef {
  type: 'onHpBelow' | 'onPlayerStreak' | 'onDistanceHeld' | 'onTimer' | 'onPhaseEnter' | 'onAllyDown';
  value: number;
  range?: 'near' | 'far';
}
export interface AbilityDef {
  id: string;
  trigger: AbilityTriggerDef;
  effect: string;
  counter?: string;
  once?: boolean;
  cooldown?: number;
}
export interface BossDef {
  id: string;
  nameKey: string;
  titleKey?: string;
  world: string;
  hp: number;
  phases: number;
  traits: TraitVector;
  moveset: string;
  abilities: AbilityDef[];
  voicePack: string;
  scale?: number;
  colour: string;
  accent?: string;
  weapon?: 'sword_shield' | 'spanner_lance' | 'daggers' | 'wrench' | 'pickaxe' | 'none';
  speed?: number;
  contactDamage?: number;
  miniBoss?: boolean;
  randomTraits?: boolean; // mini-bosses: re-roll trait noise each encounter
  gimmick?: string; // arena gimmick module id, e.g. "gear_shield_puzzle"
  cafeGameKey?: string;
}

// ------------------------------------------------------------------ levels
export type Vec3 = [number, number, number];

export interface GeomDef {
  type: 'box' | 'cylinder' | 'ramp' | 'gen';
  pos?: Vec3;
  size?: Vec3; // box: w,h,d · cylinder: [radiusTop, height, radiusBottom]
  rot?: Vec3; // degrees
  colour?: string;
  collide?: boolean;
  gen?: string; // generator name (engine-provided recipe)
  params?: Record<string, unknown>;
  segments?: number;
}
export interface DecorDef {
  type: string; // boneArch | cactus | crystal | bigGear | pipe | tree | rock | sign | lamp ...
  pos: Vec3;
  rot?: Vec3;
  scale?: number;
  colour?: string;
  text?: string; // for signs
}
export interface PlatformDef {
  id?: string;
  type: 'lift' | 'rotor' | 'conveyor' | 'crumble' | 'bounce' | 'pendulum' | 'excavation';
  pos: Vec3;
  size?: Vec3;
  colour?: string;
  axis?: Vec3;
  speed?: number;
  range?: number;
  radius?: number;
  phase?: number;
  direction?: Vec3;
  requiresGadget?: string;
}
export interface HazardDef {
  type: 'spikes' | 'steamVent' | 'magma' | 'crusher';
  pos: Vec3;
  size?: Vec3;
  interval?: number;
  phase?: number;
  damage?: number;
}
export interface CollectibleDef {
  kind: 'chip' | 'heart';
  pos?: Vec3;
  /** batch placement helpers */
  arc?: { center: Vec3; radius: number; from: number; to: number; count: number; y?: number };
  line?: { from: Vec3; to: Vec3; count: number };
}
export interface FossilPlacement {
  id: string;
  kind: 'task' | 'secret' | 'platforming' | 'arena' | 'boss' | 'bonus' | 'garden';
  nameKey: string;
  hintKey: string;
  hintSpeaker: string;
  pos?: Vec3; // for platforming/secret fossils placed in the world
  taskRef?: string;
  bossRef?: string;
}
export interface NpcDef {
  id: string;
  character: string;
  pos: Vec3;
  faceDeg?: number;
  role?: 'workshop' | 'arena' | 'digsite' | 'cafe' | 'greeter';
  dialogueId?: string;
}
export interface DoorDef {
  worldId: string;
  pos: Vec3;
  faceDeg?: number;
}
export interface TriggerDef {
  id: string;
  kind: 'secretSniff' | 'checkpoint' | 'arenaGate' | 'zoneName' | 'exit' | 'cafe' | 'workshop' | 'garden';
  pos: Vec3;
  radius: number;
  data?: Record<string, unknown>;
}
export interface EnemySpawnDef {
  ref: string;
  pos: Vec3;
  patrolRadius?: number;
}
export interface ArenaDef {
  id: string;
  bossRef: string;
  fossilId: string;
  center: Vec3;
  radius: number;
  entrance: Vec3;
  gimmickPos?: Vec3[];
  quizOrbs?: number;
}
export interface LevelDef {
  id: string;
  nameKey: string;
  music: string;
  /** Themed worlds: fossil awarded for banking 80 Amber Chips here (§4.3). */
  bonusFossilId?: string;
  palette: {
    sky: [string, string]; // top, horizon
    fog: string;
    fogNear: number;
    fogFar: number;
    sun: string;
    sunIntensity: number;
    ambient: string;
    ambientIntensity: number;
    ground: string;
  };
  spawn: Vec3;
  spawnFaceDeg?: number;
  killY: number;
  geometry: GeomDef[];
  decor?: DecorDef[];
  platforms?: PlatformDef[];
  hazards?: HazardDef[];
  collectibles?: CollectibleDef[];
  fossils: FossilPlacement[];
  npcs?: NpcDef[];
  doors?: DoorDef[];
  triggers?: TriggerDef[];
  enemies?: EnemySpawnDef[];
  arenas?: ArenaDef[];
  tasks?: { ref: string; pos: Vec3; faceDeg?: number }[];
  factsKey?: string; // loading-screen fun facts pool
}

// ------------------------------------------------------------------- music
export type { MusicDef };

export interface ContentDB {
  config: GameConfig;
  registry: Registry;
  characters: CharactersFile;
  strings: Record<string, string>;
  voices: Map<string, VoicePackFile>;
  dialogue: Map<string, DialogueFile>;
  banter: BanterFile | null;
  questionPacks: Map<string, QuestionPack>;
  topics: Map<string, QuestionPack>; // topicId → pack
  tasks: Map<string, TaskDef>;
  enemies: Map<string, EnemyDef>;
  movesets: Map<string, MovesetDef>;
  bosses: Map<string, BossDef>;
  levels: Map<string, LevelDef>;
  music: Map<string, MusicDef>;
}
