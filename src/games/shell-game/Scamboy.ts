import type * as Phaser from "phaser";
import type { BaseScene } from "../engine/BaseScene";
import { PAL } from "../engine/palette";
import { HAND, HEAD, RIGHT_HAND_OFFSET, TEX, bubbleTexture, type HeadFrame } from "./art";
import type { CupView } from "./CupManager";

const SEGMENTS = 18;
const TORSO_X = 123;
const TORSO_Y = 106;
const HEAD_X = 141;
const HEAD_Y = 70;
const SHOULDERS = [
  { x: 136, y: 119 },
  { x: 184, y: 119 },
] as const;
export const HAND_REST = [
  { x: 124, y: 161 },
  { x: 196, y: 161 },
] as const;
const DEPTH_FREE = 480;

export type Side = 0 | 1;
type Mood = "smile" | "grin";

class HandRig {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  /** progress of the current reach, 0..1 */
  t = 1;
  cup: CupView | null = null;
  tx: number;
  ty: number;
  tween: Phaser.Tweens.Tween | null = null;
  resolve: (() => void) | null = null;
  readonly sprite: Phaser.GameObjects.Image;
  readonly outline: Phaser.GameObjects.Image[] = [];
  readonly fill: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    readonly side: Side,
  ) {
    const rest = HAND_REST[side];
    this.x = this.fromX = this.tx = rest.x;
    this.y = this.fromY = this.ty = rest.y;
    for (let i = 0; i < SEGMENTS; i++) {
      this.outline.push(scene.add.image(0, 0, TEX.armOutline));
      this.fill.push(scene.add.image(0, 0, TEX.armFill));
    }
    this.sprite = scene.add.image(rest.x, rest.y, TEX.hand, HAND.rest + side * RIGHT_HAND_OFFSET);
  }
}

/**
 * SCAMBOY the hustler: expressive 2x head, jacket torso, and two long arms whose
 * hands physically reach for, grip and travel with the cups.
 */
export class Scamboy {
  private head: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private rigs: [HandRig, HandRig];
  private bubble: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Image;
  private bubbleText: Phaser.GameObjects.Text;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private bubbleTween: Phaser.Tweens.Tween | null = null;

  private clock = 0;
  private mood: Mood = "smile";
  private look: -1 | 0 | 1 = 0;
  /** wander the eyes around when nothing else is going on */
  idleLook = true;
  private nextLookAt = 1500;
  private override: { frame: HeadFrame; until: number } | null = null;
  private laughUntil = 0;
  private blinkUntil = 0;
  private nextBlink = 1800;
  private headFrame = -1;
  tapping = false;

  constructor(private scene: BaseScene) {
    this.torso = scene.add.image(TORSO_X, TORSO_Y, TEX.torso).setOrigin(0, 0).setDepth(20);
    this.head = scene.add.image(HEAD_X, HEAD_Y, TEX.head, HEAD.smile).setOrigin(0, 0).setDepth(22);
    this.rigs = [new HandRig(scene, 0), new HandRig(scene, 1)];

    this.bubbleBg = scene.add.image(0, 0, bubbleTexture(scene, 64, 22)).setOrigin(0, 0);
    this.bubbleText = scene.txt(7, 6, "", { color: PAL.ink, wrap: 140, lineSpacing: 3 });
    this.bubble = scene.add.container(150, 25, [this.bubbleBg, this.bubbleText]).setDepth(700).setVisible(false);
    this.update(0);
  }

  // ------------------------------------------------------------ face

  setMood(m: Mood) {
    this.mood = m;
  }

  /** -1 = looking left, 0 = centre, 1 = right */
  setLook(dir: -1 | 0 | 1) {
    this.look = dir;
  }

  /** show an expression for `ms` */
  express(frame: HeadFrame, ms: number) {
    this.override = { frame, until: this.clock + ms };
    this.laughUntil = 0;
  }

  laugh(ms: number) {
    this.laughUntil = this.clock + ms;
    this.override = null;
  }

  get isLaughing() {
    return this.clock < this.laughUntil;
  }

  // ------------------------------------------------------------ speech

  say(text: string, ms = 1800) {
    this.bubbleText.setText(text);
    const w = Math.max(40, Math.ceil(this.bubbleText.width / 2) * 2 + 14);
    const h = Math.ceil(this.bubbleText.height) + 11;
    this.bubbleBg.setTexture(bubbleTexture(this.scene, w, h));
    this.bubble.setPosition(Math.min(150, 316 - w), 25);
    this.bubble.setVisible(true).setScale(0.4);
    this.bubbleTween?.stop();
    this.bubbleTween = this.scene.tweens.add({ targets: this.bubble, scale: 1, duration: 150, ease: "Back.easeOut" });
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = ms > 0 ? this.scene.time.delayedCall(ms, () => this.hush()) : null;
  }

  hush() {
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = null;
    this.bubble.setVisible(false);
  }

  // ------------------------------------------------------------ hands

  /** move a hand onto the top of a cup; it then rides along with that cup */
  reach(side: Side, cup: CupView, ms: number): Promise<void> {
    return this.moveHand(side, cup, HAND_REST[side].x, HAND_REST[side].y, ms);
  }

