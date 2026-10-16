/**
 * Track renderer (Phaser-free): turns TrackData into
 *  - one big detailed pixel-art ground texture (roads, curbs, sidewalks, sand,
 *    rocks, buildings, mansions, parked cars, trees ...),
 *  - overlay pieces that conceal the hidden passages (rooftops, rock, canopy, gardens),
 *  - a mini-map.
 */
import { PixelCanvas, rng, type Color } from "../engine/pixel";
import { PAL } from "../engine/palette";
import { blitRotated, drawCar, mix, shade } from "./carArt";
import { nearestIndex, valueNoise, type Path, type Rect } from "./geom";
import { CELL, T } from "./terrain";
import { routePaths, type CoverStyle, type Prop, type TrackData, type TrackDef } from "./Track";

const pack = (c: Color) => ((255 << 24) | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
const unpack = (v: number): Color => ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);

function hashI(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** multiply existing opaque pixel by k */
function darken(pc: PixelCanvas, x: number, y: number, k: number) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (!pc.inBounds(x, y)) return;
  const i = y * pc.w + x;
  const v = pc.buf[i];
  if (v >>> 24 === 0) return;
  pc.buf[i] = pack(shade(unpack(v), k));
}

function shadowEllipse(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, k = 0.72) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) darken(pc, x, y, k);
    }
}

function shadowRect(pc: PixelCanvas, x: number, y: number, w: number, h: number, k = 0.72) {
  for (let yy = Math.floor(y); yy < y + h; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) darken(pc, xx, yy, k);
}

// ------------------------------------------------------------------ tiny 3x5 font for billboards
const FONT3: Record<string, string[]> = {
  S: ["111", "100", "111", "001", "111"],
  C: ["111", "100", "100", "100", "111"],
  A: ["010", "101", "111", "101", "101"],
  M: ["101", "111", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  O: ["111", "101", "101", "101", "111"],
  Y: ["101", "101", "010", "010", "010"],
  $: ["011", "110", "010", "011", "110"],
  R: ["110", "101", "110", "101", "101"],
  T: ["111", "010", "010", "010", "010"],
  "!": ["010", "010", "010", "000", "010"],
};
function text3(pc: PixelCanvas, s: string, x: number, y: number, c: Color) {
  for (const ch of s) {
    const g = FONT3[ch];
    if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === "1") pc.set(x + i, y + j, c);
    x += 4;
  }
}

// ================================================================== theme palettes
interface ThemeColors {
  curbA: Color;
  curbB: Color;
  center: Color;
  edge: Color | null;
  road: [Color, Color, Color];
}
const THEMES: Record<string, ThemeColors> = {
  city: { curbA: 0xd23c3c, curbB: 0xe8e8e8, center: 0xe8e4d0, edge: null, road: [0x4a4c58, 0x41434e, 0x565866] },
  desert: { curbA: 0xd23c3c, curbB: 0xf0ece0, center: 0xffd23f, edge: 0xe8e4d0, road: [0x55525a, 0x4b4850, 0x625e64] },
  lux: { curbA: 0xe0b040, curbB: 0xf4f0e0, center: 0xf4f0e0, edge: 0xe0b040, road: [0x3e4050, 0x363846, 0x4a4c5c] },
};

