/**
 * Skeleton + build based figure renderer. A Pose is a set of joint positions (relative to
 * the ground point under the character, facing right). A Build supplies proportions,
 * clothing ramps, a head and decorations. Poses are authored at SCAMBOY scale and scaled
 * per build, so every character shares the same animation library.
 */
import type { Color, PixelCanvas } from "../engine/pixel";
import { Layer, compose, dim, add, sub, scl, norm, lerp, len, perp, ik, rotCCW, rotCW, type P, type Ramp } from "./doll";

export type Expr = "n" | "shout" | "hurt" | "grin";
export type FootMode = "flat" | "up" | "toe" | "back";
export type HandMode = "fist" | "open";

export interface Pose {
  hip: P;
  neck: P;
  head?: P;
  /** 0 upright, 1 lying on back (head rotated CCW), -1 face down (CW) */
  headRot?: 0 | 1 | -1;
  sN?: P;
  eN?: P;
  hN: P;
  sF?: P;
  eF?: P;
  hF: P;
  kN?: P;
  fN: P;
  kF?: P;
  fF: P;
  expr?: Expr;
  /** torso thickness multiplier (lying poses) */
  chest?: number;
  footN?: FootMode;
  footF?: FootMode;
  handN?: HandMode;
  handF?: HandMode;
  /** extra bicep pump 0..1 */
  pump?: number;
  /** hide held item */
  noItem?: boolean;
}

export interface Ctx {
  l: Layer;
  neck: P;
  hip: P;
  axis: P;
  front: P;
  /** neck-relative local coords: u forward, v down the body */
  N: (u: number, v: number) => P;
  /** hip-relative local coords */
  H: (u: number, v: number) => P;
  upright: boolean;
  m: number;
  pose: Pose;
}

export interface Build {
  sx: number;
  sy: number;
  m: number;
  /** muscle definition (bicep / quad bulges) */
  muscle: number;
  shoulder: number;
  chestR: number;
  waistR: number;
  armR: number;
  legR: number;
  neckR: number;
  skin: Ramp;
  top: Ramp;
  sleeve: "none" | "short" | "long";
  sleeveRamp?: Ramp;
  cuff?: Ramp;
  pants: Ramp;
  shoe: Ramp;
  sole: Color;
  toe?: Color;
  wrist?: Ramp;
  belly?: number;
  head: (e: Expr) => string[];
  headPal: Record<string, Color>;
  /** head centre offset from neck in local coords (u forward, v up) */
  headOff: P;
  item?: "knife" | "pipe";
  /** which hand holds the item (default near) */
  itemHand?: "near" | "far";
  /** torso decoration drawn over the chest */
  decor?: (c: Ctx) => void;
  /** override shoe drawing scale */
  shoeK?: number;
  /** thigh / pants style override: shorts show skin below knee */
  shorts?: boolean;
}

const UPPER = 10;
const FORE = 9;
const THIGH = 11;
const SHIN = 10;

function oell(l: Layer, c: P, along: number, across: number, upright: boolean, r: Ramp, bias = 0) {
  if (upright) l.ell(c[0], c[1], across, along, r, bias);
  else l.ell(c[0], c[1], along, across, r, bias);
}

const KNIFE: Ramp = [0xffffff, 0xdfe6ee, 0xa9b4c2, 0x5d6676];
const PIPE: Ramp = [0xe8eef4, 0xb6bfcc, 0x7c8596, 0x4a5060];
const HANDLE: Ramp = [0x9a6a3c, 0x7a4a26, 0x5c3418, 0x3a200e];

function drawItem(l: Layer, item: "knife" | "pipe", hand: P, dir: P, m: number) {
  if (item === "knife") {
    const a = add(hand, scl(dir, 1.5 * m));
    const b = add(hand, scl(dir, 8 * m));
    l.cap(add(hand, scl(dir, -2.5 * m)), a, 1.4 * m, 1.4 * m, HANDLE);
    l.cap(a, b, 1.6 * m, 0.6, KNIFE, 0.25);
  } else {
    const a = add(hand, scl(dir, -4 * m));
    const b = add(hand, scl(dir, 17 * m));
    l.cap(a, b, 1.7 * m, 1.7 * m, PIPE, 0.1);
  }
}

