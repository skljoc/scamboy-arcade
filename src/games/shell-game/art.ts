/**
 * SHELL GAME pixel art — everything is generated at runtime with PixelCanvas.
 */
import type * as Phaser from "phaser";
import { PixelCanvas, registerSheet, registerTexture, rng, type Color } from "../engine/pixel";
import { PAL } from "../engine/palette";
import { FACE_PALETTE, MINI_HEAD, faceRows, type FaceExpr } from "../engine/sprites";

// ------------------------------------------------------------------ keys & frames

export const TEX = {
  bg: "sg-bg",
  table: "sg-table",
  torso: "sg-torso",
  head: "sg-head",
  hand: "sg-hand",
  armOutline: "sg-arm-o",
  armFill: "sg-arm-f",
  cup: "sg-cup",
  stone: "sg-stone",
  shadow: "sg-shadow",
  pointer: "sg-pointer",
  heart: "sg-heart",
  neon: "sg-neon",
  glow: "sg-glow",
  cat: "sg-cat",
  pigeon: "sg-pigeon",
  confetti: "sg-confetti",
  sparkle: "sg-sparkle",
  hud: "sg-hud",
  prompt: "sg-prompt",
} as const;

/** head sheet frame indices */
export const HEAD = {
  smile: 0,
  smileL: 1,
  smileR: 2,
  blink: 3,
  grin: 4,
  grinL: 5,
  grinR: 6,
  shock: 7,
  sweat: 8,
  angry: 9,
  laughA: 10,
  laughB: 11,
  wink: 12,
  sad: 13,
} as const;
export type HeadFrame = (typeof HEAD)[keyof typeof HEAD];

/** hand sheet: left hand frames 0..2, right hand frames 3..5 */
export const HAND = { rest: 0, grip: 1, tap: 2 } as const;
export const RIGHT_HAND_OFFSET = 3;

export const CUP_COLORS = 3;
/** cup sheet frame = colour * 2 + (lifted ? 1 : 0) */
export const cupFrame = (color: number, lifted: boolean) => color * 2 + (lifted ? 1 : 0);

// ------------------------------------------------------------------ colour helpers

function mix(a: Color, b: Color, t: number): Color {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
const scale = (c: Color, k: number) => mix(0, c, Math.min(1, k)) | 0;
const lighten = (c: Color, t: number) => mix(c, 0xffffff, t);

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** ordered dither threshold 0..1 */
const bayer = (x: number, y: number) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** multiply pixel colours in a region by k(x,y), quantised with ordered dithering */
function shadePass(pc: PixelCanvas, x0: number, y0: number, x1: number, y1: number, k: (x: number, y: number) => number, step = 0.08) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const c = pc.get(x, y);
      if (c === null) continue;
      const kk = k(x, y);
      const q = Math.floor(kk / step);
      const frac = kk / step - q;
      const f = (frac > bayer(x, y) ? q + 1 : q) * step;
      if (Math.abs(f - 1) < 0.001) continue;
      const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
      const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
      const b = Math.min(255, Math.round((c & 255) * f));
      pc.set(x, y, (r << 16) | (g << 8) | b);
    }
  }
}

// ------------------------------------------------------------------ tiny 3x5 font (signage)

const GLYPHS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  " ": ["...", "...", "...", "...", "..."],
};

function miniTextWidth(text: string, s = 1) {
  return text.length * 4 * s - s;
}

function miniText(pc: PixelCanvas, x: number, y: number, text: string, c: Color, s = 1) {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (g) {
      for (let gy = 0; gy < 5; gy++)
        for (let gx = 0; gx < 3; gx++) if (g[gy][gx] === "#") pc.rect(cx + gx * s, y + gy * s, s, s, c);
    }
    cx += 4 * s;
  }
}

// ------------------------------------------------------------------ background

const MORTAR = 0x5b4744;
const CONCRETE = 0x8e8984;
const CONCRETE_LT = 0xa9a49d;
const CONCRETE_DK = 0x6c6763;
const FELT = 0x2e7d4f;
const FELT_LT = 0x3f9a63;
const FELT_DK = 0x1f5a38;

function drawBricks(pc: PixelCanvas, R: () => number, bottom: number) {
  pc.rect(0, 0, 320, bottom, MORTAR);
  for (let row = 0; row * 8 < bottom; row++) {
    const y = row * 8;
    const off = (row % 2) * 8;
    for (let bx = -off; bx < 320; bx += 16) {
      const v = R();
      const base = v < 0.12 ? 0x8c3a31 : v < 0.26 ? 0xb85848 : v < 0.36 ? 0x9a4338 : v < 0.4 ? 0x7d4a40 : PAL.brick;
      pc.rect(bx, y, 15, 7, base);
      pc.hline(bx, bx + 14, y, lighten(base, 0.16));
      pc.hline(bx, bx + 14, y + 6, scale(base, 0.72));
      pc.vline(bx + 14, y + 1, y + 6, scale(base, 0.8));
      for (let i = 0; i < 3; i++) {
        const sx = bx + 1 + Math.floor(R() * 13);
        const sy = y + 1 + Math.floor(R() * 5);
        pc.set(sx, sy, R() < 0.5 ? scale(base, 0.82) : lighten(base, 0.1));
      }
      if (R() < 0.05) {
        // chipped corner
        pc.set(bx, y, MORTAR);
        pc.set(bx + 1, y, MORTAR);
        pc.set(bx, y + 1, MORTAR);
      }
    }
  }
  // a few cracks
  for (let c = 0; c < 4; c++) {
    let x = 30 + Math.floor(R() * 260);
    let y = 10 + Math.floor(R() * (bottom - 40));
    for (let i = 0; i < 14; i++) {
      pc.set(x, y, 0x4a3533);
      x += R() < 0.5 ? 1 : 0;
      y += 1;
      if (R() < 0.3) x -= 1;
    }
  }
}