// ================================================================== ground pass
function paintGround(td: TrackData): PixelCanvas {
  const W = td.w;
  const H = td.h;
  const gw = td.gw;
  const grid = td.grid;
  const pc = new PixelCanvas(W, H);
  const buf = pc.buf;
  const theme = td.def.theme;
  const tc = THEMES[theme];
  const halfW = td.def.roadWidth / 2;
  const L = td.L;
  const seed = td.def.seed;
  const g = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return T.WALL;
    return grid[(y >> 1) * gw + (x >> 1)];
  };
  const shadowOff = theme === "city" ? [5, 6] : theme === "desert" ? [2, 6] : [3, 4];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ci = (y >> 1) * gw + (x >> 1);
      const t = grid[ci];
      const h = hashI(x, y);
      let c: Color;
      switch (t) {
        case T.ROAD:
        case T.CURB: {
          const rd = td.roadD[ci];
          const onMain = rd <= halfW;
          const n = valueNoise(x, y, 24, seed);
          c = n > 0.62 ? tc.road[1] : tc.road[0];
          if (h < 0.07) c = tc.road[1];
          else if (h > 0.95) c = tc.road[2];
          if (onMain) {
            const s = td.mainS[ci];
            if (t === T.CURB) {
              c = Math.floor(s / 8) % 2 === 0 ? tc.curbA : tc.curbB;
              if (rd > halfW - 1.2) c = shade(c, 0.78);
            } else if (rd < 1.6 && Math.floor(s / 14) % 2 === 0) c = tc.center;
            else if (tc.edge !== null && rd > halfW - 9 && rd <= halfW - 7) c = tc.edge;
            if ((s < 7 || s > L - 7) && rd < halfW - 4 && t === T.ROAD) {
              c = ((x >> 2) + (y >> 2)) & 1 ? 0xf4f4f4 : 0x15131c;
            }
          }
          break;
        }
        case T.LOT: {
          c = h < 0.08 ? 0x4c4e5a : h > 0.95 ? 0x666a78 : 0x585b68;
          if (valueNoise(x, y, 10, seed + 3) < 0.18) c = shade(c, 0.85);
          break;
        }
        case T.ALLEY: {
          c = h < 0.12 ? 0x2c2c34 : h > 0.94 ? 0x4a4a54 : 0x383842;
          if (valueNoise(x, y, 8, seed + 5) > 0.75) c = 0x30303a;
          break;
        }
        case T.TUNNEL: {
          c = h < 0.1 ? 0x56524c : h > 0.95 ? 0x75706a : 0x64605a;
          break;
        }
        case T.PATH: {
          c = h < 0.18 ? 0xbfae84 : h > 0.86 ? 0xeadcb8 : 0xd8c8a0;
          if (g(x - 2, y) !== T.PATH || g(x + 2, y) !== T.PATH || g(x, y - 2) !== T.PATH || g(x, y + 2) !== T.PATH) {
            if (g(x - 2, y) !== T.PAD && g(x + 2, y) !== T.PAD) c = 0xa09a8a;
          }
          break;
        }
        case T.DIRT: {
          const n = valueNoise(x, y, 12, seed + 9);
          c = n < 0.35 ? 0x8f5f34 : n > 0.7 ? 0xae7c48 : 0x9c6a3a;
          if (h < 0.025) c = 0x6a4a2a;
          else if (h > 0.985) c = 0xc8a070;
          break;
        }
        case T.HEAVY: {
          const r = Math.sin(x * 0.5 + y * 0.25 + valueNoise(x, y, 16, seed) * 5);
          c = r > 0.75 ? 0xd8ae66 : 0xecc882;
          if (h < 0.03) c = 0xf6dca2;
          break;
        }
        case T.OIL: {
          c = h < 0.06 ? 0x3c3c58 : 0x121218;
          if (h > 0.985) c = 0x7b4bc4;
          else if (h > 0.97) c = 0x2a9d8f;
          break;
        }
        case T.RAMP: {
          if (theme === "desert") {
            c = y % 4 === 0 ? 0x5c3a1c : h < 0.1 ? 0x8b5a2b : 0xa0703a;
            if (y % 4 === 2 && (x % 12 === 3 || x % 12 === 9)) c = 0xc4c6d0;
          } else c = (x >> 2) & 1 ? PAL.yellow : 0x2a2a34;
          // brighter towards the lip, dark lip edge
          let lip = 99;
          for (let d = 1; d <= 30; d++) {
            if (g(x - d, y) === T.WATER || g(x + d, y) === T.WATER || g(x, y - d) === T.CHASM || g(x, y + d) === T.CHASM || g(x, y - d) === T.WATER || g(x - d, y) === T.CHASM || g(x + d, y) === T.CHASM) {
              lip = d;
              break;
            }
          }
          if (lip <= 2) c = 0x15131c;
          else c = shade(c, 0.7 + 0.35 * Math.max(0, 1 - lip / 30));
          break;
        }
        case T.PAD:
          c = 0x8e1546;
          break;
        case T.WATER: {
          const edge =
            g(x - 2, y) !== T.WATER || g(x + 2, y) !== T.WATER || g(x, y - 2) !== T.WATER || g(x, y + 2) !== T.WATER;
          if (edge) c = theme === "lux" ? 0xece7dc : h < 0.3 ? 0x8a8678 : 0xa8a49a;
          else {
            let up = 0;
            while (up < 10 && g(x, y - up - 1) === T.WATER) up++;
            c = theme === "lux" ? 0x3a9ad8 : 0x2f6fc8;
            if (up < 8) c = theme === "lux" ? 0x2c80bc : 0x24569c;
            const wy = y + Math.floor(valueNoise(x, y, 18, seed) * 14);
            if (wy % 9 === 0 && (x + wy * 5) % 17 < 4) c = 0x7fbfff;
            else if (h < 0.04) c = shade(c, 1.12);
          }
          break;
        }
        case T.CHASM: {
          let up = 0;
          while (up < 30 && g(x, y - up - 1) === T.CHASM) up++;
          let down = 0;
          while (down < 4 && g(x, y + down + 1) === T.CHASM) down++;
          if (down < 2) c = 0xc9a062;
          else if (up < 16) {
            const k = up / 16;
            c = mix(0x9a5530, 0x2a160c, k);
            if (hashI(x >> 1, 7) < 0.3) c = shade(c, 0.8);
            if (up < 2) c = 0xd28552;
          } else {
            const n = valueNoise(x, y, 18, seed);
            c = n > 0.6 ? 0x1c120c : 0x0e0806;
          }
          break;
        }
        case T.GRASS: {
          if (theme === "lux") c = Math.floor((x + y) / 12) % 2 ? 0x6cc04a : 0x5fb040;
          else {
            const n = valueNoise(x, y, 10, seed + 1);
            c = n > 0.6 ? 0x64b445 : n < 0.3 ? 0x4e9a34 : 0x5aa83c;
          }
          if (h < 0.02) c = 0x3e7d2c;
          else if (h > 0.99) c = 0x9ad070;
          break;
        }
        case T.WALL: {
          c = wallColor(theme, x, y, h, g, seed);
          break;
        }
        default: {
          // OFF ground
          if (theme === "city") {
            c = (x & 7) === 0 || (y & 7) === 0 ? 0xaaa598 : 0xbdb8aa;
            if (hashI(x >> 3, y >> 3) < 0.08) c = shade(c, 0.94);
            if (h < 0.01) c = 0x8f8b80;
            const near = g(x - 2, y) === T.CURB || g(x + 2, y) === T.CURB || g(x, y - 2) === T.CURB || g(x, y + 2) === T.CURB;
            if (near) c = 0x8f8b80;
          } else if (theme === "desert") {
            const n = valueNoise(x, y, 40, seed);
            c = n > 0.62 ? 0xeacf98 : n < 0.3 ? 0xd9b676 : 0xe2c286;
            const r = Math.sin(x * 0.42 + y * 0.16 + valueNoise(x, y, 30, seed + 2) * 7);
            if (r > 0.93) c = 0xcfa86a;
            if (h < 0.008) c = 0xb08850;
            else if (h > 0.994) c = 0xf6e2b4;
          } else {
            const rd = td.roadD[ci];
            if (rd <= halfW + 12) {
              c = x % 6 === 0 || y % 6 === 0 ? 0xd4c6a6 : 0xe8dcc0;
              if (rd > halfW + 10.5) c = 0xe0b040;
            } else {
              c = ((x - y) >> 4) & 1 ? 0x6ac452 : 0x5cb046;
              if (h < 0.015) c = 0x4a9a3a;
              else if (h > 0.992) c = 0xf4f0e0;
            }
          }
        }
      }
      // cast shadows from walls (light from top-left)
      if (t !== T.WALL && g(x - shadowOff[0], y - shadowOff[1]) === T.WALL) c = shade(c, 0.72);
      buf[y * W + x] = pack(c);
    }
  }
  return pc;
}

function wallColor(
  theme: string,
  x: number,
  y: number,
  h: number,
  g: (x: number, y: number) => number,
  seed: number,
): Color {
  if (theme === "desert") {
    // cliff face on south edges, lit rim on north edges, strata on plateaus
    let south = 0;
    while (south < 9 && g(x, y + south + 1) === T.WALL) south++;
    const edge = g(x - 1, y) !== T.WALL || g(x + 1, y) !== T.WALL || g(x, y - 1) !== T.WALL || g(x, y + 1) !== T.WALL;
    if (edge) return 0x4a2416;
    if (south < 8) {
      let c = mix(0x8b4a2b, 0x5c2e1a, 1 - south / 8);
      if (hashI(x >> 1, 3) < 0.35) c = shade(c, 0.85);
      return c;
    }
    if (g(x, y - 2) !== T.WALL || g(x - 2, y) !== T.WALL) return 0xe09a68;
    const band = Math.floor((y + valueNoise(x, y, 40, seed) * 30) / 7) % 4;
    let c = [0xc8794a, 0xbd6f42, 0xd28552, 0xb5663c][band];
    if (h < 0.05) c = shade(c, 0.85);
    else if (h > 0.97) c = mix(c, 0xffffff, 0.2);
    if (valueNoise(x, y, 6, seed + 11) > 0.82) c = shade(c, 0.9);
    return c;
  }
  if (theme === "lux") {
    // clipped hedge
    const edgeTop = g(x, y - 2) !== T.WALL;
    const edgeBot = g(x, y + 2) !== T.WALL;
    const n = valueNoise(x, y, 3, seed + 4);
    let c = n > 0.62 ? 0x3d9148 : n < 0.3 ? 0x235c2b : 0x2f7a3a;
    if (edgeTop) c = 0x58b060;
    if (edgeBot) c = 0x1a4a22;
    if (h > 0.985) c = 0x7fd06a;
    return c;
  }
  const c = (x & 3) === 0 ? 0x4c4f5e : 0x55586a;
  return h < 0.1 ? shade(c, 0.9) : c;
}

