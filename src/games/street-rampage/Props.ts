/**
 * World objects: destructible props, pickups and stage hazards (speeding car, rolling
 * barrel, falling flower pot, the boss's money bags, slam shockwaves).
 * They own their sprites; collisions are resolved by the stage scene.
 */
import * as Phaser from "phaser";
import type { BaseScene } from "../engine/BaseScene";
import { TEX } from "./register";
import { PROP_INFO, type ItemKind, type PropKind, type PropSpec } from "./stages";
import type { Body } from "./combat";
import { GRAVITY } from "./Fighter";

export class Destructible {
  readonly spr: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
  hp: number;
  drop?: ItemKind;
  broken = false;
  private shakeT = 0;
  /** last attack id that hit, so one swing only counts once */
  lastHitBy: object | null = null;

  constructor(sc: BaseScene, spec: PropSpec) {
    this.kind = spec.kind;
    this.x = spec.x;
    this.y = spec.y;
    this.drop = spec.drop;
    this.hp = PROP_INFO[spec.kind].hp;
    const big = spec.kind === "booth" || spec.kind === "vending";
    this.shadow = sc.add.image(spec.x, spec.y, big ? TEX.shadowM : TEX.shadowS).setDepth(2);
    this.spr = sc.add.sprite(spec.x, spec.y + 1, TEX.prop(spec.kind), 0).setOrigin(0.5, 1).setDepth(10 + spec.y);
  }

  body(): Body {
    const info = PROP_INFO[this.kind];
    return { x: this.x, y: this.y, z: 0, hw: info.hw, h: info.h };
  }

  /** returns true when it breaks */
  hit(): boolean {
    this.hp--;
    this.shakeT = 160;
    this.spr.setFrame(1);
    this.spr.setTintFill(0xffffff);
    if (this.hp <= 0) {
      this.broken = true;
      this.spr.destroy();
      this.shadow.destroy();
      return true;
    }
    return false;
  }

  update(dt: number) {
    if (this.broken) return;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.spr.x = this.x + (Math.floor(this.shakeT / 30) % 2 === 0 ? 1 : -1);
      if (this.shakeT < 110) this.spr.clearTint();
      if (this.shakeT <= 0) this.spr.x = this.x;
    }
  }
}

export class Pickup {
  readonly spr: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly kind: ItemKind;
  x: number;
  y: number;
  z: number;
  vz: number;
  t = 0;
  gone = false;

  constructor(sc: BaseScene, x: number, y: number, kind: ItemKind) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.z = 8;
    this.vz = 170;
    this.shadow = sc.add.image(x, y, TEX.shadowS).setScale(0.7).setDepth(2);
    this.spr = sc.add.image(x, y, TEX.item(kind)).setOrigin(0.5, 1);
  }

  update(dt: number) {
    if (this.gone) return;
    this.t += dt;
    const s = dt / 1000;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * s;
      this.z += this.vz * s;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = this.vz < -120 ? -this.vz * 0.35 : 0;
      }
    }
    const bob = this.z <= 0 ? Math.round(Math.sin(this.t / 180)) : 0;
    this.spr.setPosition(Math.round(this.x), Math.round(this.y - this.z - 1 + bob)).setDepth(10 + this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    // blink before expiring
    if (this.t > 14000) this.spr.setVisible(Math.floor(this.t / 80) % 2 === 0);
    if (this.t > 17000) this.collect();
  }

  collect() {
    this.gone = true;
    this.spr.destroy();
    this.shadow.destroy();
  }
}

/** speeding car crossing a lane after a flashing warning */
export class Car {
  readonly spr: Phaser.GameObjects.Sprite;
  readonly warn: Phaser.GameObjects.Image;
  x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  t = 0;
  phase: "warn" | "drive" | "done" = "warn";
  readonly hitSet = new Set<object>();
  private readonly camX: () => number;

  constructor(sc: BaseScene, camX: () => number, y: number, dir: 1 | -1) {
    this.camX = camX;
    this.y = y;
    this.dir = dir;
    this.x = dir > 0 ? camX() - 70 : camX() + 390;
    this.spr = sc.add.sprite(this.x, y, TEX.car, 0).setOrigin(0.5, 1).setDepth(10 + y).setFlipX(dir > 0).setVisible(false);
    this.warn = sc.add.image(0, y - 18, TEX.warn).setDepth(8000);
  }

  get bodyX0() {
    return this.x - 52;
  }
  get bodyX1() {
    return this.x + 52;
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === "warn") {
      const cx = this.camX();
      this.warn.setPosition(this.dir > 0 ? cx + 14 : cx + 306, this.y - 22);
      this.warn.setVisible(Math.floor(this.t / 110) % 2 === 0);
      if (this.t > 1300) {
        this.phase = "drive";
        this.warn.setVisible(false);
        this.spr.setVisible(true);
        this.x = this.dir > 0 ? cx - 70 : cx + 390;
      }
      return;
    }
    if (this.phase === "drive") {
      this.x += this.dir * 430 * (dt / 1000);
      this.spr.setPosition(Math.round(this.x), this.y);
      this.spr.setFrame(Math.floor(this.t / 50) % 2);
      const cx = this.camX();
      if ((this.dir > 0 && this.x > cx + 420) || (this.dir < 0 && this.x < cx - 100)) {
        this.phase = "done";
        this.spr.destroy();
        this.warn.destroy();
      }
    }
  }
}

