/**
 * Character art: builds (proportions + outfits) and frame tables for SCAMBOY, the gang
 * and the bosses. Pure (no Phaser) — registration lives in register.ts.
 */
import type { PixelCanvas } from "../engine/pixel";
import { PAL } from "../engine/palette";
import { renderFigure, type Build, type Ctx, type Pose } from "./figure";
import { mix, mul, rampOf, type Ramp, type P } from "./doll";
import * as PZ from "./poses";
import { scamHead, SCAM_HEAD_PAL, thugHead, punkHead, bruteHead, rexHead, donHead, headPal } from "./heads";

// ------------------------------------------------------------------ ramps

export const SKIN: Ramp = [0xffe9cf, 0xf4c9a0, 0xdb9b72, 0xa5634a];
const SKIN_TAN: Ramp = [0xf2c39a, 0xd99c6c, 0xb5764c, 0x7c4a2e];
const SKIN_DARK: Ramp = [0xc98d62, 0xa0663f, 0x7c4a2c, 0x4e2a18];
const SKIN_PALE: Ramp = [0xfff1e2, 0xf6d8bc, 0xe0b090, 0xaa7a62];
const TANK: Ramp = [0xffffff, 0xf6f3ec, 0xd9d4ca, 0x9d97a8];
const NAVY: Ramp = [0x6577bd, 0x3c4f96, 0x1d2a5c, 0x0f1636];
const RED_SHOE: Ramp = [0xff8d8d, 0xe63946, 0xb02533, 0x64101c];
const MAG: Ramp = [0xffa6c9, 0xf0609a, 0xd02a6b, 0x7e1240];
const DENIM: Ramp = [0x7f9fd8, 0x4c6fb4, 0x2f4f8f, 0x1b2f5a];
const BLACK_LEATHER: Ramp = [0x6a6a7c, 0x45454f, 0x2a2a33, 0x16161c];
const BOOT: Ramp = [0x8a6a4a, 0x5c4630, 0x3e2c1c, 0x22160c];
const GOLD: Ramp = [0xfff2a8, 0xffd23f, 0xd19a1a, 0x8a5a10];

// ------------------------------------------------------------------ frame tables

export const FRAME = { w: 64, h: 64, ax: 32, ay: 62 };
export const EFRAME = { w: 72, h: 72, ax: 36, ay: 70 };
export const BFRAME = { w: 128, h: 128, ax: 64, ay: 126 };

/** SCAMBOY frame indices */
export const PF = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  jab: [10, 11],
  cross: [12, 13],
  upper: [14, 15, 16],
  jumpRise: 17,
  jumpFall: 18,
  dive: 19,
  hurt: [20, 21],
  kdAir: 22,
  lying: 23,
  getup: 24,
  flexGather: 25,
  flexBiceps: 26,
  vicMost: 27,
  vicSingle: 28,
  dash: 29,
  shoulder: 30,
  crouch: 31,
  vicBicepsGrin: 32,
} as const;

function playerPoses(): Pose[] {
  const out: Pose[] = [];
  out.push(...PZ.idleFrames());
  out.push(...PZ.walkFrames(6));
  out.push(PZ.JAB_A, PZ.JAB_B, PZ.CROSS_A, PZ.CROSS_B);
  out.push(PZ.UPPER_WIND, PZ.UPPER_HIT, PZ.UPPER_END);
  out.push(PZ.JUMP_RISE, PZ.JUMP_FALL, PZ.DIVE);
  out.push(PZ.HURT_A, PZ.HURT_B, PZ.KD_AIR, PZ.LYING, PZ.GETUP);
  out.push(PZ.FLEX_GATHER, PZ.FLEX_BICEPS, PZ.FLEX_MOST, PZ.FLEX_SINGLE);
  out.push(PZ.DASH, PZ.SHOULDER, PZ.CROUCH, PZ.FLEX_BICEPS_GRIN);
  return out;
}

/** shared enemy frame indices */
export const EF = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  windup: 10,
  hit: 11,
  recover: 12,
  windup2: 13,
  hit2: 14,
  hurt: [15, 16],
  kdAir: 17,
  lying: 18,
  getup: 19,
  dash: 20,
  jump: 21,
  taunt: 22,
} as const;

interface EnemyPoseSet {
  windup: Pose;
  hit: Pose;
  recover: Pose;
  windup2: Pose;
  hit2: Pose;
  dash: Pose;
}

