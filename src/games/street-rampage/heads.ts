/**
 * Hand-pixelled heads (facing right) for every character, with expression variants.
 */
import type { Color } from "../engine/pixel";
import { MINI_HEAD, FACE_PALETTE } from "../engine/sprites";
import { PAL } from "../engine/palette";
import type { Expr } from "./figure";

function setRow(rows: string[], y: number, s: string) {
  rows[y] = s;
}

// ------------------------------------------------------------------ SCAMBOY

export function scamHead(e: Expr): string[] {
  const r = [...MINI_HEAD];
  switch (e) {
    case "shout":
      setRow(r, 7, "KSSKKKKSK.");
      setRow(r, 8, ".KSKMMKK..");
      break;
    case "hurt":
      setRow(r, 5, "KHSKSSKSK.");
      setRow(r, 6, "KsKKSKKSK.");
      setRow(r, 7, "KSSSKKSSK.");
      setRow(r, 8, ".KSKMMKK..");
      break;
    case "grin":
      setRow(r, 6, "KsSKSSKKK.");
      setRow(r, 7, "KSSSSSSKK.");
      setRow(r, 8, ".KSKKKKK..");
      break;
    default:
      break;
  }
  return r;
}
export const SCAM_HEAD_PAL: Record<string, Color> = FACE_PALETTE;

// ------------------------------------------------------------------ street thug (beanie + stubble)

const THUG_BASE = [
  "...KKKKK...",
  "..KBBBBBKK.",
  ".KBBBbBBBBK",
  "KBBBBBBBBBK",
  "KbbbbbbbbbK",
  "KHHSSSSSSSK",
  "KHSSSSKSSKK",
  "KsSSSSKSSKS",
  "KsSSSSSSSSK",
  "KssgggggSK.",
  ".KgggKKKgK.",
  "..KKKKKKK..",
];
export function thugHead(e: Expr): string[] {
  const r = [...THUG_BASE];
  if (e === "shout") {
    setRow(r, 9, "KssggKKKSK.");
    setRow(r, 10, ".KgggKMMKK.");
  } else if (e === "hurt") {
    setRow(r, 6, "KHSSSKKSKKK");
    setRow(r, 7, "KsSSSSSSSSS");
    setRow(r, 9, "KssggKKKSK.");
    setRow(r, 10, ".KgggKMMKK.");
  } else if (e === "grin") {
    setRow(r, 10, ".KgggKKKKK.");
  }
  return r;
}

// ------------------------------------------------------------------ knife punk (mohawk + shades)

const PUNK_BASE = [
  ".....KK....",
  "....KMMK...",
  "...KMmMK...",
  "...KMmMMK..",
  "..KKMMMKKK.",
  ".KSSKKKSSSK",
  "KHSSSSSSSSK",
  "KsSSKKKKKKK",
  "KsSSKWKKKWK",
  "KsSSSSSSSKK",
  ".KsSSSSKKK.",
  "..KsSKKSK..",
  "...KKKKK...",
];
export function punkHead(e: Expr): string[] {
  const r = [...PUNK_BASE];
  if (e === "shout") {
    setRow(r, 10, ".KsSSKKKSK.");
    setRow(r, 11, "..KsSKMMK..");
  } else if (e === "hurt") {
    setRow(r, 8, "KsSSKKWKWKK");
    setRow(r, 10, ".KsSSKKKSK.");
    setRow(r, 11, "..KsSKMMK..");
  } else if (e === "grin") {
    setRow(r, 11, "..KsSKKKKK.");
  }
  return r;
}

// ------------------------------------------------------------------ brute (bald, beard)

const BRUTE_BASE = [
  "....KKKKKK...",
  "..KKSSSSSSKK.",
  ".KSSSSSSSSSSK",
  ".KSSSSSSSSSSK",
  "KsSSSSSSSSSSK",
  "KsSSSKKSSSKKK",
  "KsSSSSKSSSKSK",
  "KsSSSSSSSSSSK",
  "KsSSSSSSSSKSK",
  "KsBBBBSSBBBKK",
  ".KBBBBKKKKBK.",
  ".KBBBBBBBBBK.",
  "..KKBBBBBKK..",
  "....KKKKK....",
];
export function bruteHead(e: Expr): string[] {
  const r = [...BRUTE_BASE];
  if (e === "shout") {
    setRow(r, 9, "KsBBBKKKKBBKK");
    setRow(r, 10, ".KBBBKMMMKBK.");
  } else if (e === "hurt") {
    setRow(r, 5, "KsSSSSSSSSSSK");
    setRow(r, 6, "KsSSSKKSSKKSK");
    setRow(r, 10, ".KBBBKMMMKBK.");
  } else if (e === "grin") {
    setRow(r, 10, ".KBBBBKWWKBK.");
  }
  return r;
}

