/**
 * Layered parallax backgrounds for the three stages, painted once into PixelCanvas
 * buffers. Pure module.
 *
 * Layers (back to front): sky (fixed), far skyline, mid buildings, near facade (1:1),
 * ground (1:1). Facades end at FACADE_BOTTOM where the walkable street begins.
 */
import { PixelCanvas, rng } from "../engine/pixel";
import { PAL } from "../engine/palette";
import { mix, mul } from "./doll";
import type { Theme } from "./stages";

export const SKY_H = 200;
export const FACADE_TOP = 20;
export const FACADE_BOTTOM = 196;
export const GROUND_TOP = 190;
export const FAR_F = 0.15;
export const MID_F = 0.45;

const K = PAL.ink;

// ------------------------------------------------------------------ tiny 3x5 font

const FONT: Record<string, string[]> = {
  A: ["###", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: ["###", "#..", "#..", "#..", "###"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: ["###", "#..", "#.#", "#.#", "###"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", "###"],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["###", "#.#", "###", "#..", "#.."],
  Q: ["###", "#.#", "#.#", "###", "..#"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: ["###", "#..", "###", "..#", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  $: [".##", "##.", ".#.", ".##", "##."],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "-": ["...", "...", "###", "...", "..."],
  "&": [".#.", "#.#", ".#.", "#.#", ".##"],
  " ": ["...", "...", "...", "...", "..."],
};

export function textWidth(s: string, scale = 1) {
  return s.length * 4 * scale - scale;
}

export function drawText(pc: PixelCanvas, x: number, y: number, s: string, c: number, scale = 1) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++) if (g[gy][gx] === "#") pc.rect(cx + gx * scale, y + gy * scale, scale, scale, c);
    cx += 4 * scale;
  }
}

/** blobby graffiti letters with outline, gradient fill and highlight */
function bubbleText(pc: PixelCanvas, x: number, y: number, s: string, top: number, bottom: number, line: number, scale = 3) {
  const tmp = new PixelCanvas(textWidth(s, scale) + scale * 4, 5 * scale + scale * 4);
  let cx = scale * 2;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++)
        if (g[gy][gx] === "#") tmp.circle(cx + gx * scale + scale / 2, scale * 2 + gy * scale + scale / 2, scale * 0.85, 0xffffff);
    cx += 4 * scale;
  }
  const H = tmp.h;
  for (let yy = 0; yy < tmp.h; yy++)
    for (let xx = 0; xx < tmp.w; xx++) {
      if (!tmp.isOpaque(xx, yy)) continue;
      const t = yy / H;
      let c = mix(top, bottom, Math.min(1, t * 1.3));
      if (!tmp.isOpaque(xx, yy - 1) || !tmp.isOpaque(xx - 1, yy)) c = mix(c, 0xffffff, 0.5);
      tmp.set(xx, yy, c);
    }
  tmp.outline(line);
  tmp.outline(K);
  pc.blit(tmp, x, y);
}

// ------------------------------------------------------------------ helpers

function vgrad(pc: PixelCanvas, y0: number, y1: number, c0: number, c1: number, x0 = 0, x1 = pc.w) {
  const steps = 8;
  for (let y = y0; y < y1; y++) {
    const t = Math.floor(((y - y0) / Math.max(1, y1 - y0)) * steps) / steps;
    pc.rect(x0, y, x1 - x0, 1, mix(c0, c1, t));
  }
}

function dither(pc: PixelCanvas, x: number, y: number, w: number, h: number, c: number, every = 2) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x + (yy % every); xx < x + w; xx += every) pc.set(xx, yy, c);
}

function bricks(pc: PixelCanvas, x0: number, y0: number, w: number, h: number, base: number, r: () => number) {
  const mortar = mix(base, 0x1a1020, 0.55);
  pc.rect(x0, y0, w, h, mortar);
  const bw = 8;
  const bh = 4;
  for (let y = y0; y < y0 + h; y += bh) {
    const off = ((y - y0) / bh) % 2 === 0 ? 0 : bw / 2;
    for (let x = x0 - off; x < x0 + w; x += bw) {
      const k = 0.86 + r() * 0.24;
      const c = mul(base, k);
      const bx = Math.max(x0, x);
      const ex = Math.min(x0 + w, x + bw - 1);
      if (ex <= bx) continue;
      pc.rect(bx, y, ex - bx, bh - 1, c);
      pc.rect(bx, y, ex - bx, 1, mix(c, 0xffffff, 0.12));
    }
  }
}

function windowBox(pc: PixelCanvas, x: number, y: number, w: number, h: number, lit: boolean, frame: number, glass: number, litC: number) {
  pc.rect(x - 1, y - 1, w + 2, h + 2, frame);
  pc.rect(x, y, w, h, lit ? litC : glass);
  if (lit) {
    pc.rect(x, y + h - 2, w, 2, mix(litC, 0x000000, 0.25));
    pc.set(x + 1, y + 1, mix(litC, 0xffffff, 0.6));
  } else {
    pc.line(x + 1, y + h - 2, x + Math.min(w - 2, 3), y + h - 2 - Math.min(w - 2, 3), mix(glass, 0xffffff, 0.25));
  }
  pc.rect(x + Math.floor(w / 2), y, 1, h, frame);
  pc.rect(x - 2, y + h + 1, w + 4, 1, mix(frame, 0xffffff, 0.2));
}

function stars(pc: PixelCanvas, h: number, n: number, r: () => number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * pc.w);
    const y = Math.floor(r() * h);
    const c = r() < 0.2 ? 0xffffff : r() < 0.5 ? 0xc8d0ff : 0x8890c8;
    pc.set(x, y, c);
    if (r() < 0.06) {
      pc.set(x - 1, y, 0x8890c8);
      pc.set(x + 1, y, 0x8890c8);
      pc.set(x, y - 1, 0x8890c8);
      pc.set(x, y + 1, 0x8890c8);
    }
  }
}