function drawShop(pc: PixelCanvas, R: () => number) {
  const X0 = 214;
  // facade
  pc.rect(X0, 24, 320 - X0, 124, 0x3b2a3f);
  pc.vline(X0, 24, 147, PAL.ink);
  pc.vline(X0 + 1, 24, 147, 0x5a4460);
  pc.vline(X0 + 2, 24, 147, 0x4a3650);
  // window glass
  const gx0 = 222;
  const gx1 = 312;
  const gy0 = 50;
  const gy1 = 132;
  for (let y = gy0; y < gy1; y++) {
    const t = (y - gy0) / (gy1 - gy0);
    for (let x = gx0; x < gx1; x++) {
      const base = mix(0x2a5566, 0x14283a, t);
      pc.set(x, y, t > bayer(x, y) * 0.3 + 0.55 ? scale(base, 0.92) : base);
    }
  }
  // interior back wall + shelves with goods
  pc.rect(gx0, 92, gx1 - gx0, 2, 0x0e1c28);
  for (const sy of [96, 116]) {
    pc.rect(gx0 + 2, sy, gx1 - gx0 - 4, 3, PAL.brown);
    pc.hline(gx0 + 2, gx1 - 3, sy, 0xb07a45);
    pc.hline(gx0 + 2, gx1 - 3, sy + 3, 0x0e1c28);
  }
  // goods on shelves: mini cups, boxes, a radio, a tiny trophy
  const cupCols: Array<[Color, Color]> = [
    [PAL.red, PAL.redDark],
    [PAL.blue, PAL.blueDark],
    [PAL.yellow, PAL.yellowDark],
  ];
  let gx = gx0 + 5;
  while (gx < gx1 - 10) {
    const kind = Math.floor(R() * 4);
    if (kind === 0) {
      const [c, d] = cupCols[Math.floor(R() * 3)];
      pc.poly([[gx + 1, 89], [gx + 6, 89], [gx + 7, 96], [gx, 96]], c);
      pc.vline(gx + 6, 90, 95, d);
      pc.vline(gx + 2, 90, 95, lighten(c, 0.4));
      gx += 10;
    } else if (kind === 1) {
      const c = [PAL.teal, PAL.purple, PAL.orange][Math.floor(R() * 3)];
      const h = 6 + Math.floor(R() * 5);
      pc.rect(gx, 96 - h, 8, h, c);
      pc.vline(gx + 7, 96 - h, 95, scale(c, 0.7));
      pc.hline(gx, gx + 7, 96 - h, lighten(c, 0.3));
      gx += 11;
    } else if (kind === 2) {
      pc.rect(gx, 89, 12, 7, PAL.grayDark);
      pc.rect(gx + 1, 90, 5, 5, PAL.gray);
      pc.circle(gx + 9, 92.5, 1.6, PAL.grayLight);
      pc.line(gx + 2, 89, gx + 5, 85, PAL.grayLight);
      gx += 15;
    } else {
      pc.rect(gx + 2, 93, 5, 3, PAL.yellowDark);
      pc.rect(gx + 1, 87, 7, 5, PAL.yellow);
      pc.set(gx + 2, 88, 0xfff08a);
      pc.rect(gx + 4, 92, 1, 1, PAL.yellowDark);
      gx += 11;
    }
  }
  // lower shelf: boxed games
  for (let x = gx0 + 4; x < gx1 - 10; x += 12) {
    const c = [PAL.magenta, PAL.navyLight, PAL.green, PAL.orange][Math.floor(R() * 4)];
    pc.rect(x, 106, 9, 10, c);
    pc.rect(x + 1, 108, 7, 3, PAL.offwhite);
    pc.vline(x + 8, 106, 115, scale(c, 0.65));
  }
  // reflections
  for (let i = 0; i < 2; i++) {
    const ox = gx0 + 10 + i * 40;
    for (let y = gy0; y < gy1; y++) {
      const x = ox + Math.floor((gy1 - y) * 0.5);
      for (let w = 0; w < (i === 0 ? 5 : 3); w++) {
        const px = x + w;
        if (px >= gx0 && px < gx1) pc.set(px, y, mix(pc.get(px, y) ?? 0, 0x9fd3e0, 0.35));
      }
    }
  }
  // window frame
  pc.strokeRect(gx0 - 2, gy0 - 2, gx1 - gx0 + 4, gy1 - gy0 + 4, PAL.ink);
  pc.strokeRect(gx0 - 1, gy0 - 1, gx1 - gx0 + 2, gy1 - gy0 + 2, 0x6a5470);
  pc.rect(266, gy0, 2, gy1 - gy0, 0x6a5470);
  pc.vline(268, gy0, gy1 - 1, PAL.ink);
  // window lettering
  miniText(pc, 274, 124, "ARCADE", PAL.yellow);
  miniText(pc, 228, 124, "24H", PAL.offwhite);
  // sill
  pc.rect(X0 + 3, 134, 320 - X0 - 3, 5, 0xb3aea7);
  pc.hline(X0 + 3, 319, 134, 0xd2cdc4);
  pc.hline(X0 + 3, 319, 138, 0x6c6763);
  pc.hline(X0 + 3, 319, 139, PAL.ink);
  // panel under window
  pc.rect(X0 + 3, 140, 320 - X0 - 3, 8, 0x2e2034);
  for (let x = X0 + 8; x < 320; x += 18) pc.strokeRect(x, 141, 14, 6, 0x4a3650);

  // striped awning
  const ay0 = 24;
  const ay1 = 42;
  for (let x = X0 - 2; x < 320; x++) {
    const stripe = Math.floor((x - X0 + 2) / 8) % 2 === 0;
    const base = stripe ? PAL.magenta : PAL.offwhite;
    for (let y = ay0; y < ay1; y++) {
      const t = (y - ay0) / (ay1 - ay0);
      const c = t < 0.2 ? scale(base, 0.78) : t > 0.75 ? lighten(base, 0.08) : base;
      pc.set(x, y, c);
    }
    // scalloped edge
    const lx = (x - X0 + 2) % 8;
    const depth = Math.round(Math.sin(((lx + 0.5) / 8) * Math.PI) * 4);
    for (let y = ay1; y < ay1 + depth; y++) pc.set(x, y, stripe ? PAL.magentaDark : 0xc9c3b5);
    pc.set(x, ay1 + depth, PAL.ink);
  }
  pc.hline(X0 - 2, 319, ay0, PAL.ink);
  pc.hline(X0 - 2, 319, ay0 + 1, 0x4a3650);
  // awning shadow on the facade/glass
  shadePass(pc, X0 + 3, 47, 320, 56, () => 0.7, 0.1);
}

function drawPipe(pc: PixelCanvas) {
  const x = 204;
  pc.rect(x, 0, 6, 150, PAL.gray);
  pc.vline(x + 1, 0, 149, PAL.grayLight);
  pc.vline(x + 4, 0, 149, PAL.grayDark);
  pc.vline(x - 1, 0, 149, PAL.ink);
  pc.vline(x + 6, 0, 149, PAL.ink);
  for (const by of [40, 104]) {
    pc.rect(x - 2, by, 10, 3, PAL.grayDark);
    pc.hline(x - 2, x + 7, by, PAL.grayLight);
    pc.strokeRect(x - 3, by - 1, 12, 5, PAL.ink);
  }
  // shoe at bottom
  pc.rect(x - 1, 146, 10, 6, PAL.gray);
  pc.hline(x - 1, x + 8, 146, PAL.grayLight);
  pc.strokeRect(x - 2, 145, 12, 8, PAL.ink);
}

