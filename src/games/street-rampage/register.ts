/**
 * Registers every STREET RAMPAGE texture with Phaser (idempotent).
 */
import type * as Phaser from "phaser";
import { PixelCanvas, registerSheet, registerTexture } from "../engine/pixel";
import { faceCanvas, type FaceExpr } from "../engine/sprites";
import { PAL } from "../engine/palette";
import { playerFrames, enemyFrames, bossFrames, LOOKS, FRAME, EFRAME, BFRAME } from "./art";
import * as PA from "./propArt";
import { buildBackground } from "./bgArt";
import type { Theme } from "./stages";

export const TEX = {
  player: "sr_player",
  boss: "sr_boss",
  enemy: (look: string) => `sr_e_${look}`,
  item: (k: string) => `sr_item_${k}`,
  prop: (k: string) => `sr_prop_${k}`,
  debris: "sr_debris",
  car: "sr_car",
  barrel: "sr_barrel",
  pot: "sr_pot",
  bag: "sr_bag",
  shadowS: "sr_shadow_s",
  shadowM: "sr_shadow_m",
  shadowL: "sr_shadow_l",
  spark: "sr_spark",
  sparkBig: "sr_spark_big",
  dust: "sr_dust",
  sparkle: "sr_sparkle",
  ring: (kind: "flex" | "slam", i: number) => `sr_ring_${kind}_${i}`,
  warn: "sr_warn",
  go: "sr_go",
  target: "sr_target",
  hud: "sr_hud",
  barFrameP: "sr_barframe_p",
  barFillHp: "sr_barfill_hp",
  barFillLag: "sr_barfill_lag",
  barFrameE: "sr_barframe_e",
  barFillE: "sr_barfill_e",
  barFillELag: "sr_barfill_elag",
  barFillBoss: "sr_barfill_b",
  powFrame: "sr_powframe",
  powFill: "sr_powfill",
  life: "sr_life",
  face: (e: FaceExpr) => `sr_face_${e}`,
  black: "sr_black",
  px: "sr_px",
  bg: (theme: Theme, layer: string) => `sr_bg_${theme}_${layer}`,
};

export const RING_FLEX_N = 8;
export const RING_SLAM_N = 10;
export const ringFlexR = (i: number) => 12 + (i / (RING_FLEX_N - 1)) * 82;
export const ringSlamR = (i: number) => 16 + (i / (RING_SLAM_N - 1)) * 150;

export const BAR_P = { w: 96, h: 6 };
export const BAR_E = { w: 110, h: 5 };
export const POW = { w: 60, h: 3 };