function enemyPoses(set: EnemyPoseSet, stance: Pose = PZ.STANCE): Pose[] {
  const out: Pose[] = [];
  out.push(...PZ.idleFrames(stance));
  out.push(...PZ.walkFrames(6, stance, 7));
  out.push(set.windup, set.hit, set.recover, set.windup2, set.hit2);
  out.push(PZ.HURT_A, PZ.HURT_B, PZ.KD_AIR, PZ.LYING, PZ.GETUP);
  out.push(set.dash, PZ.JUMP_RISE, PZ.TAUNT);
  return out;
}

const PUNCH_SET: EnemyPoseSet = {
  windup: { ...PZ.UPPER_WIND, hip: [-1, -22], neck: [-3, -40], hN: [-12, -32], eN: [-21, -30], expr: "shout" },
  hit: PZ.CROSS_A,
  recover: PZ.CROSS_B,
  windup2: PZ.CROUCH,
  hit2: PZ.KICK,
  dash: PZ.DASH,
};

/** BOSS frame indices */
export const BF = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  chargeWind: 10,
  charge: 11,
  slamUp: 12,
  slamAir: 13,
  slamDown: 14,
  reach: 15,
  hold: 16,
  throw: 17,
  whistle: 18,
  punchWind: 19,
  punch: 20,
  hurt: [21, 22],
  kdAir: 23,
  lying: 24,
  getup: 25,
  taunt: 26,
  toss: 27,
} as const;

function bossPoses(): Pose[] {
  const st = PZ.STANCE;
  const out: Pose[] = [];
  out.push(...PZ.idleFrames(st));
  out.push(...PZ.walkFrames(6, st, 7));
  out.push(PZ.CROUCH, PZ.SHOULDER, PZ.HAMMER_UP, { ...PZ.JUMP_RISE, hN: [-4, -56], hF: [2, -57], eN: undefined, eF: undefined, expr: "shout" }, PZ.HAMMER_DOWN);
  out.push(PZ.REACH, PZ.HOLD_UP, { ...PZ.SWING_HIT, handN: "open", handF: "open" }, PZ.WHISTLE);
  out.push(PUNCH_SET.windup, PZ.CROSS_A);
  out.push(PZ.HURT_A, PZ.HURT_B, PZ.KD_AIR, PZ.LYING, PZ.GETUP);
  out.push({ ...PZ.TAUNT, expr: "grin" }, { ...PZ.SWING_UP, handN: "open", expr: "grin" });
  return out;
}

// ------------------------------------------------------------------ decorations

const S_LOGO = ["MMM", "M..", "MMM", "..M", "MMM"];

function scamDecor(c: Ctx) {
  const { l, N, upright, H } = c;
  // tank top scoop neckline
  const sc = N(2, 3.2);
  if (upright) l.ell(sc[0], sc[1], 5.5, 3.2, SKIN, 0.1);
  // belt
  const b0 = H(-8, 1.4);
  const b1 = H(8, 1.4);
  l.line(b0, b1, PAL.navyDark, 2);
  const bk = H(1, 1.4);
  l.rect(Math.round(bk[0]) - 1, Math.round(bk[1]) - 1, 3, 2, PAL.yellow);
  if (upright) {
    const p = N(3.5, 8.5);
    l.art(S_LOGO, { M: PAL.magenta }, Math.round(p[0]), Math.round(p[1]));
  }
}

function dots(c: Ctx, from: P, to: P, sag: number, n: number, col: number, hi: number) {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * sag;
    c.l.rect(Math.round(x), Math.round(y), 2, 2, col);
    c.l.px(Math.round(x), Math.round(y), hi);
  }
}

const SUIT: Ramp = [0xc9a0ff, 0x9a6ae0, 0x6a3fb0, 0x3a1f6e];
const SHIRT: Ramp = [0x5a4a6a, 0x3a2a48, 0x241a30, 0x120c18];

function donDecor(c: Ctx) {
  const { l, N, H, m, upright } = c;
  if (upright) {
    // open collar: dark shirt V with gold chain and $ medallion
    l.poly([N(-5.5, 0.5), N(6.5, 0.5), N(0.8, 15)], SHIRT, 0);
    l.line(N(-5.5, 0.5), N(0.8, 15), SUIT[0], Math.max(1, Math.round(m)));
    l.line(N(6.5, 0.5), N(0.8, 15), SUIT[1], Math.max(1, Math.round(m)));
    dots(c, N(-4.5, 1.5), N(5.5, 1.5), 7.5 * m * 0.6, 9, PAL.yellowDark, PAL.yellow);
    const md = N(0.6, 10.5);
    l.ell(md[0], md[1] + 1, 4.2, 4.2, GOLD, 0.1);
    l.art([".K.", "KKK", "K..", "KKK", "..K", "KKK", ".K."], { K: PAL.yellowDark }, Math.round(md[0]) - 1, Math.round(md[1]) - 2);
    // pocket square
    const ps = N(9, 8);
    l.poly([add2(ps, -2, 0), add2(ps, 3, 0), add2(ps, 1, -3)], MAG, 0);
  }
  l.line(H(-8, 1.4), H(8, 1.4), GOLD[2], Math.max(1, Math.round(m)));
}

