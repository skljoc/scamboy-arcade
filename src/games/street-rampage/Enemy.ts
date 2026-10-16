/**
 * Street gang AI. Every enemy runs the same state machine (enter → think → approach / hover →
 * windup → attack → recover, plus hurt / knockdown / get-up) with per-kind attacks:
 *  - thug: 1-2 punch jabs; kickers add a flying kick from mid range
 *  - punk: close knife slash + long telegraphed dash-slash
 *  - brute: super armour, slow overhead hammer, belly charge
 *  - rex (miniboss): armoured pipe combos, leap slam with shockwave, running tackle, rage mode
 * Only a limited number of enemies hold an "attack token" at once; the rest circle at a
 * distance, which keeps fights readable.
 */
import { Audio } from "../engine/AudioManager";
import { Fighter, dirTo, rand, pick, type World } from "./Fighter";
import { EF, EFRAME } from "./art";
import { TEX } from "./register";
import { ENEMIES, Y_MIN, Y_MAX, type EnemyDef, type EnemyType, type ItemKind } from "./stages";
import { E_PUNCH, E_KICK, E_SLASH, E_DASH_SLASH, E_HAMMER, E_BELLY, E_PIPE, E_PIPE_SLAM, E_TACKLE, type AttackDef } from "./combat";

type Move = "main" | "alt" | "alt2";

export class Enemy extends Fighter {
  readonly type: Exclude<EnemyType, "boss">;
  readonly def: EnemyDef;
  readonly kind: EnemyDef["kind"];
  drop?: ItemKind;
  hasToken = false;
  private armorLeft = 0;
  private armorRegen = 0;
  private thinkT = 0;
  private tx = 0;
  private ty = 0;
  private side: 1 | -1 = 1;
  private move: Move = "main";
  private repeat = 0;
  private juggles = 0;
  private hurtAlt = false;
  private approachT = 0;
  private recoverMs = 300;
  private dustT = 0;
  /** the enemy is currently in an attack's active frames */
  attacking = false;
  enterX = 0;
  bossLike: boolean;
  rage = false;
  private ko = false;
  /** set once the enemy has walked onto the screen; from then on it stays reachable */
  private onScreen = false;

  constructor(w: World, type: Exclude<EnemyType, "boss">, x: number, y: number, z: number, drop?: ItemKind) {
    const def = ENEMIES[type];
    const look = pick(def.looks);
    super(w, TEX.enemy(look), def.kind === "brute" || def.kind === "rex" ? TEX.shadowM : TEX.shadowS, EFRAME.ay / EFRAME.h);
    this.type = type;
    this.def = def;
    this.kind = def.kind;
    this.drop = drop;
    this.x = x;
    this.y = y;
    this.z = z;
    this.hw = def.hw;
    this.h = def.h;
    this.hp = this.maxHp = def.hp;
    this.armorLeft = def.armor;
    this.name = pick(def.names);
    this.bossLike = def.kind === "rex";
    this.facing = dirTo(x, w.player.x);
    this.side = x < w.player.x ? -1 : 1;
    if (z > 0) {
      this.setState("drop");
      this.pose(EF.jump);
    } else {
      this.setState("enter");
      this.play(EF.walk, 9);
    }
  }

  get downed() {
    return this.state === "down" || this.state === "getup" || this.state === "dead";
  }

  get hittable() {
    return this.alive && !this.downed && this.invul <= 0 && this.state !== "drop";
  }

  private speedK() {
    return this.rage ? 1.3 : 1;
  }

  private releaseToken() {
    if (this.hasToken) {
      this.w.releaseToken(this);
      this.hasToken = false;
    }
  }