// ================================================================== props
function drawBuilding(pc: PixelCanvas, x: number, y: number, w: number, h: number, base: Color, style: number, seed: number) {
  const R = rng(seed);
  const dk = shade(base, 0.72);
  const lt = mix(base, 0xffffff, 0.28);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const hh = hashI(x + xx, y + yy);
      let c = base;
      if (style === 0) c = hh < 0.12 ? shade(base, 0.9) : hh > 0.95 ? lt : base;
      else if (style === 1) c = xx % 12 === 6 ? dk : hh < 0.05 ? shade(base, 0.92) : base;
      else if (style === 2) c = yy % 4 === 0 ? dk : (xx + (yy >> 2) * 3) % 8 === 0 ? shade(base, 0.85) : base;
      else c = xx % 3 === 0 ? lt : xx % 3 === 2 ? shade(base, 0.86) : base;
      pc.set(x + xx, y + yy, c);
    }
  pc.strokeRect(x, y, w, h, 0x26242e);
  pc.strokeRect(x + 1, y + 1, w - 2, h - 2, lt);
  pc.rect(x + 2, y + 2, w - 4, 1, dk);
  pc.rect(x + 2, y + 2, 1, h - 4, dk);
  pc.rect(x + 2, y + h - 2, w - 3, 1, shade(base, 0.6));
  pc.rect(x + w - 2, y + 2, 1, h - 3, shade(base, 0.6));
  // rooftop details
  const area = w * h;
  const placed: Rect[] = [];
  const place = (bw: number, bh: number): { x: number; y: number } | null => {
    for (let tries = 0; tries < 12; tries++) {
      if (w - bw - 8 <= 0 || h - bh - 8 <= 0) return null;
      const px = x + 4 + Math.floor(R() * (w - bw - 8));
      const py = y + 4 + Math.floor(R() * (h - bh - 8));
      if (placed.some((r) => px < r.x + r.w + 2 && px + bw + 2 > r.x && py < r.y + r.h + 2 && py + bh + 2 > r.y)) continue;
      placed.push({ x: px, y: py, w: bw, h: bh });
      return { x: px, y: py };
    }
    return null;
  };
  if (w >= 40 && h >= 26 && R() < 0.16) {
    const bwid = Math.min(w - 10, 34);
    const p = { x: x + Math.floor((w - bwid) / 2), y: y + 4 };
    placed.push({ x: p.x, y: p.y, w: bwid, h: 9 });
    shadowRect(pc, p.x + 1, p.y + 1, bwid, 9, 0.7);
    pc.rect(p.x, p.y, bwid, 8, PAL.navy);
    pc.strokeRect(p.x, p.y, bwid, 8, PAL.ink);
    pc.rect(p.x + 1, p.y + 1, bwid - 2, 1, PAL.navyLight);
    const word = bwid >= 30 ? "SCAMBOY" : bwid >= 18 ? "SCAM" : "$$";
    text3(pc, word, p.x + Math.floor((bwid - word.length * 4 + 1) / 2), p.y + 2, R() < 0.5 ? PAL.magentaLight : PAL.offwhite);
  }
  const nAc = Math.min(4, Math.floor(area / 1300) + 1);
  for (let i = 0; i < nAc; i++) {
    const p = place(8, 7);
    if (!p) break;
    shadowRect(pc, p.x + 2, p.y + 2, 8, 7, 0.65);
    pc.rect(p.x, p.y, 8, 7, 0xc4c6d0);
    pc.strokeRect(p.x, p.y, 8, 7, 0x3a3c46);
    pc.rect(p.x + 1, p.y + 1, 6, 1, 0xe4e6ee);
    pc.circle(p.x + 4, p.y + 3.8, 2.2, 0x55586a);
    pc.set(p.x + 4, p.y + 3, 0x8a8d99);
    pc.set(p.x + 3, p.y + 4, 0x8a8d99);
  }
  if (w > 30 && h > 30 && R() < 0.6) {
    const p = place(10, 6);
    if (p) {
      pc.rect(p.x, p.y, 10, 6, 0x3a6d9a);
      pc.strokeRect(p.x, p.y, 10, 6, lt);
      pc.line(p.x + 2, p.y + 4, p.x + 5, p.y + 1, 0x9fd0f0);
    }
  }
  if (w >= 44 && h >= 44 && R() < 0.45) {
    const p = place(14, 14);
    if (p) {
      shadowEllipse(pc, p.x + 9, p.y + 9, 7, 7, 0.6);
      pc.circle(p.x + 7, p.y + 7, 6.5, 0x5c3a1c);
      pc.circle(p.x + 7, p.y + 7, 5.5, 0x8b5a2b);
      pc.ellipse(p.x + 6, p.y + 6, 3.5, 3, 0xa87040);
      pc.set(p.x + 7, p.y + 7, 0x3b2618);
    }
  }
  if (R() < 0.7) {
    const p = place(9, 8);
    if (p) {
      shadowRect(pc, p.x + 2, p.y + 2, 9, 8, 0.65);
      pc.rect(p.x, p.y, 9, 8, 0xd9cbb0);
      pc.strokeRect(p.x, p.y, 9, 8, 0x3a3226);
      pc.rect(p.x + 1, p.y + 1, 7, 1, 0xf0e4c8);
      pc.rect(p.x + 3, p.y + 5, 3, 3, 0x5c4a36);
    }
  }
  const nV = Math.floor(area / 900);
  for (let i = 0; i < nV; i++) {
    const p = place(3, 3);
    if (!p) break;
    pc.rect(p.x, p.y, 3, 3, 0x3a3c46);
    pc.set(p.x, p.y, 0x8a8d99);
  }
}

