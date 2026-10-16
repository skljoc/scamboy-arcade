/**
 * Pure combat maths for the belt-scroller: 2.5D hit boxes (x, depth y, height z),
 * attack definitions and scoring constants. No Phaser imports.
 */

export interface AttackDef {
  id: string;
  dmg: number;
  /** horizontal knockback speed applied to the victim (px/s) */
  kb: number;
  /** knockdown launch speed (px/s); 0 = no knockdown */
  lift: number;
  /** forward reach window relative to attacker x (in facing direction) */
  reach: readonly [number, number];
  /** height window relative to attacker z */
  zr: readonly [number, number];
  /** max |dy| between attacker and victim */
  depth: number;
  /** hitstun (ms) */
  stun: number;
  /** hitstop (ms) */
  stop: number;
  heavy?: boolean;
  /** ignores super armour */
  breaker?: boolean;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  /** half width of the hurt box */
  hw: number;
  /** height of the hurt box */
  h: number;
}

/** Test an attack from attacker (x,y,z,facing) against a victim body. */
export function hits(ax: number, ay: number, az: number, facing: number, a: AttackDef, v: Body): boolean {
  if (Math.abs(ay - v.y) > a.depth) return false;
  const x0 = facing > 0 ? ax + a.reach[0] : ax - a.reach[1];
  const x1 = facing > 0 ? ax + a.reach[1] : ax - a.reach[0];
  if (v.x + v.hw < x0 || v.x - v.hw > x1) return false;
  const z0 = az + a.zr[0];
  const z1 = az + a.zr[1];
  if (v.z + v.h < z0 || v.z > z1) return false;
  return true;
}