  update(dt: number) {
    if (!this.tick(dt)) {
      this.sync();
      return;
    }
    const s = dt / 1000;
    const p = this.w.player;
    if (this.armorRegen > 0) {
      this.armorRegen -= dt;
      if (this.armorRegen <= 0) this.armorLeft = this.def.armor;
    }
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const adx = Math.abs(dx);
    const playerUp = p.alive && p.state !== "dead";

    switch (this.state) {
      case "drop": {
        if (this.physicsZ(dt)) {
          this.w.fx.dust(this.x, this.y);
          Audio.sfx("land");
          this.setState("land");
          this.pose(EF.windup2);
        }
        break;
      }
      case "land": {
        if (this.st > 220) this.toIdle(200);
        break;
      }
      case "enter": {
        const d = this.enterX - this.x;
        this.facing = d >= 0 ? 1 : -1;
        this.play(EF.walk, 9);
        this.x += Math.sign(d) * this.def.speed * 1.1 * s;
        if (Math.abs(d) < 3 || this.st > 3500) {
          if (this.bossLike) {
            this.setState("taunt");
            this.play([EF.taunt], 1, false);
            Audio.sfx("horn");
          } else this.toIdle(rand(100, 400));
        }
        break;
      }
      case "taunt": {
        this.facing = dirTo(this.x, p.x);
        if (this.st > 900) this.toIdle(100);
        break;
      }
      case "idle": {
        this.facing = dirTo(this.x, p.x);
        this.play(EF.idle, 4);
        this.thinkT -= dt;
        if (this.thinkT <= 0 && playerUp) this.decide(adx, Math.abs(dy));
        break;
      }
      case "approach": {
        this.approachT += dt;
        this.facing = dirTo(this.x, p.x);
        const reach = this.reach();
        this.tx = p.x - Math.sign(dx || 1) * reach;
        this.ty = p.y;
        this.walkTo(s, 1);
        if (Math.abs(this.x - this.tx) < 6 && Math.abs(p.y - this.y) < 4) {
          this.facing = dirTo(this.x, p.x);
          this.startMove("main");
        } else if (this.approachT > 2600 || !playerUp) {
          this.releaseToken();
          this.toIdle(300);
        }
        break;
      }
      case "hover": {
        this.facing = dirTo(this.x, p.x);
        const done = this.walkTo(s, 0.75);
        if (done || this.st > 1800) {
          if (Math.random() < 0.25 && !this.bossLike) {
            this.setState("taunt");
            this.play([EF.taunt], 1, false);
          } else this.toIdle(rand(this.def.think[0], this.def.think[1]));
        }
        break;
      }
      case "windup": {
        this.attackWindup(dt);
        break;
      }
      case "attack": {
        this.attackActive(dt, s);
        break;
      }
      case "recover": {
        this.vx *= Math.pow(0.002, s);
        this.x += this.vx * s;
        if (this.st >= this.recoverMs) {
          this.releaseToken();
          this.toIdle(rand(this.def.think[0], this.def.think[1]) * (this.rage ? 0.5 : 1));
        }
        break;
      }
      case "hurt": {
        this.vx *= Math.pow(0.0015, s);
        this.x += this.vx * s;
        this.clampBand();
        if (this.st >= this.recoverMs) this.toIdle(rand(150, 400));
        break;
      }
      case "kdAir": {
        this.x += this.vx * s;
        this.clampBand();
        if (this.physicsZ(dt)) {
          if (this.vz < -170) {
            this.vz = -this.vz * 0.3;
            this.vx *= 0.45;
            this.z = 0.1;
            this.w.fx.dust(this.x, this.y);
            Audio.sfx("land");
          } else {
            this.vz = 0;
            this.vx = 0;
            this.hitSet.clear();
            if (this.hp <= 0) {
              this.setState("dead");
              this.invul = 99999;
            } else this.setState("down");
            this.pose(EF.lying);
          }
        }
        break;
      }
      case "down": {
        if (this.st > (this.kind === "brute" ? 900 : 700)) {
          this.setState("getup");
          this.pose(EF.getup);
        }
        break;
      }
      case "getup": {
        if (this.st > 380) {
          this.invul = 450;
          this.blinkMs = 450;
          this.juggles = 0;
          this.toIdle(this.bossLike ? 120 : rand(250, 600));
        }
        break;
      }
      case "dead": {
        if (this.st > 950) {
          this.alive = false;
          this.destroy();
        }
        break;
      }
      default:
        break;
    }
    this.updateAnim(dt);
    this.sync();
    if (this.state === "dead") this.spr.setVisible(Math.floor(this.st / 60) % 2 === 0);
    // telegraph flash during long windups
    if (this.state === "windup" && (this.kind === "brute" || this.bossLike) && Math.floor(this.st / 80) % 2 === 0 && this.flash <= 0) this.spr.setTint(0xffb0b0);
    else if (this.flash <= 0) this.spr.clearTint();
  }

