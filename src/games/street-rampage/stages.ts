/**
 * Stage, wave and enemy definitions. Pure data (no Phaser).
 */

/** street depth band (feet y) */
export const Y_MIN = 196;
export const Y_MAX = 274;
export const VIEW_W = 320;

export type EnemyType = "thug" | "thugFast" | "kicker" | "punk" | "brute" | "rex" | "boss";
export type ItemKind = "burger" | "shake" | "cash" | "watch" | "gem";
export type PropKind = "can" | "crate" | "drum" | "booth" | "vending";
export type HazardKind = "car" | "barrel" | "pot";
export type Theme = "alley" | "downtown" | "casino";

export interface Spawn {
  type: EnemyType;
  /** L / R = walk in from that screen edge, T = drop from above */
  side: "L" | "R" | "T";
  /** ms after the wave starts (or after the previous spawn when queued) */
  delay?: number;
  y?: number;
  drop?: ItemKind;
}

export interface HazardSpec {
  kind: HazardKind;
  /** min / max ms between events */
  min: number;
  max: number;
}

export interface Wave {
  /** camera x where the screen locks */
  at: number;
  spawns: Spawn[];
  maxAlive: number;
  boss?: boolean;
  hazards?: HazardSpec[];
}

export interface PropSpec {
  kind: PropKind;
  x: number;
  y: number;
  drop?: ItemKind;
}

export interface Zone {
  x0: number;
  x1: number;
  hazard: HazardSpec;
}

export interface StageDef {
  n: number;
  title: string;
  theme: Theme;
  worldW: number;
  waves: Wave[];
  props: PropSpec[];
  zones: Zone[];
  maxAttackers: number;
}

export interface EnemyDef {
  kind: "thug" | "punk" | "brute" | "rex";
  looks: string[];
  names: string[];
  hp: number;
  speed: number;
  hw: number;
  h: number;
  /** light hits absorbed before flinching (0 = always flinch) */
  armor: number;
  /** knockback multiplier */
  weight: number;
  /** delay range between decisions (ms) */
  think: readonly [number, number];
  score: number;
  /** probability of a drop when defeated */
  dropChance: number;
}

export const ENEMIES: Record<Exclude<EnemyType, "boss">, EnemyDef> = {
  thug: { kind: "thug", looks: ["thugA"], names: ["SPIKE", "LOUIE", "DEXTER", "MOE"], hp: 34, speed: 48, hw: 10, h: 48, armor: 0, weight: 1, think: [500, 1100], score: 200, dropChance: 0.12 },
  thugFast: { kind: "thug", looks: ["thugB"], names: ["VINNIE", "RICKY", "SAL"], hp: 30, speed: 66, hw: 10, h: 48, armor: 0, weight: 1.05, think: [350, 800], score: 220, dropChance: 0.12 },
  kicker: { kind: "thug", looks: ["thugC"], names: ["DUKE", "JAMAL", "TYRELL"], hp: 40, speed: 54, hw: 10, h: 48, armor: 0, weight: 1, think: [400, 900], score: 260, dropChance: 0.15 },
  punk: { kind: "punk", looks: ["punkA", "punkB"], names: ["SLASH", "RIPPER", "SHIV", "RAZZ"], hp: 32, speed: 60, hw: 9, h: 50, armor: 0, weight: 1.1, think: [500, 1000], score: 300, dropChance: 0.15 },
  brute: { kind: "brute", looks: ["bruteA", "bruteB"], names: ["TANK", "BULLDOZER", "MOOSE"], hp: 80, speed: 36, hw: 15, h: 56, armor: 2, weight: 0.65, think: [700, 1300], score: 500, dropChance: 0.35 },
  rex: { kind: "rex", looks: ["rex"], names: ["RAZOR REX"], hp: 190, speed: 58, hw: 12, h: 56, armor: 3, weight: 0.7, think: [300, 700], score: 3000, dropChance: 1 },
};