export class RollingBarrel {
  readonly spr: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly warn: Phaser.GameObjects.Image;
  x: number;
  readonly y: number;
  readonly vx: number;
  t = 0;
  alive = true;
  readonly hitSet = new Set<object>();
  private readonly camX: () => number;

  constructor(sc: BaseScene, camX: () => number, y: number) {
    this.camX = camX;
    this.y = y;
    this.x = camX() + 340;
    this.vx = -150;
    this.spr = sc.add.sprite(this.x, y, TEX.barrel, 0).setOrigin(0.5, 1).setDepth(10 + y);
    this.shadow = sc.add.image(this.x, y, TEX.shadowS).setDepth(2);
    this.warn = sc.add.image(camX() + 306, y - 20, TEX.warn).setDepth(8000);
  }

  update(dt: number) {
    this.t += dt;
    const cx = this.camX();
    if (this.t < 700) {
      this.warn.setPosition(cx + 306, this.y - 20).setVisible(Math.floor(this.t / 100) % 2 === 0);
      this.x = cx + 340;
    } else {
      this.warn.setVisible(false);
      this.x += this.vx * (dt / 1000);
    }
    this.spr.setPosition(Math.round(this.x), this.y).setFrame(Math.floor(this.t / 90) % 4);
    this.shadow.setPosition(Math.round(this.x), this.y);
    if (this.x < cx - 40) this.kill();
  }

  get rolling() {
    return this.t >= 700;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.spr.destroy();
    this.shadow.destroy();
    this.warn.destroy();
  }
}

/** flower pot falling from a window box onto a marked target */
export class FallingPot {
  readonly spr: Phaser.GameObjects.Image;
  readonly target: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  z = 200;
  vz = 0;
  t = 0;
  alive = true;
  landed = false;

  constructor(sc: BaseScene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.target = sc.add.image(x, y, TEX.target).setDepth(3);
    this.spr = sc.add.image(x, y - this.z, TEX.pot).setOrigin(0.5, 1).setDepth(10 + y).setVisible(false);
  }

  /** returns true on the impact frame */
  update(dt: number): boolean {
    this.t += dt;
    this.target.setVisible(Math.floor(this.t / 90) % 2 === 0 || this.t > 700);
    if (this.t < 650) return false;
    this.spr.setVisible(true);
    this.vz -= GRAVITY * 0.8 * (dt / 1000);
    this.z += this.vz * (dt / 1000);
    this.spr.setPosition(this.x, Math.round(this.y - Math.max(0, this.z)));
    this.target.setScale(1 + Math.max(0, this.z) / 200);
    if (this.z <= 0) {
      this.alive = false;
      this.spr.destroy();
      this.target.destroy();
      return true;
    }
    return false;
  }
}

/** gold money bag thrown in an arc by the boss */
export class MoneyBag {
  readonly spr: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly target: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  readonly vx: number;
  readonly vy: number;
  vz: number;
  alive = true;

  constructor(sc: BaseScene, x: number, y: number, z: number, tx: number, ty: number) {
    const T = 0.95;
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = (tx - x) / T;
    this.vy = (ty - y) / T;
    this.vz = (0.5 * GRAVITY * T * T - z) / T;
    this.target = sc.add.image(tx, ty, TEX.target).setDepth(3);
    this.shadow = sc.add.image(x, y, TEX.shadowS).setScale(0.6).setDepth(2);
    this.spr = sc.add.image(x, y - z, TEX.bag).setOrigin(0.5, 1);
  }

  update(dt: number): boolean {
    const s = dt / 1000;
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.vz -= GRAVITY * s;
    this.z += this.vz * s;
    this.spr.setPosition(Math.round(this.x), Math.round(this.y - Math.max(0, this.z))).setDepth(10 + this.y);
    this.spr.setFlipX(Math.floor(this.z / 12) % 2 === 0);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    if (this.z <= 0) {
      this.alive = false;
      this.spr.destroy();
      this.shadow.destroy();
      this.target.destroy();
      return true;
    }
    return false;
  }
}

/** expanding ground shockwave from the boss slam; hits grounded players on its edge */
export class ShockRing {
  readonly x: number;
  readonly y: number;
  t: number;
  hit = false;
  started = false;
  static readonly DUR = 950;
  static readonly R0 = 16;
  static readonly R1 = 166;

  constructor(x: number, y: number, delay: number) {
    this.x = x;
    this.y = y;
    this.t = -delay;
  }

  get radius() {
    return ShockRing.R0 + (ShockRing.R1 - ShockRing.R0) * Phaser.Math.Clamp(this.t / ShockRing.DUR, 0, 1);
  }

  get done() {
    return this.t >= ShockRing.DUR;
  }
}