function drawPosters(pc: PixelCanvas) {
  // WANTED poster
  const px = 36;
  const py = 46;
  const pw = 42;
  const ph = 56;
  pc.rect(px + 2, py + 2, pw, ph, 0x3a2422); // drop shadow
  pc.rect(px, py, pw, ph, 0xe8dcc0);
  // aged paper speckles + darker border band
  const R = rng(77);
  for (let i = 0; i < 70; i++) pc.set(px + Math.floor(R() * pw), py + Math.floor(R() * ph), 0xd4c4a0);
  pc.strokeRect(px + 2, py + 2, pw - 4, ph - 4, 0xb8a47c);
  miniText(pc, px + Math.floor((pw - miniTextWidth("WANTED")) / 2), py + 5, "WANTED", PAL.redDark);
  // mug shot frame + mini SCAMBOY
  pc.rect(px + 9, py + 13, 24, 24, 0xc9b994);
  pc.strokeRect(px + 9, py + 13, 24, 24, 0x8a7550);
  const pal: Record<string, Color> = { ...FACE_PALETTE, H: 0x4b3a2a };
  for (let y = 0; y < MINI_HEAD.length; y++)
    for (let x = 0; x < MINI_HEAD[y].length; x++) {
      const c = pal[MINI_HEAD[y][x]];
      if (c !== undefined) pc.rect(px + 11 + x * 2, py + 15 + y * 2, 2, 2, c);
    }
  miniText(pc, px + Math.floor((pw - miniTextWidth("SCAMBOY")) / 2), py + 40, "SCAMBOY", PAL.ink);
  for (let x = px + 6; x < px + pw - 6; x += 2) pc.set(x, py + 48, 0x8a7550);
  // torn bottom-right corner
  for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) pc.set(px + pw - 1 - j, py + ph - 7 + i, MORTAR);
  pc.line(px + pw - 7, py + ph - 1, px + pw - 1, py + ph - 7, 0xb8a47c);
  // tape
  for (const [tx, ty] of [
    [px - 2, py - 1],
    [px + pw - 6, py - 1],
  ]) {
    pc.rect(tx, ty, 8, 3, 0xd9d2b0);
    pc.hline(tx, tx + 7, ty, 0xeee8cc);
  }
  pc.strokeRect(px - 1, py - 1, pw + 2, ph + 2, 0x3a2422);

  // purple gig poster, half torn
  const gx = 84;
  const gy = 58;
  pc.rect(gx + 2, gy + 2, 30, 38, 0x3a2422);
  pc.rect(gx, gy, 30, 38, PAL.purple);
  pc.rect(gx, gy, 30, 3, PAL.purpleDark);
  // star burst
  pc.poly([[gx + 15, gy + 6], [gx + 18, gy + 13], [gx + 25, gy + 14], [gx + 19, gy + 18], [gx + 21, gy + 25], [gx + 15, gy + 21], [gx + 9, gy + 25], [gx + 11, gy + 18], [gx + 5, gy + 14], [gx + 12, gy + 13]], PAL.yellow);
  pc.set(gx + 14, gy + 12, 0xfff08a);
  miniText(pc, gx + 9, gy + 28, "GIG", PAL.offwhite);
  for (let x = gx + 3; x < gx + 27; x += 3) pc.set(x, gy + 35, PAL.magentaLight);
  // torn top-left: brick shows through with a ragged edge
  for (let y = 0; y < 12; y++) {
    const w = 12 - y + (y % 3 === 0 ? 1 : 0);
    for (let x = 0; x < w; x++) pc.set(gx + x, gy + y, MORTAR);
    pc.set(gx + w, gy + y, 0xc6b6e6);
  }
  pc.strokeRect(gx - 1, gy - 1, 32, 40, 0x3a2422);
}

function drawGraffiti(pc: PixelCanvas) {
  const tag = new PixelCanvas(96, 36);
  const s = 3;
  const text = "SCAM";
  miniText(tag, 3, 8, text, PAL.teal, s);
  // fat-cap: thicken with a 1px right/down bleed
  const thick = tag.clone();
  for (let y = 0; y < tag.h; y++)
    for (let x = 0; x < tag.w; x++) if (tag.isOpaque(x, y)) thick.set(x + 1, y + 1, 0x1f7268);
  tag.blit(thick, 0, 0);
  miniText(tag, 3, 8, text, PAL.teal, s);
  // highlights on top-left of each stroke
  for (let y = 0; y < tag.h; y++)
    for (let x = 0; x < tag.w; x++)
      if (tag.get(x, y) === PAL.teal && !tag.isOpaque(x, y - 1)) tag.set(x, y, 0x9ae6dc);
  // drips
  for (const dx of [6, 21, 33, 44]) {
    const len = 3 + (dx % 5);
    for (let i = 0; i < len; i++) tag.set(dx, 24 + i, PAL.teal);
    tag.set(dx, 24 + len, 0x9ae6dc);
  }
  // crown doodle
  tag.poly([[14, 6], [16, 1], [19, 4], [22, 0], [25, 4], [28, 1], [30, 6]], PAL.yellow);
  tag.hline(14, 30, 6, PAL.yellowDark);
  tag.outline(PAL.ink);
  // magenta underline swoosh
  tag.line(2, 31, 50, 29, PAL.magenta, 2);
  tag.line(50, 29, 56, 25, PAL.magenta, 2);
  pc.blit(tag, 28, 108);
}

function drawLamp(pc: PixelCanvas) {
  const x = 14;
  // pole
  pc.rect(x, 40, 6, 186, 0x2c3a3a);
  pc.vline(x + 1, 40, 225, 0x4d6363);
  pc.vline(x + 4, 40, 225, 0x1d2828);
  pc.vline(x - 1, 40, 225, PAL.ink);
  pc.vline(x + 6, 40, 225, PAL.ink);
  for (const ry of [96, 170]) {
    pc.rect(x - 2, ry, 10, 4, 0x2c3a3a);
    pc.hline(x - 2, x + 7, ry, 0x4d6363);
    pc.strokeRect(x - 3, ry - 1, 12, 6, PAL.ink);
  }
  // base
  pc.rect(x - 4, 212, 14, 16, 0x2c3a3a);
  pc.vline(x - 3, 212, 227, 0x4d6363);
  pc.hline(x - 4, x + 9, 212, 0x4d6363);
  pc.strokeRect(x - 5, 211, 16, 18, PAL.ink);
  // lantern
  pc.poly([[x - 6, 30], [x + 3, 24], [x + 12, 30]], 0x2c3a3a);
  pc.rect(x - 5, 30, 16, 2, 0x2c3a3a);
  pc.rect(x - 4, 32, 14, 9, 0xfff2b0);
  pc.rect(x - 2, 33, 10, 7, 0xffffe6);
  pc.vline(x + 2, 32, 40, 0x2c3a3a);
  pc.rect(x - 3, 41, 12, 2, 0x2c3a3a);
  pc.hline(x - 6, x + 12, 30, 0x4d6363);
  // outline lantern
  pc.strokeRect(x - 5, 31, 16, 11, PAL.ink);
  pc.line(x - 7, 30, x + 3, 23, PAL.ink);
  pc.line(x + 13, 30, x + 3, 23, PAL.ink);
}

function drawSidewalk(pc: PixelCanvas, R: () => number) {
  const top = 148;
  const curb = 270;
  // skirting at wall base
  pc.rect(0, top, 320, 8, 0x77726d);
  pc.hline(0, 319, top, 0x9a958f);
  pc.hline(0, 319, top + 7, 0x4f4a47);
  const y0 = top + 8;
  for (let y = y0; y < curb; y++) {
    const t = (y - y0) / (curb - y0);
    for (let x = 0; x < 320; x++) {
      const n = R();
      let c = mix(0x7f7a75, CONCRETE, t);
      if (n < 0.06) c = CONCRETE_DK;
      else if (n > 0.95) c = CONCRETE_LT;
      pc.set(x, y, c);
    }
  }
  // slab joints (perspective)
  for (const jy of [168, 186, 210, 238]) {
    pc.hline(0, 319, jy, 0x5f5a56);
    pc.hline(0, 319, jy + 1, CONCRETE_LT);
  }
  for (let i = -4; i <= 4; i++) {
    const xb = 160 + i * 56;
    const xt = 160 + i * 40;
    pc.line(xt, y0, xb, curb - 1, 0x5f5a56);
    pc.line(xt + 1, y0, xb + 1, curb - 1, CONCRETE_LT);
  }
  // cracks & gum spots
  for (let c = 0; c < 5; c++) {
    let x = Math.floor(R() * 320);
    let y = y0 + 4 + Math.floor(R() * 100);
    for (let i = 0; i < 10; i++) {
      pc.set(x, y, 0x55504c);
      x += R() < 0.5 ? 1 : -1;
      y += R() < 0.6 ? 1 : 0;
    }
  }
  for (let g = 0; g < 9; g++) {
    const gx = Math.floor(R() * 320);
    const gy = y0 + 6 + Math.floor(R() * 104);
    pc.rect(gx, gy, 2, 1, 0x5a5552);
    pc.set(gx, gy - 1, 0x67625e);
  }
  // curb
  pc.rect(0, curb, 320, 3, 0xbdb8b0);
  pc.hline(0, 319, curb, 0xd8d3ca);
  pc.rect(0, curb + 3, 320, 5, 0x7d7873);
  for (let x = 0; x < 320; x += 40) pc.vline(x, curb, curb + 7, 0x5f5a56);
  pc.hline(0, 319, curb + 8, PAL.ink);
  // gutter / road
  for (let y = curb + 9; y < 288; y++)
    for (let x = 0; x < 320; x++) pc.set(x, y, R() < 0.08 ? PAL.asphaltDark : R() < 0.04 ? 0x5c5e6a : PAL.asphalt);
  // drain grate
  pc.rect(246, curb + 10, 28, 7, 0x2a2b33);
  for (let x = 248; x < 272; x += 3) pc.vline(x, curb + 11, curb + 15, 0x55586a);
  pc.strokeRect(245, curb + 9, 30, 9, PAL.ink);
  // road line
  pc.rect(40, 285, 40, 3, 0xd8c060);
  pc.rect(180, 285, 40, 3, 0xd8c060);

  // litter: crumpled paper + bottle cap + leaf
  const paper = new PixelCanvas(10, 8);
  paper.ellipse(5, 4, 4, 3.2, PAL.offwhite);
  paper.set(3, 3, 0xc9c3b5);
  paper.set(6, 5, 0xc9c3b5);
  paper.set(5, 2, 0xc9c3b5);
  paper.outline(PAL.ink);
  pc.blit(paper, 56, 252);
  const cap = new PixelCanvas(7, 5);
  cap.ellipse(3.5, 2.5, 2.6, 1.6, PAL.red);
  cap.set(2, 1, 0xff8a8a);
  cap.outline(PAL.ink);
  pc.blit(cap, 290, 214);
  const leaf = new PixelCanvas(9, 6);
  leaf.poly([[0, 3], [4, 0], [8, 2], [4, 5]], PAL.orange);
  leaf.line(1, 3, 7, 2, PAL.orangeDark);
  leaf.outline(PAL.ink);
  pc.blit(leaf, 268, 248);
}

