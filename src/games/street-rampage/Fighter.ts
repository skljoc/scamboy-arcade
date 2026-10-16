/**
 * Shared 2.5D actor: world position (x, depth y, height z), velocity, a sprite + ground
 * shadow, frame-based animation driven by the scene clock (so hitstop / slow-mo / OS pause
 * all just work), hit flash and invulnerability blinking.
 */
import * as Phaser from "phaser";
import type { AttackDef, Body } from "./combat";
import type { BaseScene } from "../engine/BaseScene";
import type { Effects } from "./Effects";
import type { StageDef, EnemyType, ItemKind } from "./stages";
import type { Player } from "./Player";

export const GRAVITY = 980;

/** what actors need from the stage scene */
export interface World {
  sc: BaseScene;
  /** game time in ms (frozen while paused, scaled in slow-mo) */
  now: number;
  fx: Effects;
  stage: StageDef;
  camX: number;
  player: Player;
  addScore(n: number): void;
  requestToken(f: Fighter): boolean;
  releaseToken(f: Fighter): void;
  /** resolve a player attack against enemies / props; returns number of victims */
  playerAttack(src: Player, atk: AttackDef): number;
  /** resolve an enemy / boss attack against the player; returns true if it connected */
  attackPlayer(src: Fighter, atk: AttackDef, dirOverride?: number): boolean;
  /** resolve an area attack against the player (shockwaves etc.) */
  hitPlayerArea(src: Fighter | null, atk: AttackDef, dir: number): boolean;
  spawnEnemy(type: EnemyType, side: "L" | "R" | "T", y?: number, drop?: ItemKind): void;
  enemyCount(): number;
  dropItem(x: number, y: number, kind: ItemKind): void;
  onDefeated(f: Fighter): void;
  bossShockwave(x: number, y: number, count: number): void;
  tossBag(fromX: number, fromY: number, fromZ: number, tx: number, ty: number): void;
}

export class Fighter {
  readonly w: World;
  readonly spr: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  hp = 1;
  maxHp = 1;
  hw = 10;
  h = 48;
  state = "idle";
  /** time in current state (ms) */
  st = 0;
  /** hitstop (ms) */
  freeze = 0;
  flash = 0;
  invul = 0;
  /** remaining ms of invulnerability blinking (respawn / get-up) */
  blinkMs = 0;
  alive = true;
  removed = false;
  /** victims of the current attack */
  readonly hitSet = new Set<object>();
  name = "";
  shakeX = 0;

  private animFrames: readonly number[] = [0];
  private animFps = 8;
  private animLoop = true;
  private animT = 0;
  private curFrame = -1;
  private flashing = false;

  constructor(w: World, tex: string, shadowTex: string, originY: number) {
    this.w = w;
    const sc = w.sc;
    this.shadow = sc.add.image(0, 0, shadowTex).setDepth(2);
    this.spr = sc.add.sprite(0, 0, tex, 0);
    this.spr.setOrigin(0.5, originY);
  }

  setState(s: string) {
    this.state = s;
    this.st = 0;
  }

  play(frames: readonly number[], fps = 8, loop = true) {
    if (frames === this.animFrames && loop === this.animLoop) return;
    this.animFrames = frames;
    this.animFps = fps;
    this.animLoop = loop;
    this.animT = 0;
    this.applyFrame();
  }

  pose(frame: number) {
    this.animFrames = [frame];
    this.animLoop = false;
    this.animT = 0;
    this.applyFrame();
  }

  private applyFrame() {
    const n = this.animFrames.length;
    let i = Math.floor((this.animT * this.animFps) / 1000);
    i = this.animLoop ? i % n : Math.min(n - 1, i);
    const f = this.animFrames[i];
    if (f !== this.curFrame) {
      this.curFrame = f;
      this.spr.setFrame(f);
    }
  }

  updateAnim(dt: number) {
    this.animT += dt;
    this.applyFrame();
  }

  body(): Body {
    return { x: this.x, y: this.y, z: this.z, hw: this.hw, h: this.h };
  }

  get grounded() {
    return this.z <= 0 && this.vz <= 0;
  }

  /** integrate z under gravity; returns true on the frame it lands */
  physicsZ(dt: number): boolean {
    const s = dt / 1000;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * s;
      this.z += this.vz * s;
      if (this.z <= 0) {
        this.z = 0;
        return true;
      }
    }
    return false;
  }

  hitFlash(ms = 70) {
    this.flash = ms;
  }

  /** push sprite + shadow to the screen */
  sync() {
    const sx = this.freeze > 0 ? this.shakeX : 0;
    this.spr.setPosition(Math.round(this.x + sx), Math.round(this.y - this.z));
    this.spr.setFlipX(this.facing < 0);
    this.spr.setDepth(10 + this.y);
    const k = Math.max(0.45, 1 - this.z / 140);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    this.shadow.setScale(k);
    this.shadow.setAlpha(0.5 + k * 0.5);
    const wantFlash = this.flash > 0;
    if (wantFlash !== this.flashing) {
      this.flashing = wantFlash;
      if (wantFlash) this.spr.setTintFill(0xffffff);
      else this.spr.clearTint();
    }
    if (this.blinkMs > 0) this.spr.setVisible(Math.floor(this.blinkMs / 70) % 2 === 0);
    else this.spr.setVisible(true);
  }

  /** shared timers; returns false when frozen by hitstop */
  tick(dt: number): boolean {
    if (this.flash > 0) this.flash -= dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.blinkMs > 0) this.blinkMs -= dt;
    if (this.freeze > 0) {
      this.freeze -= dt;
      this.shakeX = this.shakeX > 0 ? -1 : 1;
      return false;
    }
    this.st += dt;
    return true;
  }

  destroy() {
    this.removed = true;
    this.spr.destroy();
    this.shadow.destroy();
  }
}

export function dirTo(from: number, to: number): 1 | -1 {
  return to >= from ? 1 : -1;
}

export function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clampY(y: number, y0: number, y1: number) {
  return Phaser.Math.Clamp(y, y0, y1);
}