export const BOSS_HP = 320;
export const BOSS_NAME = "DON HUSTLO";

export const STAGES: StageDef[] = [
  {
    n: 1,
    title: "BACK ALLEY",
    theme: "alley",
    worldW: 1600,
    maxAttackers: 2,
    zones: [],
    props: [
      { kind: "can", x: 170, y: 214, drop: "burger" },
      { kind: "crate", x: 410, y: 252, drop: "cash" },
      { kind: "can", x: 690, y: 206 },
      { kind: "can", x: 720, y: 222, drop: "shake" },
      { kind: "crate", x: 1030, y: 244, drop: "watch" },
      { kind: "drum", x: 1240, y: 210, drop: "burger" },
      { kind: "can", x: 1420, y: 260, drop: "cash" },
    ],
    waves: [
      {
        at: 160,
        maxAlive: 3,
        spawns: [
          { type: "thug", side: "R", delay: 300 },
          { type: "thug", side: "R", delay: 900 },
          { type: "thug", side: "L", delay: 1600 },
        ],
      },
      {
        at: 520,
        maxAlive: 3,
        spawns: [
          { type: "thugFast", side: "R", delay: 200 },
          { type: "thug", side: "T", delay: 600 },
          { type: "thug", side: "L", delay: 900 },
          { type: "thugFast", side: "R", delay: 1200, drop: "burger" },
        ],
      },
      {
        at: 880,
        maxAlive: 3,
        spawns: [
          { type: "kicker", side: "R", delay: 200 },
          { type: "thug", side: "L", delay: 600 },
          { type: "thugFast", side: "T", delay: 1000 },
          { type: "kicker", side: "R", delay: 1400 },
          { type: "thug", side: "L", delay: 1800 },
        ],
      },
      {
        at: 1280,
        maxAlive: 3,
        spawns: [
          { type: "brute", side: "R", delay: 400, drop: "shake" },
          { type: "thug", side: "L", delay: 900 },
          { type: "thugFast", side: "R", delay: 1500 },
          { type: "kicker", side: "L", delay: 2400 },
        ],
      },
    ],
  },
  {
    n: 2,
    title: "DOWNTOWN CHAOS",
    theme: "downtown",
    worldW: 1920,
    maxAttackers: 2,
    zones: [
      { x0: 380, x1: 620, hazard: { kind: "pot", min: 900, max: 1700 } },
      { x0: 1180, x1: 1340, hazard: { kind: "pot", min: 800, max: 1500 } },
    ],
    props: [
      { kind: "can", x: 200, y: 208, drop: "burger" },
      { kind: "booth", x: 470, y: 200, drop: "cash" },
      { kind: "crate", x: 760, y: 256, drop: "shake" },
      { kind: "vending", x: 980, y: 202, drop: "watch" },
      { kind: "drum", x: 1290, y: 246, drop: "burger" },
      { kind: "can", x: 1520, y: 214, drop: "cash" },
      { kind: "crate", x: 1560, y: 258, drop: "shake" },
    ],
    waves: [
      {
        at: 200,
        maxAlive: 3,
        spawns: [
          { type: "thug", side: "R", delay: 200 },
          { type: "punk", side: "L", delay: 800 },
          { type: "thugFast", side: "R", delay: 1300 },
        ],
      },
      {
        at: 640,
        maxAlive: 3,
        hazards: [{ kind: "car", min: 4200, max: 6500 }],
        spawns: [
          { type: "punk", side: "R", delay: 300 },
          { type: "kicker", side: "L", delay: 700 },
          { type: "brute", side: "R", delay: 1500, drop: "burger" },
          { type: "punk", side: "L", delay: 2200 },
        ],
      },
      {
        at: 1040,
        maxAlive: 3,
        hazards: [{ kind: "barrel", min: 3500, max: 5500 }],
        spawns: [
          { type: "thugFast", side: "R", delay: 200 },
          { type: "punk", side: "T", delay: 700 },
          { type: "kicker", side: "L", delay: 1100 },
          { type: "brute", side: "R", delay: 1800 },
          { type: "punk", side: "L", delay: 2400 },
        ],
      },
      {
        at: 1600,
        maxAlive: 3,
        boss: true,
        hazards: [{ kind: "car", min: 7000, max: 10000 }],
        spawns: [
          { type: "rex", side: "R", delay: 600 },
          { type: "punk", side: "L", delay: 9000 },
          { type: "thugFast", side: "R", delay: 9000 },
        ],
      },
    ],
  },
  {
    n: 3,
    title: "THE BIG BOSS",
    theme: "casino",
    worldW: 1360,
    maxAttackers: 2,
    zones: [],
    props: [
      { kind: "crate", x: 180, y: 250, drop: "burger" },
      { kind: "vending", x: 420, y: 202, drop: "shake" },
      { kind: "drum", x: 760, y: 214, drop: "gem" },
      { kind: "can", x: 840, y: 258, drop: "burger" },
    ],
    waves: [
      {
        at: 160,
        maxAlive: 3,
        spawns: [
          { type: "brute", side: "R", delay: 300 },
          { type: "punk", side: "L", delay: 800 },
          { type: "punk", side: "R", delay: 1500 },
        ],
      },
      {
        at: 560,
        maxAlive: 4,
        spawns: [
          { type: "kicker", side: "R", delay: 200 },
          { type: "thugFast", side: "L", delay: 500 },
          { type: "thug", side: "T", delay: 900 },
          { type: "brute", side: "R", delay: 1400, drop: "shake" },
          { type: "punk", side: "L", delay: 2000 },
        ],
      },
      {
        at: 1040,
        maxAlive: 4,
        boss: true,
        spawns: [{ type: "boss", side: "R", delay: 300 }],
      },
    ],
  },
];

