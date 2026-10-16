/**
 * Animation pose library (authored at SCAMBOY scale; facing right; ground = y 0).
 * Pure data + small generators.
 */
import type { Pose } from "./figure";
import type { P } from "./doll";

const mv = (p: P, dx: number, dy: number): P => [p[0] + dx, p[1] + dy];

/** fighting stance */
export const STANCE: Pose = {
  hip: [0, -23],
  neck: [1, -41],
  hN: [5, -31],
  eN: [-12, -27],
  hF: [23, -36],
  eF: [21, -27],
  fN: [-8, -3],
  fF: [10, -3],
};

export function shift(p: Pose, o: Partial<Pose>): Pose {
  return { ...p, ...o };
}

/** move the upper body (neck, shoulders, arms) */
function upper(p: Pose, dx: number, dy: number): Pose {
  return {
    ...p,
    neck: mv(p.neck, dx, dy),
    hN: mv(p.hN, dx, dy),
    hF: mv(p.hF, dx, dy),
    eN: p.eN ? mv(p.eN, dx, dy) : undefined,
    eF: p.eF ? mv(p.eF, dx, dy) : undefined,
    sN: p.sN ? mv(p.sN, dx, dy) : undefined,
    sF: p.sF ? mv(p.sF, dx, dy) : undefined,
  };
}

export function idleFrames(base: Pose = STANCE): Pose[] {
  return [0, 0, 1, 1].map((k) => upper(base, 0, -k));
}

/** procedural walk cycle (n frames) */
export function walkFrames(n = 6, base: Pose = STANCE, stride = 8): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * Math.PI * 2;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const bob = Math.abs(Math.sin(ph)) > 0.7 ? 0 : -1;
    const nX = 1 + stride * s;
    const fX = 3 - stride * s;
    const nY = -3 - Math.max(0, c) * 4;
    const fY = -3 - Math.max(0, -c) * 4;
    const p = upper(base, 1, bob);
    out.push({
      ...p,
      hip: mv(base.hip, 0, bob),
      kN: undefined,
      kF: undefined,
      fN: [nX, nY],
      fF: [fX, fY],
      hN: mv(p.hN, -2 * s, 0),
      hF: mv(p.hF, 2 * s, 0),
      eN: undefined,
      eF: undefined,
      footN: nY < -5 ? "toe" : "flat",
      footF: fY < -5 ? "toe" : "flat",
    });
  }
  return out;
}

/** jab with the lead (far) arm */
export const JAB_A: Pose = {
  ...STANCE,
  neck: [4, -41],
  sF: [17, -38],
  hF: [36, -37],
  eF: [27, -38],
  hN: [7, -32],
  eN: [-10, -27],
  fN: [-9, -3],
  fF: [12, -3],
  expr: "shout",
};
export const JAB_B: Pose = { ...STANCE, neck: [2, -41], hF: [28, -36], eF: [22, -31] };

/** cross with the rear (near) arm */
export const CROSS_A: Pose = {
  ...STANCE,
  neck: [5, -41],
  sN: [-4, -38],
  eN: [20, -37],
  hN: [36, -36],
  hF: [17, -34],
  eF: [19, -27],
  fN: [-11, -3],
  fF: [11, -3],
  expr: "shout",
};
export const CROSS_B: Pose = { ...STANCE, neck: [3, -41], sN: [-8, -38], eN: [8, -32], hN: [22, -34] };

/** uppercut / haymaker */
export const UPPER_WIND: Pose = {
  hip: [-2, -21],
  neck: [-3, -38],
  sN: [-15, -35],
  eN: [-22, -27],
  hN: [-12, -19],
  hF: [17, -33],
  eF: [16, -25],
  fN: [-10, -3],
  fF: [11, -3],
  expr: "shout",
};
export const UPPER_HIT: Pose = {
  hip: [2, -25],
  neck: [6, -43],
  sN: [-1, -40],
  eN: [17, -40],
  hN: [27, -53],
  hF: [4, -30],
  eF: [12, -25],
  fN: [-12, -3],
  fF: [12, -4],
  footN: "toe",
  expr: "shout",
};
export const UPPER_END: Pose = {
  ...UPPER_HIT,
  neck: [5, -42],
  eN: [16, -39],
  hN: [24, -50],
  expr: "grin",
};