export function drawBackground(): PixelCanvas {
  const pc = new PixelCanvas(320, 288);
  const R = rng(1337);
  drawBricks(pc, R, 148);
  // a small vent above SCAMBOY
  pc.rect(146, 30, 30, 14, PAL.gray);
  for (let y = 32; y < 42; y += 2) pc.hline(148, 173, y, PAL.grayDark);
  pc.hline(146, 175, 30, PAL.grayLight);
  pc.strokeRect(145, 29, 32, 16, PAL.ink);
  for (const [vx, vy] of [
    [147, 31],
    [174, 31],
    [147, 42],
    [174, 42],
  ])
    pc.set(vx, vy, PAL.grayLight);
  // a cable from the pipe to the shop
  for (let x = 110; x < 204; x++) pc.set(x, 22 + Math.round(Math.sin((x - 110) / 30) * 2 + ((x - 110) * (204 - x)) / 900), PAL.ink);
  drawPosters(pc);
  drawGraffiti(pc);
  drawShop(pc, R);
  drawPipe(pc);
  drawSidewalk(pc, R);
  drawLamp(pc);

  // lighting: warm lamp light near top-left, darker corners, shadow under the table
  shadePass(pc, 0, 0, 320, 288, (x, y) => {
    const dl = Math.hypot((x - 17) * 0.8, y - 36);
    let k = 0.84 + Math.max(0, 1 - dl / 120) * 0.3;
    const dc = Math.hypot((x - 160) / 200, (y - 150) / 190);
    k -= Math.max(0, dc - 0.55) * 0.35;
    // pool of lamplight on the sidewalk
    const dp = Math.hypot((x - 17) / 46, (y - 226) / 14);
    if (dp < 1) k += 0.14 * (1 - dp);
    // table shadow
    const ds = Math.hypot((x - 160) / 128, (y - 262) / 9);
    if (ds < 1) k -= 0.3 * (1 - ds * 0.6);
    return k;
  });
  return pc;
}

// ------------------------------------------------------------------ table

export const TABLE_X = 32;
export const TABLE_Y = 146;

export function drawTable(): PixelCanvas {
  const W = 256;
  const pc = new PixelCanvas(W, 114);
  const R = rng(42);
  // back wooden rim
  pc.poly([[24, 0], [232, 0], [234, 3], [22, 3]], PAL.brownDark);
  pc.hline(25, 231, 0, PAL.brown);
  // felt top (trapezoid)
  const topY = 3;
  const botY = 48;
  for (let y = topY; y < botY; y++) {
    const t = (y - topY) / (botY - topY);
    const xl = Math.round(22 - t * 18);
    const xr = Math.round(234 + t * 18);
    for (let x = xl; x < xr; x++) {
      let c: Color;
      if (t < 0.18) c = t < 0.09 || bayer(x, y) > 0.5 ? FELT_LT : FELT;
      else if (t > 0.8) c = t > 0.9 || bayer(x, y) > 0.5 ? FELT_DK : FELT;
      else c = FELT;
      if (R() < 0.05) c = scale(c, 0.9);
      pc.set(x, y, c);
    }
    // stitched gold border
    if (y > topY + 2 && y < botY - 3 && y % 2 === 0) {
      pc.set(xl + 3, y, PAL.yellowDark);
      pc.set(xr - 4, y, PAL.yellowDark);
    }
  }
  for (let x = 28; x < 228; x += 3) pc.set(x, topY + 2, PAL.yellowDark);
  for (let x = 10; x < 246; x += 3) pc.set(x, botY - 3, PAL.yellowDark);
  // faint ring stains on the felt
  pc.ring(48, 30, 6, 2.5, FELT_DK, 1);
  pc.ring(214, 20, 5, 2, scale(FELT, 0.88), 1);
  // front wooden edge
  pc.rect(2, botY, W - 4, 6, PAL.brown);
  pc.hline(2, W - 3, botY, 0xb07a45);
  pc.hline(2, W - 3, botY + 1, 0x9c6a38);
  pc.hline(2, W - 3, botY + 5, PAL.brownDark);
  for (let x = 12; x < W - 8; x += 22) pc.hline(x, x + 6, botY + 3, 0x7a4c24);
  // drape cloth
  const dy0 = botY + 6;
  const dy1 = 98;
  for (let y = dy0; y < dy1; y++) {
    const t = (y - dy0) / (dy1 - dy0);
    const xl = Math.round(3 - t * 2);
    const xr = Math.round(W - 3 + t * 2);
    for (let x = xl; x < xr; x++) {
      const fold = (x + Math.round(t * 3)) % 24;
      let c: Color = PAL.navy;
      if (fold < 3) c = PAL.navyLight;
      else if (fold < 5) c = 0x283a78;
      else if (fold > 19) c = PAL.navyDark;
      else if (fold > 17) c = 0x16224a;
      if (y < dy0 + 3) c = scale(c, 0.7);
      pc.set(x, y, c);
    }
  }
  // trim + tassels
  pc.rect(1, 90, W - 2, 6, PAL.magenta);
  pc.hline(1, W - 2, 90, PAL.magentaLight);
  pc.hline(1, W - 2, 95, PAL.magentaDark);
  for (let x = 4; x < W - 4; x += 8) {
    pc.vline(x + 2, 96, 99, PAL.yellow);
    pc.rect(x + 1, 99, 3, 3, PAL.yellow);
    pc.set(x + 1, 99, 0xfff08a);
    pc.set(x + 3, 101, PAL.yellowDark);
  }
  // logo: three tiny cups + SHELL GAME
  const cups: Array<[Color, Color, Color]> = [
    [PAL.red, 0xff8a8a, PAL.redDark],
    [PAL.blue, 0x8ab8ff, PAL.blueDark],
    [PAL.yellow, 0xfff08a, PAL.yellowDark],
  ];
  const logo = new PixelCanvas(96, 30);
  cups.forEach(([c, l, d], i) => {
    const cx = 30 + i * 18;
    logo.poly([[cx + 2, 1], [cx + 9, 1], [cx + 11, 10], [cx, 10]], c);
    logo.vline(cx + 3, 2, 9, l);
    logo.vline(cx + 9, 2, 9, d);
    logo.hline(cx, cx + 10, 9, d);
  });
  logo.ellipse(48, 11.5, 2, 1.4, PAL.grayLight);
  miniText(logo, 48 - Math.floor(miniTextWidth("SHELL GAME", 2) / 2), 15, "SHELL GAME", PAL.offwhite, 2);
  logo.outline(PAL.ink);
  pc.blit(logo, W / 2 - 48, 58);
  // folding legs
  for (const lx of [22, W - 46]) {
    pc.line(lx, 102, lx + 20, 112, PAL.grayDark, 2);
    pc.line(lx + 20, 102, lx, 112, PAL.grayDark, 2);
    pc.line(lx, 102, lx + 20, 112, PAL.grayLight);
    pc.rect(lx - 1, 111, 4, 2, PAL.ink);
    pc.rect(lx + 18, 111, 4, 2, PAL.ink);
  }
  pc.outline(PAL.ink);
  return pc;
}