function drawArm(b: Build, l: Layer, sh: P, el: P, hand: P, far: boolean, mode: HandMode, pump: number, m: number, item: boolean) {
  const skin = far ? dim(b.skin) : b.skin;
  const slv = b.sleeveRamp ? (far ? dim(b.sleeveRamp) : b.sleeveRamp) : skin;
  const ar = b.armR * m;
  const u = sub(el, sh);
  const f = sub(hand, el);
  const fn = norm(f);
  const wrist = sub(hand, scl(fn, ar * 0.75));
  const upperR = b.sleeve === "long" || b.sleeve === "short" ? slv : skin;
  const foreR = b.sleeve === "long" ? slv : skin;

  // deltoid
  l.ell(sh[0], sh[1], ar * 1.3, ar * 1.2, upperR);
  // upper arm
  l.cap(sh, el, ar, ar * 0.85, b.sleeve === "short" ? skin : upperR);
  if (b.sleeve === "short") l.cap(sh, lerp(sh, el, 0.45), ar * 1.08, ar * 1.0, slv);
  // bicep / tricep bulges
  if (b.muscle > 0) {
    const un = norm(u);
    let pp: P = [-un[1], un[0]];
    if (pp[0] * f[0] + pp[1] * f[1] < 0) pp = scl(pp, -1);
    const cosA = un[0] * fn[0] + un[1] * fn[1];
    const flex = Math.max(0, Math.min(1, (1 - cosA) / 1.6 + pump * 0.5));
    const bsz = ar * (0.55 + 0.55 * flex) * b.muscle;
    const bc = add(lerp(sh, el, 0.5), scl(pp, ar * (0.35 + 0.45 * flex)));
    l.ell(bc[0], bc[1], bsz * 1.05, bsz * 1.05, b.sleeve === "long" ? slv : skin);
    const tc = add(lerp(sh, el, 0.45), scl(pp, -ar * 0.45));
    l.ell(tc[0], tc[1], ar * 0.62 * b.muscle, ar * 0.62 * b.muscle, b.sleeve === "long" ? slv : skin, -0.05);
  }
  // forearm
  l.cap(el, wrist, ar * 0.9, ar * 0.68, foreR);
  if (b.muscle > 0) {
    const fc = lerp(el, wrist, 0.3);
    l.ell(fc[0], fc[1], ar * 0.85, ar * 0.85, foreR);
  }
  if (b.sleeve === "long" && b.cuff) {
    const cc = lerp(el, wrist, 0.92);
    l.cap(cc, wrist, ar * 0.78, ar * 0.72, far ? dim(b.cuff) : b.cuff);
  }
  if (b.wrist) {
    const wr = far ? dim(b.wrist) : b.wrist;
    l.cap(sub(wrist, scl(fn, ar * 0.5)), wrist, ar * 0.8, ar * 0.8, wr);
  }
  if (item && b.item) drawItem(l, b.item, hand, fn, Math.max(1, m * 0.9));
  // fist / hand
  const hr = ar * (mode === "open" ? 0.8 : 0.85);
  if (mode === "open") {
    l.ell(hand[0], hand[1], hr, hr * 1.05, skin);
    const tip = add(hand, scl(fn, hr * 1.1));
    l.cap(hand, tip, hr * 0.7, hr * 0.45, skin);
  } else {
    l.ell(hand[0], hand[1], hr, hr, skin, 0.05);
    // knuckle crease
    const k = add(hand, scl(fn, hr * 0.35));
    const kp: P = [-fn[1], fn[0]];
    l.line(add(k, scl(kp, -hr * 0.5)), add(k, scl(kp, hr * 0.3)), skin[3]);
  }
}