function drawTree(pc: PixelCanvas, cx: number, cy: number, r: number, seed: number, palm = false) {
  const R = rng(seed);
  if (palm) {
    shadowEllipse(pc, cx + 3, cy + 4, r + 1, r * 0.8, 0.7);
    const n = 7;
    const a0 = R() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const len = r + 1 + R() * 2;
      const ex = cx + Math.cos(a) * len;
      const ey = cy + Math.sin(a) * len + 1;
      pc.line(cx, cy, ex, ey, 0x1f6b32, 2);
      pc.line(cx, cy, cx + Math.cos(a) * (len - 1), cy + Math.sin(a) * (len - 1), 0x3fb950);
      pc.set(ex, ey, 0x7fd06a);
    }
    pc.circle(cx, cy, 1.6, 0x8b5a2b);
    pc.set(cx - 1, cy - 1, 0xc0905a);
    return;
  }
  shadowEllipse(pc, cx + 3, cy + 4, r, r * 0.85, 0.68);
  pc.circle(cx, cy, r, 0x1e4f22);
  pc.circle(cx, cy, r - 1, 0x2f7a32);
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2;
    const d = R() * (r - 3);
    pc.circle(cx + Math.cos(a) * d - 1, cy + Math.sin(a) * d - 1, 2 + R() * 2, 0x3f9a40);
  }
  pc.circle(cx - r * 0.3, cy - r * 0.3, r * 0.45, 0x56b452);
  for (let i = 0; i < 4; i++) pc.set(cx - r * 0.4 + R() * r * 0.5, cy - r * 0.5 + R() * r * 0.4, 0x8fd87a);
}

function drawCactus(pc: PixelCanvas, cx: number, cy: number, r: number, seed: number) {
  const R = rng(seed);
  shadowEllipse(pc, cx + 3, cy + 5, r + 1, r * 0.6, 0.7);
  const c = new PixelCanvas(20, 20);
  const m = 10;
  const horizontal = R() < 0.5;
  const arms = R() < 0.6 ? [-1, 1] : [R() < 0.5 ? -1 : 1];
  for (const s of arms) {
    const ax = horizontal ? m + s * (r - 1) : m;
    const ay = horizontal ? m : m + s * (r - 1);
    c.line(m, m, ax, ay, 0x2f7a3a, 3);
    c.circle(ax + 0.5, ay + 0.5, 2.2, 0x3f9a48);
    c.set(ax, ay, 0x6cc070);
  }
  c.circle(m + 0.5, m + 0.5, 3.6, 0x3f9a48);
  c.circle(m + 0.5, m + 0.5, 2.2, 0x56b452);
  c.set(m - 1, m - 1, 0x9ad89a);
  c.set(m, m - 2, 0x7fd06a);
  c.outline(0x163a1c);
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2;
    const x = Math.round(m + Math.cos(a) * 3.5);
    const y = Math.round(m + Math.sin(a) * 3.5);
    if (c.isOpaque(x, y)) c.set(x, y, 0xf0f4d0);
  }
  if (R() < 0.3) c.set(m, m, PAL.magentaLight); // flower
  pc.blit(c, Math.round(cx) - m, Math.round(cy) - m);
}

function drawBoulder(pc: PixelCanvas, cx: number, cy: number, r: number, seed: number, desert: boolean) {
  const R = rng(seed);
  const base = desert ? 0xa0644a : 0x8a8d99;
  const lt = desert ? 0xc8916a : 0xc4c6d0;
  const dk = desert ? 0x6a4030 : 0x55586a;
  shadowEllipse(pc, cx + 2, cy + 3, r * 0.6, r * 0.45, 0.7);
  const blobs: Array<[number, number, number]> = [];
  for (let i = 0; i < 4; i++) blobs.push([cx + (R() - 0.5) * r * 0.5, cy + (R() - 0.5) * r * 0.4, r * (0.3 + R() * 0.2)]);
  for (const [bx, by, br] of blobs) pc.circle(bx, by, br + 1, 0x2a1a14);
  for (const [bx, by, br] of blobs) pc.circle(bx, by, br, base);
  for (const [bx, by, br] of blobs) pc.circle(bx + 1, by + 1, br * 0.6, dk);
  for (const [bx, by, br] of blobs) pc.circle(bx - br * 0.3, by - br * 0.3, br * 0.45, lt);
}

function drawBarrier(pc: PixelCanvas, x: number, y: number, w: number, h: number) {
  shadowRect(pc, x + 2, y + 3, w, h, 0.65);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) pc.set(x + xx, y + yy, ((xx + yy) >> 2) & 1 ? 0xf4a24c : 0xece7dc);
  pc.strokeRect(x, y, w, h, PAL.ink);
  pc.set(x + 1, y + 1, 0xffd23f);
  pc.set(x + w - 2, y + h - 2, 0xe63946);
}