// ------------------------------------------------------------------ SCAMBOY body

export function drawTorso(): PixelCanvas {
  const pc = new PixelCanvas(74, 52);
  const cx = 37;
  // neck
  pc.rect(cx - 5, 0, 10, 7, PAL.skin);
  pc.rect(cx - 5, 0, 10, 2, PAL.skinShade);
  pc.vline(cx + 4, 0, 6, PAL.skinShade);
  // jacket body
  pc.roundRect(4, 5, 66, 50, 13, PAL.navy);
  // side shading / highlight
  for (let y = 5; y < 52; y++) {
    for (let x = 4; x < 70; x++) {
      if (pc.get(x, y) !== PAL.navy) continue;
      if (x < 11) pc.set(x, y, x < 8 && bayer(x, y) > 0.4 ? PAL.navy : PAL.navyLight);
      else if (x > 62) pc.set(x, y, PAL.navyDark);
      else if (x > 58 && bayer(x, y) > 0.5) pc.set(x, y, PAL.navyDark);
    }
  }
  // shoulder top highlight
  for (let x = 14; x < 60; x++) if (pc.get(x, 6) !== null) pc.set(x, 6, x < 37 ? 0x4b60aa : PAL.navyLight);
  // shirt V
  pc.poly([[cx - 10, 4], [cx + 10, 4], [cx, 28]], PAL.magenta);
  pc.poly([[cx + 2, 4], [cx + 10, 4], [cx, 28]], PAL.magentaDark);
  pc.poly([[cx - 8, 5], [cx - 2, 5], [cx - 2, 14]], PAL.magentaLight);
  // collar
  pc.poly([[cx - 11, 3], [cx - 4, 3], [cx - 6, 11]], PAL.magentaLight);
  pc.poly([[cx + 4, 3], [cx + 11, 3], [cx + 6, 11]], PAL.magenta);
  pc.line(cx - 11, 3, cx - 6, 11, PAL.magentaDark);
  pc.line(cx + 11, 3, cx + 6, 11, PAL.magentaDark);
  // gold chain + star pendant
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (i / 14);
    const x = Math.round(cx - Math.cos(a) * 7);
    const y = Math.round(7 + Math.sin(a) * 7);
    pc.set(x, y, i % 2 ? PAL.yellow : PAL.yellowDark);
  }
  pc.rect(cx - 1, 14, 3, 3, PAL.yellow);
  pc.set(cx, 13, PAL.yellow);
  pc.set(cx, 17, PAL.yellowDark);
  pc.set(cx - 1, 14, 0xfff08a);
  // lapels
  pc.poly([[cx - 16, 4], [cx - 10, 4], [cx, 30], [cx - 3, 31], [cx - 18, 14]], PAL.navyDark);
  pc.poly([[cx + 10, 4], [cx + 16, 4], [cx + 18, 14], [cx + 3, 31], [cx, 30]], PAL.navyDark);
  pc.line(cx - 10, 5, cx - 1, 29, PAL.navyLight);
  pc.line(cx + 10, 5, cx + 1, 29, 0x283a78);
  pc.line(cx - 17, 13, cx - 13, 18, PAL.navyLight);
  // closure seam & buttons
  pc.vline(cx, 31, 51, PAL.navyDark);
  for (const by of [36, 45]) {
    pc.rect(cx - 2, by, 3, 3, PAL.ink);
    pc.set(cx - 1, by + 1, PAL.grayLight);
  }
  // pocket square
  pc.poly([[cx + 13, 24], [cx + 15, 19], [cx + 17, 23], [cx + 19, 19], [cx + 21, 24]], PAL.magentaLight);
  pc.hline(cx + 12, cx + 22, 24, PAL.navyDark);
  pc.hline(cx + 12, cx + 22, 25, PAL.navyLight);
  // shoulder seams
  pc.line(14, 16, 18, 8, PAL.navyDark);
  pc.line(60, 16, 56, 8, PAL.ink);
  pc.outline(PAL.ink);
  return pc;
}

/** Head frames — the canonical SCAMBOY face with extra game expressions, at 2x. */
function shiftEyes(rows: string[], dx: number) {
  for (const y of [10, 11, 12]) {
    const old = rows[y].split("");
    const next = [...old];
    for (let x = 4; x <= 15; x++) if (old[x] === "K") next[x] = "S";
    for (let x = 4; x <= 15; x++) if (old[x] === "K" && x + dx >= 3 && x + dx <= 15) next[x + dx] = "K";
    rows[y] = next.join("");
  }
}

function put(rows: string[], y: number, x: number, s: string) {
  const r = rows[y].split("");
  for (let i = 0; i < s.length; i++) r[x + i] = s[i];
  rows[y] = r.join("");
}

function headRows(frame: HeadFrame): string[] {
  const base = (e: FaceExpr) => [...faceRows(e)];
  let rows: string[];
  switch (frame) {
    case HEAD.smile:
      return base("smile");
    case HEAD.smileL:
      rows = base("smile");
      shiftEyes(rows, -1);
      return rows;
    case HEAD.smileR:
      rows = base("smile");
      shiftEyes(rows, 1);
      return rows;
    case HEAD.blink:
      rows = base("smile");
      put(rows, 11, 3, "SSSSSSSSSSSSS");
      put(rows, 12, 3, "SSSSSSSSSSSSS");
      put(rows, 12, 6, "KK");
      put(rows, 12, 11, "KK");
      return rows;
    case HEAD.grin:
    case HEAD.grinL:
    case HEAD.grinR:
      rows = base("grin");
      put(rows, 13, 4, "R");
      put(rows, 13, 14, "R");
      if (frame === HEAD.grinL) shiftEyes(rows, -1);
      if (frame === HEAD.grinR) shiftEyes(rows, 1);
      return rows;
    case HEAD.shock:
      return base("shock");
    case HEAD.sweat:
      rows = base("shock");
      put(rows, 9, 18, "K");
      put(rows, 10, 17, "KTK");
      put(rows, 11, 17, "KTK");
      put(rows, 12, 18, "K");
      return rows;
    case HEAD.angry:
      rows = base("angry");
      put(rows, 9, 18, "K");
      put(rows, 10, 17, "KTK");
      put(rows, 11, 18, "K");
      return rows;
    case HEAD.laughA:
      rows = base("laugh");
      put(rows, 13, 4, "R");
      put(rows, 13, 14, "R");
      return rows;
    case HEAD.laughB:
      rows = base("laugh");
      put(rows, 13, 5, "KKKKKKKKK");
      put(rows, 14, 5, "KWWWWWWWK");
      put(rows, 15, 5, "KMMMMMMMK");
      put(rows, 16, 6, "KKKKKKK");
      put(rows, 12, 4, "T");
      put(rows, 13, 4, "T");
      put(rows, 12, 15, "T");
      put(rows, 13, 15, "T");
      return rows;
    case HEAD.wink:
      return base("wink");
    case HEAD.sad:
      return base("sad");
  }
  return base("smile");
}

