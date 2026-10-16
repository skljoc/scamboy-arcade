import * as Phaser from "phaser";
import { Pad } from "./InputManager";
import { pixelFont } from "./fonts";
import { hex } from "./palette";

/** Logical resolution of the SCAMBOY screen */
export const W = 320;
export const H = 288;

export interface TextOpts {
  /** font size in px — use multiples of 8 for crisp pixels */
  size?: number;
  color?: number | string;
  stroke?: number | string;
  strokeThickness?: number;
  align?: "left" | "center" | "right";
  originX?: number;
  originY?: number;
  wrap?: number;
  lineSpacing?: number;
}

/**
 * Base class for every SCAMBOY scene.
 *  - `this.pad` gives frame-accurate console button state (up/down/left/right/a/b).
 *    START and SELECT are owned by the console OS (pause / quit) — do not use them.
 *  - `this.txt()` creates crisp pixel-font text.
 *  - `this.popText()` spawns arcade text effects (POW!, BAM! ...).
 */
export class BaseScene extends Phaser.Scene {
  private _pad = new Pad();
  private _padFrame = -1;
  private _padHooked = false;
  /**
   * Press Start 2P draws its glyphs ~5px below the text origin. Scenes laid out
   * against glyph tops can set this (e.g. -4) to shift top-anchored text up.
   */
  protected textYOffset = 0;

  get pad(): Pad {
    if (!this._padHooked) {
      this._padHooked = true;
      this.events.on(Phaser.Scenes.Events.RESUME, () => this._pad.sync());
      this.events.on(Phaser.Scenes.Events.WAKE, () => this._pad.sync());
      this.events.on(Phaser.Scenes.Events.START, () => this._pad.sync());
    }
    const f = this.game.loop.frame;
    if (f !== this._padFrame) {
      this._padFrame = f;
      this._pad.beginFrame();
    }
    return this._pad;
  }

  /** Pixel font text. Positions are rounded for crispness. */
  txt(x: number, y: number, text: string, o: TextOpts = {}): Phaser.GameObjects.Text {
    const color = typeof o.color === "number" ? hex(o.color) : (o.color ?? "#ffffff");
    const stroke = typeof o.stroke === "number" ? hex(o.stroke) : o.stroke;
    const oy = o.originY ?? 0;
    const t = this.add.text(Math.round(x), Math.round(y + this.textYOffset * (1 - oy)), text, {
      fontFamily: pixelFont(),
      fontSize: `${o.size ?? 8}px`,
      color,
      align: o.align ?? "left",
      stroke: stroke ?? undefined,
      strokeThickness: stroke ? (o.strokeThickness ?? 2) : 0,
      wordWrap: o.wrap ? { width: o.wrap } : undefined,
      lineSpacing: o.lineSpacing ?? 2,
      resolution: 1,
    });
    t.setOrigin(o.originX ?? 0, oy);
    return t;
  }

  /** Rising, fading arcade text (e.g. "POW!") */
  popText(x: number, y: number, text: string, color: number = 0xffd23f, size = 16, stroke = 0x15131c) {
    const t = this.txt(x, y, text, { size, color, stroke, strokeThickness: 4, originX: 0.5, originY: 0.5 });
    t.setDepth(10000);
    t.setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: "Back.Out" });
    this.tweens.add({
      targets: t,
      y: y - 18,
      alpha: 0,
      delay: 380,
      duration: 380,
      onComplete: () => t.destroy(),
    });
    return t;
  }

  /** Screen shake helper */
  shake(intensity = 0.006, duration = 120) {
    this.cameras.main.shake(duration, intensity);
  }
}