export function registerCommon(scene: Phaser.Scene) {
  if (!scene.textures.exists(TEX.player)) registerSheet(scene, TEX.player, playerFrames(), FRAME.w, FRAME.h);
  for (const k of ["smile", "grin", "shock", "angry", "sad", "laugh"] as FaceExpr[]) registerTexture(scene, TEX.face(k), faceCanvas(k));

  if (!scene.textures.exists(TEX.item("burger"))) {
    const items = PA.itemFrames();
    for (const [k, pc] of Object.entries(items)) registerTexture(scene, TEX.item(k), pc);
  }
  if (!scene.textures.exists(TEX.prop("can"))) {
    const props = PA.propFrames();
    for (const [k, fr] of Object.entries(props)) registerSheet(scene, TEX.prop(k), fr, fr[0].w, fr[0].h);
  }
  registerSheet(scene, TEX.debris, PA.debrisFrames(), 12, 12);
  if (!scene.textures.exists(TEX.car)) registerSheet(scene, TEX.car, PA.carFrames(), 112, 46);
  if (!scene.textures.exists(TEX.barrel)) registerSheet(scene, TEX.barrel, PA.barrelFrames(), 22, 22);
  registerTexture(scene, TEX.pot, PA.potFrame());
  registerTexture(scene, TEX.bag, PA.bagFrame());
  registerTexture(scene, TEX.shadowS, PA.shadowCanvas(12, 4));
  registerTexture(scene, TEX.shadowM, PA.shadowCanvas(17, 5));
  registerTexture(scene, TEX.shadowL, PA.shadowCanvas(34, 9));
  if (!scene.textures.exists(TEX.spark)) registerSheet(scene, TEX.spark, PA.sparkFrames(false), 26, 26);
  if (!scene.textures.exists(TEX.sparkBig)) registerSheet(scene, TEX.sparkBig, PA.sparkFrames(true), 36, 36);
  if (!scene.textures.exists(TEX.dust)) registerSheet(scene, TEX.dust, PA.dustFrames(), 20, 16);
  if (!scene.textures.exists(TEX.sparkle)) registerSheet(scene, TEX.sparkle, PA.sparkleFrames(), 11, 11);
  for (let i = 0; i < RING_FLEX_N; i++)
    if (!scene.textures.exists(TEX.ring("flex", i))) registerTexture(scene, TEX.ring("flex", i), PA.ringFrame(ringFlexR(i), 0xffffff, PAL.magentaLight, 0.4));
  for (let i = 0; i < RING_SLAM_N; i++)
    if (!scene.textures.exists(TEX.ring("slam", i))) registerTexture(scene, TEX.ring("slam", i), PA.ringFrame(ringSlamR(i), PAL.yellow, PAL.orange, 0.34));
  registerTexture(scene, TEX.warn, PA.warnFrame());
  registerTexture(scene, TEX.go, PA.goFrame());
  registerTexture(scene, TEX.target, PA.targetFrame());
  registerTexture(scene, TEX.hud, PA.hudPanel());
  registerTexture(scene, TEX.barFrameP, PA.barFrame(BAR_P.w, BAR_P.h));
  registerTexture(scene, TEX.barFillHp, PA.barFill(BAR_P.w, BAR_P.h, PAL.yellow));
  registerTexture(scene, TEX.barFillLag, PA.barFill(BAR_P.w, BAR_P.h, PAL.red));
  registerTexture(scene, TEX.barFrameE, PA.barFrame(BAR_E.w, BAR_E.h));
  registerTexture(scene, TEX.barFillE, PA.barFill(BAR_E.w, BAR_E.h, PAL.orange));
  registerTexture(scene, TEX.barFillELag, PA.barFill(BAR_E.w, BAR_E.h, PAL.red));
  registerTexture(scene, TEX.barFillBoss, PA.barFill(BAR_E.w, BAR_E.h, PAL.magenta));
  registerTexture(scene, TEX.powFrame, PA.barFrame(POW.w, POW.h));
  registerTexture(scene, TEX.powFill, PA.barFill(POW.w, POW.h, 0x5ad8ff));
  registerTexture(scene, TEX.life, PA.lifeIcon());
  if (!scene.textures.exists(TEX.black)) registerTexture(scene, TEX.black, new PixelCanvas(4, 4).fill(0x000000));
  if (!scene.textures.exists(TEX.px)) registerTexture(scene, TEX.px, new PixelCanvas(1, 1).fill(0xffffff));
}

/** enemy + boss sheets needed by a stage */
export function registerEnemies(scene: Phaser.Scene, looks: string[], boss: boolean) {
  for (const k of looks) {
    if (scene.textures.exists(TEX.enemy(k))) continue;
    const look = LOOKS[k];
    if (look) registerSheet(scene, TEX.enemy(k), enemyFrames(look), EFRAME.w, EFRAME.h);
  }
  if (boss && !scene.textures.exists(TEX.boss)) registerSheet(scene, TEX.boss, bossFrames(), BFRAME.w, BFRAME.h);
}

export function registerBackground(scene: Phaser.Scene, theme: Theme, worldW: number) {
  if (scene.textures.exists(TEX.bg(theme, "near"))) return;
  const L = buildBackground(theme, worldW);
  registerTexture(scene, TEX.bg(theme, "sky"), L.sky);
  registerTexture(scene, TEX.bg(theme, "far"), L.far);
  registerTexture(scene, TEX.bg(theme, "mid"), L.mid);
  registerTexture(scene, TEX.bg(theme, "near"), L.near);
  registerTexture(scene, TEX.bg(theme, "ground"), L.ground);
}