function drawShoe(b: Build, l: Layer, ankle: P, mode: FootMode, far: boolean, m: number) {
  const k = (b.shoeK ?? 1) * m;
  const sh = far ? dim(b.shoe) : b.shoe;
  const sole = far ? dim([b.sole, b.sole, b.sole, b.sole])[0] : b.sole;
  const toe = b.toe !== undefined ? (far ? dim([b.toe, b.toe, b.toe, b.toe])[0] : b.toe) : sole;
  if (mode === "up") {
    l.cap(ankle, add(ankle, [1.5 * k, -5.5 * k]), 2.8 * k, 2.6 * k, sh);
    l.line(add(ankle, [-2.2 * k, -6 * k]), add(ankle, [3.5 * k, -6.5 * k]), sole, Math.max(1, Math.round(k)));
    return;
  }
  if (mode === "back") {
    l.cap(ankle, add(ankle, [-5.5 * k, 1 * k]), 2.8 * k, 2.6 * k, sh);
    l.line(add(ankle, [-7 * k, -1.5 * k]), add(ankle, [-7 * k, 3 * k]), sole, Math.max(1, Math.round(k)));
    return;
  }
  const tilt = mode === "toe" ? 2.5 * k : 0;
  const heel = add(ankle, [-1.8 * k, 0.6 * k - tilt * 0.3]);
  const tip = add(ankle, [5.6 * k, 1.4 * k + tilt]);
  l.cap(heel, tip, 2.7 * k, 2.3 * k, sh);
  // white toe cap and sole
  l.ell(tip[0] - 0.4 * k, tip[1] - 0.2 * k, 2.0 * k, 1.8 * k, [toe, toe, toe, mix2(toe)]);
  const sy = Math.round(ankle[1] + 3.2 * k);
  const sx0 = Math.round(heel[0] - 2.5 * k);
  const sx1 = Math.round(tip[0] + 2.0 * k);
  if (mode === "flat") l.rect(sx0, sy - 1, sx1 - sx0 + 1, Math.max(1, Math.round(k)), sole);
  else l.line(add(heel, [-2.5 * k, 2.6 * k]), add(tip, [2 * k, 2.2 * k]), sole, Math.max(1, Math.round(k)));
}

function mix2(c: Color): Color {
  return ((((c >> 16) & 255) * 0.75) << 16) | ((((c >> 8) & 255) * 0.75) << 8) | ((c & 255) * 0.75);
}

function drawLeg(b: Build, l: Layer, hipP: P, knee: P, ankle: P, far: boolean, foot: FootMode, m: number) {
  const pr = far ? dim(b.pants) : b.pants;
  const skin = far ? dim(b.skin) : b.skin;
  const lr = b.legR * m;
  l.cap(hipP, knee, lr, lr * 0.78, pr);
  if (b.muscle > 0) {
    const q = add(lerp(hipP, knee, 0.42), [lr * 0.25, 0]);
    l.ell(q[0], q[1], lr * 0.85, lr * 0.95, pr, 0.05);
  }
  l.cap(knee, ankle, lr * (b.shorts ? 0.62 : 0.76), lr * (b.shorts ? 0.5 : 0.6), b.shorts ? skin : pr);
  if (b.shorts) l.cap(lerp(hipP, knee, 0.7), knee, lr * 0.85, lr * 0.8, pr);
  else if (b.muscle > 0) {
    const calf = add(lerp(knee, ankle, 0.35), [-lr * 0.25, 0]);
    l.ell(calf[0], calf[1], lr * 0.6, lr * 0.7, pr, -0.05);
  }
  drawShoe(b, l, ankle, foot, far, m);
}