function add2(p: P, x: number, y: number): P {
  return [p[0] + x, p[1] + y];
}

function rexDecor(c: Ctx) {
  const { l, N, H, m, upright } = c;
  // open leather vest
  l.cap(N(-8.5, 4), H(-7, 3), 4.4 * m, 4.2 * m, BLACK_LEATHER);
  l.cap(N(8.5, 4), H(7.5, 3), 3.6 * m, 3.4 * m, BLACK_LEATHER, -0.05);
  // studs
  if (upright) {
    for (let i = 0; i < 4; i++) {
      const p = N(-9 + (i % 2), 6 + i * 4);
      l.px(Math.round(p[0]), Math.round(p[1]), 0xd8dce6);
    }
  }
  l.line(H(-8, 1.4), H(8, 1.4), 0x2a1a10, 2);
  const bk = H(1, 1.4);
  l.rect(Math.round(bk[0]) - 1, Math.round(bk[1]) - 1, 4, 3, 0xd8dce6);
}

function teeDecor(c: Ctx) {
  const { l, H } = c;
  l.line(H(-8, 1.4), H(8, 1.4), 0x241a14, 2);
}

function punkDecor(c: Ctx) {
  const { l, N, H, m } = c;
  l.cap(N(-8, 4), H(-7, 3), 4 * m, 3.8 * m, BLACK_LEATHER);
  l.cap(N(8, 4), H(7, 3), 3.3 * m, 3.2 * m, BLACK_LEATHER, -0.05);
  if (c.upright) {
    const z = N(7, 8);
    l.line(z, N(7.5, 17), 0xd8dce6);
    const p = N(1, 9);
    l.art(["K.K", ".K.", "K.K"], { K: PAL.red }, Math.round(p[0]), Math.round(p[1]));
  }
  l.line(H(-8, 1.4), H(8, 1.4), 0x1a1214, 2);
}

function bruteDecor(c: Ctx) {
  const { l, N, H, m, upright } = c;
  // overall straps
  const strap: Ramp = [0x9fc06b, 0x6f9440, 0x4d6e2a, 0x2e4618];
  l.cap(N(-6, 2), H(-5, 6), 1.7 * m, 1.7 * m, strap);
  l.cap(N(6, 2), H(6, 6), 1.5 * m, 1.5 * m, strap, -0.05);
  if (upright) {
    const b = N(-5, 12);
    l.rect(Math.round(b[0]) - 1, Math.round(b[1]), 3, 3, PAL.yellow);
  }
  l.line(H(-9, 1.4), H(9, 1.4), strap[3], 2);
}

// ------------------------------------------------------------------ builds

export const PLAYER_BUILD: Build = {
  sx: 1,
  sy: 1,
  m: 1,
  muscle: 1,
  shoulder: 13,
  chestR: 12,
  waistR: 7,
  armR: 5,
  legR: 5.8,
  neckR: 3.6,
  skin: SKIN,
  top: TANK,
  sleeve: "none",
  pants: NAVY,
  shoe: RED_SHOE,
  sole: PAL.white,
  toe: PAL.white,
  wrist: MAG,
  head: scamHead,
  headPal: SCAM_HEAD_PAL,
  headOff: [1, 6],
  decor: scamDecor,
};

export type EnemyKind = "thug" | "punk" | "brute" | "rex";

export interface EnemyLook {
  key: string;
  kind: EnemyKind;
  build: Build;
}

function thugBuild(skin: Ramp, top: Ramp, pants: Ramp, beanie: number, sleeve: "short" | "long" | "none", hair = PAL.hair): Build {
  return {
    sx: 0.82,
    sy: 0.93,
    m: 0.74,
    muscle: 0.3,
    shoulder: 11,
    chestR: 10.5,
    waistR: 8.8,
    armR: 4.4,
    legR: 5,
    neckR: 3,
    skin,
    top,
    sleeve,
    sleeveRamp: top,
    cuff: sleeve === "long" ? rampOf(mul(top[2], 0.8)) : undefined,
    pants,
    shoe: [0xf4f4f4, 0xdadada, 0xa8a8b4, 0x5e5e6e],
    sole: 0x3a3a46,
    toe: 0xffffff,
    head: thugHead,
    headPal: headPal({ B: beanie, b: mul(beanie, 0.7), S: skin[1], s: skin[2], g: mix(skin[2], 0x2a2a3a, 0.45), H: hair }),
    headOff: [1, 6.5],
    decor: teeDecor,
  };
}