function drawMansion(pc: PixelCanvas, p: Prop) {
  const R = rng(p.seed);
  const { x, y, w, h } = p;
  // lawn
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) pc.set(x + xx, y + yy, ((xx + yy) >> 3) & 1 ? 0x6cc04a : 0x62b644);
  // hedge border
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      if (xx > 3 && yy > 3 && xx < w - 4 && yy < h - 4) continue;
      const n = hashI(x + xx, y + yy);
      pc.set(x + xx, y + yy, n < 0.3 ? 0x235c2b : n > 0.85 ? 0x58b060 : 0x2f7a3a);
    }
  pc.strokeRect(x, y, w, h, 0x163a1c);
  // gate gap facing south
  const gx = x + Math.floor(w / 2) - 5;
  pc.rect(gx, y + h - 4, 10, 4, 0xd8c8a0);
  pc.rect(gx, y + h - 4, 1, 4, PAL.yellow);
  pc.rect(gx + 9, y + h - 4, 1, 4, PAL.yellow);
  // house
  const mw = Math.max(30, Math.floor(w * (0.5 + R() * 0.15)));
  const mh = Math.max(24, Math.floor(h * (0.42 + R() * 0.12)));
  const leftHouse = R() < 0.5;
  const mx = leftHouse ? x + 8 : x + w - 8 - mw;
  const my = y + 8;
  // driveway
  const dx = mx + Math.floor(mw / 2) - 4;
  pc.rect(dx, my + mh, 8, y + h - 4 - (my + mh), 0xd8c8a0);
  pc.rect(gx, y + h - 10, Math.max(10, Math.abs(dx - gx) + 8), 6, 0xd8c8a0);
  shadowRect(pc, mx + 4, my + 5, mw, mh, 0.62);
  const style = p.style % 4;
  const roofBase = [0xc0632a, 0xece7dc, 0x6d7d8c, 0xf4f0e0][style];
  for (let yy = 0; yy < mh; yy++)
    for (let xx = 0; xx < mw; xx++) {
      let c = roofBase;
      if (style === 0 || style === 2) {
        // hip roof faces
        const dl = xx;
        const dr = mw - 1 - xx;
        const dt = yy;
        const db = mh - 1 - yy;
        const m = Math.min(dl, dr, dt, db);
        if (m === dt) c = mix(roofBase, 0xffffff, 0.22);
        else if (m === dl) c = roofBase;
        else if (m === dr) c = shade(roofBase, 0.8);
        else c = shade(roofBase, 0.66);
        if (style === 0 && yy % 3 === 0) c = shade(c, 0.88);
        if (style === 2 && (xx + yy) % 5 === 0) c = shade(c, 0.92);
      } else {
        if (hashI(mx + xx, my + yy) < 0.08) c = shade(c, 0.94);
        if (xx < 2 || yy < 2 || xx >= mw - 2 || yy >= mh - 2) c = PAL.yellow;
      }
      pc.set(mx + xx, my + yy, c);
    }
  if (style === 1) {
    // rooftop terrace + helipad
    const hx = mx + Math.floor(mw / 2);
    const hy = my + Math.floor(mh / 2);
    pc.circle(hx, hy, Math.min(mw, mh) * 0.32, 0x55586a);
    pc.ring(hx, hy, Math.min(mw, mh) * 0.32, Math.min(mw, mh) * 0.32, PAL.yellow, 1);
    text3(pc, "!", hx - 1, hy - 2, 0xffffff);
    pc.rect(hx - 3, hy - 2, 1, 5, 0xffffff);
    pc.rect(hx + 3, hy - 2, 1, 5, 0xffffff);
    pc.rect(hx - 3, hy, 7, 1, 0xffffff);
  } else if (style === 3) {
    // modern villa: glass strip + solar
    pc.rect(mx + 3, my + 3, mw - 6, 4, 0x5b9bc2);
    pc.line(mx + 4, my + 6, mx + 7, my + 3, 0xbfe4f8);
    for (let i = 0; i < 3; i++) pc.rect(mx + 4 + i * 7, my + mh - 9, 6, 5, PAL.navy);
  }
  pc.strokeRect(mx, my, mw, mh, 0x2a2420);
  // chimney
  if (style === 0 || style === 2) {
    const cx = mx + 4 + Math.floor(R() * (mw - 12));
    pc.rect(cx, my + 3, 5, 5, PAL.brick);
    pc.strokeRect(cx, my + 3, 5, 5, 0x2a1a14);
  }
  // pool
  const pw = Math.min(Math.floor(w * 0.36), 40);
  const ph = Math.min(Math.floor(h * 0.26), 22);
  const px = leftHouse ? x + w - 8 - pw : x + 8;
  const py = y + Math.floor(h * 0.18);
  if (pw >= 14 && ph >= 10 && (leftHouse ? px > mx + mw + 2 : px + pw < mx - 2)) {
    pc.rect(px - 3, py - 3, pw + 6, ph + 6, 0xd8c8a8);
    pc.strokeRect(px - 3, py - 3, pw + 6, ph + 6, 0xb8a888);
    pc.roundRect(px, py, pw, ph, 3, 0x3aa0e0);
    pc.rect(px + 1, py + 1, pw - 2, 2, 0x2c80bc);
    for (let i = 0; i < 4; i++) pc.line(px + 3 + i * 7, py + 5 + (i % 2) * 3, px + 6 + i * 7, py + 5 + (i % 2) * 3, 0x8fd8ff);
    pc.rect(px + pw - 4, py - 1, 1, 3, 0xffffff);
    pc.rect(px + pw - 2, py - 1, 1, 3, 0xffffff);
    // deck chairs
    for (let i = 0; i < 2; i++) pc.rect(px + 2 + i * 6, py + ph + 4, 3, 5, i ? PAL.magentaLight : PAL.yellow);
  }
  // garden trees/palms
  const nt = Math.floor((w * h) / 4000) + 1;
  for (let i = 0; i < nt; i++) {
    const tx = x + 8 + R() * (w - 16);
    const ty = y + h * 0.6 + R() * (h * 0.4 - 10);
    if (tx > mx - 6 && tx < mx + mw + 6 && ty < my + mh + 6) continue;
    drawTree(pc, tx, ty, 4 + R() * 2, Math.floor(R() * 1e6), R() < 0.5);
  }
  // fancy car on the driveway
  if (R() < 0.6) {
    const car = drawCar({ body: [PAL.yellow, 0xf4f0e0, 0x15131c, PAL.red][Math.floor(R() * 4)], dark: 0x8a6a10, accent: 0xffffff, driver: "none" });
    blitRotated(pc, car, dx + 4, my + mh + 14, Math.PI / 2);
  }
}

