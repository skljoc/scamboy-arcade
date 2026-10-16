/**
 * SCAMBOY — the playable muscle mountain.
 *
 * Controls: D-pad walks in 2.5D, A = punch combo (jab, cross, uppercut), B = jump
 * (A in the air = dive punch), A+B together = FLEX shockwave, double-tap left/right =
 * dash (A while dashing = shoulder charge).
 */
import { Audio } from "../engine/AudioManager";
import type { Pad } from "../engine/InputManager";
import { Fighter, type World } from "./Fighter";
import { PF, FRAME } from "./art";
import { TEX } from "./register";
import { P_JAB, P_CROSS, P_UPPER, P_DIVE, P_SHOULDER, isChord, type AttackDef } from "./combat";
import { Y_MIN, Y_MAX } from "./stages";

interface AtkSpec {
  def: AttackDef;
  frames: ReadonlyArray<readonly [number, number]>;
  active: readonly [number, number];
  total: number;
  cancel: number;
  lunge?: readonly [number, number, number];
  sfx: "punch" | "whoosh";
}

const JAB: AtkSpec = { def: P_JAB, frames: [[PF.jab[0], 110], [PF.jab[1], 190]], active: [30, 110], total: 190, cancel: 90, sfx: "punch" };
const CROSS: AtkSpec = { def: P_CROSS, frames: [[PF.cross[0], 120], [PF.cross[1], 210]], active: [30, 120], total: 210, cancel: 100, sfx: "punch" };
const UPPER: AtkSpec = {
  def: P_UPPER,
  frames: [[PF.upper[0], 120], [PF.upper[1], 270], [PF.upper[2], 440]],
  active: [120, 220],
  total: 440,
  cancel: 9999,
  lunge: [100, 200, 70],
  sfx: "whoosh",
};
const COMBO = [JAB, CROSS, UPPER];

export const PLAYER_MAX_HP = 100;
const SPEED_X = 80;
const SPEED_Y = 52;
const JUMP_V = 340;
const DASH_V = 190;
const CHARGE_V = 235;
const FLEX_COST = 10;

export class Player extends Fighter {
  readonly isPlayer = true;
  lives = 3;
  /** flex meter 0..100 (full = free flex) */
  power = 0;
  /** bounds in world x for the current camera */
  minX = 0;
  maxX = 320;

  private lastA = -1e9;
  private lastB = -1e9;
  private tapDir = 0;
  private tapT = -1e9;
  private comboStep = 0;
  private comboHit = false;
  private lastAtkEnd = -1e9;
  private buffered = false;
  private atk: AtkSpec | null = null;
  private airAtkUsed = false;
  private hurtAlt = false;
  private dustT = 0;
  private flexFired = false;
  private landFrom = 0;
  /** set by the scene when the flex goes off */
  onFlex: ((x: number, y: number) => void) | null = null;
  grabbed = false;

  constructor(w: World, x: number, y: number) {
    super(w, TEX.player, TEX.shadowM, FRAME.ay / FRAME.h);
    this.x = x;
    this.y = y;
    this.hw = 12;
    this.h = 52;
    this.hp = this.maxHp = PLAYER_MAX_HP;
    this.play(PF.idle, 4);
    this.name = "SCAMBOY";
  }

  get vulnerable() {
    return this.alive && this.invul <= 0 && !["flex", "down", "getup", "dead", "kdAir", "victory", "grabbed"].includes(this.state);
  }

  /** knocked over / getting up / dead */
  get isDown() {
    return this.state === "kdAir" || this.state === "down" || this.state === "getup" || this.state === "dead";
  }

  get canBeGrabbed() {
    return this.vulnerable && this.z < 4 && this.state !== "dash" && this.state !== "charge";
  }

  respawn(x: number, y: number) {
    this.alive = true;
    this.hp = this.maxHp;
    this.x = x;
    this.y = y;
    this.z = 150;
    this.vx = this.vy = this.vz = 0;
    this.invul = 2600;
    this.blinkMs = 2600;
    this.grabbed = false;
    this.setState("air");
    this.airAtkUsed = true;
    this.pose(PF.jumpFall);
  }

