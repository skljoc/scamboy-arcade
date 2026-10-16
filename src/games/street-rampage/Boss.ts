/**
 * DON HUSTLO — the gigantic gold-chained street hustler (2× SCAMBOY).
 *
 * Telegraphed attack patterns:
 *  - haymaker punch (close)
 *  - grab & throw (close, reaches out with open hands)
 *  - bull charge across the screen (paws the ground with a "!" first)
 *  - jumping ground slam that sends a shockwave ring you must jump over (double in phase 3)
 *  - whistle to summon thugs (phase 2+)
 *  - money-bag toss with landing markers (phase 3)
 * Super armour while attacking; gets staggered by heavy hits during recoveries, and bursts
 * free when stun-locked. Phases at 60% / 30% health.
 */
import * as Phaser from "phaser";
import { Audio } from "../engine/AudioManager";
import { Fighter, dirTo, rand, type World } from "./Fighter";
import { BF, BFRAME, PF } from "./art";
import { TEX } from "./register";
import { BOSS_HP, BOSS_NAME, Y_MIN, Y_MAX } from "./stages";
import { B_PUNCH, B_CHARGE, B_SLAM_DIRECT, B_THROW, type AttackDef } from "./combat";

const ARMORED = new Set(["intro", "laugh", "punchWind", "punch", "chargeWind", "charge", "slamUp", "slamAir", "grabWind", "reach", "hold", "throw", "whistle", "tossWind", "toss", "burst"]);

export class Boss extends Fighter {
  private onScreen = false;
  phase = 1;
  enterX = 0;
  private thinkT = 800;
  private summonCd = 6000;
  private tossCd = 0;
  private recentHits = 0;
  private recentT = 0;
  private stagger = 0;
  private recoverMs = 500;
  private bagsLeft = 0;
  private dustT = 0;
  private warn: Phaser.GameObjects.Image;
  private ko = false;

  constructor(w: World, x: number, y: number) {
    super(w, TEX.boss, TEX.shadowL, BFRAME.ay / BFRAME.h);
    this.x = x;
    this.y = y;
    this.hw = 22;
    this.h = 96;
    this.hp = this.maxHp = BOSS_HP;
    this.name = BOSS_NAME;
    this.facing = -1;
    this.setState("intro");
    this.play(BF.walk, 7);
    this.warn = w.sc.add.image(0, 0, TEX.warn).setVisible(false).setDepth(8000);
  }

  get downed() {
    return this.state === "down" || this.state === "getup" || this.state === "dead" || this.state === "kdAir";
  }

  get hittable() {
    return this.alive && this.invul <= 0 && !this.downed && this.state !== "intro";
  }

  private speed() {
    return this.phase === 3 ? 64 : this.phase === 2 ? 54 : 46;
  }

  private tk(ms: number) {
    return this.phase === 3 ? ms * 0.8 : ms;
  }