function drawProp(pc: PixelCanvas, p: Prop, theme: string) {
  switch (p.kind) {
    case "building":
      shadowRect(pc, p.x + 4, p.y + 5, p.w, p.h, 0.7);
      drawBuilding(pc, p.x, p.y, p.w, p.h, p.color || 0x8a8d99, p.style, p.seed);
      break;
    case "tree":
      drawTree(pc, p.x, p.y, p.w / 2, p.seed);
      break;
    case "palm":
      drawTree(pc, p.x, p.y, 6, p.seed, true);
      break;
    case "cactus":
      drawCactus(pc, p.x, p.y, p.w / 2, p.seed);
      break;
    case "boulder":
      drawBoulder(pc, p.x, p.y, p.w / 2 + 1, p.seed, theme === "desert");
      break;
    case "parked": {
      const col = p.color || PAL.blue;
      // stall lines
      const ca = Math.cos(p.rot);
      const sa = Math.sin(p.rot);
      for (const side of [-1, 1]) {
        const ox = -sa * side * 8.5;
        const oy = ca * side * 8.5;
        pc.line(p.x + ox - ca * 11, p.y + oy - sa * 11, p.x + ox + ca * 9, p.y + oy + sa * 9, 0xe8e4d0);
      }
      shadowEllipse(pc, p.x + 2, p.y + 3, 8, 8, 0.75);
      const car = drawCar({ body: col, dark: shade(col, 0.62), accent: mix(col, 0xffffff, 0.5), driver: "none" });
      blitRotated(pc, car, p.x, p.y, p.rot);
      break;
    }
    case "dumpster":
      shadowRect(pc, p.x + 2, p.y + 3, p.w, p.h, 0.65);
      pc.rect(p.x, p.y, p.w, p.h, 0x2a7a4a);
      for (let i = 2; i < p.w - 1; i += 4) pc.rect(p.x + i, p.y + 1, 1, p.h - 2, 0x1f5a36);
      pc.strokeRect(p.x, p.y, p.w, p.h, PAL.ink);
      break;
    case "barrier":
      drawBarrier(pc, p.x, p.y, p.w, p.h);
      break;
    case "mansion":
      drawMansion(pc, p);
      break;
    case "excavator": {
      const { x, y, w, h } = p;
      shadowRect(pc, x + 3, y + 4, w, h, 0.62);
      pc.rect(x, y, w - 8, 5, 0x2a2a34);
      pc.rect(x, y + h - 5, w - 8, 5, 0x2a2a34);
      for (let i = 0; i < w - 8; i += 3) {
        pc.set(x + i, y + 2, 0x55586a);
        pc.set(x + i, y + h - 3, 0x55586a);
      }
      pc.rect(x + 3, y + 4, w - 14, h - 8, PAL.yellow);
      pc.rect(x + 4, y + 5, 7, h - 10, 0x5b9bc2);
      pc.strokeRect(x + 3, y + 4, w - 14, h - 8, PAL.ink);
      pc.line(x + w - 11, y + h / 2, x + w - 2, y + h / 2 - 4, PAL.yellowDark, 3);
      pc.rect(x + w - 4, y + h / 2 - 8, 4, 6, 0x55586a);
      break;
    }
    case "fountain": {
      const r = p.w / 2;
      pc.circle(p.x, p.y, r, 0xd9d4c7);
      pc.circle(p.x, p.y, r - 3, 0x3aa0e0);
      pc.ring(p.x, p.y, r - 3, r - 3, 0x8fd8ff, 1);
      pc.circle(p.x, p.y, 5, 0xece7dc);
      pc.circle(p.x, p.y, 3, PAL.yellow);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pc.set(p.x + Math.cos(a) * (r - 7), p.y + Math.sin(a) * (r - 7), 0xffffff);
      }
      pc.ring(p.x, p.y, r, r, 0x8a8678, 1);
      break;
    }
    case "bush":
      pc.circle(p.x, p.y, p.w / 2, theme === "desert" ? 0x7a6a3a : 0x2f7a32);
      pc.circle(p.x - 1, p.y - 1, p.w / 2 - 1.5, theme === "desert" ? 0x9a8a50 : 0x56b452);
      break;
    case "flag":
      pc.circle(p.x, p.y, 16, 0x8fd87a);
      pc.circle(p.x, p.y, 2, 0x15131c);
      pc.line(p.x, p.y, p.x + 1, p.y - 12, 0xffffff);
      pc.rect(p.x + 2, p.y - 12, 6, 4, PAL.red);
      break;
    case "sign":
      shadowRect(pc, p.x + 1, p.y + 2, 6, 6, 0.65);
      pc.rect(p.x - 3, p.y - 3, 7, 7, PAL.yellow);
      pc.strokeRect(p.x - 3, p.y - 3, 7, 7, PAL.ink);
      pc.rect(p.x, p.y - 2, 1, 3, PAL.ink);
      pc.set(p.x, p.y + 2, PAL.ink);
      break;
    case "pipes":
      for (let i = 0; i < 3; i++) {
        const cx = p.x + 7 + i * 13;
        const cy = p.y + 7;
        shadowEllipse(pc, cx + 2, cy + 2, 6, 6, 0.65);
        pc.circle(cx, cy, 6, 0x8a8d99);
        pc.circle(cx, cy, 4, 0x3a3c46);
        pc.ring(cx, cy, 6, 6, 0x55586a, 1);
      }
      break;
    case "statue":
      pc.rect(p.x - 6, p.y - 6, 12, 12, 0xd9d4c7);
      pc.strokeRect(p.x - 6, p.y - 6, 12, 12, 0x8a8678);
      pc.circle(p.x, p.y, 3, PAL.yellow);
      pc.set(p.x - 1, p.y - 1, 0xfff0a0);
      break;
    case "kiosk":
      pc.rect(p.x, p.y, p.w, p.h, PAL.red);
      for (let i = 0; i < p.w; i += 4) pc.rect(p.x + i, p.y, 2, p.h, 0xece7dc);
      pc.strokeRect(p.x, p.y, p.w, p.h, PAL.ink);
      break;
  }
}