  update(dt: number, pad: Pad) {
    if (!this.tick(dt)) {
      this.sync();
      return;
    }
    const t = this.w.now;
    const aJ = pad.justDown("a");
    const bJ = pad.justDown("b");
    if (aJ) this.lastA = t;
    if (bJ) this.lastB = t;
    let dashDir = 0;
    for (const [btn, d] of [
      ["left", -1],
      ["right", 1],
    ] as const) {
      if (pad.justDown(btn)) {
        if (this.tapDir === d && t - this.tapT < 260) dashDir = d;
        this.tapDir = d;
        this.tapT = t;
      }
    }
    const chord = (aJ || bJ) && isChord(this.lastA, this.lastB, 90);
    const s = dt / 1000;

    if (chord && this.canFlex()) {
      this.startFlex();
    }

    switch (this.state) {
      case "idle":
      case "walk": {
        if (dashDir !== 0) {
          this.facing = dashDir > 0 ? 1 : -1;
          this.setState("dash");
          this.play([PF.dash], 1, false);
          Audio.sfx("whoosh");
          this.w.fx.dust(this.x - this.facing * 8, this.y, this.facing < 0);
          break;
        }
        if (aJ) {
          this.startCombo();
          break;
        }
        if (bJ) {
          this.setState("prejump");
          this.pose(PF.crouch);
          break;
        }
        const px = pad.x;
        const py = pad.y;
        this.vx = px * SPEED_X;
        this.vy = py * SPEED_Y;
        if (px !== 0) this.facing = px > 0 ? 1 : -1;
        if (px !== 0 || py !== 0) {
          if (this.state !== "walk") this.setState("walk");
          this.play(PF.walk, 10);
        } else {
          if (this.state !== "idle") this.setState("idle");
          this.play(PF.idle, 4);
        }
        this.move(s);
        break;
      }
      case "prejump": {
        this.vx = pad.x * SPEED_X;
        if (this.st >= 70) {
          this.vz = JUMP_V;
          this.vx = pad.x * 95;
          this.vy = pad.y * 30;
          if (pad.x !== 0) this.facing = pad.x > 0 ? 1 : -1;
          this.airAtkUsed = false;
          this.setState("air");
          this.pose(PF.jumpRise);
          Audio.sfx("jump");
        }
        break;
      }
      case "air": {
        if (aJ && !this.airAtkUsed) {
          this.airAtkUsed = true;
          this.hitSet.clear();
          this.setState("airAtk");
          this.pose(PF.dive);
          this.vx = this.facing * Math.max(110, Math.abs(this.vx));
          this.vz = Math.min(this.vz, 120);
          Audio.sfx("whoosh");
          break;
        }
        this.pose(this.vz > 0 ? PF.jumpRise : PF.jumpFall);
        this.move(s);
        if (this.physicsZ(dt)) this.land();
        break;
      }
      case "airAtk": {
        this.move(s);
        this.w.playerAttack(this, P_DIVE);
        if (this.physicsZ(dt)) this.land();
        break;
      }
      case "land": {
        this.vx = 0;
        this.vy = 0;
        if (this.st >= this.landFrom) {
          this.setState("idle");
          this.play(PF.idle, 4);
        }
        break;
      }
      case "attack": {
        this.runAttack(dt, aJ);
        break;
      }
      case "dash": {
        if (aJ) {
          this.setState("charge");
          this.hitSet.clear();
          this.pose(PF.shoulder);
          Audio.sfx("whoosh");
          break;
        }
        if (bJ) {
          this.vz = JUMP_V * 0.92;
          this.vx = this.facing * 150;
          this.vy = 0;
          this.airAtkUsed = false;
          this.setState("air");
          this.pose(PF.jumpRise);
          Audio.sfx("jump");
          break;
        }
        this.vx = this.facing * DASH_V;
        this.vy = pad.y * SPEED_Y * 0.5;
        this.move(s);
        this.dustTrail(dt);
        if (this.st >= 340) {
          this.setState("idle");
          this.play(PF.idle, 4);
        }
        break;
      }
      case "charge": {
        this.vx = this.facing * CHARGE_V * (this.st < 240 ? 1 : 0.4);
        this.vy = 0;
        this.move(s);
        this.dustTrail(dt);
        if (this.st < 260) this.w.playerAttack(this, P_SHOULDER);
        if (this.st >= 420) {
          this.setState("idle");
          this.play(PF.idle, 4);
        }
        break;
      }
      case "flex": {
        this.vx = this.vy = 0;
        if (this.st < 260) this.pose(PF.flexGather);
        else {
          if (!this.flexFired) {
            this.flexFired = true;
            this.onFlex?.(this.x, this.y);
          }
          this.pose(PF.flexBiceps);
        }
        if (this.st >= 780) {
          this.setState("idle");
          this.play(PF.idle, 4);
          this.invul = Math.max(this.invul, 150);
        }
        break;
      }
      case "hurt": {
        this.vx *= Math.pow(0.0015, s);
        this.move(s);
        if (this.st >= this.landFrom) {
          this.setState("idle");
          this.play(PF.idle, 4);
        }
        break;
      }
      case "kdAir": {
        this.move(s);
        if (this.physicsZ(dt)) {
          if (this.vz < -170) {
            this.vz = -this.vz * 0.32;
            this.vx *= 0.5;
            this.z = 0.1;
            this.w.fx.dust(this.x, this.y);
            Audio.sfx("land");
            this.w.sc.shake(0.004, 90);
          } else {
            this.vx = 0;
            this.vz = 0;
            this.setState(this.hp <= 0 ? "dead" : "down");
            this.pose(PF.lying);
          }
        }
        break;
      }
      case "down": {
        if (this.st >= 620) {
          this.setState("getup");
          this.pose(PF.getup);
        }
        break;
      }
      case "getup": {
        if (this.st >= 300) {
          this.setState("idle");
          this.play(PF.idle, 4);
          this.invul = Math.max(this.invul, 900);
          this.blinkMs = 900;
        }
        break;
      }
      case "dead":
      case "grabbed":
      case "victory":
        break;
      default:
        break;
    }
    this.updateAnim(dt);
    this.sync();
  }