  update(dt: number) {
    if (!this.tick(dt)) {
      this.sync();
      this.post();
      return;
    }
    const s = dt / 1000;
    const p = this.w.player;
    if (this.summonCd > 0) this.summonCd -= dt;
    if (this.tossCd > 0) this.tossCd -= dt;
    if (this.recentT > 0) {
      this.recentT -= dt;
      if (this.recentT <= 0) {
        this.recentHits = 0;
        this.stagger = 0;
      }
    }
    let showWarn = false;
    switch (this.state) {
      case "intro": {
        const d = this.enterX - this.x;
        this.facing = -1;
        this.play(BF.walk, 7);
        this.x += Math.sign(d) * 44 * s;
        if (Math.abs(d) < 2) {
          this.setState("laugh");
          this.pose(BF.taunt);
          Audio.jingle(["C4", "E4", "G4", "C5", "-", "G4", "C5"], 0.09, "square", 0.12);
          this.w.fx.word(this.x, this.y - 112, "HA HA HA!", 0xffd23f, 8, true);
        }
        break;
      }
      case "laugh": {
        this.pose(Math.floor(this.st / 160) % 2 === 0 ? BF.taunt : BF.idle[0]);
        if (this.st > 1300) this.toIdle(400);
        break;
      }
      case "idle": {
        this.facing = dirTo(this.x, p.x);
        this.play(BF.idle, 3);
        this.thinkT -= dt;
        if (this.thinkT <= 0 && p.alive && p.state !== "dead") this.decide();
        break;
      }
      case "walk": {
        this.facing = dirTo(this.x, p.x);
        const tx = p.x - Math.sign(p.x - this.x || 1) * 40;
        const ty = p.y;
        this.stepTo(tx, ty, s, this.speed());
        if ((Math.abs(this.x - tx) < 6 && Math.abs(this.y - ty) < 5) || this.st > 1800) this.toIdle(60);
        break;
      }
      case "align": {
        this.facing = dirTo(this.x, p.x);
        const ok = this.stepTo(this.x, p.y, s, this.speed() * 1.4);
        if (ok || this.st > 900) {
          this.setState("chargeWind");
          this.pose(BF.chargeWind);
          Audio.sfx("alarm");
        }
        break;
      }
      case "punchWind": {
        if (this.st >= this.tk(420)) {
          this.setState("punch");
          this.hitSet.clear();
          this.pose(BF.punch);
          Audio.sfx("whoosh");
        }
        break;
      }
      case "punch": {
        if (this.st < 150) this.w.attackPlayer(this, B_PUNCH);
        if (this.st >= 200) this.toRecover(520, BF.punch);
        break;
      }
      case "chargeWind": {
        showWarn = true;
        this.facing = dirTo(this.x, p.x);
        this.dustT -= dt;
        if (this.dustT <= 0) {
          this.dustT = 160;
          this.w.fx.dust(this.x - this.facing * 22, this.y, this.facing < 0);
        }
        if (this.st >= this.tk(760)) {
          this.setState("charge");
          this.hitSet.clear();
          this.pose(BF.charge);
          this.vx = this.facing * (this.phase === 3 ? 320 : 280);
          Audio.sfx("whoosh");
          this.w.sc.shake(0.004, 200);
        }
        break;
      }
      case "charge": {
        this.x += this.vx * s;
        this.dustT -= dt;
        if (this.dustT <= 0) {
          this.dustT = 70;
          this.w.fx.dust(this.x - this.facing * 26, this.y, this.facing < 0);
        }
        this.w.attackPlayer(this, B_CHARGE);
        const x0 = this.w.camX + 30;
        const x1 = this.w.camX + 290;
        if ((this.vx > 0 && this.x >= x1) || (this.vx < 0 && this.x <= x0) || this.st > 1600) {
          this.x = Phaser.Math.Clamp(this.x, x0, x1);
          this.setState("chargeEnd");
          this.pose(BF.chargeWind);
          Audio.sfx("skid");
        }
        break;
      }
      case "chargeEnd": {
        this.vx *= Math.pow(0.01, s);
        this.x += this.vx * s;
        if (this.st >= this.tk(700)) this.toIdle(rand(300, 600));
        break;
      }
      case "slamUp": {
        showWarn = true;
        if (this.st >= this.tk(620)) {
          this.setState("slamAir");
          this.pose(BF.slamAir);
          this.vz = 420;
          const T = 0.86;
          const tx = Phaser.Math.Clamp(p.x, this.w.camX + 40, this.w.camX + 280);
          this.vx = Phaser.Math.Clamp((tx - this.x) / T, -220, 220);
          this.vy = Phaser.Math.Clamp((p.y - this.y) / T, -80, 80);
          Audio.sfx("jump");
        }
        break;
      }
      case "slamAir": {
        this.x += this.vx * s;
        this.y = Phaser.Math.Clamp(this.y + this.vy * s, Y_MIN, Y_MAX);
        if (this.vz < 0) this.pose(BF.slamDown);
        if (this.physicsZ(dt)) {
          this.vz = 0;
          this.vx = 0;
          this.vy = 0;
          this.pose(BF.slamDown);
          this.w.sc.shake(0.012, 260);
          Audio.sfx("heavyHit");
          this.w.fx.dust(this.x - 24, this.y, true);
          this.w.fx.dust(this.x + 24, this.y);
          if (Math.abs(p.x - this.x) < 50 && Math.abs(p.y - this.y) < 18 && p.z < 12) this.w.hitPlayerArea(this, B_SLAM_DIRECT, dirTo(this.x, p.x));
          this.w.bossShockwave(this.x, this.y, this.phase === 3 ? 2 : 1);
          this.setState("slamLand");
          this.recoverMs = this.tk(760);
        }
        break;
      }
      case "slamLand": {
        if (this.st >= this.recoverMs) this.toIdle(rand(200, 500));
        break;
      }
      case "grabWind": {
        this.facing = dirTo(this.x, p.x);
        if (this.st >= this.tk(360)) {
          this.setState("reach");
          this.pose(BF.reach);
          this.vx = this.facing * 160;
          Audio.sfx("whoosh");
        }
        break;
      }
      case "reach": {
        this.x += this.vx * s;
        this.vx *= Math.pow(0.02, s);
        const dx = (p.x - this.x) * this.facing;
        if (this.st > 60 && dx > 10 && dx < 64 && Math.abs(p.y - this.y) < 11 && p.canBeGrabbed) {
          p.grabbed = true;
          p.setState("grabbed");
          p.vx = p.vy = p.vz = 0;
          this.setState("hold");
          this.pose(BF.hold);
          Audio.sfx("lift");
          this.w.fx.word(this.x, this.y - 120, "GOTCHA!", 0xff5a5a, 8, true);
          break;
        }
        if (this.st >= 300) this.toRecover(480, BF.reach);
        break;
      }
      case "hold": {
        // player dangles above the boss
        p.x = this.x + this.facing * 4;
        p.y = this.y + 1;
        p.z = 88 + Math.sin(this.st / 50) * 2;
        p.facing = this.facing === 1 ? -1 : 1;
        p.pose(Math.floor(this.st / 120) % 2 === 0 ? PF.hurt[0] : PF.hurt[1]);
        if (this.st >= 760) {
          this.setState("throw");
          this.pose(BF.throw);
          p.grabbed = false;
          p.z = 60;
          p.x = this.x + this.facing * 30;
          this.w.hitPlayerArea(this, B_THROW, this.facing);
          Audio.sfx("whoosh");
        }
        break;
      }
      case "throw": {
        if (this.st >= 420) this.toIdle(rand(400, 700));
        break;
      }
      case "whistle": {
        if (this.st > 250 && this.st - dt <= 250) {
          Audio.tone({ type: "square", freq: 1800, to: 2600, dur: 0.18, vol: 0.12 });
          Audio.tone({ type: "square", freq: 2600, to: 1900, dur: 0.22, vol: 0.12, delay: 0.2 });
          this.w.fx.word(this.x, this.y - 118, "BOYS!", 0xffd23f, 8, true);
        }
        if (this.st > 500 && this.st - dt <= 500) {
          const n = this.phase === 3 ? 3 : 2;
          const types = ["thugFast", "punk", "kicker", "thug"] as const;
          for (let i = 0; i < n; i++) this.w.spawnEnemy(types[Math.floor(Math.random() * types.length)], i % 2 === 0 ? "L" : "R");
        }
        if (this.st >= 950) this.toIdle(500);
        break;
      }
      case "tossWind": {
        if (this.st >= this.tk(450)) {
          this.setState("toss");
          this.bagsLeft = 3;
        }
        break;
      }
      case "toss": {
        const k = Math.floor(this.st / 260);
        this.pose(k % 2 === 0 ? BF.throw : BF.toss);
        if (this.bagsLeft > 0 && this.st >= (3 - this.bagsLeft) * 260 + 60) {
          this.bagsLeft--;
          const tx = p.x + rand(-26, 26) + p.vx * 0.5;
          const ty = Phaser.Math.Clamp(p.y + rand(-14, 14), Y_MIN, Y_MAX);
          this.w.tossBag(this.x + this.facing * 26, this.y, 92, tx, ty);
          Audio.sfx("whoosh");
        }
        if (this.st >= 900) this.toRecover(400, BF.idle[0]);
        break;
      }
      case "burst": {
        if (this.st >= 420) this.toIdle(200);
        break;
      }
      case "recover":
      case "hurt": {
        this.vx *= Math.pow(0.01, s);
        this.x += this.vx * s;
        if (this.st >= this.recoverMs) this.toIdle(rand(150, 350));
        break;
      }
      case "kdAir": {
        this.x += this.vx * s;
        if (this.physicsZ(dt)) {
          this.w.sc.shake(0.01, 200);
          this.w.fx.dust(this.x - 20, this.y, true);
          this.w.fx.dust(this.x + 20, this.y);
          Audio.sfx("land");
          this.vx = 0;
          this.vz = 0;
          this.setState(this.hp <= 0 ? "dead" : "down");
          this.pose(BF.lying);
        }
        break;
      }
      case "down": {
        if (this.st > 1100) {
          this.setState("getup");
          this.pose(BF.getup);
        }
        break;
      }
      case "getup": {
        if (this.st > 520) {
          this.invul = 900;
          this.blinkMs = 900;
          this.setState("laugh");
          this.pose(BF.taunt);
          this.stagger = 0;
          this.recentHits = 0;
        }
        break;
      }
      case "dead":
        break;
      default:
        break;
    }
    // may enter from off-screen, but once visible the boss always stays within reach
    const cx = this.w.camX;
    if (!this.onScreen && this.x > cx + 24 && this.x < cx + 296) this.onScreen = true;
    this.x = this.onScreen ? Phaser.Math.Clamp(this.x, cx + 20, cx + 300) : Phaser.Math.Clamp(this.x, cx - 60, cx + 380);
    this.updateAnim(dt);
    this.sync();
    this.post();
    this.warn.setVisible(showWarn && Math.floor(this.st / 90) % 2 === 0);
    if (showWarn) this.warn.setPosition(Math.round(this.x), Math.round(this.y - this.z - 118));
  }