function moon(pc: PixelCanvas, x: number, y: number, r: number) {
  pc.circle(x, y, r + 3, 0x2a2c5a);
  pc.circle(x, y, r + 1, 0x3a3c72);
  pc.circle(x, y, r, 0xf4ecd0);
  pc.circle(x + 2, y - 1, r - 1, 0xfffaea);
  pc.circle(x - 3, y + 2, 2, 0xe0d4b0);
  pc.circle(x + 3, y + 4, 1.5, 0xe0d4b0);
}

/** skyline silhouette with lit windows */
function skyline(w: number, h: number, base: number, win: number, seed: number, minH: number, maxH: number, gap = 2): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  const r = rng(seed);
  let x = -4;
  while (x < w) {
    const bw = 14 + Math.floor(r() * 26);
    const bh = minH + Math.floor(r() * (maxH - minH));
    const c = mul(base, 0.85 + r() * 0.3);
    pc.rect(x, h - bh, bw, bh, c);
    pc.rect(x, h - bh, 1, bh, mix(c, 0xffffff, 0.08));
    // roof details
    const kind = r();
    if (kind < 0.25) {
      pc.rect(x + Math.floor(bw / 2), h - bh - 8, 1, 8, c);
      pc.set(x + Math.floor(bw / 2), h - bh - 9, PAL.red);
    } else if (kind < 0.45) {
      pc.rect(x + 2, h - bh - 4, bw - 4, 4, c);
    } else if (kind < 0.6) {
      pc.poly(
        [
          [x, h - bh],
          [x + bw / 2, h - bh - 8],
          [x + bw, h - bh],
        ],
        c,
      );
    }
    for (let yy = h - bh + 4; yy < h - 3; yy += 4)
      for (let xx = x + 2; xx < x + bw - 2; xx += 3) if (r() < 0.28) pc.set(xx, yy, r() < 0.8 ? win : mix(win, 0xffffff, 0.5));
    x += bw + Math.floor(r() * gap);
  }
  return pc;
}

// ------------------------------------------------------------------ props painted on the facade

function fireEscape(pc: PixelCanvas, x: number, y: number, w: number, floors: number, c: number) {
  const hi = mix(c, 0xffffff, 0.3);
  for (let f = 0; f < floors; f++) {
    const fy = y + f * 34;
    pc.rect(x, fy, w, 2, c);
    pc.rect(x, fy, w, 1, hi);
    for (let xx = x; xx <= x + w; xx += 3) pc.rect(xx, fy - 9, 1, 9, c);
    pc.rect(x, fy - 10, w + 1, 1, hi);
    // ladder
    const lx = f % 2 === 0 ? x + w - 8 : x + 3;
    pc.line(lx, fy + 2, lx + 5, fy + 32, c);
    pc.line(lx + 4, fy + 2, lx + 9, fy + 32, c);
    for (let k = 4; k < 30; k += 4) pc.line(lx + k / 6, fy + 2 + k, lx + 4 + k / 6, fy + 2 + k, hi);
  }
}

function dumpster(pc: PixelCanvas, x: number, y: number) {
  const g = 0x2f7a4a;
  pc.rect(x, y - 22, 44, 22, K);
  pc.rect(x + 1, y - 21, 42, 20, g);
  pc.rect(x + 1, y - 21, 42, 2, mix(g, 0xffffff, 0.3));
  for (let i = 0; i < 5; i++) pc.rect(x + 5 + i * 8, y - 17, 2, 14, mul(g, 0.7));
  pc.rect(x - 1, y - 26, 46, 5, K);
  pc.rect(x, y - 25, 44, 3, 0x245e38);
  pc.rect(x, y - 25, 44, 1, 0x4a9a66);
  drawText(pc, x + 13, y - 13, "WASTE", 0xd8e8d0);
  pc.rect(x + 3, y - 1, 4, 2, K);
  pc.rect(x + 37, y - 1, 4, 2, K);
  // trash bags beside
  pc.ellipse(x + 50, y - 6, 7, 6, 0x15131c);
  pc.ellipse(x + 50, y - 6, 6, 5, 0x2a2a3a);
  pc.set(x + 48, y - 9, 0x5a5a6e);
  pc.set(x + 47, y - 8, 0x5a5a6e);
  pc.ellipse(x + 60, y - 5, 6, 5, 0x15131c);
  pc.ellipse(x + 60, y - 5, 5, 4, 0x2a2a3a);
}

function doorway(pc: PixelCanvas, x: number, y: number, w: number, h: number, c: number, lamp: boolean) {
  pc.rect(x - 2, y - h - 2, w + 4, h + 2, K);
  pc.rect(x, y - h, w, h, c);
  pc.rect(x + 2, y - h + 2, w - 4, h - 4, mul(c, 0.8));
  pc.rect(x + w - 5, y - h / 2, 2, 2, PAL.yellow);
  pc.rect(x - 3, y - h - 4, w + 6, 2, mix(c, 0xffffff, 0.2));
  if (lamp) {
    pc.rect(x + w / 2 - 3, y - h - 10, 6, 4, K);
    pc.rect(x + w / 2 - 2, y - h - 9, 4, 2, 0xfff4b0);
    // light cone
    for (let yy = 0; yy < h + 4; yy++) {
      const half = 3 + yy * 0.45;
      for (let xx = -half; xx <= half; xx++) {
        const px = Math.round(x + w / 2 + xx);
        const py = y - h - 6 + yy;
        const cur = pc.get(px, py);
        if (cur !== null && (px + py) % 2 === 0) pc.set(px, py, mix(cur, 0xfff0b0, 0.22));
      }
    }
  }
}

function neonSign(pc: PixelCanvas, x: number, y: number, s: string, c: number, scale = 2) {
  const w = textWidth(s, scale) + 8;
  const h = 5 * scale + 8;
  pc.rect(x, y, w, h, K);
  pc.rect(x + 1, y + 1, w - 2, h - 2, 0x1a1028);
  // glow
  drawText(pc, x + 4, y + 5, s, mul(c, 0.45), scale);
  drawText(pc, x + 4, y + 4, s, c, scale);
  pc.strokeRect(x + 2, y + 2, w - 4, h - 4, mul(c, 0.6));
}