export const LOOKS: Record<string, EnemyLook> = {
  thugA: {
    key: "thugA",
    kind: "thug",
    build: thugBuild(SKIN_TAN, rampOf(0xc0392b), DENIM, 0x2b2b35, "short"),
  },
  thugB: {
    key: "thugB",
    kind: "thug",
    build: thugBuild(SKIN_PALE, rampOf(0x3f8f4a), rampOf(0x5b5d6b), 0xe07a1f, "none"),
  },
  thugC: {
    key: "thugC",
    kind: "thug",
    build: thugBuild(SKIN_DARK, rampOf(0x6a3fa0), rampOf(0x2e2e3a), 0xe0c040, "long"),
  },
  punkA: {
    key: "punkA",
    kind: "punk",
    build: {
      ...thugBuild(SKIN_PALE, TANK, rampOf(0x3a4a7a), 0, "long"),
      sx: 0.78,
      sy: 0.95,
      m: 0.66,
      muscle: 0.2,
      sleeveRamp: BLACK_LEATHER,
      cuff: rampOf(0x5a5a66),
      shoe: BOOT,
      sole: 0x1a1214,
      toe: undefined,
      head: punkHead,
      headPal: headPal({ M: PAL.magenta, m: PAL.magentaLight, S: SKIN_PALE[1], s: SKIN_PALE[2], W: 0x8ae0ff }),
      headOff: [1, 7.5],
      item: "knife",
      itemHand: "far",
      decor: punkDecor,
    },
  },
  punkB: {
    key: "punkB",
    kind: "punk",
    build: {
      ...thugBuild(SKIN_TAN, rampOf(0xe0c040), rampOf(0x2e2e3a), 0, "long"),
      sx: 0.78,
      sy: 0.95,
      m: 0.66,
      muscle: 0.2,
      sleeveRamp: BLACK_LEATHER,
      cuff: rampOf(0x5a5a66),
      shoe: BOOT,
      sole: 0x1a1214,
      toe: undefined,
      head: punkHead,
      headPal: headPal({ M: PAL.green, m: 0x9cf0a0, S: SKIN_TAN[1], s: SKIN_TAN[2], W: 0xff8a8a }),
      headOff: [1, 7.5],
      item: "knife",
      itemHand: "far",
      decor: punkDecor,
    },
  },
  bruteA: {
    key: "bruteA",
    kind: "brute",
    build: {
      sx: 1.06,
      sy: 1.02,
      m: 1.12,
      muscle: 0.45,
      shoulder: 13,
      chestR: 11.5,
      waistR: 11,
      armR: 5.2,
      legR: 6.2,
      neckR: 4.2,
      belly: 8.5,
      skin: SKIN,
      top: rampOf(0x9a9488),
      sleeve: "none",
      pants: rampOf(0x6f9440),
      shoe: BOOT,
      sole: 0x1a1214,
      head: bruteHead,
      headPal: headPal({ B: 0x6b3a1c }),
      headOff: [1.5, 6.5],
      decor: bruteDecor,
    },
  },
  bruteB: {
    key: "bruteB",
    kind: "brute",
    build: {
      sx: 1.06,
      sy: 1.02,
      m: 1.12,
      muscle: 0.45,
      shoulder: 13,
      chestR: 11.5,
      waistR: 11,
      armR: 5.2,
      legR: 6.2,
      neckR: 4.2,
      belly: 8.5,
      skin: SKIN_DARK,
      top: rampOf(0x3a3a46),
      sleeve: "none",
      pants: rampOf(0x8b5a2b),
      shoe: BOOT,
      sole: 0x1a1214,
      head: bruteHead,
      headPal: headPal({ B: 0x1e1410, S: SKIN_DARK[1], s: SKIN_DARK[2] }),
      headOff: [1.5, 6.5],
      decor: bruteDecor,
    },
  },
  rex: {
    key: "rex",
    kind: "rex",
    build: {
      sx: 0.98,
      sy: 1.06,
      m: 0.95,
      muscle: 0.75,
      shoulder: 12.5,
      chestR: 11,
      waistR: 8.5,
      armR: 4.8,
      legR: 5.6,
      neckR: 3.6,
      skin: SKIN_TAN,
      top: SKIN_TAN,
      sleeve: "none",
      pants: rampOf(0x2a2a33),
      shoe: BOOT,
      sole: 0x1a1214,
      wrist: BLACK_LEATHER,
      head: rexHead,
      headPal: headPal({ R: PAL.red, r: PAL.redDark, Y: 0xffd23f, S: SKIN_TAN[1], s: SKIN_TAN[2], H: 0x2a1a10 }),
      headOff: [1, 7],
      item: "pipe",
      itemHand: "near",
      decor: rexDecor,
    },
  },
};

