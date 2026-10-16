/**
 * Registers every DIRTY RACING texture with Phaser (idempotent).
 * Pure drawing lives in carArt.ts / trackArt.ts.
 */
import type * as Phaser from "phaser";
import { PixelCanvas, registerSheet, registerTexture } from "../engine/pixel";
import { PAL } from "../engine/palette";
import { FACE_PALETTE, faceCanvas, type FaceExpr } from "../engine/sprites";
import { drawCar, drawFlame, drawPortrait, drawScamKart, drawShadow, type DriverKind } from "./carArt";
import { RIVALS } from "./RacerAI";

export const CAR_KEYS = ["dr-car-0", "dr-car-1", "dr-car-2", "dr-car-3"];
export const PORTRAIT_KEYS = ["dr-face-granny", "dr-face-skid", "dr-face-rico", "dr-face-scam"];
export const RACER_COLORS = [RIVALS[0].body, RIVALS[1].body, RIVALS[2].body, PAL.magenta];

const DRIVERS: DriverKind[] = ["granny", "skidmark", "rico"];

export const FACE_EXPRS: FaceExpr[] = ["grin", "laugh", "shock", "angry", "smile", "sad", "wink"];

export function registerRacingArt(scene: Phaser.Scene) {
  // ---- cars (2 frames: wheel animation)
  RIVALS.forEach((r, i) => {
    const look = { body: r.body, dark: r.bodyDark, accent: r.accent, driver: DRIVERS[i] };
    registerSheet(scene, CAR_KEYS[i], [drawCar(look, 0), drawCar(look, 1)]);
  });
  registerSheet(scene, CAR_KEYS[3], [drawScamKart(0), drawScamKart(1)]);
  registerSheet(scene, "dr-flame", [drawFlame(0), drawFlame(1), drawFlame(2)]);
  registerTexture(scene, "dr-shadow", drawShadow());

  // ---- portraits
  registerTexture(scene, PORTRAIT_KEYS[0], drawPortrait("granny"));
  registerTexture(scene, PORTRAIT_KEYS[1], drawPortrait("skidmark"));
  registerTexture(scene, PORTRAIT_KEYS[2], drawPortrait("rico"));
  registerSheet(
    scene,
    PORTRAIT_KEYS[3],
    FACE_EXPRS.map((e) => faceCanvas(e, FACE_PALETTE, 1)),
  );
  registerTexture(scene, "dr-face-scam-big", faceCanvas("grin", FACE_PALETTE, 2));
  registerTexture(scene, "dr-face-granny-big", drawPortrait("granny", 2));
  registerTexture(scene, "dr-face-skid-big", drawPortrait("skidmark", 2));
  registerTexture(scene, "dr-face-rico-big", drawPortrait("rico", 2));

  // ---- traffic cone (top-down) + knocked frame
  registerSheet(scene, "dr-cone", [coneCanvas(false), coneCanvas(true)]);

  // ---- particles: dust 0-2, smoke 3-5, spark 6-7, splash 8-9, confetti 10-13
  registerSheet(scene, "dr-fx", particleFrames(), 8, 8);

  // ---- skid mark dot
  const skid = new PixelCanvas(2, 2);
  skid.fill(0x1a1a20);
  registerTexture(scene, "dr-skid", skid);
  const dust = new PixelCanvas(2, 2);
  dust.fill(0x6a4a2a);
  registerTexture(scene, "dr-rut", dust);

  // ---- HUD bits
  registerTexture(scene, "dr-hud-frame", hudFrame(24, 23));
  registerTexture(scene, "dr-boost-bar", boostBar(62, 8));
  registerSheet(scene, "dr-dot", [dot(PAL.magenta, true), ...RIVALS.map((r) => dot(r.body, false))], 5, 5);
  registerTexture(scene, "dr-lock", lockCanvas());
  registerSheet(scene, "dr-arrow", [arrowCanvas(false), arrowCanvas(true)]);
  registerTexture(scene, "dr-flag", flagCanvas());
}