/** Heal amounts and score values of pickups */
export const ITEM_INFO: Record<ItemKind, { heal: number; score: number; power: number }> = {
  burger: { heal: 30, score: 100, power: 0 },
  shake: { heal: 55, score: 200, power: 100 },
  cash: { heal: 0, score: 500, power: 0 },
  watch: { heal: 0, score: 1500, power: 0 },
  gem: { heal: 0, score: 3000, power: 0 },
};

export const PROP_INFO: Record<PropKind, { hp: number; hw: number; h: number; debris: number[] }> = {
  can: { hp: 2, hw: 9, h: 24, debris: [0, 1, 1, 5, 6] },
  crate: { hp: 3, hw: 11, h: 22, debris: [2, 2, 3, 3, 2] },
  drum: { hp: 3, hw: 9, h: 24, debris: [1, 1, 0, 6, 1] },
  booth: { hp: 5, hw: 12, h: 56, debris: [4, 4, 4, 1, 1, 2] },
  vending: { hp: 5, hw: 13, h: 46, debris: [4, 4, 1, 1, 7, 7, 7] },
};

/** Validate stage data (used by tests / dev sanity checks). Returns a list of problems. */
export function validateStages(): string[] {
  const errs: string[] = [];
  for (const s of STAGES) {
    let last = -1;
    for (const w of s.waves) {
      if (w.at <= last) errs.push(`stage ${s.n}: wave at ${w.at} not increasing`);
      if (w.at + VIEW_W > s.worldW) errs.push(`stage ${s.n}: wave at ${w.at} beyond world`);
      if (w.spawns.length === 0) errs.push(`stage ${s.n}: empty wave`);
      last = w.at;
    }
    for (const p of s.props) {
      if (p.y < Y_MIN || p.y > Y_MAX) errs.push(`stage ${s.n}: prop y ${p.y} outside band`);
      if (p.x < 20 || p.x > s.worldW - 20) errs.push(`stage ${s.n}: prop x ${p.x} outside world`);
    }
  }
  return errs;
}