function pipe(pc: PixelCanvas, x: number, y0: number, y1: number) {
  pc.rect(x, y0, 3, y1 - y0, 0x5a5e6e);
  pc.rect(x, y0, 1, y1 - y0, 0x8a8e9e);
  pc.rect(x + 2, y0, 1, y1 - y0, 0x3a3e4e);
  for (let y = y0 + 10; y < y1; y += 22) pc.rect(x - 1, y, 5, 2, 0x3a3e4e);
}

function acUnit(pc: PixelCanvas, x: number, y: number) {
  pc.rect(x, y, 18, 12, K);
  pc.rect(x + 1, y + 1, 16, 10, 0xb8bec8);
  for (let i = 0; i < 4; i++) pc.rect(x + 2, y + 2 + i * 2, 14, 1, 0x868d9c);
  pc.rect(x + 1, y + 1, 16, 1, 0xe4e8ee);
  // drip
  pc.set(x + 14, y + 13, 0x8ac0e0);
  pc.set(x + 14, y + 16, 0x8ac0e0);
}

function poster(pc: PixelCanvas, x: number, y: number, c: number, r: () => number) {
  pc.rect(x, y, 14, 18, K);
  pc.rect(x + 1, y + 1, 12, 16, c);
  pc.rect(x + 2, y + 3, 10, 2, 0xf6f3ec);
  pc.rect(x + 3, y + 7, 8, 6, mix(c, 0x000000, 0.35));
  pc.circle(x + 7, y + 9, 2, 0xf6f3ec);
  pc.rect(x + 2, y + 14, 10, 1, 0xf6f3ec);
  if (r() < 0.5) {
    // torn corner
    pc.poly(
      [
        [x + 9, y + 18],
        [x + 14, y + 13],
        [x + 14, y + 18],
      ],
      0,
    );
  }
}

function lampPost(pc: PixelCanvas, x: number, yBase: number, h: number) {
  pc.rect(x, yBase - h, 3, h, 0x2a2c3a);
  pc.rect(x, yBase - h, 1, h, 0x4a4c5e);
  pc.rect(x - 2, yBase - 6, 7, 6, 0x2a2c3a);
  pc.rect(x - 8, yBase - h - 2, 12, 3, 0x2a2c3a);
  pc.rect(x - 10, yBase - h + 1, 8, 3, 0x2a2c3a);
  pc.rect(x - 9, yBase - h + 3, 6, 2, 0xfff4b0);
  // glow halo
  for (let yy = -6; yy <= 6; yy++)
    for (let xx = -9; xx <= 9; xx++) {
      const d = Math.hypot(xx, yy * 1.4);
      if (d > 9 || (xx + yy) % 2 !== 0) continue;
      const px = x - 6 + xx;
      const py = yBase - h + 5 + yy;
      const cur = pc.get(px, py);
      if (cur !== null) pc.set(px, py, mix(cur, 0xfff0b0, 0.3));
    }
}

function awning(pc: PixelCanvas, x: number, y: number, w: number, a: number, b: number) {
  for (let i = 0; i < w; i += 6) pc.rect(x + i, y, Math.min(6, w - i), 9, (i / 6) % 2 === 0 ? a : b);
  pc.rect(x, y, w, 1, mix(a, 0xffffff, 0.4));
  for (let i = 0; i < w; i += 6) {
    pc.ellipse(x + i + 3, y + 9, 3, 2, (i / 6) % 2 === 0 ? a : b);
  }
  pc.rect(x, y + 11, w, 1, mul(a, 0.4));
}

function shopWindow(pc: PixelCanvas, x: number, y: number, w: number, h: number, inner: number, r: () => number) {
  pc.rect(x - 2, y - 2, w + 4, h + 4, K);
  pc.rect(x - 1, y - 1, w + 2, h + 2, 0x6a6e80);
  pc.rect(x, y, w, h, inner);
  // goods on shelves
  for (let s = 0; s < 2; s++) {
    const sy = y + 8 + s * Math.floor(h / 2.4);
    pc.rect(x + 1, sy + 6, w - 2, 1, mul(inner, 0.6));
    for (let xx = x + 3; xx < x + w - 4; xx += 5) {
      const c = [PAL.red, PAL.yellow, PAL.green, PAL.blue, PAL.magentaLight][Math.floor(r() * 5)];
      pc.rect(xx, sy + 1, 3, 5, c);
      pc.set(xx, sy + 1, 0xffffff);
    }
  }
  // glass reflection
  for (let i = 0; i < h; i++) {
    const xx = x + 4 + i;
    if (xx < x + w - 1) pc.set(xx, y + h - 1 - i, mix(inner, 0xffffff, 0.4));
    if (xx + 3 < x + w - 1) pc.set(xx + 3, y + h - 1 - i, mix(inner, 0xffffff, 0.25));
  }
}

function sign(pc: PixelCanvas, x: number, y: number, s: string, bg: number, fg: number, scale = 2) {
  const w = textWidth(s, scale) + 8;
  const h = 5 * scale + 6;
  pc.rect(x, y, w, h, K);
  pc.rect(x + 1, y + 1, w - 2, h - 2, bg);
  pc.rect(x + 1, y + 1, w - 2, 1, mix(bg, 0xffffff, 0.35));
  drawText(pc, x + 4, y + 4, s, mul(bg, 0.5), scale);
  drawText(pc, x + 4, y + 3, s, fg, scale);
  return w;
}

function bulbs(pc: PixelCanvas, x: number, y: number, w: number, h: number) {
  for (let xx = x; xx < x + w; xx += 4) {
    pc.set(xx, y, 0xfff4b0);
    pc.set(xx, y + h, 0xfff4b0);
  }
  for (let yy = y; yy < y + h; yy += 4) {
    pc.set(x, yy, 0xfff4b0);
    pc.set(x + w, yy, 0xfff4b0);
  }
}

// ------------------------------------------------------------------ layer builders

export interface BgLayers {
  sky: PixelCanvas;
  far: PixelCanvas;
  mid: PixelCanvas;
  near: PixelCanvas;
  ground: PixelCanvas;
  /** y positions (top) of each layer in screen space */
  farY: number;
  midY: number;
}