// ------------------------------------------------------------------ miniboss RAZOR REX (bandana, shades, goatee)

const REX_BASE = [
  "...KKKKKKK...",
  "..KRRRRRRRK..",
  ".KRRWRRRRRRK.",
  "KRRRRRRWRRRRK",
  "KrrrrrrrrrrrK",
  "KKHSSSSSSSSKK",
  "KrKSSKKKKKKKK",
  "KrKSSKYKKKYKK",
  ".KsSSSSSSSSSK",
  ".KsSSSSSSKKK.",
  ".KsSSSHHHHK..",
  "..KsSHKKKHK..",
  "...KKHHHHK...",
  ".....KKKK....",
];
export function rexHead(e: Expr): string[] {
  const r = [...REX_BASE];
  if (e === "shout") {
    setRow(r, 10, ".KsSSKKKKHK..");
    setRow(r, 11, "..KsSHKMMKK..");
  } else if (e === "hurt") {
    setRow(r, 7, "KrKSSKKYKYKKK");
    setRow(r, 10, ".KsSSKKKKHK..");
    setRow(r, 11, "..KsSHKMMKK..");
  } else if (e === "grin") {
    setRow(r, 11, "..KsSHKWWKK..");
  }
  return r;
}

// ------------------------------------------------------------------ BIG BOSS — DON HUSTLO (pompadour, gold shades, gold tooth)

const DON_BASE = [
  ".......KKKKKKK........",
  ".....KKFFFFFFFKK......",
  "....KFFFFFFFFFFfK.....",
  "....KFFFFFFFFFFfK.....",
  "...KFFFFFFFFFFFffK....",
  "...KBBBBBBBBBBBBBK....",
  ".KKfFFFFFFFFFFFFfKK...",
  "KFFFFFFFFFFFFFFFFFFFK.",
  ".KKKKKKKKKKKKKKKKKKKKK",
  "..KHHKSSSSSSSSSSSK....",
  "..KHKSSSSSSSSSSSSSK...",
  "..KHKSSSSKKKKSSKKKSK..",
  ".KHKsSSSKYYYYKKKYYYKK.",
  ".KHKsSSSKYyYYKSKYyYK..",
  "..KKsSSSSKKKKSSSKKKSK.",
  "..KssSSSSSSSSSSSSSSSK.",
  "..KssSSSSSSSSSSSSSKK..",
  "..KssSSSSSSSKKKKKKSK..",
  "...KsSSSSSKWWGWWWKK...",
  "...KssSSSSSKKKKKKSK...",
  "....KssSSSSSSSSSSK....",
  ".....KKssssssssKK.....",
  ".......KKKKKKKKK......",
];
export function donHead(e: Expr): string[] {
  const r = [...DON_BASE];
  if (e === "shout") {
    setRow(r, 17, "..KssSSSSSSKKKKKKKK...");
    setRow(r, 18, "...KsSSSSSKMMMMMMKK...");
    setRow(r, 19, "...KssSSSSKWWGWWWK....");
    setRow(r, 20, "....KssSSSSKKKKKKK....");
  } else if (e === "hurt") {
    setRow(r, 12, ".KHKsSSSKYKYYKKKYKYKK.");
    setRow(r, 13, ".KHKsSSSKYYKYKSKYYKK..");
    setRow(r, 17, "..KssSSSSSSKKKKKKKK...");
    setRow(r, 18, "...KsSSSSSKMMMMMMKK...");
    setRow(r, 19, "...KssSSSSKKKKKKKK....");
  } else if (e === "n") {
    setRow(r, 18, "...KsSSSSSSKKKKKKK....");
    setRow(r, 19, "...KssSSSSSSSSSSSK....");
  }
  return r;
}

export function headPal(o: Partial<Record<string, Color>>): Record<string, Color> {
  const base: Record<string, Color> = {
    K: PAL.ink,
    S: PAL.skin,
    s: PAL.skinShade,
    H: PAL.hair,
    W: PAL.white,
    M: PAL.mouth,
  };
  for (const [k, v] of Object.entries(o)) if (v !== undefined) base[k] = v;
  return base;
}