export const JUMP_RISE: Pose = {
  hip: [0, -26],
  neck: [1, -44],
  hN: [-6, -47],
  eN: [-17, -40],
  hF: [22, -48],
  eF: [22, -38],
  kN: [-1, -16],
  fN: [-9, -9],
  kF: [9, -17],
  fF: [4, -10],
  footN: "toe",
  footF: "toe",
};
export const JUMP_FALL: Pose = {
  hip: [0, -24],
  neck: [1, -42],
  hN: [-12, -44],
  hF: [25, -42],
  fN: [-8, -3],
  fF: [10, -6],
  footF: "toe",
};
/** flying dive punch */
export const DIVE: Pose = {
  hip: [-3, -27],
  neck: [10, -40],
  sN: [-1, -38],
  eN: [20, -32],
  hN: [33, -25],
  hF: [10, -30],
  eF: [16, -28],
  kN: [-12, -20],
  fN: [-21, -24],
  kF: [-4, -15],
  fF: [-13, -12],
  footN: "back",
  footF: "back",
  expr: "shout",
};
/** flying kick (enemies) */
export const KICK: Pose = {
  hip: [-2, -26],
  neck: [-8, -42],
  hN: [-14, -33],
  hF: [6, -40],
  kF: [10, -27],
  fF: [24, -27],
  kN: [-4, -15],
  fN: [-10, -12],
  footF: "toe",
  footN: "toe",
  expr: "shout",
};

export const HURT_A: Pose = {
  hip: [-1, -23],
  neck: [-5, -40],
  hN: [-17, -42],
  hF: [7, -33],
  fN: [-9, -3],
  fF: [9, -3],
  expr: "hurt",
};
export const HURT_B: Pose = {
  hip: [0, -22],
  neck: [6, -37],
  hN: [7, -24],
  hF: [13, -25],
  fN: [-8, -3],
  fF: [9, -3],
  expr: "hurt",
};
/** knocked into the air, falling backwards */
export const KD_AIR: Pose = {
  hip: [0, -20],
  neck: [-14, -33],
  hN: [-26, -44],
  hF: [-7, -46],
  kN: [8, -25],
  fN: [17, -30],
  kF: [10, -20],
  fF: [19, -18],
  footN: "up",
  footF: "toe",
  expr: "hurt",
};
export const LYING: Pose = {
  hip: [6, -7],
  neck: [-14, -8],
  headRot: 1,
  head: [-21, -7],
  chest: 0.66,
  hN: [-6, -3],
  eN: [-11, -4],
  hF: [-27, -4],
  eF: [-22, -9],
  kN: [16, -11],
  fN: [26, -4],
  kF: [17, -7],
  fF: [27, -3],
  footN: "up",
  footF: "up",
  expr: "hurt",
};
export const GETUP: Pose = {
  hip: [-3, -13],
  neck: [3, -29],
  hN: [-3, -14],
  hF: [13, -14],
  kN: [-4, -3],
  fN: [-15, -3],
  kF: [9, -14],
  fF: [10, -3],
  footN: "back",
};
export const CROUCH: Pose = {
  ...STANCE,
  hip: [0, -19],
  neck: [2, -37],
  hN: [6, -27],
  eN: [-12, -23],
  hF: [22, -31],
  eF: [20, -23],
  fN: [-9, -3],
  fF: [11, -3],
};

