/**
 * Canonical SCAMBOY pixel art shared by the console OS (React/SVG) and every game.
 * Pure data — no Phaser import — so React components can render it too.
 */
import { PixelCanvas, type Color } from "./pixel";
import { PAL } from "./palette";

export type FaceExpr = "smile" | "grin" | "shock" | "laugh" | "wink" | "angry" | "sad";

/** 20x19 SCAMBOY head, cap brim facing right. */
const FACE_BASE = [
  "......KKKKKK........",
  "....KKCCCCCCKK......",
  "...KCCCCCCCCCCK.....",
  "..KCCCCCCCCcccCK....",
  "..KCCCCCCCCcccCCK...",
  "..KCCCCCCCCCCCCCCKKK",
  "..KDDDDDDDDDDDDDDDDK",
  "..KDDDDDDDDDDDDDDDDK",
  "..KKKKKKKKKKKKKKKKKK",
  "..KHHSSSSSSSSSSSK...",
  "..KHSSSSSSSSSSSSK...",
  "KsKSSSSKSSSSKSSSK...",
  "KsKSSSSKSSSSKSSSK...",
  "..KSSSSSSSSSSSSSK...",
  "..KSSSKSSSSSSKSSK...",
  "..KSSSSKKKKKKSSSK...",
  "...KSSSSSSSSSSSK....",
  "....KKSSSSSSSKK.....",
  "......KKKKKKK.......",
];

function setRow(rows: string[], y: number, x: number, s: string) {
  const r = rows[y].split("");
  for (let i = 0; i < s.length; i++) r[x + i] = s[i];
  rows[y] = r.join("");
}

export function faceRows(expr: FaceExpr = "smile"): string[] {
  const rows = [...FACE_BASE];
  // clear eyes & mouth area first for variants
  const clearFeatures = () => {
    for (const y of [11, 12]) {
      setRow(rows, y, 3, "SSSSSSSSSSSSS");
    }
    for (const y of [13, 14, 15]) setRow(rows, y, 3, "SSSSSSSSSSSSS");
  };
  switch (expr) {
    case "smile":
      break;
    case "grin": // mischievous smirk + raised brow
      clearFeatures();
      setRow(rows, 10, 6, "KK");
      setRow(rows, 11, 7, "K");
      setRow(rows, 12, 7, "K");
      setRow(rows, 11, 11, "KK");
      setRow(rows, 12, 12, "K");
      setRow(rows, 14, 13, "K");
      setRow(rows, 15, 7, "KKKKKK");
      setRow(rows, 14, 6, "K");
      setRow(rows, 15, 9, "WWW");
      break;
    case "shock":
      clearFeatures();
      setRow(rows, 11, 6, "KK");
      setRow(rows, 12, 6, "KK");
      setRow(rows, 11, 11, "KK");
      setRow(rows, 12, 11, "KK");
      setRow(rows, 13, 8, "KKK");
      setRow(rows, 14, 7, "KMMMK");
      setRow(rows, 15, 8, "KKK");
      break;
    case "laugh":
      clearFeatures();
      setRow(rows, 11, 6, "K.K".replace(/\./g, "S"));
      setRow(rows, 10, 7, "K");
      setRow(rows, 11, 11, "KSK");
      setRow(rows, 10, 12, "K");
      setRow(rows, 13, 5, "KKKKKKKKK");
      setRow(rows, 14, 5, "KWWWWWWWK");
      setRow(rows, 15, 6, "KMMMMMK");
      setRow(rows, 16, 7, "KKKKK");
      break;
    case "wink":
      clearFeatures();
      setRow(rows, 12, 6, "KK");
      setRow(rows, 11, 12, "K");
      setRow(rows, 12, 12, "K");
      setRow(rows, 14, 6, "K");
      setRow(rows, 14, 13, "K");
      setRow(rows, 15, 7, "KKKKKK");
      break;
    case "angry":
      clearFeatures();
      setRow(rows, 10, 5, "KK");
      setRow(rows, 10, 12, "KK");
      setRow(rows, 11, 7, "K");
      setRow(rows, 11, 12, "K");
      setRow(rows, 12, 7, "K");
      setRow(rows, 12, 12, "K");
      setRow(rows, 15, 7, "KKKKKK");
      break;
    case "sad":
      clearFeatures();
      setRow(rows, 11, 7, "K");
      setRow(rows, 12, 7, "K");
      setRow(rows, 11, 12, "K");
      setRow(rows, 12, 12, "K");
      setRow(rows, 14, 7, "KKKKKK");
      setRow(rows, 15, 6, "K");
      setRow(rows, 15, 13, "K");
      break;
  }
  return rows;
}

/** Full-colour palette for the head */
export const FACE_PALETTE: Record<string, Color> = {
  K: PAL.ink,
  C: 0x2f2f3a,
  D: 0x1d1d25,
  c: PAL.capPatch,
  H: PAL.hair,
  S: PAL.skin,
  s: PAL.skinShade,
  W: PAL.white,
  M: PAL.mouth,
};

/** Classic green LCD palette for the head (boot screen / menus) */
export const FACE_PALETTE_LCD: Record<string, Color> = {
  K: PAL.lcd3,
  C: PAL.lcd3,
  D: PAL.lcd3,
  c: PAL.lcd1,
  H: PAL.lcd2,
  S: PAL.lcd0,
  s: PAL.lcd1,
  W: PAL.lcd0,
  M: PAL.lcd2,
};

/** Waving hand (2 frames) — used on the boot screen next to the head. */
export const HAND_FRAMES: string[][] = [
  [
    ".K.K.K..",
    "KSKSKSK.",
    "KSKSKSK.",
    "KSSSSSKK",
    "KSSSSSSK",
    ".KSSSSK.",
    "..KSSK..",
    "..KSSK..",
  ],
  [
    "..K.K.K.",
    ".KSKSKSK",
    ".KSKSKSK",
    "KKSSSSSK",
    "KSSSSSSK",
    ".KSSSSK.",
    "..KSSK..",
    "..KSSK..",
  ],
];

/** Make a PixelCanvas of the head (optionally scaled ×n) */
export function faceCanvas(expr: FaceExpr = "smile", palette = FACE_PALETTE, scale = 1): PixelCanvas {
  const rows = faceRows(expr);
  const w = rows[0].length;
  const h = rows.length;
  const pc = new PixelCanvas(w * scale, h * scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = palette[rows[y][x]];
      if (c === undefined) continue;
      pc.rect(x * scale, y * scale, scale, scale, c);
    }
  }
  return pc;
}

/**
 * Small 10x10 head for tiny characters (muscle body, race car driver).
 * Cap brim faces right.
 */
export const MINI_HEAD = [
  "..KKKKK...",
  ".KCCCcCK..",
  "KCCCCCCCKK",
  "KDDDDDDDDK",
  "KKKKKKKKKK",
  "KHSSSSSSK.",
  "KsSKSSKSK.",
  "KSSSSSSSK.",
  ".KSKKKSK..",
  "..KKKKK...",
];
