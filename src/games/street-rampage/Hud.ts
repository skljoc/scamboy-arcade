/**
 * Classic arcade HUD: SCAMBOY portrait, name, lives, segmented health bar with a red
 * "damage lag" trail, FLEX power meter, score, and the current enemy's name + bar
 * (persistent for bosses).
 */
import type * as Phaser from "phaser";
import type { BaseScene } from "../engine/BaseScene";
import { PAL } from "../engine/palette";
import type { FaceExpr } from "../engine/sprites";
import { TEX, BAR_P, BAR_E, POW } from "./register";

const D = 20000;

export class Hud {
  private sc: BaseScene;
  private face: Phaser.GameObjects.Image;
  private hpFill: Phaser.GameObjects.Image;
  private hpLag: Phaser.GameObjects.Image;
  private powFill: Phaser.GameObjects.Image;
  private powLabel: Phaser.GameObjects.Text;
  private livesTxt: Phaser.GameObjects.Text;
  private scoreTxt: Phaser.GameObjects.Text;
  private stageTxt: Phaser.GameObjects.Text;
  private eName: Phaser.GameObjects.Text;
  private eFrame: Phaser.GameObjects.Image;
  private eFill: Phaser.GameObjects.Image;
  private eLag: Phaser.GameObjects.Image;
  private bossFill: Phaser.GameObjects.Image;
  private lag = 1;
  private eLagV = 1;
  private eTimer = 0;
  private faceExpr: FaceExpr = "smile";
  private faceHold = 0;
  private lastScore = -1;
  private lastLives = -1;
  private t = 0;
  private enemyKey: object | null = null;

  constructor(sc: BaseScene, stageN: number) {
    this.sc = sc;
    const fix = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 0): T => {
      o.setScrollFactor(0);
      o.setDepth(D + d);
      return o;
    };
    fix(sc.add.image(0, 0, TEX.hud).setOrigin(0));
    this.face = fix(sc.add.image(6, 7, TEX.face("smile")).setOrigin(0), 1);
    fix(sc.txt(33, 2, "SCAMBOY", { color: PAL.offwhite, stroke: PAL.ink }), 1);
    fix(sc.add.image(96, 2, TEX.life).setOrigin(0), 1);
    this.livesTxt = fix(sc.txt(108, 2, "x3", { color: PAL.offwhite, stroke: PAL.ink }), 1);
    fix(sc.add.image(31, 13, TEX.barFrameP).setOrigin(0), 1);
    this.hpLag = fix(sc.add.image(33, 15, TEX.barFillLag).setOrigin(0), 2);
    this.hpFill = fix(sc.add.image(33, 15, TEX.barFillHp).setOrigin(0), 3);
    fix(sc.add.image(31, 24, TEX.powFrame).setOrigin(0), 1);
    this.powFill = fix(sc.add.image(33, 26, TEX.powFill).setOrigin(0), 2);
    this.powLabel = fix(sc.txt(98, 23, "FLEX", { color: 0x5ad8ff, stroke: PAL.ink }), 2);
    this.scoreTxt = fix(sc.txt(316, 2, "0000000", { color: PAL.yellow, stroke: PAL.ink, originX: 1 }), 1);
    this.stageTxt = fix(sc.txt(146, 2, `ST${stageN}`, { color: PAL.magentaLight, stroke: PAL.ink }), 1);
    this.eName = fix(sc.txt(316, 14, "", { color: PAL.offwhite, stroke: PAL.ink, originX: 1 }), 1);
    this.eFrame = fix(sc.add.image(202, 24, TEX.barFrameE).setOrigin(0), 1);
    this.eLag = fix(sc.add.image(204, 26, TEX.barFillELag).setOrigin(0), 2);
    this.eFill = fix(sc.add.image(204, 26, TEX.barFillE).setOrigin(0), 3);
    this.bossFill = fix(sc.add.image(204, 26, TEX.barFillBoss).setOrigin(0), 3);
    this.eLag.setCrop(0, 0, BAR_E.w, BAR_E.h);
    this.setEnemyVisible(false);
  }

  private setEnemyVisible(v: boolean) {
    this.eName.setVisible(v);
    this.eFrame.setVisible(v);
    this.eFill.setVisible(v);
    this.eLag.setVisible(v);
    this.bossFill.setVisible(false);
  }

  /** flash a face expression for a moment */
  react(e: FaceExpr, ms = 600) {
    this.faceExpr = e;
    this.faceHold = ms;
    this.face.setTexture(TEX.face(e));
  }

  showEnemy(key: object, name: string, hp: number, max: number, boss: boolean) {
    if (this.enemyKey !== key) {
      this.enemyKey = key;
      this.eLagV = Math.max(0, hp) / max;
    }
    this.eTimer = boss ? 1e9 : 2600;
    this.setEnemyVisible(true);
    this.eName.setText(name);
    const r = Math.max(0, hp) / max;
    this.eFill.setVisible(!boss);
    this.bossFill.setVisible(boss);
    (boss ? this.bossFill : this.eFill).setCrop(0, 0, Math.ceil(BAR_E.w * r), BAR_E.h);
    this.eName.setColor(boss ? "#f0609a" : "#ece7dc");
    this.eTarget = r;
  }

  private eTarget = 1;

  hideEnemy() {
    this.eTimer = 0;
    this.enemyKey = null;
    this.setEnemyVisible(false);
  }

  update(dt: number, hp: number, maxHp: number, lives: number, power: number, score: number) {
    this.t += dt;
    const r = Math.max(0, hp) / maxHp;
    this.hpFill.setCrop(0, 0, Math.ceil(BAR_P.w * r), BAR_P.h);
    if (this.lag > r) this.lag = Math.max(r, this.lag - dt / 1400);
    else this.lag = r;
    this.hpLag.setCrop(0, 0, Math.ceil(BAR_P.w * this.lag), BAR_P.h);
    // low health blink
    this.hpFill.setVisible(r > 0.25 || Math.floor(this.t / 160) % 2 === 0);

    const pr = Math.min(1, power / 100);
    this.powFill.setCrop(0, 0, Math.ceil(POW.w * pr), POW.h);
    const full = pr >= 1;
    this.powLabel.setColor(full ? (Math.floor(this.t / 120) % 2 === 0 ? "#ffd23f" : "#ffffff") : "#5ad8ff");
    this.powLabel.setText(full ? "FLEX!" : "FLEX");

    if (score !== this.lastScore) {
      this.lastScore = score;
      this.scoreTxt.setText(String(Math.floor(score)).padStart(7, "0"));
    }
    if (lives !== this.lastLives) {
      this.lastLives = lives;
      this.livesTxt.setText(`x${Math.max(0, lives)}`);
    }

    if (this.faceHold > 0) {
      this.faceHold -= dt;
      if (this.faceHold <= 0) this.faceExpr = "smile";
    }
    const want: FaceExpr = this.faceHold > 0 ? this.faceExpr : r < 0.25 ? "sad" : "smile";
    this.face.setTexture(TEX.face(want));

    if (this.eTimer > 0) {
      this.eTimer -= dt;
      if (this.eLagV > this.eTarget) this.eLagV = Math.max(this.eTarget, this.eLagV - dt / 1200);
      else this.eLagV = this.eTarget;
      this.eLag.setCrop(0, 0, Math.ceil(BAR_E.w * this.eLagV), BAR_E.h);
      if (this.eTimer <= 0) this.hideEnemy();
    }
  }

  setStageVisible(v: boolean) {
    this.stageTxt.setVisible(v);
  }
}