/** flex gather — "most muscular" crunch */
export const FLEX_GATHER: Pose = {
  hip: [0, -21],
  neck: [1, -38],
  sN: [-14, -35],
  sF: [14, -36],
  eN: [-17, -24],
  eF: [18, -24],
  hN: [4, -21],
  hF: [-1, -22],
  fN: [-11, -3],
  fF: [12, -3],
  pump: 0.7,
  expr: "shout",
};
/** double biceps */
export const FLEX_BICEPS: Pose = {
  hip: [0, -23],
  neck: [1, -42],
  sN: [-14, -38],
  sF: [14, -39],
  eN: [-25, -42],
  hN: [-19, -55],
  eF: [26, -43],
  hF: [20, -56],
  fN: [-12, -3],
  fF: [12, -3],
  pump: 1,
  expr: "shout",
};
export const FLEX_BICEPS_GRIN: Pose = { ...FLEX_BICEPS, expr: "grin" };
/** single bicep + hand on hip */
export const FLEX_SINGLE: Pose = {
  hip: [0, -23],
  neck: [0, -42],
  sN: [-14, -38],
  eN: [-25, -40],
  hN: [-17, -53],
  sF: [13, -38],
  eF: [21, -30],
  hF: [10, -24],
  fN: [-10, -3],
  fF: [10, -3],
  pump: 1,
  expr: "grin",
};
export const FLEX_MOST: Pose = { ...FLEX_GATHER, expr: "grin" };

export const DASH: Pose = {
  hip: [0, -22],
  neck: [9, -39],
  hN: [-12, -29],
  hF: [4, -30],
  kN: [-6, -12],
  fN: [-14, -7],
  kF: [10, -14],
  fF: [13, -3],
  footN: "toe",
};
export const SHOULDER: Pose = {
  hip: [-1, -21],
  neck: [10, -36],
  sN: [6, -33],
  eN: [12, -24],
  hN: [4, -27],
  hF: [14, -28],
  kN: [-8, -11],
  fN: [-16, -4],
  kF: [10, -13],
  fF: [14, -3],
  footN: "toe",
  expr: "shout",
};

/** two-handed overhead hammer (brute / boss) */
export const HAMMER_UP: Pose = {
  hip: [-1, -23],
  neck: [-3, -42],
  hN: [-6, -58],
  hF: [-1, -59],
  fN: [-9, -3],
  fF: [10, -3],
  expr: "shout",
};
export const HAMMER_DOWN: Pose = {
  hip: [1, -20],
  neck: [8, -36],
  hN: [25, -18],
  hF: [28, -20],
  fN: [-11, -3],
  fF: [12, -3],
  expr: "shout",
};
/** weapon swing windup (arm cocked back high) */
export const SWING_UP: Pose = {
  ...STANCE,
  neck: [-2, -41],
  sN: [-12, -38],
  eN: [-22, -44],
  hN: [-14, -54],
  hF: [16, -32],
  expr: "shout",
};
export const SWING_HIT: Pose = {
  ...STANCE,
  neck: [6, -40],
  sN: [-3, -37],
  eN: [14, -33],
  hN: [27, -30],
  hF: [10, -28],
  fN: [-11, -3],
  fF: [12, -3],
  expr: "shout",
};
/** grab reach (open hand) */
export const REACH: Pose = {
  ...STANCE,
  neck: [5, -41],
  sN: [-4, -38],
  eN: [16, -40],
  hN: [32, -40],
  handN: "open",
  hF: [24, -34],
  handF: "open",
  fN: [-11, -3],
  fF: [12, -3],
};
/** holding something overhead */
export const HOLD_UP: Pose = {
  ...STANCE,
  neck: [0, -42],
  eN: [-6, -50],
  hN: [4, -60],
  handN: "open",
  eF: [16, -50],
  hF: [10, -60],
  handF: "open",
  expr: "grin",
};
/** whistle — hand to mouth */
export const WHISTLE: Pose = {
  ...STANCE,
  eN: [-6, -33],
  hN: [7, -44],
  hF: [20, -26],
  eF: [16, -26],
  handF: "open",
  expr: "shout",
};
export const TAUNT: Pose = {
  ...STANCE,
  hN: [-14, -24],
  eN: [-16, -30],
  hF: [14, -24],
  eF: [20, -30],
  expr: "grin",
};