function coneCanvas(knocked: boolean) {
  const pc = new PixelCanvas(9, 9);
  if (knocked) {
    // lying on its side
    pc.poly(
      [
        [1, 3],
        [8, 1],
        [8, 7],
        [1, 5],
      ],
      PAL.orange,
    );
    pc.rect(4, 2, 1, 5, 0xffffff);
    pc.rect(7, 1, 2, 7, PAL.orangeDark);
  } else {
    pc.rect(1, 1, 7, 7, PAL.orangeDark);
    pc.circle(4.5, 4.5, 3, PAL.orange);
    pc.ring(4.5, 4.5, 2.6, 2.6, 0xffffff, 1);
    pc.circle(4.5, 4.5, 1.2, PAL.orange);
    pc.set(4, 4, 0xffd0a0);
  }
  pc.outline(PAL.ink);
  return pc;
}

function particleFrames() {
  const frames: PixelCanvas[] = [];
  // dust (sand coloured puffs growing)
  for (let i = 0; i < 3; i++) {
    const pc = new PixelCanvas(8, 8);
    const r = 1.5 + i;
    pc.circle(4, 4, r, 0xd9b676);
    pc.circle(3.5, 3.5, r * 0.6, 0xf0dcaa);
    frames.push(pc);
  }
  // smoke (grey)
  for (let i = 0; i < 3; i++) {
    const pc = new PixelCanvas(8, 8);
    const r = 1.5 + i;
    pc.circle(4, 4, r, 0x9a9cac);
    pc.circle(3.5, 3.5, r * 0.6, 0xd0d2dc);
    frames.push(pc);
  }
  // sparks
  for (let i = 0; i < 2; i++) {
    const pc = new PixelCanvas(8, 8);
    pc.rect(3, 3, 2, 2, i ? PAL.orange : PAL.yellow);
    pc.set(2 + i * 3, 3, 0xffffff);
    frames.push(pc);
  }
  // splash
  for (let i = 0; i < 2; i++) {
    const pc = new PixelCanvas(8, 8);
    pc.circle(4, 4, 2 + i, 0x7fbfff);
    pc.set(3, 3, 0xffffff);
    frames.push(pc);
  }
  // confetti
  for (const c of [PAL.magentaLight, PAL.yellow, PAL.sky, PAL.green]) {
    const pc = new PixelCanvas(8, 8);
    pc.rect(3, 2, 2, 4, c);
    frames.push(pc);
  }
  return frames;
}

function hudFrame(w: number, h: number) {
  const pc = new PixelCanvas(w, h);
  pc.rect(0, 0, w, h, PAL.navyDark);
  pc.strokeRect(0, 0, w, h, PAL.ink);
  pc.strokeRect(1, 1, w - 2, h - 2, PAL.magenta);
  return pc;
}

function boostBar(w: number, h: number) {
  const pc = new PixelCanvas(w, h);
  pc.rect(0, 0, w, h, PAL.ink);
  pc.rect(1, 1, w - 2, h - 2, 0x2a2a3a);
  pc.strokeRect(0, 0, w, h, PAL.offwhite);
  return pc;
}

function dot(c: number, player: boolean) {
  const pc = new PixelCanvas(5, 5);
  if (player) {
    pc.rect(1, 0, 3, 5, c);
    pc.rect(0, 1, 5, 3, c);
    pc.set(2, 2, 0xffffff);
  } else {
    pc.rect(1, 1, 3, 3, c);
  }
  pc.outline(PAL.ink);
  return pc;
}

function lockCanvas() {
  const pc = new PixelCanvas(16, 18);
  pc.ring(8, 6, 5, 5.5, PAL.grayLight, 2);
  pc.rect(2, 7, 12, 10, PAL.yellow);
  pc.rect(2, 7, 12, 2, 0xfff0a0);
  pc.rect(2, 15, 12, 2, PAL.yellowDark);
  pc.rect(7, 10, 2, 4, PAL.ink);
  pc.outline(PAL.ink);
  return pc;
}

function arrowCanvas(right: boolean) {
  const pc = new PixelCanvas(8, 11);
  for (let i = 0; i < 5; i++) {
    const x = right ? 1 + i : 6 - i;
    pc.rect(x, 1 + i, 1, 9 - i * 2, PAL.yellow);
  }
  pc.outline(PAL.ink);
  return pc;
}

function flagCanvas() {
  const pc = new PixelCanvas(12, 12);
  pc.rect(1, 1, 1, 11, PAL.grayLight);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) pc.rect(2 + x * 2, 1 + y * 2, 2, 2, (x + y) % 2 ? PAL.ink : 0xffffff);
  pc.outline(PAL.ink);
  return pc;
}