const HEAD_PAL: Record<string, Color> = { ...FACE_PALETTE, T: PAL.sky, R: PAL.magentaLight };

function headCanvas(frame: HeadFrame): PixelCanvas {
  const rows = headRows(frame);
  const s = 2;
  const w = rows[0].length;
  const h = rows.length;
  const pc = new PixelCanvas(w * s, h * s);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const c = HEAD_PAL[ch];
      if (c === undefined) continue;
      pc.rect(x * s, y * s, s, s, c);
      // 2x detail: cap sheen, skin shading on the lower-right, brim underside
      const below = rows[y + 1]?.[x];
      const above = rows[y - 1]?.[x];
      if (ch === "C" && above === "K") pc.set(x * s + 1, y * s, PAL.capHi);
      if (ch === "C" && x < 7 && y < 6 && above !== "K") pc.set(x * s, y * s, 0x3a3a48);
      if (ch === "S" && rows[y][x + 1] === "K" && y > 10) pc.set(x * s + 1, y * s + 1, PAL.skinShade);
      if (ch === "S" && below === "K" && y > 14) pc.set(x * s, y * s + 1, PAL.skinShade);
      if (ch === "D" && below === "K") pc.hline(x * s, x * s + 1, y * s + 1, 0x101016);
      if (ch === "S" && above === "K" && y === 9) pc.hline(x * s, x * s + 1, y * s, PAL.skinShade);
    }
  return pc;
}

/** hand frames (left hand; right hand = mirrored) */
const HAND_ROWS: string[][] = [
  // rest: flat hand on the table, fingers toward the viewer
  [
    "...KKKKKKK....",
    "...KWWWWWK....",
    "...KwwwwwK....",
    "..KSSSSSSSK...",
    ".KSSSSSSSSSK..",
    ".KHSSSSSSSsKK.",
    ".KSSSSSSSSsSsK",
    ".KSKSKSKSsKssK",
    ".KSKSKSKSsKKK.",
    ".KsKsKsKsK....",
    "..K.K.K.KK....",
    "..............",
  ],
  // grip: fist over the top of a cup
  [
    "...KKKKKKK....",
    "...KWWWWWK....",
    "...KwwwwwK....",
    "..KKSSSSSKK...",
    ".KSSKSSKSSKK..",
    ".KHSKSSKSSsKK.",
    ".KSSSSSSSSsSsK",
    ".KSSSSSSSssSsK",
    ".KsSSSSSsssKK.",
    "..KsssssssK...",
    "...KKKKKKK....",
    "..............",
  ],
  // tap: index finger raised (drumming on the table)
  [
    "...KKKKKKK....",
    "...KWWWWWK....",
    "...KwwwwwK....",
    "..KSSSSSSSK...",
    ".KSSSSSSSSSK..",
    ".KHSSSSSSSsKK.",
    ".KSSSSSSSSsSsK",
    ".KSKSKSKSsKssK",
    ".KSKSKSKKKKKK.",
    ".KsKsKsK......",
    "..K.K.K.......",
    "..............",
  ],
];
const HAND_PAL: Record<string, Color> = {
  K: PAL.ink,
  W: PAL.offwhite,
  w: PAL.shell,
  S: PAL.skin,
  s: PAL.skinShade,
  H: 0xffe0c4,
};

// ------------------------------------------------------------------ cups & props

const CUP_SET: Array<{ base: Color; light: Color; dark: Color; deep: Color }> = [
  { base: PAL.red, light: 0xff7a7a, dark: PAL.redDark, deep: 0x6a1420 },
  { base: PAL.blue, light: 0x86b8ff, dark: PAL.blueDark, deep: 0x15336e },
  { base: PAL.yellow, light: 0xfff2a0, dark: PAL.yellowDark, deep: 0x9a6a10 },
];

export const CUP_W = 30;
export const CUP_H = 34;

function cupCanvas(ci: number, lifted: boolean): PixelCanvas {
  const { base, light, dark, deep } = CUP_SET[ci];
  const pc = new PixelCanvas(CUP_W, CUP_H);
  const cx = 15;
  // body: narrow closed top (y=4) to wide mouth (y=28)
  for (let y = 4; y <= 29; y++) {
    const t = (y - 4) / 25;
    const half = 7.5 + t * 5;
    const l = Math.round(cx - half);
    const r = Math.round(cx + half);
    for (let x = l; x < r; x++) {
      const u = (x - l) / (r - l);
      let c = base;
      if (u < 0.12) c = dark;
      else if (u < 0.3) c = light;
      else if (u < 0.38) c = bayer(x, y) > 0.5 ? light : base;
      else if (u > 0.86) c = deep;
      else if (u > 0.7) c = dark;
      else if (u > 0.62) c = bayer(x, y) > 0.5 ? dark : base;
      pc.set(x, y, c);
    }
    // specular stripe
    pc.set(Math.round(cx - half * 0.45), y, y % 7 === 3 ? lighten(light, 0.6) : lighten(light, 0.35));
  }
  // domed top
  pc.ellipse(cx, 4.5, 7.5, 2.6, light);
  pc.ellipse(cx + 1, 5, 5.5, 1.6, base);
  pc.hline(cx - 4, cx - 1, 3, lighten(light, 0.5));
  // embossed bands
  for (const by of [11, 21]) {
    const t = (by - 4) / 25;
    const half = 7.5 + t * 5;
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
      pc.set(x, by, deep);
      pc.set(x, by + 1, lighten(pc.get(x, by + 1) ?? base, 0.25));
    }
  }
  // rim lip
  for (let x = 1; x < 29; x++) {
    const u = (x - 1) / 28;
    pc.set(x, 29, u < 0.2 ? dark : u > 0.8 ? deep : light);
    pc.set(x, 30, u < 0.15 || u > 0.75 ? deep : dark);
  }
  if (lifted) {
    // looking up into the mouth of the cup
    pc.ellipse(cx, 30, 12.5, 2.2, 0x1c1018);
    pc.hline(cx - 9, cx + 9, 31, scale(deep, 0.7));
    pc.hline(cx - 11, cx + 11, 29, dark);
  }
  pc.outline(PAL.ink);
  return pc;
}

function stoneCanvas(): PixelCanvas {
  const pc = new PixelCanvas(12, 9);
  pc.ellipse(6, 4.6, 5, 3.4, PAL.gray);
  pc.ellipse(7, 5.6, 4, 2.4, PAL.grayDark);
  pc.ellipse(5.5, 4.2, 3.5, 2.2, PAL.gray);
  pc.ellipse(4.5, 3.4, 2, 1.2, PAL.grayLight);
  pc.set(3, 3, PAL.white);
  pc.set(8, 4, 0x6e7184);
  pc.set(6, 6, 0x6e7184);
  pc.outline(PAL.ink);
  return pc;
}

