/**
 * Phaser-free pixel art for vehicles, drivers and portraits.
 * All cars are drawn facing RIGHT (+x) so Phaser rotation = heading.
 */
import { PixelCanvas, type Color } from "../engine/pixel";
import { PAL } from "../engine/palette";

export const CAR_W = 22;
export const CAR_H = 14;

export function shade(c: Color, k: number): Color {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: Color, b: Color, t: number): Color {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

export type DriverKind = "granny" | "skidmark" | "rico" | "none";

export interface CarLook {
  body: Color;
  dark: Color;
  accent: Color;
  driver: DriverKind;
}

function wheels(pc: PixelCanvas, frame: number, xs: number[], wheelW: number) {
  for (const x of xs) {
    for (const y of [1, 10]) {
      pc.rect(x, y, wheelW, 3, 0x1c1b22);
      // tread animation
      for (let i = 0; i < wheelW; i++) if ((i + frame) % 2 === 0) pc.set(x + i, y + (y === 1 ? 0 : 2), 0x3a3946);
      pc.set(x + 1, y + 1, 0x55545f);
    }
  }
}

/** Generic rival / parked car, 22x14 canvas, body 18x10. */
export function drawCar(look: CarLook, frame = 0): PixelCanvas {
  const pc = new PixelCanvas(CAR_W, CAR_H);
  const { body, dark, accent } = look;
  const light = mix(body, 0xffffff, 0.35);
  wheels(pc, frame, [4, 14], 4);
  // body with rounded corners
  pc.roundRect(2, 2, 18, 10, 3, body);
  // lower-half shading, upper highlight
  pc.rect(3, 9, 16, 2, dark);
  pc.rect(4, 3, 14, 1, light);
  // hood bulge + nose
  pc.rect(16, 4, 3, 6, mix(body, 0xffffff, 0.15));
  pc.rect(19, 4, 1, 6, dark);
  // racing stripe
  pc.rect(2, 6, 18, 2, accent);
  pc.rect(2, 7, 18, 1, shade(accent, 0.8));
  // cockpit / windscreen
  pc.rect(11, 4, 3, 6, 0x24304a);
  pc.set(12, 4, 0x8ecae6);
  pc.set(11, 5, 0x5b9bc2);
  pc.rect(6, 4, 2, 6, 0x24304a);
  pc.rect(8, 4, 3, 6, mix(body, 0x000000, 0.1));
  // lights
  pc.set(19, 3, 0xfff6c0);
  pc.set(19, 10, 0xfff6c0);
  pc.set(2, 3, 0xe63946);
  pc.set(2, 10, 0xe63946);
  driver(pc, look.driver);
  pc.outline(PAL.ink);
  return pc;
}

function driver(pc: PixelCanvas, kind: DriverKind) {
  // head seen from above in the cockpit (centre ~ x 9.5, y 7)
  switch (kind) {
    case "granny":
      pc.circle(9.5, 7, 3, 0xc4c6d0);
      pc.circle(9, 6.5, 1.6, 0xe8e8ee);
      pc.circle(8.5, 7, 1.2, 0xa9abb8); // bun
      pc.set(12, 5, 0xf4c9a0);
      pc.set(12, 8, 0xf4c9a0);
      break;
    case "skidmark":
      pc.circle(9.5, 7, 3.2, 0x15131c); // top hat brim
      pc.circle(9.5, 7, 2, 0x2a2a34);
      pc.rect(8, 6, 3, 2, PAL.yellow); // gold band
      break;
    case "rico":
      pc.circle(9.5, 7, 3, 0xc98b5f);
      pc.rect(11, 5, 2, 4, 0x15131c); // shades
      pc.set(8, 6, 0xe0a878);
      break;
    case "none":
      break;
  }
}

/** SCAMBOY's tiny kart with his oversized capped head, 22x14 canvas. */
export function drawScamKart(frame = 0): PixelCanvas {
  const pc = new PixelCanvas(CAR_W, CAR_H);
  const navy = PAL.navy;
  const mag = PAL.magenta;
  // fat rear wheels, small front wheels
  for (const y of [0, 11]) {
    pc.rect(2, y, 5, 3, 0x1c1b22);
    for (let i = 0; i < 5; i++) if ((i + frame) % 2 === 0) pc.set(2 + i, y === 0 ? 0 : 13, 0x3a3946);
    pc.set(3, y + 1, 0x55545f);
    pc.rect(15, y + 1, 3, 2, 0x1c1b22);
    pc.set(16 + (frame % 2), y + 1, 0x3a3946);
  }
  // chassis with magenta side stripes
  pc.rect(2, 3, 16, 8, navy);
  pc.rect(2, 3, 16, 1, mag);
  pc.rect(2, 10, 16, 1, PAL.magentaDark);
  pc.rect(3, 4, 14, 1, PAL.navyLight);
  // nose cone with offwhite tip stripe
  pc.rect(17, 4, 3, 6, mag);
  pc.rect(20, 5, 1, 4, mag);
  pc.rect(18, 4, 1, 6, PAL.offwhite);
  pc.set(19, 5, PAL.magentaLight);
  // rear spoiler
  pc.rect(0, 2, 2, 10, mag);
  pc.rect(0, 2, 1, 10, PAL.magentaDark);
  pc.set(1, 3, PAL.magentaLight);
  // steering wheel peeking out in front of the head
  pc.rect(14, 5, 1, 4, 0x15131c);
  // ---- oversized head seen from above: dark cap, light patch, brim forward (+x)
  pc.rect(7, 1, 2, 1, PAL.skin); // ears
  pc.rect(7, 12, 2, 1, PAL.skin);
  pc.set(8, 1, PAL.skinShade);
  pc.set(8, 12, PAL.skinShade);
  pc.ellipse(12.2, 7, 2.6, 3.6, 0x1d1d25); // brim
  pc.circle(7.5, 7, 4.6, 0x2f2f3a); // cap dome
  pc.ellipse(6.6, 5.6, 2.6, 2, 0x45454f); // highlight
  pc.rect(8, 4, 3, 3, PAL.capPatch); // the light patch
  pc.set(8, 4, 0xffffff);
  pc.set(10, 6, 0xb8b4a8);
  pc.set(7, 8, 0x15131c); // cap button
  pc.outline(PAL.ink);
  return pc;
}

/** Exhaust flame (drawn behind the car), 3 frames, 10x8 */
export function drawFlame(frame: number): PixelCanvas {
  const pc = new PixelCanvas(10, 8);
  const len = [7, 9, 6][frame % 3];
  for (let i = 0; i < len; i++) {
    const x = 9 - i;
    const w = Math.max(1, Math.round(3 - (i / len) * 2.6));
    const c = i < 2 ? 0xffffff : i < 4 ? PAL.yellow : i < 6 ? PAL.orange : PAL.red;
    pc.rect(x, 4 - w / 2, 1, w, c);
  }
  pc.set(9, 3, 0x8ecae6);
  pc.set(9, 4, 0x8ecae6);
  return pc;
}

/** soft car shadow */
export function drawShadow(): PixelCanvas {
  const pc = new PixelCanvas(20, 12);
  pc.roundRect(1, 1, 18, 10, 3, 0x000000);
  return pc;
}

// =================================================================== portraits

const PORTRAIT_PAL: Record<string, Color> = {
  K: PAL.ink,
  S: PAL.skin,
  s: PAL.skinShade,
  d: PAL.skinDark,
  W: 0xffffff,
  w: 0xd8d8e0,
  g: 0xa9abb8,
  G: 0x6f7180,
  M: PAL.mouth,
  P: 0xf08aa8,
  p: 0xc45a80,
  Y: PAL.yellow,
  y: PAL.yellowDark,
  B: 0x15131c,
  b: 0x2f2f3a,
  R: PAL.red,
  r: PAL.redDark,
  H: 0x3b2618,
  h: 0x5a3a24,
  L: 0x8ecae6,
  N: 0xc98b5f,
  n: 0xa06a44,
  O: 0x7a4f30,
  V: 0x9b6bd6,
  v: 0x5e3a96,
  E: 0x3fb950,
  e: 0x1f6b32,
};

const GRANNY = [
  "......KKKKKK........",
  ".....KwwwgwwK.......",
  "....KwwwwwwwwK......",
  "...KwgwwwwwwgwK.....",
  "..KwwwwwwwwwwwwK....",
  "..KwwKKKKKKKKwwK....",
  "..KwKSSSSSSSSKwK....",
  "..KKSSSSSSSSSSKK....",
  "...KKKKKSSKKKKKK....",
  "..KLWLKKSSKLWLKS....",
  "..KLBLKSSSKLBLKS....",
  "..KKKKKSSSKKKKKS....",
  "..KSPPSSSSSSPPSK....",
  "..KSPPSKKKKSPPSK....",
  "...KSSSKMMKSSSK.....",
  "...KSSSSKKSSSSK.....",
  "...VKKSSSSSSKKV.....",
  "..VVVVKKKKKKVVVV....",
  ".KVvVVVVVVVVVVvVK...",
];

const SKIDMARK = [
  "....KKKKKKKKKK......",
  "....KBBBBBBBBK......",
  "....KBbBBBBBBK......",
  "....KBbBBBBBBK......",
  "....KYYYYYYYYK......",
  "..KKKBBBBBBBBKKK....",
  ".KBBBBBBBBBBBBBBK...",
  "..KKKKKKKKKKKKKK....",
  "...KSSSSSSSSSSK.....",
  "..KSSKKSSSSKKSSK....",
  "..KSSBKSSSWBBWSK....",
  "..KSSSSSSSSWWSSK....",
  "..KSSSSSssSSSSSK....",
  "..KHHHHHHHHHHHHK....",
  ".KHHKKHHSSHHKKHHK...",
  "..KK.KSSMMSSK.KK....",
  "...KSSSSSSSSSSK.....",
  "...EKKSSSSSSKKE.....",
  "..EEEEKKKKKKEEEE....",
];

const RICO = [
  "....................",
  "......KKKKKKK.......",
  "....KKHHHHHHHKK.....",
  "...KHHhHHHHhHHHK....",
  "..KHHHHHHHHHHHHHK...",
  "..KNNNNNNNNNNNNNK...",
  "..KNNNNNNNNNNNNNK...",
  "..KNBBBBBNBBBBBNK...",
  "KnKNBBBBBKBBBBBNK...",
  "KnKNNBBBNNNBBBNNK...",
  "..KNNNNNNNNNNNNNK...",
  "..KNNNNNnnNNNNNNK...",
  "..KNnNNNNNNNNnNNK...",
  "..KNNnKKKKKKnNNNK...",
  "...KNNnnnnnnNNNK....",
  "....KKNNNNNNNKK.....",
  ".....YKKKKKKKY......",
  "..RRRRYyYYyYRRRR....",
  ".KRrRRRRYRRRRRrRK...",
];

export type PortraitId = "scamboy" | "granny" | "skidmark" | "rico";

export function portraitRows(id: Exclude<PortraitId, "scamboy">): string[] {
  return id === "granny" ? GRANNY : id === "skidmark" ? SKIDMARK : RICO;
}

export function drawPortrait(id: Exclude<PortraitId, "scamboy">, scale = 1): PixelCanvas {
  const rows = portraitRows(id);
  const pc = new PixelCanvas(20 * scale, 19 * scale);
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const c = PORTRAIT_PAL[rows[y][x]];
      if (c !== undefined) pc.rect(x * scale, y * scale, scale, scale, c);
    }
  return pc;
}

/** rotate-blit src into dst centred at (cx, cy) with nearest-neighbour sampling */
export function blitRotated(dst: PixelCanvas, src: PixelCanvas, cx: number, cy: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hw = src.w / 2;
  const hh = src.h / 2;
  const R = Math.ceil(Math.hypot(hw, hh));
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const sx = Math.floor(dx * c + dy * s + hw);
      const sy = Math.floor(-dx * s + dy * c + hh);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const v = src.buf[sy * src.w + sx];
      if (v >>> 24 === 0) continue;
      if (dst.inBounds(x, y)) dst.buf[y * dst.w + x] = v;
    }
}