  private toIdle(think: number) {
    this.setState("idle");
    this.thinkT = think;
    this.play(EF.idle, 4);
    this.attacking = false;
  }

  private reach() {
    switch (this.kind) {
      case "brute":
        return 30;
      case "rex":
        return 34;
      case "punk":
        return 28;
      default:
        return 24;
    }
  }

  private clampBand() {
    if (this.y < Y_MIN) this.y = Y_MIN;
    if (this.y > Y_MAX) this.y = Y_MAX;
    const cx = this.w.camX;
    if (!this.onScreen && this.x > cx + 16 && this.x < cx + 304) this.onScreen = true;
    // enemies may enter from just off-screen, but never retreat out of the player's reach
    const x0 = this.onScreen ? cx + 12 : cx - 40;
    const x1 = this.onScreen ? cx + 308 : cx + 360;
    if (this.x < x0) this.x = x0;
    if (this.x > x1) this.x = x1;
  }

  /** move toward (tx, ty); returns true when arrived */
  private walkTo(s: number, k: number): boolean {
    const sp = this.def.speed * k * this.speedK();
    const ddx = this.tx - this.x;
    const ddy = this.ty - this.y;
    let moved = false;
    if (Math.abs(ddx) > 2) {
      this.x += Math.sign(ddx) * Math.min(Math.abs(ddx), sp * s);
      moved = true;
    }
    if (Math.abs(ddy) > 1.5) {
      this.y += Math.sign(ddy) * Math.min(Math.abs(ddy), sp * 0.7 * s);
      moved = true;
    }
    this.clampBand();
    if (moved) this.play(EF.walk, 9);
    else this.play(EF.idle, 4);
    return !moved;
  }

  private decide(adx: number, ady: number) {
    const p = this.w.player;
    const k = this.kind;
    // special moves from mid range
    const aligned = ady < 9;
    const canAlt =
      (k === "punk" && aligned && adx > 60 && adx < 150) ||
      (k === "brute" && aligned && adx > 70 && adx < 160) ||
      (this.type === "kicker" && ady < 7 && adx > 45 && adx < 95) ||
      (k === "rex" && adx > 50 && adx < 170);
    if (canAlt && Math.random() < (k === "rex" ? 0.55 : 0.6) && (this.bossLike || this.w.requestToken(this))) {
      if (!this.bossLike) this.hasToken = true;
      this.facing = dirTo(this.x, p.x);
      this.startMove(k === "rex" && (Math.random() < 0.5 || !aligned) ? "alt2" : "alt");
      return;
    }
    if (this.bossLike || this.hasToken || this.w.requestToken(this)) {
      if (!this.bossLike) this.hasToken = true;
      this.setState("approach");
      this.approachT = 0;
      return;
    }
    // hover around the player at a distance, flanking
    if (Math.random() < 0.3) this.side = this.side === 1 ? -1 : 1;
    const dist = 62 + Math.random() * 40;
    this.tx = p.x + this.side * dist;
    this.ty = Math.max(Y_MIN, Math.min(Y_MAX, p.y + rand(-28, 28)));
    const cx0 = this.w.camX + 14;
    const cx1 = this.w.camX + 306;
    if (this.tx < cx0 || this.tx > cx1) {
      this.side = this.side === 1 ? -1 : 1;
      this.tx = Math.max(cx0, Math.min(cx1, p.x + this.side * dist));
    }
    this.setState("hover");
  }

  private startMove(m: Move) {
    this.move = m;
    this.hitSet.clear();
    this.setState("windup");
    this.repeat = 0;
    this.vx = 0;
    const k = this.kind;
    if (m === "main") this.pose(EF.windup);
    else if (k === "rex" && m === "alt2") this.pose(EF.taunt);
    else this.pose(EF.windup2);
    if (m !== "main" && (k === "punk" || k === "rex" || k === "brute")) Audio.sfx("whoosh");
  }