  private canFlex() {
    if (!this.alive || this.grabbed) return false;
    if (this.state === "idle" || this.state === "walk" || this.state === "prejump" || this.state === "land") return true;
    if (this.state === "attack" && this.atk === JAB && this.st < 110) return true;
    return false;
  }

  private startFlex() {
    if (this.power >= 100) this.power = 0;
    else this.hp = Math.max(1, this.hp - FLEX_COST);
    this.setState("flex");
    this.flexFired = false;
    this.vx = this.vy = 0;
    this.invul = Math.max(this.invul, 800);
    this.pose(PF.flexGather);
    Audio.sfx("flex");
  }

  private startCombo() {
    const t = this.w.now;
    if (t - this.lastAtkEnd > 450 || !this.comboHit) this.comboStep = 0;
    const spec = COMBO[Math.min(this.comboStep, COMBO.length - 1)];
    this.comboStep = this.comboStep >= COMBO.length - 1 ? 0 : this.comboStep + 1;
    this.atk = spec;
    this.comboHit = false;
    this.buffered = false;
    this.hitSet.clear();
    this.setState("attack");
    this.vx = this.vy = 0;
    this.pose(spec.frames[0][0]);
    Audio.sfx(spec.sfx);
  }

  private runAttack(dt: number, aJ: boolean) {
    const a = this.atk;
    if (!a) {
      this.setState("idle");
      return;
    }
    let f = a.frames[a.frames.length - 1][0];
    for (const [fr, until] of a.frames)
      if (this.st < until) {
        f = fr;
        break;
      }
    this.pose(f);
    if (a.lunge && this.st >= a.lunge[0] && this.st < a.lunge[1]) {
      this.vx = this.facing * a.lunge[2];
      this.move(dt / 1000);
    }
    if (this.st >= a.active[0] && this.st < a.active[1]) {
      if (this.w.playerAttack(this, a.def) > 0) this.comboHit = true;
    }
    if (aJ) this.buffered = true;
    if (this.st >= a.cancel && this.buffered && a !== UPPER) {
      this.lastAtkEnd = this.w.now;
      this.startCombo();
      return;
    }
    if (this.st >= a.total) {
      this.lastAtkEnd = this.w.now;
      if (a === UPPER) this.comboStep = 0;
      this.atk = null;
      this.setState("idle");
      this.play(PF.idle, 4);
    }
  }

  private land() {
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.setState("land");
    this.landFrom = 110;
    this.pose(PF.crouch);
    this.w.fx.dust(this.x, this.y);
    Audio.sfx("land");
  }

  private dustTrail(dt: number) {
    this.dustT -= dt;
    if (this.dustT <= 0) {
      this.dustT = 90;
      this.w.fx.dust(this.x - this.facing * 10, this.y, this.facing < 0);
    }
  }

  move(s: number) {
    this.x += this.vx * s;
    this.y += this.vy * s;
    if (this.x < this.minX) this.x = this.minX;
    if (this.x > this.maxX) this.x = this.maxX;
    if (this.y < Y_MIN) this.y = Y_MIN;
    if (this.y > Y_MAX) this.y = Y_MAX;
  }

  /** called by the scene when an enemy / hazard connects. Returns false if ignored. */
  takeHit(def: AttackDef, dir: number): boolean {
    if (!this.vulnerable && !(this.state === "grabbed" && def.id === "b_throw")) return false;
    this.hp = Math.max(0, this.hp - def.dmg);
    this.hitFlash(80);
    this.freeze = def.stop;
    this.atk = null;
    this.power = Math.min(100, this.power + 5);
    this.grabbed = false;
    if (def.lift > 0 || this.hp <= 0 || this.z > 0) {
      this.setState("kdAir");
      this.vz = Math.max(def.lift, 200);
      this.vx = dir * Math.max(def.kb, 90);
      this.vy = 0;
      this.z = Math.max(this.z, 0.1);
      this.facing = dir > 0 ? -1 : 1;
      this.pose(PF.kdAir);
      Audio.sfx(this.hp <= 0 ? "ko" : "hurt");
    } else {
      this.setState("hurt");
      this.landFrom = def.stun;
      this.vx = dir * def.kb;
      this.vy = 0;
      this.hurtAlt = !this.hurtAlt;
      this.pose(this.hurtAlt ? PF.hurt[0] : PF.hurt[1]);
      Audio.sfx("hurt");
    }
    return true;
  }

  heal(n: number) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }
}