  /** phase tint after sync */
  private post() {
    if (this.flash <= 0 && this.phase === 3 && this.state !== "dead") this.spr.setTint(0xffb8b8);
  }

  private stepTo(tx: number, ty: number, s: number, sp: number): boolean {
    const dx = tx - this.x;
    const dy = ty - this.y;
    let moved = false;
    if (Math.abs(dx) > 2) {
      this.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * s);
      moved = true;
    }
    if (Math.abs(dy) > 1.5) {
      this.y = Phaser.Math.Clamp(this.y + Math.sign(dy) * Math.min(Math.abs(dy), sp * 0.7 * s), Y_MIN, Y_MAX);
      moved = true;
    }
    if (moved) this.play(BF.walk, 7);
    return !moved;
  }

  private toIdle(think: number) {
    this.setState("idle");
    this.thinkT = this.phase === 3 ? think * 0.6 : think;
    this.play(BF.idle, 3);
  }

  private toRecover(ms: number, frame: number) {
    this.setState("recover");
    this.recoverMs = this.tk(ms);
    this.pose(frame);
  }

  private decide() {
    const p = this.w.player;
    const adx = Math.abs(p.x - this.x);
    const ady = Math.abs(p.y - this.y);
    this.facing = dirTo(this.x, p.x);
    if (p.isDown) {
      // let SCAMBOY get up — gloat instead of hitting a man while he's down
      if (Math.random() < 0.35) {
        this.setState("laugh");
        this.pose(BF.taunt);
      } else this.toIdle(350);
      return;
    }
    if (this.phase >= 2 && this.summonCd <= 0 && this.w.enemyCount() < 2) {
      this.summonCd = this.phase === 3 ? 13000 : 16000;
      this.setState("whistle");
      this.pose(BF.whistle);
      return;
    }
    if (adx < 66 && ady < 12) {
      if (p.canBeGrabbed && Math.random() < 0.4) {
        this.setState("grabWind");
        this.pose(BF.taunt);
      } else {
        this.setState("punchWind");
        this.pose(BF.punchWind);
      }
      return;
    }
    const r = Math.random();
    if (this.phase === 3 && this.tossCd <= 0 && r < 0.3) {
      this.tossCd = 6000;
      this.setState("tossWind");
      this.pose(BF.toss);
      return;
    }
    if (r < 0.35) {
      this.setState("align");
      this.play(BF.walk, 7);
      return;
    }
    if (r < 0.65) {
      this.setState("slamUp");
      this.pose(BF.slamUp);
      Audio.sfx("alarm");
      return;
    }
    this.setState("walk");
  }

  takeHit(def: AttackDef, dir: number): boolean {
    if (!this.hittable) return false;
    this.hp = Math.max(0, this.hp - def.dmg);
    this.hitFlash(70);
    this.freeze = Math.round(def.stop * 0.8);
    const oldPhase = this.phase;
    this.phase = this.hp > this.maxHp * 0.6 ? 1 : this.hp > this.maxHp * 0.3 ? 2 : 3;
    if (this.phase !== oldPhase) {
      this.w.fx.word(this.x, this.y - 120, this.phase === 3 ? "FURIOUS!" : "ANGRY!", 0xff5a5a, 16, true);
      this.summonCd = Math.min(this.summonCd, 800);
    }
    if (this.hp <= 0) {
      if (!this.ko) {
        this.ko = true;
        this.setState("kdAir");
        this.vz = 260;
        this.vx = dir * 120;
        this.z = 0.1;
        this.pose(BF.kdAir);
        this.facing = dir > 0 ? -1 : 1;
        this.w.onDefeated(this);
      }
      return true;
    }
    if (ARMORED.has(this.state)) return true;
    this.recentHits++;
    this.recentT = 1800;
    this.stagger += def.dmg;
    if (def.breaker && this.stagger >= 24) {
      this.stagger = 0;
      this.recentHits = 0;
      this.setState("kdAir");
      this.vz = 200;
      this.vx = dir * 90;
      this.z = 0.1;
      this.facing = dir > 0 ? -1 : 1;
      this.pose(BF.kdAir);
      return true;
    }
    if (this.recentHits >= 6) {
      // shrug it off with a burst that shoves SCAMBOY away
      this.recentHits = 0;
      this.setState("burst");
      this.pose(BF.slamDown);
      this.w.fx.ring("slam", this.x, this.y, 300);
      this.w.sc.shake(0.006, 120);
      Audio.sfx("heavyHit");
      const p = this.w.player;
      if (Math.abs(p.x - this.x) < 70 && Math.abs(p.y - this.y) < 22) this.w.hitPlayerArea(this, { ...B_SLAM_DIRECT, dmg: 6, id: "b_burst" }, dirTo(this.x, p.x));
      return true;
    }
    this.setState("hurt");
    this.recoverMs = 240;
    this.vx = dir * 40;
    this.pose(Math.random() < 0.5 ? BF.hurt[0] : BF.hurt[1]);
    return true;
  }

  destroy() {
    this.warn.destroy();
    super.destroy();
  }
}