  private windupMs(): number {
    const r = this.rage ? 0.72 : 1;
    const k = this.kind;
    if (this.move === "main") {
      if (k === "brute") return 540;
      if (k === "rex") return (this.repeat > 0 ? 170 : 330) * r;
      if (k === "punk") return 300;
      return this.type === "thugFast" ? (this.repeat > 0 ? 120 : 210) : this.repeat > 0 ? 160 : 280;
    }
    if (k === "punk") return 440;
    if (k === "brute") return 520;
    if (k === "rex") return 400 * r;
    return 240;
  }

  private attackWindup(dt: number) {
    const p = this.w.player;
    if (this.st < 60) this.facing = dirTo(this.x, p.x);
    if (this.kind === "punk" && this.move === "alt" && Math.floor(this.st / 110) !== Math.floor((this.st - dt) / 110)) {
      this.w.fx.sparkle(this.x + this.facing * 16, this.y - this.z - 30, 10 + this.y + 1);
    }
    if (this.st < this.windupMs()) return;
    this.setState("attack");
    this.hitSet.clear();
    this.attacking = true;
    const k = this.kind;
    if (this.move === "main") {
      this.pose(EF.hit);
      Audio.sfx(k === "brute" ? "whoosh" : "punch");
    } else if (k === "punk") {
      this.pose(EF.hit2);
      this.vx = this.facing * 290;
      Audio.sfx("whoosh");
    } else if (k === "brute") {
      this.pose(EF.dash);
      this.vx = this.facing * 215;
      Audio.sfx("whoosh");
    } else if (k === "rex" && this.move === "alt") {
      // leap slam toward the player
      this.pose(EF.jump);
      this.vz = 360;
      const t = 0.72;
      this.vx = Math.max(-230, Math.min(230, (p.x - this.x) / t));
      this.vy = Math.max(-80, Math.min(80, (p.y - this.y) / t));
      Audio.sfx("jump");
    } else if (k === "rex") {
      this.pose(EF.dash);
      this.vx = this.facing * 250;
      Audio.sfx("whoosh");
    } else {
      // flying kick
      this.pose(EF.hit2);
      this.vz = 250;
      this.vx = this.facing * 150;
      Audio.sfx("jump");
    }
  }

  private mainAtk(): AttackDef {
    switch (this.kind) {
      case "brute":
        return E_HAMMER;
      case "punk":
        return E_SLASH;
      case "rex":
        return E_PIPE;
      default:
        return E_PUNCH;
    }
  }