// ================================================================== decals
function drawDecals(pc: PixelCanvas, td: TrackData) {
  for (const d of td.decals) {
    const ca = Math.cos(d.a);
    const sa = Math.sin(d.a);
    switch (d.kind) {
      case "tyres":
        for (const side of [-4, 4]) {
          for (let i = -d.w / 2; i < d.w / 2; i++) {
            if (((i + 100) >> 1) % 3 === 0) continue;
            const x = d.x + ca * i - sa * side;
            const y = d.y + sa * i + ca * side;
            darken(pc, x, y, 0.62);
            darken(pc, x - sa, y + ca, 0.75);
          }
        }
        break;
      case "skid":
        for (let i = -d.w / 2; i < d.w / 2; i++) darken(pc, d.x + ca * i, d.y + sa * i, 0.6);
        break;
      case "crack": {
        const R = rng(Math.floor(d.x * 7 + d.y));
        let x = d.x;
        let y = d.y;
        for (let i = 0; i < 14; i++) {
          x += (R() - 0.5) * 3;
          y += 1;
          darken(pc, x, y, 0.5);
          if (R() < 0.3) darken(pc, x + 1, y, 0.6);
        }
        break;
      }
      case "puddle":
        pc.ellipse(d.x, d.y, 7, 4, 0x44506a);
        pc.ellipse(d.x - 1, d.y - 1, 4, 2, 0x5a6a88);
        pc.set(d.x - 3, d.y - 2, 0xbfd8f0);
        break;
      case "trash":
        pc.circle(d.x, d.y, 3, 0x2a2a34);
        pc.circle(d.x + 4, d.y + 1, 2.5, 0x3a3c46);
        pc.set(d.x - 1, d.y - 1, 0x55586a);
        pc.rect(d.x + 2, d.y - 4, 2, 1, 0xece7dc);
        break;
      case "manhole":
        pc.circle(d.x, d.y, 4, 0x2a2a34);
        pc.ring(d.x, d.y, 4, 4, 0x55586a, 1);
        break;
      case "arrow":
      case "chevron": {
        const col = d.kind === "arrow" ? 0xe8e4d0 : 0xffffff;
        const reps = d.kind === "arrow" ? 1 : 3;
        for (let k = 0; k < reps; k++) {
          const off = (k - (reps - 1) / 2) * 9;
          const bx = d.x + ca * off;
          const by = d.y + sa * off;
          if (d.kind === "arrow") pc.line(bx - ca * 8, by - sa * 8, bx + ca * 4, by + sa * 4, col, 2);
          for (const s of [-1, 1]) {
            pc.line(bx + ca * 5, by + sa * 5, bx + ca * 1 - sa * s * 5, by + sa * 1 + ca * s * 5, d.kind === "chevron" ? PAL.red : col, 2);
          }
        }
        break;
      }
      case "sign":
        pc.rect(d.x - 3, d.y - 3, 7, 7, PAL.yellow);
        pc.strokeRect(d.x - 3, d.y - 3, 7, 7, PAL.ink);
        break;
    }
  }
  // start grid boxes
  for (const s of td.startSlots) {
    const ca = Math.cos(s.a);
    const sa = Math.sin(s.a);
    for (const side of [-1, 1]) {
      pc.line(s.x + ca * 8 - sa * side * 7, s.y + sa * 8 + ca * side * 7, s.x - ca * 8 - sa * side * 7, s.y - sa * 8 + ca * side * 7, 0xe8e4d0);
    }
    pc.line(s.x + ca * 9 - sa * 7, s.y + sa * 9 + ca * 7, s.x + ca * 9 + sa * 7, s.y + sa * 9 - ca * 7, 0xe8e4d0);
  }
  // boost pads: chevrons pointing along the nearest shortcut
  for (const z of td.def.zones) {
    if (z.k !== "rect" || z.t !== T.PAD) continue;
    const cx = z.r.x + z.r.w / 2;
    const cy = z.r.y + z.r.h / 2;
    let best = 1e9;
    let dx = 1;
    let dy = 0;
    for (const s of td.shortcuts)
      for (let i = 0; i < s.path.n; i++) {
        const d = (s.path.x[i] - cx) ** 2 + (s.path.y[i] - cy) ** 2;
        if (d < best) {
          best = d;
          dx = s.path.tx[i];
          dy = s.path.ty[i];
        }
      }
    for (let y = Math.floor(z.r.y); y < z.r.y + z.r.h; y++)
      for (let x = Math.floor(z.r.x); x < z.r.x + z.r.w; x++) {
        const u = (x + 0.5 - cx) * dx + (y + 0.5 - cy) * dy;
        const v = -(x + 0.5 - cx) * dy + (y + 0.5 - cy) * dx;
        const m = (((u - Math.abs(v) * 0.9) % 8) + 8) % 8;
        let c: Color = m < 3 ? PAL.magentaLight : 0x8e1546;
        if (m < 1) c = 0xffffff;
        if (x === Math.floor(z.r.x) || y === Math.floor(z.r.y) || x >= z.r.x + z.r.w - 1 || y >= z.r.y + z.r.h - 1) c = PAL.yellow;
        pc.set(x, y, c);
      }
  }
}

// ================================================================== lux garden trees on hedge areas
function decorateWalls(pc: PixelCanvas, td: TrackData) {
  if (td.def.theme !== "lux") return;
  const R = rng(td.def.seed + 77);
  const isWall = (x: number, y: number) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= td.gw || cy >= td.gh) return false;
    return td.grid[cy * td.gw + cx] === T.WALL;
  };
  const inLot = (x: number, y: number) =>
    td.props.some((p) => p.kind === "mansion" && x >= p.x - 4 && y >= p.y - 4 && x < p.x + p.w + 4 && y < p.y + p.h + 4);
  const tries = Math.floor((td.w * td.h) / 500);
  for (let i = 0; i < tries; i++) {
    const x = R() * td.w;
    const y = R() * td.h;
    const r = 6 + R() * 5;
    if (!isWall(x, y) || !isWall(x - r, y) || !isWall(x + r, y) || !isWall(x, y - r) || !isWall(x, y + r)) continue;
    if (inLot(x, y)) continue;
    if (R() < 0.15) {
      // flower bed
      for (let k = 0; k < 10; k++)
        pc.set(x + (R() - 0.5) * r, y + (R() - 0.5) * r, [PAL.magentaLight, PAL.yellow, 0xffffff, PAL.red][k % 4]);
    } else drawTree(pc, x, y, r, Math.floor(R() * 1e6), R() < 0.2);
  }
}