export const BG_OFFSETS: Record<Theme, { farY: number; midY: number }> = {
  alley: { farY: 72, midY: 46 },
  downtown: { farY: 64, midY: 46 },
  casino: { farY: 70, midY: 36 },
};

export function layerWidth(worldW: number, f: number) {
  return Math.ceil(320 + (worldW - 320) * f) + 2;
}

export function buildBackground(theme: Theme, worldW: number): BgLayers {
  switch (theme) {
    case "alley":
      return alley(worldW);
    case "downtown":
      return downtown(worldW);
    default:
      return casino(worldW);
  }
}

// ----- STAGE 1: BACK ALLEY (night)

function alley(worldW: number): BgLayers {
  const r = rng(101);
  const sky = new PixelCanvas(320, SKY_H);
  vgrad(sky, 0, SKY_H, 0x0a0c24, 0x3a1f4e);
  stars(sky, 120, 90, r);
  moon(sky, 252, 58, 11);

  const farW = layerWidth(worldW, FAR_F);
  const far = skyline(farW, 110, 0x1c1c44, 0xb8a050, 11, 40, 96);
  const midW = layerWidth(worldW, MID_F);
  const mid = new PixelCanvas(midW, 150);
  {
    let x = 0;
    while (x < midW) {
      const bw = 50 + Math.floor(r() * 40);
      const bh = 80 + Math.floor(r() * 60);
      const top = 150 - bh;
      const base = r() < 0.5 ? 0x4a2a3a : 0x3a2c4a;
      bricks(mid, x, top, bw, bh, base, r);
      mid.rect(x, top, bw, 3, mul(base, 0.6));
      mid.rect(x, top - 1, bw, 1, K);
      for (let wy = top + 10; wy < 140; wy += 18)
        for (let wx = x + 6; wx < x + bw - 10; wx += 14) windowBox(mid, wx, wy, 7, 10, r() < 0.35, 0x1a1020, 0x1c2440, r() < 0.5 ? 0xffd27a : 0xff9f5a);
      if (r() < 0.5) {
        // water tower
        const tx = x + 10 + Math.floor(r() * (bw - 30));
        mid.rect(tx, top - 18, 18, 14, 0x3a2418);
        for (let i = 0; i < 18; i += 3) mid.rect(tx + i, top - 18, 1, 14, 0x2a180e);
        mid.poly(
          [
            [tx - 1, top - 18],
            [tx + 9, top - 25],
            [tx + 19, top - 18],
          ],
          0x2a180e,
        );
        mid.rect(tx + 2, top - 4, 1, 4, 0x1a1020);
        mid.rect(tx + 15, top - 4, 1, 4, 0x1a1020);
      }
      x += bw + 4 + Math.floor(r() * 10);
    }
    // haze at bottom
    dither(mid, 0, 128, midW, 22, 0x2a1838, 2);
  }

  // near: alley walls (y FACADE_TOP..FACADE_BOTTOM)
  const nh = FACADE_BOTTOM - FACADE_TOP;
  const near = new PixelCanvas(worldW, nh);
  {
    const B = nh; // local bottom
    let x = 0;
    let seg = 0;
    while (x < worldW) {
      const sw = 150 + Math.floor(r() * 90);
      const brick = [0x8a3a30, 0x6e3a4a, 0x7a4a34][seg % 3];
      const top = 34 + Math.floor(r() * 40);
      bricks(near, x, top, sw, B - top, brick, r);
      // cornice
      near.rect(x, top, sw, 4, mul(brick, 0.55));
      near.rect(x, top, sw, 1, mix(brick, 0xffffff, 0.2));
      // upper windows
      for (let wx = x + 12; wx < x + sw - 20; wx += 36) {
        windowBox(near, wx, top + 14, 12, 16, r() < 0.4, 0x2a1418, 0x1c2238, 0xffcf6a);
        if (r() < 0.6) windowBox(near, wx, top + 50, 12, 16, r() < 0.3, 0x2a1418, 0x1c2238, 0xffcf6a);
      }
      if (r() < 0.7) fireEscape(near, x + 20 + Math.floor(r() * (sw - 90)), top + 36, 46, 2, 0x26222e);
      pipe(near, x + sw - 8, top + 4, B);
      // graffiti band near the ground
      const gy = B - 58;
      const words = ["SCAM", "RAMPAGE", "BOOM", "POW", "S-BOY", "FLEX"];
      const cols: Array<[number, number, number]> = [
        [PAL.magentaLight, PAL.magenta, PAL.navy],
        [0x6af0d0, PAL.teal, 0x103a3a],
        [PAL.yellow, PAL.orange, PAL.redDark],
        [0x9ac0ff, PAL.blue, PAL.navyDark],
      ];
      const wd = words[Math.floor(r() * words.length)];
      const cc = cols[Math.floor(r() * cols.length)];
      const gx = x + 20 + Math.floor(r() * Math.max(10, sw - textWidth(wd, 4) - 40));
      bubbleText(near, gx, gy - 8, wd, cc[0], cc[1], cc[2], 4);
      // tags
      for (let t = 0; t < 3; t++) {
        const tx = x + Math.floor(r() * sw);
        const ty = B - 30 - Math.floor(r() * 50);
        const tc = [0xf6f3ec, PAL.yellow, PAL.magentaLight, 0x6af0d0][Math.floor(r() * 4)];
        for (let k = 0; k < 10; k++) near.set(tx + k, ty + Math.round(Math.sin(k * 1.3 + t) * 2), tc);
        near.line(tx + 10, ty, tx + 13, ty - 4, tc);
      }
      if (r() < 0.6) poster(near, x + 10 + Math.floor(r() * (sw - 30)), B - 72, [PAL.red, PAL.blue, PAL.yellowDark][seg % 3], r);
      // door
      if (seg % 2 === 0) doorway(near, x + 40 + Math.floor(r() * (sw - 100)), B, 20, 34, [0x3a4a6a, 0x5a3a2a][seg % 2 === 0 ? 0 : 1], true);
      if (r() < 0.6) acUnit(near, x + 14 + Math.floor(r() * (sw - 40)), top + 74);
      // vertical shadow edge between segments
      near.rect(x, top, 2, B - top, 0x1a0e14);
      x += sw;
      seg++;
      if (seg % 2 === 0 && x < worldW - 60) {
        // alley opening with chain-link fence
        const gw = 26 + Math.floor(r() * 18);
        for (let yy = B - 44; yy < B; yy++)
          for (let xx = x; xx < x + gw; xx++) if ((xx + yy) % 5 === 0 || (xx - yy + 500) % 5 === 0) near.set(xx, yy, 0x8a8e9e);
        near.rect(x, B - 46, gw, 2, 0x5a5e6e);
        near.rect(x, B - 46, 2, 46, 0x5a5e6e);
        near.rect(x + gw - 2, B - 46, 2, 46, 0x5a5e6e);
        x += gw;
      }
    }
    // neon BAR sign and dumpsters
    for (let i = 0; i < worldW; i += 420) {
      neonSign(near, i + 250, B - 104, i % 840 === 0 ? "BAR" : "HOTEL", i % 840 === 0 ? PAL.magentaLight : 0x6af0d0, 3);
      dumpster(near, i + 90, B);
    }
    // ground shadow along wall base
    dither(near, 0, B - 6, worldW, 6, 0x0e0812, 2);
  }

  const ground = alleyGround(worldW, r);
  return { sky, far, mid, near, ground, ...BG_OFFSETS.alley };
}