/** Elliptical area test (flex shockwave, boss slam): rx horizontal, ry depth. */
export function inEllipse(cx: number, cy: number, rx: number, ry: number, x: number, y: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Point is on the expanding ring band between r0 and r1 (as ellipse radii scale). */
export function onRing(cx: number, cy: number, r: number, band: number, squash: number, x: number, y: number): boolean {
  const dx = x - cx;
  const dy = (y - cy) / squash;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d >= r - band && d <= r + band;
}

// ------------------------------------------------------------------ player attacks

export const P_JAB: AttackDef = { id: "jab", dmg: 4, kb: 30, lift: 0, reach: [6, 38], zr: [22, 50], depth: 10, stun: 300, stop: 55 };
export const P_CROSS: AttackDef = { id: "cross", dmg: 5, kb: 40, lift: 0, reach: [6, 38], zr: [22, 50], depth: 10, stun: 320, stop: 60 };
export const P_UPPER: AttackDef = { id: "upper", dmg: 12, kb: 150, lift: 230, reach: [4, 34], zr: [16, 60], depth: 11, stun: 0, stop: 110, heavy: true, breaker: true };
export const P_DIVE: AttackDef = { id: "dive", dmg: 11, kb: 130, lift: 170, reach: [4, 38], zr: [-6, 36], depth: 11, stun: 0, stop: 90, heavy: true, breaker: true };
export const P_SHOULDER: AttackDef = { id: "shoulder", dmg: 12, kb: 190, lift: 200, reach: [-2, 28], zr: [8, 48], depth: 12, stun: 0, stop: 90, heavy: true, breaker: true };
export const P_FLEX: AttackDef = { id: "flex", dmg: 15, kb: 230, lift: 250, reach: [-90, 90], zr: [-10, 120], depth: 36, stun: 0, stop: 120, heavy: true, breaker: true };

/** flex shockwave radii */
export const FLEX_RX = 92;
export const FLEX_RY = 36;

// ------------------------------------------------------------------ enemy attacks

export const E_PUNCH: AttackDef = { id: "e_punch", dmg: 6, kb: 60, lift: 0, reach: [4, 30], zr: [18, 46], depth: 9, stun: 360, stop: 60 };
export const E_KICK: AttackDef = { id: "e_kick", dmg: 9, kb: 120, lift: 170, reach: [2, 30], zr: [8, 40], depth: 10, stun: 0, stop: 70, heavy: true };
export const E_SLASH: AttackDef = { id: "e_slash", dmg: 9, kb: 70, lift: 0, reach: [4, 34], zr: [16, 46], depth: 9, stun: 380, stop: 60 };
export const E_DASH_SLASH: AttackDef = { id: "e_dslash", dmg: 11, kb: 140, lift: 180, reach: [-4, 30], zr: [10, 46], depth: 10, stun: 0, stop: 80, heavy: true };
export const E_HAMMER: AttackDef = { id: "e_hammer", dmg: 15, kb: 150, lift: 210, reach: [6, 36], zr: [0, 56], depth: 11, stun: 0, stop: 110, heavy: true };
export const E_BELLY: AttackDef = { id: "e_belly", dmg: 12, kb: 200, lift: 200, reach: [-2, 30], zr: [6, 48], depth: 11, stun: 0, stop: 90, heavy: true };
export const E_PIPE: AttackDef = { id: "e_pipe", dmg: 10, kb: 90, lift: 0, reach: [6, 44], zr: [14, 56], depth: 10, stun: 400, stop: 70 };
export const E_PIPE_SLAM: AttackDef = { id: "e_pslam", dmg: 15, kb: 160, lift: 220, reach: [4, 42], zr: [-4, 50], depth: 12, stun: 0, stop: 110, heavy: true };
export const E_TACKLE: AttackDef = { id: "e_tackle", dmg: 12, kb: 200, lift: 200, reach: [-4, 32], zr: [6, 50], depth: 11, stun: 0, stop: 90, heavy: true };

// boss
export const B_PUNCH: AttackDef = { id: "b_punch", dmg: 12, kb: 160, lift: 190, reach: [10, 64], zr: [20, 90], depth: 13, stun: 0, stop: 100, heavy: true };
export const B_CHARGE: AttackDef = { id: "b_charge", dmg: 16, kb: 240, lift: 240, reach: [-10, 50], zr: [0, 100], depth: 15, stun: 0, stop: 110, heavy: true };
export const B_SLAM_DIRECT: AttackDef = { id: "b_slam", dmg: 16, kb: 180, lift: 240, reach: [-30, 60], zr: [0, 80], depth: 18, stun: 0, stop: 120, heavy: true };
export const B_SHOCK: AttackDef = { id: "b_shock", dmg: 11, kb: 150, lift: 200, reach: [0, 0], zr: [0, 10], depth: 0, stun: 0, stop: 80, heavy: true };
export const B_THROW: AttackDef = { id: "b_throw", dmg: 18, kb: 260, lift: 260, reach: [0, 0], zr: [0, 0], depth: 0, stun: 0, stop: 120, heavy: true };
export const B_BAG: AttackDef = { id: "b_bag", dmg: 9, kb: 120, lift: 160, reach: [0, 0], zr: [0, 0], depth: 0, stun: 0, stop: 70, heavy: true };

// hazards
export const H_CAR: AttackDef = { id: "car", dmg: 18, kb: 320, lift: 260, reach: [0, 0], zr: [0, 0], depth: 0, stun: 0, stop: 120, heavy: true };
export const H_BARREL: AttackDef = { id: "barrel", dmg: 10, kb: 150, lift: 190, reach: [0, 0], zr: [0, 0], depth: 0, stun: 0, stop: 80, heavy: true };
export const H_POT: AttackDef = { id: "pot", dmg: 9, kb: 40, lift: 120, reach: [0, 0], zr: [0, 0], depth: 0, stun: 0, stop: 80, heavy: true };
export const H_DEBRIS: AttackDef = { id: "debris", dmg: 6, kb: 120, lift: 170, reach: [0, 0], zr: [0, 0], depth: 0, stun: 0, stop: 60, heavy: true };

// ------------------------------------------------------------------ input helpers

/** True when two button presses (ms timestamps) count as a simultaneous chord. */
export function isChord(tA: number, tB: number, window = 90): boolean {
  return tA > 0 && tB > 0 && Math.abs(tA - tB) <= window;
}

// ------------------------------------------------------------------ scoring

export const SCORE = {
  hit: 10,
  heavy: 30,
  flexHit: 50,
  koThug: 200,
  koPunk: 300,
  koBrute: 500,
  koRex: 3000,
  koBoss: 10000,
  object: 50,
  cash: 500,
  watch: 1500,
  gem: 3000,
  hpBonus: 20,
} as const;