// ================================================================== covers (hidden passage overlays)
function drawCover(td: TrackData, r: Rect, style: CoverStyle, scIdx: number, seed: number): PixelCanvas {
  const pc = new PixelCanvas(r.w, r.h);
  const R = rng(seed);
  const sc = td.shortcuts[scIdx];
  // find where the passage crosses the rect edges (portal positions)
  const portals: Array<{ x: number; y: number; vertical: boolean }> = [];
  const horizontal = r.w >= r.h;
  {
    let prevIn = false;
    for (let i = 0; i < sc.path.n; i++) {
      const lx = sc.path.x[i] - r.x;
      const ly = sc.path.y[i] - r.y;
      const inside = lx >= 0 && ly >= 0 && lx < r.w && ly < r.h;
      if (inside !== prevIn && i > 0) portals.push({ x: lx, y: ly, vertical: !horizontal });
      prevIn = inside;
    }
  }
  const pw = sc.def.width / 2 + 3;
  if (style === "roof") {
    drawBuilding(pc, 0, 0, r.w, r.h, [0x7a6a8a, 0x8a8d99, 0x9a8a72][Math.floor(R() * 3)], 0, seed);
    // grimy alley mouths under the overhang
    for (const p of portals) {
      for (let k = -pw; k <= pw; k++) {
        const px = horizontal ? Math.round(p.x) : Math.round(p.x + k);
        const py = horizontal ? Math.round(p.y + k) : Math.round(p.y);
        for (let d = 0; d < 3; d++) {
          const ix = horizontal ? (p.x < r.w / 2 ? px + d : px - d) : px;
          const iy = horizontal ? py : p.y < r.h / 2 ? py + d : py - d;
          darken(pc, ix, iy, 0.55 + d * 0.12);
        }
      }
    }
  } else if (style === "rock") {
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const wx = r.x + x;
        const wy = r.y + y;
        const edge = Math.min(x, y, r.w - 1 - x, r.h - 1 - y);
        if (edge < 5 && valueNoise(wx, wy, 5, seed) * 5 > edge + 1) continue;
        const band = Math.floor((wy + valueNoise(wx, wy, 40, td.def.seed) * 30) / 7) % 4;
        let c = [0xc8794a, 0xbd6f42, 0xd28552, 0xb5663c][band];
        const h = hashI(wx, wy);
        if (h < 0.05) c = shade(c, 0.85);
        else if (h > 0.97) c = mix(c, 0xffffff, 0.2);
        if (valueNoise(wx, wy, 6, td.def.seed + 11) > 0.82) c = shade(c, 0.9);
        pc.set(x, y, c);
      }
    // mine / canyon portals: dark mouth with timber frame
    for (const p of portals) {
      for (let k = -pw - 2; k <= pw + 2; k++) {
        for (let d = 0; d < 7; d++) {
          const atStart = horizontal ? p.x < r.w / 2 : p.y < r.h / 2;
          const ix = horizontal ? Math.round(atStart ? p.x + d : p.x - 1 - d) : Math.round(p.x + k);
          const iy = horizontal ? Math.round(p.y + k) : Math.round(atStart ? p.y + d : p.y - 1 - d);
          let c: Color = mix(0x0e0806, 0x3a2012, d / 7);
          if (Math.abs(k) >= pw) c = 0x8b5a2b;
          if (d === 0 && Math.abs(k) <= pw + 2) c = 0x5c3a1c;
          pc.set(ix, iy, c);
        }
      }
    }
  } else if (style === "canopy") {
    // same look as the surrounding botanical garden: hedge floor + overlapping trees
    const gAt = (x: number, y: number) => (x < 0 || y < 0 || x >= r.w || y >= r.h ? T.OFF : T.WALL);
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const edge = Math.min(x, y, r.w - 1 - x, r.h - 1 - y);
        if (edge < 4 && hashI(r.x + x, r.y + y) * 4 > edge + 0.5) continue;
        pc.set(x, y, wallColor("lux", r.x + x, r.y + y, hashI(r.x + x, r.y + y), (gx, gy) => gAt(gx - r.x, gy - r.y) === T.WALL ? T.WALL : T.WALL, td.def.seed));
      }
    const tries = Math.floor((r.w * r.h) / 40);
    for (let i = 0; i < tries; i++) {
      const tx = 4 + R() * (r.w - 8);
      const ty = 4 + R() * (r.h - 8);
      const tr = 5 + R() * 5;
      drawTree(pc, tx, ty, tr, Math.floor(R() * 1e6), R() < 0.15);
    }
  } else {
    // private garden over the tunnel: lawn, hedges, gazebo, portals in marble & gold
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) pc.set(x, y, ((x + y) >> 3) & 1 ? 0x6cc04a : 0x62b644);
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        if (x > 3 && y > 3 && x < r.w - 4 && y < r.h - 4) continue;
        const n = hashI(r.x + x, r.y + y);
        pc.set(x, y, n < 0.3 ? 0x235c2b : n > 0.85 ? 0x58b060 : 0x2f7a3a);
      }
    const gx = Math.floor(r.w / 2);
    const gy = Math.floor(r.h / 2);
    pc.circle(gx, gy, 11, 0xd8c8a0);
    pc.circle(gx, gy, 8, 0xf4f0e0);
    pc.circle(gx, gy, 6, 0xd9d4c7);
    pc.ring(gx, gy, 8, 8, PAL.yellow, 1);
    pc.set(gx, gy, PAL.yellow);
    for (let i = 0; i < 18; i++) {
      const fx = 6 + R() * (r.w - 12);
      const fy = 6 + R() * (r.h - 12);
      if (Math.hypot(fx - gx, fy - gy) < 14) continue;
      pc.set(fx, fy, [PAL.magentaLight, PAL.yellow, 0xffffff, PAL.red][i % 4]);
    }
    for (let i = 0; i < 3; i++) drawTree(pc, 10 + i * ((r.w - 20) / 2), r.h - 10, 5, seed + i);
    for (const p of portals) {
      for (let k = -pw - 2; k <= pw + 2; k++)
        for (let d = 0; d < 7; d++) {
          const atStart = horizontal ? p.x < r.w / 2 : p.y < r.h / 2;
          const ix = horizontal ? Math.round(atStart ? p.x + d : p.x - 1 - d) : Math.round(p.x + k);
          const iy = horizontal ? Math.round(p.y + k) : Math.round(atStart ? p.y + d : p.y - 1 - d);
          let c: Color = mix(0x0e0e16, 0x3a3a48, d / 7);
          if (Math.abs(k) >= pw) c = 0xece7dc;
          if (d === 0) c = PAL.yellow;
          pc.set(ix, iy, c);
        }
    }
    pc.outline(0x163a1c);
  }
  return pc;
}

// ================================================================== public API
export interface TrackArt {
  base: PixelCanvas;
  covers: Array<{ x: number; y: number; pc: PixelCanvas; sc: number }>;
}

export function renderTrackArt(td: TrackData): TrackArt {
  const base = paintGround(td);
  drawDecals(base, td);
  decorateWalls(base, td);
  const theme = td.def.theme;
  // shadows/big props first, small ones last
  const order = [...td.props].sort((a, b) => {
    const big = (p: Prop) => (p.kind === "building" || p.kind === "mansion" ? 0 : 1);
    return big(a) - big(b) || a.y - b.y;
  });
  for (const p of order) drawProp(base, p, theme);
  const covers = td.covers.map((c, i) => ({
    x: c.r.x,
    y: c.r.y,
    pc: drawCover(td, c.r, c.style, c.sc - 1, td.def.seed * 13 + i * 101),
    sc: c.sc - 1,
  }));
  return { base, covers };
}

/**
 * Mini-map drawn from the route geometry: main loop light, visible shortcuts
 * orange, hidden ones only once discovered, start line marked.
 */
export function renderMinimap(def: TrackDef, size: number, showHidden: (sc: number) => boolean): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  const { main, spines } = routePaths(def);
  const k = size / def.size;
  const plot = (p: Path, c: Color, th: number) => {
    const segs = p.closed ? p.n : p.n - 1;
    for (let i = 0; i < segs; i += 2) {
      const j = Math.min(p.n - 1, i + 2) % p.n;
      pc.line(p.x[i] * k, p.y[i] * k, p.x[j] * k, p.y[j] * k, c, th);
    }
  };
  def.shortcuts.forEach((s, i) => {
    if (s.hidden && !showHidden(i)) return;
    plot(spines[i], s.hidden ? PAL.magentaLight : 0xd09a5a, 1);
  });
  plot(main, 0xece7dc, size >= 64 ? 3 : 2);
  pc.outline(0x15131c);
  // start line
  const si = nearestIndex(main, def.start[0], def.start[1]);
  pc.rect(Math.round(main.x[si] * k) - 1, Math.round(main.y[si] * k) - 1, 3, 3, PAL.red);
  return pc;
}