function alleyGround(worldW: number, r: () => number): PixelCanvas {
  const gh = 288 - GROUND_TOP;
  const g = new PixelCanvas(worldW, gh);
  const top = FACADE_BOTTOM - GROUND_TOP;
  // curb strip at the wall
  g.rect(0, 0, worldW, top + 4, 0x4a4450);
  g.rect(0, top + 3, worldW, 2, 0x2a2430);
  for (let x = 0; x < worldW; x += 24) g.rect(x, 0, 1, top + 3, 0x3a3440);
  // asphalt with gradient (darker at back)
  for (let y = top + 5; y < gh; y++) {
    const t = (y - top) / (gh - top);
    g.rect(0, y, worldW, 1, mix(0x2c2a38, 0x45424f, t));
  }
  // texture specks
  for (let i = 0; i < worldW * 6; i++) {
    const x = Math.floor(r() * worldW);
    const y = top + 6 + Math.floor(r() * (gh - top - 6));
    g.set(x, y, r() < 0.5 ? 0x55526a : 0x22202c);
  }
  // cracks
  for (let i = 0; i < worldW / 40; i++) {
    let x = Math.floor(r() * worldW);
    let y = top + 10 + Math.floor(r() * (gh - top - 20));
    for (let k = 0; k < 12; k++) {
      g.set(x, y, 0x1a1822);
      x += r() < 0.5 ? 1 : 2;
      y += r() < 0.5 ? 0 : r() < 0.5 ? 1 : -1;
    }
  }
  // puddles reflecting neon
  for (let i = 0; i < worldW / 110; i++) {
    const x = 30 + Math.floor(r() * (worldW - 60));
    const y = top + 20 + Math.floor(r() * (gh - top - 30));
    const w = 14 + Math.floor(r() * 22);
    g.ellipse(x, y, w, 4, 0x1c2a44);
    g.ellipse(x, y - 1, w - 3, 2.5, 0x2a3a5c);
    g.rect(x - w / 2, y - 1, w / 3, 1, PAL.magentaLight);
    g.rect(x + 2, y, w / 4, 1, 0x6af0d0);
  }
  // manholes
  for (let x = 140; x < worldW; x += 380) {
    const y = top + 44;
    g.ellipse(x, y, 13, 5, 0x1a1822);
    g.ellipse(x, y, 11, 4, 0x3a3846);
    for (let k = -8; k <= 8; k += 4) g.rect(x + k, y - 2, 2, 4, 0x2a2834);
  }
  return g;
}

// ----- STAGE 2: DOWNTOWN CHAOS (sunset)

