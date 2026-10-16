/**
 * Pooled visual effects: hit sparks, dust, sparkles, shockwave rings, debris and arcade words.
 * Everything advances with the scene's (scaled) delta so hitstop / slow-mo / pause apply.
 */
import type * as Phaser from "phaser";
import type { BaseScene } from "../engine/BaseScene";
import { TEX, RING_FLEX_N, RING_SLAM_N } from "./register";

interface FrameFx {
  spr: Phaser.GameObjects.Sprite;
  t: number;
  frameMs: number;
  n: number;
  vy: number;
  active: boolean;
}

interface RingFx {
  img: Phaser.GameObjects.Image;
  kind: "flex" | "slam";
  t: number;
  dur: number;
  active: boolean;
}

interface Debris {
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  bounces: number;
  active: boolean;
}

export class Effects {
  private sc: BaseScene;
  private frames: FrameFx[] = [];
  private rings: RingFx[] = [];
  private debris: Debris[] = [];
  private lastWord = -1000;
  private clock = 0;

  constructor(sc: BaseScene) {
    this.sc = sc;
  }

  private getFrameFx(tex: string): FrameFx {
    let f = this.frames.find((e) => !e.active && e.spr.texture.key === tex);
    if (!f) {
      const spr = this.sc.add.sprite(0, 0, tex, 0);
      f = { spr, t: 0, frameMs: 50, n: 4, vy: 0, active: false };
      this.frames.push(f);
    }
    f.active = true;
    f.t = 0;
    f.vy = 0;
    f.spr.setVisible(true).setFrame(0).setAlpha(1).setFlipX(false);
    return f;
  }

  /** impact spark at world x and screen y */
  spark(x: number, sy: number, big = false) {
    const f = this.getFrameFx(big ? TEX.sparkBig : TEX.spark);
    f.frameMs = big ? 45 : 38;
    f.spr.setPosition(Math.round(x), Math.round(sy)).setDepth(5000);
    f.spr.setFlipX(Math.random() < 0.5);
  }

  dust(x: number, y: number, flip = false) {
    const f = this.getFrameFx(TEX.dust);
    f.frameMs = 70;
    f.spr.setOrigin(0.5, 1).setPosition(Math.round(x), Math.round(y)).setDepth(10 + y + 0.5).setFlipX(flip);
  }

  sparkle(x: number, sy: number, depth = 5000) {
    const f = this.getFrameFx(TEX.sparkle);
    f.frameMs = 80;
    f.vy = -12;
    f.spr.setPosition(Math.round(x), Math.round(sy)).setDepth(depth);
  }

  /** expanding ground ring (flex shockwave or boss slam) */
  ring(kind: "flex" | "slam", x: number, y: number, dur: number) {
    let r = this.rings.find((e) => !e.active && e.kind === kind);
    if (!r) {
      const img = this.sc.add.image(0, 0, TEX.ring(kind, 0));
      r = { img, kind, t: 0, dur, active: false };
      this.rings.push(r);
    }
    r.active = true;
    r.t = 0;
    r.dur = dur;
    r.img.setTexture(TEX.ring(kind, 0)).setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(1).setDepth(4);
  }

  debrisBurst(x: number, y: number, z: number, frames: number[], power = 1) {
    for (const fr of frames) {
      let d = this.debris.find((e) => !e.active);
      if (!d) {
        const spr = this.sc.add.sprite(0, 0, TEX.debris, 0);
        const shadow = this.sc.add.image(0, 0, TEX.shadowS).setScale(0.4).setDepth(2);
        d = { spr, shadow, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, bounces: 0, active: false };
        this.debris.push(d);
      }
      d.active = true;
      d.x = x + (Math.random() - 0.5) * 10;
      d.y = y + (Math.random() - 0.5) * 6;
      d.z = z + Math.random() * 10;
      d.vx = (Math.random() - 0.5) * 220 * power;
      d.vy = (Math.random() - 0.5) * 40;
      d.vz = (120 + Math.random() * 160) * power;
      d.t = 0;
      d.bounces = 0;
      d.spr.setFrame(fr).setVisible(true).setAlpha(1);
      d.shadow.setVisible(true);
    }
  }

  /** arcade word (rate limited) */
  word(x: number, sy: number, text: string, color: number, size = 16, force = false) {
    if (!force && this.clock - this.lastWord < 260) return;
    this.lastWord = this.clock;
    const t = this.sc.popText(Math.round(x), Math.round(sy), text, color, size);
    t.setDepth(9000);
  }

  update(dt: number) {
    this.clock += dt;
    for (const f of this.frames) {
      if (!f.active) continue;
      f.t += dt;
      const i = Math.floor(f.t / f.frameMs);
      if (i >= f.n) {
        f.active = false;
        f.spr.setVisible(false);
        continue;
      }
      f.spr.setFrame(i);
      if (f.vy) f.spr.y += (f.vy * dt) / 1000;
    }
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) {
        r.active = false;
        r.img.setVisible(false);
        continue;
      }
      const n = r.kind === "flex" ? RING_FLEX_N : RING_SLAM_N;
      r.img.setTexture(TEX.ring(r.kind, Math.min(n - 1, Math.floor(p * n))));
      r.img.setAlpha(p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1);
    }
    const s = dt / 1000;
    for (const d of this.debris) {
      if (!d.active) continue;
      d.t += dt;
      d.x += d.vx * s;
      d.y += d.vy * s;
      d.vz -= 900 * s;
      d.z += d.vz * s;
      if (d.z <= 0) {
        d.z = 0;
        if (d.bounces < 2 && d.vz < -60) {
          d.vz = -d.vz * 0.4;
          d.vx *= 0.6;
          d.bounces++;
        } else {
          d.vz = 0;
          d.vx *= 0.85;
        }
      }
      if (d.z > 0 && Math.floor(d.t / 70) % 2 === 0) d.spr.setFlipX(!d.spr.flipX);
      d.spr.setPosition(Math.round(d.x), Math.round(d.y - d.z - 4)).setDepth(10 + d.y);
      d.shadow.setPosition(Math.round(d.x), Math.round(d.y));
      if (d.t > 1300) d.spr.setAlpha(Math.max(0, 1 - (d.t - 1300) / 400));
      if (d.t > 1700) {
        d.active = false;
        d.spr.setVisible(false);
        d.shadow.setVisible(false);
      }
    }
  }
}