  private attackActive(dt: number, s: number) {
    const k = this.kind;
    if (this.move === "main") {
      if (this.st < 110) {
        if (this.w.attackPlayer(this, this.mainAtk())) this.onConnect();
      }
      if (k === "brute" && this.st >= 40 && this.st - dt < 40) {
        this.w.sc.shake(0.004, 100);
        this.w.fx.dust(this.x + this.facing * 26, this.y);
      }
      if (this.st >= 160) {
        this.attacking = false;
        const again = (this.type === "thugFast" && this.repeat === 0) || (k === "rex" && this.repeat === 0 && Math.random() < 0.5) || (k === "thug" && this.repeat === 0 && Math.random() < 0.3);
        if (again) {
          this.repeat++;
          this.hitSet.clear();
          this.setState("windup");
          this.pose(EF.windup);
          return;
        }
        this.toRecover(k === "brute" ? 520 : k === "rex" ? 380 : 300, EF.recover);
      }
      return;
    }
    if (k === "punk" || k === "brute" || (k === "rex" && this.move === "alt2")) {
      // dash attacks
      const atk = k === "punk" ? E_DASH_SLASH : k === "brute" ? E_BELLY : E_TACKLE;
      const dur = k === "punk" ? 380 : k === "brute" ? 640 : 600;
      this.x += this.vx * s;
      this.clampBand();
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 80;
        this.w.fx.dust(this.x - this.facing * 10, this.y, this.facing < 0);
      }
      if (this.w.attackPlayer(this, atk)) this.onConnect();
      const atEdge = (this.vx < 0 && this.x <= this.w.camX + 14) || (this.vx > 0 && this.x >= this.w.camX + 306);
      if (this.st >= dur || atEdge) {
        this.attacking = false;
        this.toRecover(k === "punk" ? 480 : 560, k === "punk" ? EF.recover : EF.windup2);
      }
      return;
    }
    // airborne attacks (kick / leap slam)
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.clampBand();
    if (k === "rex") {
      if (this.vz < 60) this.pose(EF.hit2);
    } else if (this.w.attackPlayer(this, E_KICK)) this.onConnect();
    if (this.physicsZ(dt)) {
      this.vz = 0;
      this.vy = 0;
      this.attacking = false;
      if (k === "rex") {
        this.w.sc.shake(0.008, 160);
        Audio.sfx("heavyHit");
        this.w.fx.ring("slam", this.x, this.y, 380);
        this.w.fx.dust(this.x - 14, this.y, true);
        this.w.fx.dust(this.x + 14, this.y);
        const p = this.w.player;
        if (Math.abs(p.x - this.x) < 46 && Math.abs(p.y - this.y) < 16 && p.z < 10) this.w.hitPlayerArea(this, E_PIPE_SLAM, dirTo(this.x, p.x));
        this.toRecover(560, EF.hit2);
      } else {
        this.w.fx.dust(this.x, this.y);
        this.toRecover(380, EF.windup2);
      }
    }
  }

  private onConnect() {
    // hitstop on the attacker too
    this.freeze = 60;
  }

  private toRecover(ms: number, frame: number) {
    this.setState("recover");
    this.recoverMs = ms * (this.rage ? 0.7 : 1);
    this.vx = this.kind === "punk" ? this.vx * 0.5 : 0;
    this.pose(frame);
  }

  /** player / hazard hit. Returns true if it registered. */
  takeHit(def: AttackDef, dir: number): boolean {
    if (!this.alive || this.downed || this.invul > 0 || this.state === "drop") return false;
    if (this.state === "kdAir") {
      if (this.juggles >= 2) return false;
      this.juggles++;
      this.hp -= Math.ceil(def.dmg * 0.7);
      if (this.hp <= 0 && !this.ko) {
        this.ko = true;
        this.w.onDefeated(this);
        Audio.sfx("ko");
      }
      this.vz = 170;
      this.vx = dir * Math.max(80, def.kb * 0.6) * this.def.weight;
      this.freeze = def.stop;
      this.hitFlash(80);
      return true;
    }
    this.hp -= def.dmg;
    this.hitFlash(80);
    this.freeze = def.stop;
    this.attacking = false;
    const armored = !def.breaker && this.armorLeft > 0 && this.state !== "hurt" && this.hp > 0;
    if (armored) {
      this.armorLeft--;
      this.armorRegen = 1300;
      this.freeze = Math.round(def.stop * 0.6);
      return true;
    }
    this.releaseToken();
    if (this.bossLike && this.hp > 0 && this.hp < this.maxHp * 0.5 && !this.rage) {
      this.rage = true;
      this.w.fx.word(this.x, this.y - 70, "RAGE!", 0xff5a5a, 16, true);
    }
    if (this.hp <= 0 || def.lift > 0) {
      this.setState("kdAir");
      this.vz = Math.max(def.lift, this.hp <= 0 ? 240 : 0);
      this.vx = dir * Math.max(def.kb, this.hp <= 0 ? 160 : 80) * this.def.weight;
      this.z = Math.max(this.z, 0.1);
      this.facing = dir > 0 ? -1 : 1;
      this.pose(EF.kdAir);
      this.hitSet.clear();
      if (this.hp <= 0 && !this.ko) {
        this.ko = true;
        this.w.onDefeated(this);
        Audio.sfx("ko");
      }
    } else {
      this.setState("hurt");
      this.recoverMs = def.stun * (this.kind === "brute" ? 0.7 : 1);
      this.vx = dir * def.kb * this.def.weight;
      this.hurtAlt = !this.hurtAlt;
      this.pose(this.hurtAlt ? EF.hurt[0] : EF.hurt[1]);
      this.facing = dir > 0 ? -1 : 1;
    }
    return true;
  }

  /** is this enemy flying fast enough to bowl over others? */
  get bowling() {
    return this.state === "kdAir" && Math.abs(this.vx) > 140 && this.z > 2;
  }

  destroy() {
    this.releaseToken();
    super.destroy();
  }
}