function downtown(worldW: number): BgLayers {
  const r = rng(202);
  const sky = new PixelCanvas(320, SKY_H);
  vgrad(sky, 0, 70, 0x2a1a5a, 0x8a2a6a);
  vgrad(sky, 70, 140, 0x8a2a6a, 0xf07a4a);
  vgrad(sky, 140, SKY_H, 0xf07a4a, 0xffc06a);
  // sun
  sky.circle(90, 150, 26, 0xffd27a);
  sky.circle(90, 150, 22, 0xfff0b0);
  for (let y = 132; y < 176; y += 5) sky.rect(60, y, 60, 2, mix(0xf07a4a, 0xffc06a, (y - 132) / 44));
  // clouds
  for (let i = 0; i < 7; i++) {
    const cx = Math.floor(r() * 320);
    const cy = 30 + Math.floor(r() * 90);
    const cw = 20 + Math.floor(r() * 30);
    sky.ellipse(cx, cy, cw, 3, mix(0xff9a7a, 0x8a2a6a, 0.4));
    sky.ellipse(cx + 4, cy - 2, cw * 0.6, 2.5, 0xffb08a);
  }
  const farW = layerWidth(worldW, FAR_F);
  const far = skyline(farW, 130, 0x4a2a6a, 0xffd27a, 23, 50, 120, 1);
  const midW = layerWidth(worldW, MID_F);
  const mid = new PixelCanvas(midW, 150);
  {
    let x = 0;
    let n = 0;
    while (x < midW) {
      const bw = 44 + Math.floor(r() * 40);
      const bh = 90 + Math.floor(r() * 56);
      const top = 150 - bh;
      const base = [0x5a4a7a, 0x6a4a5a, 0x4a5a7a][n % 3];
      mid.rect(x, top, bw, bh, base);
      mid.rect(x, top, 2, bh, mix(base, 0xffd27a, 0.3));
      mid.rect(x + bw - 2, top, 2, bh, mul(base, 0.7));
      mid.rect(x - 1, top - 2, bw + 2, 3, mul(base, 0.6));
      for (let wy = top + 6; wy < 146; wy += 8)
        for (let wx = x + 5; wx < x + bw - 6; wx += 7) {
          const lit = r() < 0.25;
          mid.rect(wx, wy, 4, 5, lit ? 0xffd27a : mix(base, 0xff9a7a, 0.35));
          if (!lit) mid.set(wx, wy, mix(base, 0xffffff, 0.4));
        }
      if (n % 3 === 1 && bw > 60) {
        // billboard
        const bx = x + 6;
        const by = top - 30;
        mid.rect(bx + 6, by + 20, 2, 12, 0x2a2030);
        mid.rect(bx + bw - 20, by + 20, 2, 12, 0x2a2030);
        mid.rect(bx, by, bw - 12, 22, K);
        mid.rect(bx + 1, by + 1, bw - 14, 20, PAL.magenta);
        drawText(mid, bx + 4, by + 4, "SCAMBOY", 0xffffff, 1);
        drawText(mid, bx + 4, by + 12, "COLA", PAL.yellow, 1);
        mid.circle(bx + bw - 22, by + 11, 6, 0xffffff);
        mid.circle(bx + bw - 22, by + 11, 4, PAL.red);
      }
      x += bw + 2 + Math.floor(r() * 6);
      n++;
    }
    dither(mid, 0, 132, midW, 18, 0x8a4a6a, 2);
  }

  const nh = FACADE_BOTTOM - FACADE_TOP;
  const near = new PixelCanvas(worldW, nh);
  {
    const B = nh;
    const shops: Array<[string, number, number, number, number]> = [
      ["PIZZA", 0xc0392b, 0xffffff, PAL.red, 0xf6f3ec],
      ["PAWN", 0x2f4f8f, PAL.yellow, PAL.yellow, PAL.navy],
      ["ARCADE", 0x1a1028, PAL.magentaLight, PAL.magenta, 0x2a1a48],
      ["DONUTS", 0xf0609a, 0xffffff, 0xf0609a, 0xffffff],
      ["24/7", 0x23753a, 0xffffff, PAL.green, 0xf6f3ec],
      ["GYM", 0x15131c, PAL.yellow, PAL.yellow, 0x15131c],
    ];
    let x = 0;
    let i = 0;
    while (x < worldW) {
      const sw = 160 + Math.floor(r() * 40);
      const facade = [0xc8b8a0, 0xa8c0c8, 0xd0a890, 0xb0a8c8][i % 4];
      const top = 50 + Math.floor(r() * 16);
      near.rect(x, top, sw, B - top, facade);
      dither(near, x, top, sw, B - top, mul(facade, 0.93), 3);
      near.rect(x, top, sw, 5, mul(facade, 0.65));
      near.rect(x, top, sw, 1, mix(facade, 0xffffff, 0.5));
      near.rect(x, top + 5, sw, 1, K);
      // upper floor windows with flower boxes
      for (let wx = x + 12; wx < x + sw - 22; wx += 30) {
        windowBox(near, wx, top + 12, 16, 18, r() < 0.3, mul(facade, 0.5), 0x6a7aa0, 0xffd27a);
        // flower box
        near.rect(wx - 2, top + 32, 20, 4, 0xa04c20);
        near.rect(wx - 2, top + 32, 20, 1, 0xd8783c);
        for (let f = 0; f < 6; f++) {
          near.set(wx + f * 3, top + 30, [PAL.red, PAL.magentaLight, PAL.yellow][f % 3]);
          near.set(wx + f * 3 + 1, top + 31, PAL.green);
        }
      }
      // storefront
      const sh = shops[i % shops.length];
      const sy = B - 62;
      near.rect(x, sy - 4, sw, 66, mul(facade, 0.75));
      const sgW = sign(near, x + 10, sy - 22, sh[0], sh[1], sh[2], 2);
      if (sgW > 0) near.rect(x + 10, sy - 6, 2, 2, K);
      awning(near, x + 4, sy - 2, sw - 8, sh[3], sh[4]);
      shopWindow(near, x + 10, sy + 14, Math.floor(sw * 0.45), 40, sh[1] === 0x15131c ? 0x3a3a50 : mix(sh[1], 0x101020, 0.4), r);
      // door
      const dx = x + Math.floor(sw * 0.62);
      near.rect(dx - 1, sy + 13, 24, 49, K);
      near.rect(dx, sy + 14, 22, 48, 0x4a5a7a);
      near.rect(dx + 2, sy + 16, 18, 26, 0x8ab0d0);
      near.line(dx + 4, sy + 38, dx + 14, sy + 18, 0xd8f0ff);
      near.rect(dx + 17, sy + 44, 2, 4, PAL.yellow);
      // building separator
      near.rect(x, top, 3, B - top, mul(facade, 0.55));
      x += sw;
      i++;
    }
    for (let lx = 60; lx < worldW; lx += 230) lampPost(near, lx, B, 80);
    dither(near, 0, B - 4, worldW, 4, 0x2a1a28, 2);
  }

  // ground: sidewalk + curb + road
  const gh = 288 - GROUND_TOP;
  const ground = new PixelCanvas(worldW, gh);
  {
    const top = FACADE_BOTTOM - GROUND_TOP;
    const sideB = 230 - GROUND_TOP;
    ground.rect(0, 0, worldW, sideB, 0xb8b0b8);
    for (let y = top + 1; y < sideB; y += 10) ground.rect(0, y, worldW, 1, 0x948c98);
    for (let x = 0; x < worldW; x += 18) {
      for (let y = top + 1; y < sideB; y += 10) ground.rect(x + (((y - top) / 10) % 2) * 9, y, 1, 10, 0x948c98);
    }
    dither(ground, 0, top, worldW, 6, 0x8a8290, 2);
    // curb
    ground.rect(0, sideB, worldW, 3, 0xe0d8e0);
    ground.rect(0, sideB + 3, worldW, 2, 0x6a6270);
    // road
    for (let y = sideB + 5; y < gh; y++) ground.rect(0, y, worldW, 1, mix(0x3a3848, 0x4a4858, (y - sideB) / (gh - sideB)));
    for (let k = 0; k < worldW * 5; k++) ground.set(Math.floor(r() * worldW), sideB + 6 + Math.floor(r() * (gh - sideB - 6)), r() < 0.5 ? 0x5a5868 : 0x2a2838);
    // lane dashes
    const laneY = sideB + 30;
    for (let x = 0; x < worldW; x += 40) ground.rect(x, laneY, 22, 2, PAL.yellow);
    // crosswalk
    for (let cx = 300; cx < worldW; cx += 720) for (let s = 0; s < 9; s++) ground.rect(cx, sideB + 7 + s * 6, 46, 3, 0xe8e4e8);
    // manholes and grates
    for (let x = 180; x < worldW; x += 410) {
      ground.ellipse(x, sideB + 46, 12, 4, 0x2a2838);
      ground.ellipse(x, sideB + 46, 10, 3, 0x4a4858);
    }
    // fire hydrants and newspaper boxes on sidewalk edge (painted, flat)
    for (let x = 120; x < worldW; x += 340) {
      ground.rect(x, top + 2, 6, 9, K);
      ground.rect(x + 1, top + 3, 4, 8, PAL.red);
      ground.rect(x - 1, top + 5, 8, 2, PAL.redDark);
      ground.rect(x + 1, top + 3, 1, 8, 0xff9a8a);
    }
  }
  return { sky, far, mid, near, ground, ...BG_OFFSETS.downtown };
}