  /** put a hand back to its resting spot on the table */
  rest(side: Side, ms: number): Promise<void> {
    return this.moveHand(side, null, HAND_REST[side].x, HAND_REST[side].y, ms);
  }

  restAll(ms: number): Promise<void> {
    return Promise.all([this.rest(0, ms), this.rest(1, ms)]).then(() => undefined);
  }

  /** which hand is naturally closer to a screen x */
  sideFor(x: number): Side {
    if (x < 160) return 0;
    if (x > 160) return 1;
    return this.rigs[0].cup ? 1 : 0;
  }

  private moveHand(side: Side, cup: CupView | null, tx: number, ty: number, ms: number): Promise<void> {
    const r = this.rigs[side];
    // finish any reach still in flight so its awaiting coroutine resumes
    if (r.tween) {
      const prev = r.resolve;
      r.resolve = null;
      r.tween.stop();
      prev?.();
    }
    r.fromX = r.x;
    r.fromY = r.y;
    r.cup = cup;
    r.tx = tx;
    r.ty = ty;
    r.t = 0;
    return new Promise((resolve) => {
      r.resolve = resolve;
      r.tween = this.scene.tweens.add({
        targets: r,
        t: 1,
        duration: Math.max(1, ms),
        ease: "Sine.easeInOut",
        onComplete: () => {
          r.tween = null;
          const res = r.resolve;
          r.resolve = null;
          res?.();
        },
      });
    });
  }

  // ------------------------------------------------------------ per frame

  update(dt: number) {
    this.clock += dt;
    const c = this.clock;
    const laughing = c < this.laughUntil;
    const bob = Math.round(Math.sin(c / 420));
    const shakeY = laughing ? (Math.floor(c / 90) % 2) * -2 : 0;
    const shakeX = laughing ? (Math.floor(c / 180) % 2) * 2 - 1 : 0;

    this.torso.setPosition(TORSO_X, TORSO_Y + bob + (laughing ? -shakeY / 2 : 0));
    this.head.setPosition(HEAD_X + shakeX, HEAD_Y + bob + shakeY);

    // ---- face
    if (c > this.nextBlink) {
      this.blinkUntil = c + 130;
      this.nextBlink = c + 1800 + Math.random() * 2600;
    }
    if (this.idleLook && c > this.nextLookAt) {
      const r = Math.random();
      this.look = r < 0.25 ? -1 : r < 0.5 ? 1 : 0;
      this.nextLookAt = c + 1200 + Math.random() * 2400;
    }
    let f: number;
    if (laughing) f = Math.floor(c / 120) % 2 ? HEAD.laughB : HEAD.laughA;
    else if (this.override && c < this.override.until) f = this.override.frame;
    else if (c < this.blinkUntil) f = HEAD.blink;
    else if (this.mood === "grin") f = this.look < 0 ? HEAD.grinL : this.look > 0 ? HEAD.grinR : HEAD.grin;
    else f = this.look < 0 ? HEAD.smileL : this.look > 0 ? HEAD.smileR : HEAD.smile;
    if (f !== this.headFrame) {
      this.headFrame = f;
      this.head.setFrame(f);
    }

    // ---- hands & arms
    for (const r of this.rigs) {
      const tx = r.cup ? r.cup.screenX : r.tx;
      const ty = r.cup ? r.cup.topY + 3 : r.ty;
      if (r.t >= 1) {
        r.x = tx;
        r.y = ty;
      } else {
        r.x = r.fromX + (tx - r.fromX) * r.t;
        r.y = r.fromY + (ty - r.fromY) * r.t - Math.sin(Math.PI * r.t) * 6;
      }
      const hx = Math.round(r.x);
      const hy = Math.round(r.y);

      let frame: number = HAND.rest;
      if (r.cup && r.t > 0.7) frame = HAND.grip;
      else if (this.tapping && !r.cup && Math.floor((c + r.side * 260) / 200) % 3 === 0) frame = HAND.tap;
      r.sprite.setFrame(frame + r.side * RIGHT_HAND_OFFSET);

      const attached = r.cup !== null && r.t > 0.5;
      const d = attached && r.cup ? r.cup.depth + 0.2 + r.side * 0.05 : DEPTH_FREE + r.side * 2;
      r.sprite.setPosition(hx, hy + (frame === HAND.grip ? 0 : 1)).setDepth(d + 0.02);

      // arm: quadratic curve from shoulder to wrist, elbow bulging outward & down
      const s = SHOULDERS[r.side];
      const sx = s.x;
      const sy = s.y + bob;
      const wx = hx;
      const wy = hy - 5;
      const out = r.side === 0 ? -1 : 1;
      const cx = (sx + wx) / 2 + out * 12;
      const cy = (sy + wy) / 2 + 10;
      for (let i = 0; i < SEGMENTS; i++) {
        const t = i / (SEGMENTS - 1);
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const e = t * t;
        const px = Math.round(a * sx + b * cx + e * wx);
        const py = Math.round(a * sy + b * cy + e * wy);
        r.outline[i].setPosition(px, py).setDepth(d);
        r.fill[i].setPosition(px, py).setDepth(d + 0.01);
      }
    }
  }
}