export const BOSS_BUILD: Build = {
  sx: 1.85,
  sy: 1.85,
  m: 1.8,
  muscle: 0.55,
  shoulder: 13.5,
  chestR: 11.5,
  waistR: 9.5,
  armR: 4.5,
  legR: 4.7,
  neckR: 4,
  belly: 6.5,
  skin: SKIN_TAN,
  top: SUIT,
  sleeve: "long",
  sleeveRamp: SUIT,
  cuff: GOLD,
  pants: [0x6a5a8a, 0x4a3a6a, 0x2e2248, 0x170f28],
  shoe: [0xffffff, 0xf0f0f0, 0xc8c8d2, 0x7a7a8a],
  sole: 0x15131c,
  toe: 0x2a2a33,
  shoeK: 0.85,
  head: donHead,
  headPal: headPal({ H: 0x1a1426, F: 0xf4f1ea, f: 0xc4bfb4, B: PAL.magenta, Y: PAL.yellow, y: 0xfff4b0, G: PAL.yellow, S: SKIN_TAN[1], s: SKIN_TAN[2] }),
  headOff: [1.5, 6.5],
  decor: donDecor,
};

// ------------------------------------------------------------------ frame generation

export function playerFrames(): PixelCanvas[] {
  return playerPoses().map((p) => renderFigure(PLAYER_BUILD, p, FRAME.w, FRAME.h, FRAME.ax, FRAME.ay));
}

function setFor(kind: EnemyKind): { set: EnemyPoseSet; stance: Pose } {
  switch (kind) {
    case "punk":
      return {
        stance: { ...PZ.STANCE, hF: [22, -30], eF: [18, -24], hN: [-2, -28] },
        set: {
          windup: { ...PZ.SWING_UP, hF: [-6, -44], eF: [4, -48], hN: [-4, -30], eN: [-14, -28], sN: undefined },
          hit: { ...PZ.JAB_A, hF: [34, -32], eF: [24, -36] },
          recover: { ...PZ.JAB_B, hF: [26, -28] },
          windup2: { ...PZ.CROUCH, hF: [16, -24], eF: [14, -16], neck: [6, -35] },
          hit2: { ...PZ.DASH, hF: [36, -30], eF: [26, -33], neck: [11, -38] },
          dash: { ...PZ.DASH, hF: [24, -28] },
        },
      };
    case "brute":
      return {
        stance: { ...PZ.STANCE, hN: [2, -27], hF: [18, -28] },
        set: {
          windup: PZ.HAMMER_UP,
          hit: PZ.HAMMER_DOWN,
          recover: { ...PZ.HAMMER_DOWN, neck: [5, -38], hN: [20, -16], hF: [23, -18] },
          windup2: PZ.CROUCH,
          hit2: PZ.SHOULDER,
          dash: PZ.SHOULDER,
        },
      };
    case "rex":
      return {
        stance: { ...PZ.STANCE, hN: [10, -30], eN: [-6, -26] },
        set: {
          windup: PZ.SWING_UP,
          hit: PZ.SWING_HIT,
          recover: { ...PZ.SWING_HIT, eN: [8, -27], hN: [18, -18] },
          windup2: { ...PZ.HAMMER_UP, hN: [-4, -58], hF: [0, -56] },
          hit2: { ...PZ.HAMMER_DOWN, hN: [22, -14] },
          dash: PZ.SHOULDER,
        },
      };
    default:
      return { set: PUNCH_SET, stance: PZ.STANCE };
  }
}

export function enemyFrames(look: EnemyLook): PixelCanvas[] {
  const { set, stance } = setFor(look.kind);
  return enemyPoses(set, stance).map((p) => renderFigure(look.build, p, EFRAME.w, EFRAME.h, EFRAME.ax, EFRAME.ay));
}

export function bossFrames(): PixelCanvas[] {
  return bossPoses().map((p) => renderFigure(BOSS_BUILD, p, BFRAME.w, BFRAME.h, BFRAME.ax, BFRAME.ay));
}