// ----- STAGE 3: THE BIG BOSS (casino strip)

function casino(worldW: number): BgLayers {
  const r = rng(303);
  const sky = new PixelCanvas(320, SKY_H);
  vgrad(sky, 0, SKY_H, 0x0c0620, 0x4a1a5a);
  stars(sky, 110, 70, r);
  // spotlight beams
  for (const [bx, ang] of [
    [70, -0.35],
    [240, 0.3],
  ] as const) {
    for (let y = 0; y < SKY_H; y++) {
      const cx = bx + (SKY_H - y) * ang;
      const half = 4 + (SKY_H - y) * 0.06;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        if ((x + y) % 2 !== 0) continue;
        const cur = sky.get(x, y);
        if (cur !== null) sky.set(x, y, mix(cur, 0xc8b0ff, 0.25));
      }
    }
  }
  const farW = layerWidth(worldW, FAR_F);
  const far = skyline(farW, 120, 0x24143a, 0xff6ac8, 31, 40, 110, 2);
  const midW = layerWidth(worldW, MID_F);
  const mid = new PixelCanvas(midW, 160);
  {
    let x = 0;
    let n = 0;
    while (x < midW) {
      const bw = 60 + Math.floor(r() * 50);
      const bh = 100 + Math.floor(r() * 56);
      const top = 160 - bh;
      const base = n % 2 === 0 ? 0x4a2a72 : 0x5a2a5a;
      mid.rect(x, top, bw, bh, base);
      mid.rect(x, top, bw, 2, PAL.yellow);
      for (let wy = top + 8; wy < 156; wy += 6)
        for (let wx = x + 4; wx < x + bw - 4; wx += 5) if (r() < 0.45) mid.set(wx, wy, r() < 0.5 ? 0xffd27a : 0xff6ac8);
      if (n % 2 === 0) {
        // vertical neon strip
        mid.rect(x + bw - 10, top + 10, 4, bh - 20, K);
        for (let yy = top + 12; yy < top + bh - 12; yy += 3) mid.rect(x + bw - 9, yy, 2, 2, (yy / 3) % 2 ? PAL.magentaLight : PAL.yellow);
      }
      x += bw + 6;
      n++;
    }
    dither(mid, 0, 138, midW, 22, 0x5a1a5a, 2);
  }
  const nh = FACADE_BOTTOM - FACADE_TOP;
  const near = new PixelCanvas(worldW, nh);
  {
    const B = nh;
    const CT = 40;
    // facade base
    near.rect(0, CT, worldW, B - CT, 0x3a1430);
    near.rect(0, CT, worldW, 2, PAL.yellow);
    near.rect(0, CT - 1, worldW, 1, K);
    for (let x = 0; x < worldW; x += 4) near.rect(x, CT + 2, 1, B - CT - 2, 0x341028);
    // gold columns every 64px with marble panels between
    for (let x = 0; x < worldW; x += 64) {
      near.rect(x + 8, CT + 12, 48, B - CT - 22, 0x5a1a3a);
      dither(near, x + 8, CT + 12, 48, B - CT - 22, 0x6a2448, 4);
      near.rect(x, CT, 10, B - CT, K);
      near.rect(x + 1, CT, 8, B - CT, PAL.yellowDark);
      near.rect(x + 2, CT, 3, B - CT, PAL.yellow);
      near.rect(x + 7, CT, 1, B - CT, 0x8a5a10);
      near.rect(x - 2, CT - 4, 14, 5, PAL.yellow);
      near.rect(x - 2, B - 6, 14, 6, PAL.yellowDark);
    }
    // big marquee banners
    for (let x = 60; x < worldW; x += 380) {
      const w = 150;
      near.rect(x, CT + 12, w, 40, K);
      near.rect(x + 2, CT + 14, w - 4, 36, 0xa01040);
      bulbs(near, x + 3, CT + 15, w - 7, 33);
      const t1 = x % 760 === 60 ? "LUCKY HUSTLE" : "HIGH ROLLERS";
      drawText(near, x + Math.floor((w - textWidth(t1, 2)) / 2), CT + 20, t1, mul(PAL.yellow, 0.6), 2);
      drawText(near, x + Math.floor((w - textWidth(t1, 2)) / 2), CT + 19, t1, PAL.yellow, 2);
      drawText(near, x + Math.floor((w - textWidth("CASINO", 2)) / 2), CT + 34, "CASINO", 0xffffff, 2);
    }
    // neon dice + card signs
    for (let x = 250; x < worldW; x += 380) {
      near.rect(x, CT + 62, 24, 24, PAL.magentaLight);
      near.rect(x + 1, CT + 63, 22, 22, 0xffffff);
      for (const [dx, dy] of [
        [6, 6],
        [17, 6],
        [11, 12],
        [6, 18],
        [17, 18],
      ])
        near.circle(x + dx, CT + 62 + dy, 2, PAL.red);
      near.rect(x + 34, CT + 58, 18, 26, K);
      near.rect(x + 35, CT + 59, 16, 24, 0xffffff);
      drawText(near, x + 37, CT + 61, "A", PAL.red);
      near.poly(
        [
          [x + 43, CT + 66],
          [x + 48, CT + 72],
          [x + 43, CT + 78],
          [x + 38, CT + 72],
        ],
        PAL.red,
      );
    }
    // entrance doors with red carpet light
    for (let x = 150; x < worldW; x += 380) {
      near.rect(x - 2, B - 56, 52, 56, K);
      near.rect(x, B - 54, 48, 54, 0xffd27a);
      near.rect(x + 2, B - 52, 21, 52, 0xc89a40);
      near.rect(x + 25, B - 52, 21, 52, 0xc89a40);
      near.line(x + 5, B - 10, x + 18, B - 48, 0xfff0b0);
      near.line(x + 28, B - 10, x + 41, B - 48, 0xfff0b0);
      near.rect(x + 20, B - 30, 2, 8, K);
      near.rect(x + 26, B - 30, 2, 8, K);
      // awning
      near.rect(x - 10, B - 66, 68, 8, PAL.redDark);
      near.rect(x - 10, B - 66, 68, 2, PAL.red);
      bulbs(near, x - 9, B - 64, 66, 5);
      // palm pots
      for (const px of [x - 22, x + 60]) {
        near.rect(px, B - 14, 12, 14, K);
        near.rect(px + 1, B - 13, 10, 13, PAL.yellowDark);
        for (let k = 0; k < 5; k++) near.line(px + 6, B - 14, px + 6 + Math.cos(-Math.PI / 2 + (k - 2) * 0.6) * 14, B - 14 + Math.sin(-Math.PI / 2 + (k - 2) * 0.6) * 12, PAL.greenDark, 2);
        near.rect(px + 5, B - 30, 2, 16, 0x6a4a2a);
      }
    }
    // gold statue of the boss near the arena (last screen)
    const sx = worldW - 150;
    near.rect(sx - 14, B - 30, 28, 30, K);
    near.rect(sx - 13, B - 29, 26, 29, 0x6a4a6a);
    near.rect(sx - 13, B - 29, 26, 2, 0x9a7a9a);
    near.ellipse(sx, B - 52, 12, 20, PAL.yellowDark);
    near.ellipse(sx - 2, B - 54, 9, 16, PAL.yellow);
    near.circle(sx, B - 76, 6, PAL.yellow);
    near.rect(sx - 7, B - 84, 14, 3, PAL.yellowDark);
    near.rect(sx - 4, B - 88, 8, 4, PAL.yellowDark);
    drawText(near, sx - 6, B - 24, "DON", PAL.yellow);
    dither(near, 0, B - 4, worldW, 4, 0x1a0818, 2);
  }
  const gh = 288 - GROUND_TOP;
  const ground = new PixelCanvas(worldW, gh);
  {
    const top = FACADE_BOTTOM - GROUND_TOP;
    // marble checker plaza
    for (let y = 0; y < gh; y++) {
      const ty = Math.floor((y - top) / 12);
      for (let x = 0; x < worldW; x += 16) {
        const tx = Math.floor(x / 16);
        const dark = (tx + ty) % 2 === 0;
        const base = dark ? 0x2a1a3a : 0x5a4a6a;
        ground.rect(x, y, 16, 1, mix(base, 0x000000, y < top ? 0.4 : 0));
      }
    }
    for (let y = top; y < gh; y += 12) ground.rect(0, y, worldW, 1, 0x1a1028);
    // reflections of neon on marble
    for (let x = 0; x < worldW; x += 64) {
      for (let y = top + 4; y < gh; y += 3) ground.set(x + 4 + ((y * 3) % 6), y, mix(PAL.yellow, 0x2a1a3a, 0.55));
    }
    // red carpet runway leading to the doors
    for (let x = 150; x < worldW; x += 380) {
      for (let y = top; y < gh; y++) {
        const t = (y - top) / (gh - top);
        const half = 22 + t * 18;
        ground.rect(Math.round(x + 24 - half), y, Math.round(half * 2), 1, y % 2 === 0 ? 0xb01a3a : 0xa01434);
        ground.set(Math.round(x + 24 - half), y, PAL.yellow);
        ground.set(Math.round(x + 24 + half), y, PAL.yellow);
      }
      // velvet ropes
      for (const side of [-1, 1]) {
        const px = x + 24 + side * 46;
        ground.rect(px - 1, top + 2, 3, 16, PAL.yellow);
        ground.rect(px - 2, top + 1, 5, 2, PAL.yellowDark);
      }
    }
    dither(ground, 0, top, worldW, 5, 0x0a0410, 2);
  }
  return { sky, far, mid, near, ground, ...BG_OFFSETS.casino };
}

/** big graffiti logo for the title screen */
export function titleLogo(): PixelCanvas {
  const top = new PixelCanvas(textWidth("STREET", 5) + 40, 5 * 5 + 30);
  bubbleText(top, 0, 0, "STREET", 0xffffff, 0x9ac0ff, PAL.navy, 5);
  const bottom = new PixelCanvas(textWidth("RAMPAGE", 6) + 40, 5 * 6 + 34);
  bubbleText(bottom, 0, 0, "RAMPAGE", PAL.yellow, PAL.magenta, PAL.magentaDark, 6);
  const w = Math.max(top.w, bottom.w);
  const out = new PixelCanvas(w + 4, top.h + bottom.h - 12);
  const tx = Math.floor((w - top.w) / 2) + 6;
  const bx = Math.floor((w - bottom.w) / 2);
  out.blit(top.clone().silhouette(PAL.navyDark), tx + 3, 3);
  out.blit(top, tx, 0);
  out.blit(bottom.clone().silhouette(0x3a0a20), bx + 3, top.h - 13);
  out.blit(bottom, bx, top.h - 16);
  return out;
}