function shadowCanvas(): PixelCanvas {
  const pc = new PixelCanvas(32, 7);
  pc.ellipse(16, 3.5, 15.5, 3.2, PAL.ink);
  return pc;
}

function pointerFrames(): PixelCanvas[] {
  const up = [
    "....KK.......",
    "...KWWK......",
    "...KWWK......",
    "...KWWK......",
    "...KWWKKK....",
    "...KWWKWWKK..",
    ".KKKWWKWWKWK.",
    "KWWKWWWWWKWWK",
    "KWWWWWWWWWWWK",
    "KWWWWWWWWWWgK",
    ".KWWWWWWWWWgK",
    ".KWWWWWWWWggK",
    "..KWWWWWWWgK.",
    "..KgggggggK..",
    "..KMMMMMMMK..",
    "..KKKKKKKKK..",
  ];
  const pal: Record<string, Color> = { K: PAL.ink, W: PAL.white, g: PAL.grayLight, M: PAL.magenta };
  const a = new PixelCanvas(13, 16);
  a.draw(up, pal);
  const down = new PixelCanvas(13, 16);
  down.blit(a, 0, 0, false, true);
  // pressed: finger shortened by two rows
  const pressedRows = [...up.slice(0, 1), ...up.slice(3)];
  const p = new PixelCanvas(13, 16);
  p.draw(pressedRows, pal, 0, 2);
  const pressed = new PixelCanvas(13, 16);
  pressed.blit(p, 0, 0, false, true);
  return [down, pressed];
}

function heartFrames(): PixelCanvas[] {
  const rows = [
    ".KKK.KKK.",
    "KRWRKRRRK",
    "KWRRRRRrK",
    "KRRRRRRrK",
    ".KRRRRrK.",
    "..KRRrK..",
    "...KrK...",
    "....K....",
  ];
  const full = new PixelCanvas(9, 8).draw(rows, { K: PAL.ink, R: PAL.red, W: PAL.white, r: PAL.redDark });
  const empty = new PixelCanvas(9, 8).draw(rows, { K: PAL.ink, R: PAL.grayDark, W: PAL.gray, r: PAL.asphaltDark });
  return [full, empty];
}

function neonFrames(): PixelCanvas[] {
  const make = (on: boolean) => {
    const pc = new PixelCanvas(40, 18);
    // backing plate + hanging chains
    pc.rect(1, 3, 38, 14, 0x150e1c);
    pc.strokeRect(0, 2, 40, 16, PAL.ink);
    pc.vline(6, 0, 2, PAL.grayDark);
    pc.vline(33, 0, 2, PAL.grayDark);
    const tube = new PixelCanvas(40, 18);
    miniText(tube, 5, 5, "OPEN", on ? PAL.magentaLight : 0x5a3a4a, 2);
    if (on) {
      // glow halo
      const halo = tube.clone().silhouette(PAL.magentaDark);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        pc.blit(halo, dx, dy);
      for (let y = 0; y < 18; y++) for (let x = 0; x < 40; x++) if (tube.get(x, y) !== null && (x + y) % 4 === 0) tube.set(x, y, 0xffd0e6);
    }
    pc.blit(tube, 0, 0);
    return pc;
  };
  return [make(true), make(false)];
}

function glowCanvas(): PixelCanvas {
  const pc = new PixelCanvas(64, 56);
  for (let y = 0; y < 56; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot((x - 32) / 32, (y - 20) / 28);
      if (d >= 1) continue;
      const a = d < 0.35 ? 70 : d < 0.65 ? 42 : 20;
      pc.set(x, y, 0xffe9a0, a);
    }
  return pc;
}

/** sitting orange tabby, 4 frames: tail positions 0..2, blink */
function catFrames(): PixelCanvas[] {
  const tails: Array<Array<[number, number]>> = [
    [
      [15, 20],
      [19, 19],
      [21, 16],
      [21, 12],
      [19, 9],
    ],
    [
      [15, 20],
      [19, 19],
      [22, 17],
      [23, 13],
      [23, 9],
    ],
    [
      [15, 20],
      [19, 20],
      [22, 18],
      [24, 15],
      [25, 12],
    ],
  ];
  const frame = (tail: Array<[number, number]>, blink: boolean) => {
    const pc = new PixelCanvas(28, 24);
    const O = PAL.orange;
    const D = PAL.orangeDark;
    // tail
    for (let i = 0; i + 1 < tail.length; i++) pc.line(tail[i][0], tail[i][1], tail[i + 1][0], tail[i + 1][1], O, 2);
    const tip = tail[tail.length - 1];
    pc.rect(tip[0] - 1, tip[1] - 1, 2, 2, D);
    // body
    pc.ellipse(10, 15.5, 7, 6.5, O);
    pc.ellipse(9, 18, 4, 3.5, PAL.offwhite);
    // stripes
    for (const [sx, sy] of [
      [14, 12],
      [15, 15],
      [14, 18],
    ])
      pc.hline(sx, sx + 2, sy, D);
    // head
    pc.ellipse(9, 7, 6, 5, O);
    pc.poly([[3, 5], [4, 0], [8, 3]], O);
    pc.poly([[10, 3], [14, 0], [15, 5]], O);
    pc.set(5, 2, PAL.magentaLight);
    pc.set(13, 2, PAL.magentaLight);
    pc.hline(7, 11, 3, D);
    pc.set(9, 4, D);
    // face
    if (blink) {
      pc.hline(5, 7, 7, PAL.ink);
      pc.hline(11, 13, 7, PAL.ink);
    } else {
      pc.rect(6, 6, 2, 2, PAL.green);
      pc.rect(11, 6, 2, 2, PAL.green);
      pc.set(7, 6, PAL.ink);
      pc.set(12, 6, PAL.ink);
    }
    pc.set(9, 9, PAL.magentaLight);
    pc.hline(8, 10, 10, D);
    pc.ellipse(9, 10.5, 2.4, 1.3, PAL.offwhite);
    pc.set(9, 9, PAL.magentaLight);
    // front paws
    pc.rect(6, 21, 3, 2, PAL.offwhite);
    pc.rect(10, 21, 3, 2, PAL.offwhite);
    pc.outline(PAL.ink);
    pc.set(9, 22, PAL.ink);
    return pc;
  };
  return [frame(tails[0], false), frame(tails[1], false), frame(tails[2], false), frame(tails[1], true)];
}

/** pigeon facing left, 3 frames: stand, peck, step */
function pigeonFrames(): PixelCanvas[] {
  const frame = (pose: 0 | 1 | 2) => {
    const pc = new PixelCanvas(18, 15);
    const B = 0x8a93a8;
    const BD = 0x5e6678;
    const BL = 0xb4bccc;
    // tail
    pc.poly([[12, 7], [17, 9], [16, 11], [11, 10]], BD);
    // body
    pc.ellipse(9, 9, 5.5, 3.6, B);
    pc.ellipse(10, 8, 3.5, 2, BL);
    pc.line(8, 10, 13, 9, BD);
    pc.hline(10, 13, 7, BD);
    // head & neck
    const hx = pose === 1 ? 3 : 5;
    const hy = pose === 1 ? 9 : 4;
    pc.line(7, 7, hx + 1, hy + 1, 0x4fa38f, 2);
    pc.set(6, 7, 0x8a5fc0);
    pc.ellipse(hx, hy, 2.2, 2, B);
    pc.set(hx - 1, hy - 1, 0xf4a24c);
    pc.rect(hx - 4, hy, 2, 1, 0xd9c7b0);
    // feet
    const fx = pose === 2 ? 1 : 0;
    pc.vline(8 + fx, 12, 13, PAL.magentaLight);
    pc.vline(11 - fx, 12, 13, PAL.magentaLight);
    pc.outline(PAL.ink);
    return pc;
  };
  return [frame(0), frame(1), frame(2)];
}