/** Render one pose of a build into a w×h canvas with the ground anchor at (ax, ay). */
export function renderFigure(b: Build, pose: Pose, w: number, h: number, ax: number, ay: number): PixelCanvas {
  const S = (p: P): P => [p[0] * b.sx, p[1] * b.sy];
  const m = b.m;
  const hip = S(pose.hip);
  const neck = S(pose.neck);
  const axis = norm(sub(neck, hip));
  const front = perp(axis);
  const upright = Math.abs(axis[1]) > 0.7;
  const N = (u: number, v: number): P => add(add(neck, scl(front, u * b.sx)), scl(axis, -v * b.sy));
  const Hp = (u: number, v: number): P => add(add(hip, scl(front, u * b.sx)), scl(axis, v * b.sy));

  const sN = pose.sN ? S(pose.sN) : N(-b.shoulder, 3);
  const sF = pose.sF ? S(pose.sF) : N(b.shoulder, 2);
  const hN = S(pose.hN);
  const hF = S(pose.hF);
  const ul = UPPER * b.sy;
  const fl = FORE * b.sy;
  const pickLow = (a: P, c: P): P => {
    const e1 = ik(a, c, ul, fl, 1);
    const e2 = ik(a, c, ul, fl, -1);
    return e1[1] >= e2[1] ? e1 : e2;
  };
  const eN = pose.eN ? S(pose.eN) : pickLow(sN, hN);
  const eF = pose.eF ? S(pose.eF) : pickLow(sF, hF);

  const hipN = Hp(-4, 0);
  const hipF = Hp(4, 0);
  const fN = S(pose.fN);
  const fF = S(pose.fF);
  const tl = THIGH * b.sy;
  const sl = SHIN * b.sy;
  const pickFwd = (a: P, c: P): P => {
    const k1 = ik(a, c, tl, sl, 1);
    const k2 = ik(a, c, tl, sl, -1);
    return k1[0] >= k2[0] ? k1 : k2;
  };
  const kN = pose.kN ? S(pose.kN) : pickFwd(hipN, fN);
  const kF = pose.kF ? S(pose.kF) : pickFwd(hipF, fF);

  const mk = () => new Layer(w, h, ax, ay);
  const farArm = mk();
  const farLeg = mk();
  const nearLeg = mk();
  const pelvis = mk();
  const torso = mk();
  const head = mk();
  head.outlined = false;
  const nearArm = mk();
  const item = !pose.noItem;

  const farItem = (b.itemHand ?? "near") === "far";
  drawArm(b, farArm, sF, eF, hF, true, pose.handF ?? "fist", pose.pump ?? 0, m, item && farItem);
  drawLeg(b, farLeg, hipF, kF, fF, true, pose.footF ?? "flat", m);
  drawLeg(b, nearLeg, hipN, kN, fN, false, pose.footN ?? "flat", m);

  // pelvis / belt
  pelvis.cap(hipN, hipF, b.legR * m * 1.05, b.legR * m * 1.05, b.pants);

  // torso
  const ch = pose.chest ?? 1;
  const headC: P = pose.head ? S(pose.head) : add(add(neck, scl(front, b.headOff[0] * b.sx)), scl(axis, b.headOff[1] * b.sy));
  torso.cap(neck, lerp(neck, headC, 0.6), b.neckR * m, b.neckR * m * 0.9, b.skin);
  const trapsR = b.chestR * 0.36 * m;
  torso.cap(N(-b.shoulder * 0.62, 3), N(b.shoulder * 0.62, 3), trapsR * ch, trapsR * ch, b.sleeve === "long" ? (b.sleeveRamp ?? b.top) : b.skin);
  torso.cap(N(0.5, 9), Hp(0, Math.max(2, (b.waistR * m * ch) / b.sy - 2.5)), b.chestR * m * ch, b.waistR * m * ch, b.top);
  if (b.muscle > 0) {
    // pecs
    oell(torso, N(-3.5, 7.5), 5.2 * m * ch * b.muscle, 7 * m * b.muscle, upright, b.top);
    oell(torso, N(5.5, 7.5), 5 * m * ch * b.muscle, 6.2 * m * b.muscle, upright, b.top, -0.05);
    // abs
    for (let i = 0; i < 2; i++) {
      const v = 12.5 + i * 3.2;
      oell(torso, N(-1.2, v), 1.5 * m * ch, 2.4 * m, upright, b.top, 0.08);
      oell(torso, N(4.2, v), 1.5 * m * ch, 2.2 * m, upright, b.top, 0.02);
    }
  }
  // waistband tucks the top into the pants
  torso.cap(Hp(-b.waistR * 0.55, -2.5), Hp(b.waistR * 0.55, -2.5), b.legR * m * 0.75 * ch, b.legR * m * 0.75 * ch, b.pants);
  if (b.belly) {
    const bc = Hp(b.belly * 0.45, b.belly * 0.9);
    torso.ell(bc[0], bc[1], b.belly * m * 1.05, b.belly * m * 0.95 * ch, b.top, 0.05);
  }
  const ctx: Ctx = { l: torso, neck, hip, axis, front, N, H: Hp, upright, m, pose };
  b.decor?.(ctx);

  // head
  let rows = b.head(pose.expr ?? "n");
  if (pose.headRot === 1) rows = rotCCW(rows);
  else if (pose.headRot === -1) rows = rotCW(rows);
  const hw = Math.max(...rows.map((r) => r.length));
  head.art(rows, b.headPal, Math.round(headC[0] - hw / 2), Math.round(headC[1] - rows.length / 2));

  drawArm(b, nearArm, sN, eN, hN, false, pose.handN ?? "fist", pose.pump ?? 0, m, item && !farItem);

  return compose(w, h, [farArm, farLeg, nearLeg, pelvis, torso, head, nearArm]);
}

/** helper for decorations: distance along the torso */
export function torsoLen(c: Ctx) {
  return len(sub(c.neck, c.hip));
}