function confettiFrames(): PixelCanvas[] {
  const cols: Array<[Color, Color]> = [
    [PAL.magentaLight, PAL.magenta],
    [PAL.yellow, PAL.yellowDark],
    [0x5fd3c6, PAL.teal],
    [0x86b8ff, PAL.blue],
  ];
  const out: PixelCanvas[] = [];
  for (const [c, d] of cols) {
    const a = new PixelCanvas(5, 5);
    a.rect(0, 1, 5, 2, c);
    a.hline(0, 4, 2, d);
    const b = new PixelCanvas(5, 5);
    b.rect(2, 0, 2, 5, c);
    b.vline(3, 0, 4, d);
    out.push(a, b);
  }
  return out;
}

function sparkleFrames(): PixelCanvas[] {
  const sizes = [1, 2, 4, 2];
  return sizes.map((s, i) => {
    const pc = new PixelCanvas(11, 11);
    const c = 5;
    pc.hline(c - s, c + s, c, PAL.white);
    pc.vline(c, c - s, c + s, PAL.white);
    if (s >= 2) {
      pc.set(c, c, PAL.yellow);
      pc.set(c - 1, c - 1, i === 2 ? PAL.white : PAL.yellow);
      pc.set(c + 1, c + 1, PAL.yellow);
      pc.set(c - 1, c + 1, PAL.yellow);
      pc.set(c + 1, c - 1, PAL.yellow);
    }
    if (s >= 4) {
      pc.set(c - 3, c - 3, PAL.yellowDark);
      pc.set(c + 3, c + 3, PAL.yellowDark);
      pc.set(c - 3, c + 3, PAL.yellowDark);
      pc.set(c + 3, c - 3, PAL.yellowDark);
    }
    return pc;
  });
}

function hudCanvas(): PixelCanvas {
  const pc = new PixelCanvas(320, 26);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 320; x++) pc.set(x, y, (x + y) % 6 === 0 ? 0x18224a : PAL.navyDark);
  pc.hline(0, 319, 0, PAL.navyLight);
  pc.hline(0, 319, 22, PAL.magenta);
  pc.hline(0, 319, 23, PAL.magentaDark);
  pc.hline(0, 319, 24, PAL.ink);
  pc.hline(0, 319, 25, PAL.ink);
  for (const rx of [2, 316]) {
    pc.rect(rx, 9, 2, 2, PAL.navyLight);
    pc.set(rx, 9, PAL.grayLight);
  }
  return pc;
}

function promptCanvas(): PixelCanvas {
  const pc = new PixelCanvas(240, 16);
  pc.roundRect(0, 0, 240, 16, 4, PAL.ink);
  pc.roundRect(1, 1, 238, 14, 3, PAL.navyDark);
  pc.hline(4, 235, 1, PAL.navyLight);
  pc.hline(4, 235, 14, PAL.magentaDark);
  return pc;
}

// ------------------------------------------------------------------ dynamic panels

/** speech bubble with a tail at the bottom-left; texture key is cached by size */
export function bubbleTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sg-bubble-${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const tail = 9;
  const pc = new PixelCanvas(w, h + tail);
  pc.roundRect(1, 1, w - 2, h - 2, 5, PAL.offwhite);
  // under-shade
  for (let x = 4; x < w - 4; x++) pc.set(x, h - 3, PAL.shell);
  // tail pointing down-left
  pc.poly([[12, h - 3], [22, h - 3], [6, h + tail - 1]], PAL.offwhite);
  pc.line(13, h - 2, 8, h + tail - 3, PAL.shell);
  pc.outline(PAL.ink);
  // highlight
  pc.hline(6, Math.min(w - 8, 26), 3, PAL.white);
  pc.set(4, 5, PAL.white);
  registerTexture(scene, key, pc);
  return key;
}

/** framed navy panel used for title / banners / end screens */
export function panelTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sg-panel-${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const pc = new PixelCanvas(w, h);
  pc.roundRect(0, 0, w, h, 6, PAL.ink);
  pc.roundRect(1, 1, w - 2, h - 2, 5, PAL.magenta);
  pc.roundRect(3, 3, w - 6, h - 6, 4, PAL.ink);
  pc.roundRect(4, 4, w - 8, h - 8, 3, PAL.navy);
  for (let y = 5; y < h - 5; y++)
    for (let x = 5; x < w - 5; x++) if ((x + y * 2) % 7 === 0) pc.set(x, y, 0x23326a);
  pc.hline(6, w - 7, 4, PAL.navyLight);
  pc.hline(6, w - 7, h - 5, PAL.navyDark);
  pc.hline(4, w - 5, 1, PAL.magentaLight);
  for (const [rx, ry] of [
    [6, 6],
    [w - 8, 6],
    [6, h - 8],
    [w - 8, h - 8],
  ]) {
    pc.rect(rx, ry, 2, 2, PAL.magentaLight);
    pc.set(rx + 1, ry + 1, PAL.magentaDark);
  }
  registerTexture(scene, key, pc);
  return key;
}

// ------------------------------------------------------------------ registration

export function buildShellArt(scene: Phaser.Scene) {
  if (scene.textures.exists(TEX.bg)) return;
  registerTexture(scene, TEX.bg, drawBackground());
  registerTexture(scene, TEX.table, drawTable());
  registerTexture(scene, TEX.torso, drawTorso());
  const heads: PixelCanvas[] = [];
  for (let f = 0; f <= HEAD.sad; f++) heads.push(headCanvas(f as HeadFrame));
  registerSheet(scene, TEX.head, heads);
  const hands = HAND_ROWS.map((r) => new PixelCanvas(14, 12).draw(r, HAND_PAL));
  registerSheet(scene, TEX.hand, [...hands, ...hands.map((h) => h.flipped())]);
  const armO = new PixelCanvas(10, 10).circle(5, 5, 5, PAL.ink);
  registerTexture(scene, TEX.armOutline, armO);
  const armF = new PixelCanvas(10, 10).circle(5, 5, 4, PAL.navy);
  armF.ellipse(4.5, 3.5, 2.5, 1.5, PAL.navyLight);
  armF.ellipse(5.5, 7, 2.5, 1.2, PAL.navyDark);
  registerTexture(scene, TEX.armFill, armF);
  const cups: PixelCanvas[] = [];
  for (let c = 0; c < CUP_COLORS; c++) cups.push(cupCanvas(c, false), cupCanvas(c, true));
  registerSheet(scene, TEX.cup, cups);
  registerTexture(scene, TEX.stone, stoneCanvas());
  registerTexture(scene, TEX.shadow, shadowCanvas());
  registerSheet(scene, TEX.pointer, pointerFrames());
  registerSheet(scene, TEX.heart, heartFrames());
  registerSheet(scene, TEX.neon, neonFrames());
  registerTexture(scene, TEX.glow, glowCanvas());
  registerSheet(scene, TEX.cat, catFrames());
  registerSheet(scene, TEX.pigeon, pigeonFrames());
  registerSheet(scene, TEX.confetti, confettiFrames());
  registerSheet(scene, TEX.sparkle, sparkleFrames());
  registerTexture(scene, TEX.hud, hudCanvas());
  registerTexture(scene, TEX.prompt, promptCanvas());
}
