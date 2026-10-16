/**
 * STREET RAMPAGE stage scene: parallax street, camera locks per wave with a flashing GO
 * arrow, wave spawning, the attack-token director, hit resolution, hazards, pickups,
 * stage title cards, stage clear, continue / game over and the champion ending.
 */
import * as Phaser from "phaser";
import { BaseScene, W, H } from "../engine/BaseScene";
import { Audio } from "../engine/AudioManager";
import { Arcade } from "../engine/bridge";
import { PAL } from "../engine/palette";
import { Fighter, dirTo, rand, pick, type World } from "./Fighter";
import { Player } from "./Player";
import { Enemy } from "./Enemy";
import { Boss } from "./Boss";
import { Effects } from "./Effects";
import { Hud } from "./Hud";
import { Destructible, Pickup, Car, RollingBarrel, FallingPot, MoneyBag, ShockRing } from "./Props";
import { registerCommon, registerEnemies, registerBackground, TEX } from "./register";
import { BG_OFFSETS, FAR_F, MID_F, FACADE_TOP, GROUND_TOP } from "./bgArt";
import { PF } from "./art";
import {
  hits,
  inEllipse,
  onRing,
  P_FLEX,
  FLEX_RX,
  FLEX_RY,
  H_CAR,
  H_BARREL,
  H_POT,
  H_DEBRIS,
  B_BAG,
  B_SHOCK,
  SCORE,
  type AttackDef,
} from "./combat";
import {
  STAGES,
  ENEMIES,
  ITEM_INFO,
  PROP_INFO,
  Y_MIN,
  Y_MAX,
  type StageDef,
  type Spawn,
  type EnemyType,
  type ItemKind,
  type HazardSpec,
} from "./stages";

export interface RunData {
  stage: number;
  score: number;
  lives: number;
  credits: number;
  hp?: number;
  power?: number;
}

type Phase = "card" | "play" | "clear" | "continue" | "gameover" | "victory";

const HIT_WORDS = ["POW!", "BAM!", "WHAM!"];
const WORD_COLORS = [PAL.yellow, 0xff8a3a, PAL.magentaLight, 0x5ad8ff];
const BOWL: AttackDef = { ...H_DEBRIS, id: "bowl", dmg: 7 };
const RESPAWN_PUSH: AttackDef = { ...P_FLEX, id: "respawn", dmg: 0 };

export class StreetRampageScene extends BaseScene implements World {
  protected textYOffset = -4;
  constructor() {
    super("SR_Stage");
  }

  // ---- World
  get sc(): BaseScene {
    return this;
  }
  now = 0;
  fx!: Effects;
  stage!: StageDef;
  camX = 0;
  player!: Player;

  enemies: Enemy[] = [];
  boss: Boss | null = null;
  private props: Destructible[] = [];
  private pickups: Pickup[] = [];
  private cars: Car[] = [];
  private barrels: RollingBarrel[] = [];
  private pots: FallingPot[] = [];
  private bags: MoneyBag[] = [];
  private rings: ShockRing[] = [];
  private hud!: Hud;
  private run!: RunData;
  private score = 0;
  private phase: Phase = "card";
  private timeScale = 1;
  private slowT = 0;
  private waveIdx = 0;
  private waveActive = false;
  private queue: Spawn[] = [];
  private waveT = 0;
  private camMin = 0;
  private tokens = new Set<Fighter>();
  private hazards: Array<{ spec: HazardSpec; t: number }> = [];
  private zoneT = 1500;
  private goImg!: Phaser.GameObjects.Image;
  private goUntil = -1;
  private firstPunch = false;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private phaseT = 0;
  private finished = false;
  private countdown = 9;
  private countT = 0;
  private countTxt: Phaser.GameObjects.Text | null = null;
  private victoryStep = 0;
  private bossRef: Fighter | null = null;
  private clearBonus = 0;
  private hudBoss = false;

  init(data: Partial<RunData>) {
    this.run = {
      stage: data.stage ?? 0,
      score: data.score ?? 0,
      lives: data.lives ?? 3,
      credits: data.credits ?? 2,
      hp: data.hp,
      power: data.power,
    };
    // reset per-run state (scene instances are reused between restarts)
    this.enemies = [];
    this.boss = null;
    this.props = [];
    this.pickups = [];
    this.cars = [];
    this.barrels = [];
    this.pots = [];
    this.bags = [];
    this.rings = [];
    this.tokens = new Set();
    this.hazards = [];
    this.overlay = [];
    this.now = 0;
    this.camX = 0;
    this.camMin = 0;
    this.waveIdx = 0;
    this.waveActive = false;
    this.queue = [];
    this.timeScale = 1;
    this.slowT = 0;
    this.goUntil = -1;
    this.finished = false;
    this.victoryStep = 0;
    this.bossRef = null;
    this.countTxt = null;
    this.hudBoss = false;
    this.firstPunch = !!Arcade.progress().achievements["first-punch"];
  }

  create() {
    this.stage = STAGES[Math.min(this.run.stage, STAGES.length - 1)];
    const st = this.stage;
    this.score = this.run.score;
    Arcade.setScore(this.score);
    Arcade.progress().setRampageBestStage(st.n);

    registerCommon(this);
    const looks = new Set<string>();
    for (const w of st.waves)
      for (const s of w.spawns) {
        if (s.type !== "boss") ENEMIES[s.type].looks.forEach((l) => looks.add(l));
      }
    const hasBoss = st.waves.some((w) => w.spawns.some((s) => s.type === "boss"));
    if (hasBoss) ["thugA", "thugB", "thugC", "punkA", "punkB"].forEach((l) => looks.add(l));
    registerEnemies(this, [...looks], hasBoss);
    registerBackground(this, st.theme, st.worldW);

    const off = BG_OFFSETS[st.theme];
    this.add.image(0, 0, TEX.bg(st.theme, "sky")).setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.add.image(0, off.farY, TEX.bg(st.theme, "far")).setOrigin(0).setScrollFactor(FAR_F, 0).setDepth(-90);
    this.add.image(0, off.midY, TEX.bg(st.theme, "mid")).setOrigin(0).setScrollFactor(MID_F, 0).setDepth(-80);
    this.add.image(0, FACADE_TOP, TEX.bg(st.theme, "near")).setOrigin(0).setScrollFactor(1, 0).setDepth(-70);
    this.add.image(0, GROUND_TOP, TEX.bg(st.theme, "ground")).setOrigin(0).setScrollFactor(1, 0).setDepth(-60);

    this.fx = new Effects(this);
    for (const p of st.props) this.props.push(new Destructible(this, p));

    this.player = new Player(this, 70, 236);
    this.player.lives = this.run.lives;
    if (this.run.hp !== undefined) this.player.hp = Math.max(40, this.run.hp);
    if (this.run.power !== undefined) this.player.power = this.run.power;
    this.player.onFlex = (x, y) => this.flexBlast(x, y);

    this.hud = new Hud(this, st.n);
    this.goImg = this.add.image(276, 112, TEX.go).setScrollFactor(0).setDepth(19000).setVisible(false);

    this.cameras.main.setScroll(0, 0);
    this.showTitleCard();
    Audio.playMusic("rampage");
    this.player.sync();
  }

  // ------------------------------------------------------------------ World API

  addScore(n: number) {
    if (n <= 0) return;
    this.score += n;
    Arcade.setScore(this.score);
  }

  requestToken(f: Fighter): boolean {
    if (this.tokens.has(f)) return true;
    if (this.tokens.size >= this.stage.maxAttackers) return false;
    this.tokens.add(f);
    return true;
  }

  releaseToken(f: Fighter) {
    this.tokens.delete(f);
  }

  enemyCount() {
    return this.enemies.filter((e) => e.alive && e.hp > 0).length;
  }

  spawnEnemy(type: EnemyType, side: "L" | "R" | "T", y?: number, drop?: ItemKind) {
    const cx = this.camX;
    if (type === "boss") {
      const b = new Boss(this, cx + 400, y ?? 236);
      b.enterX = cx + 238;
      this.boss = b;
      this.bossRef = b;
      Audio.playMusic("boss");
      this.banner(b.name);
      return;
    }
    const yy = y ?? rand(Y_MIN + 4, Y_MAX - 4);
    let x = cx + 350;
    let z = 0;
    let enterX = cx + rand(228, 296);
    if (side === "L") {
      x = cx - 30;
      enterX = cx + rand(24, 92);
    } else if (side === "T") {
      x = cx + rand(60, 260);
      z = 170;
      enterX = x;
    }
    const e = new Enemy(this, type, x, yy, z, drop);
    e.enterX = enterX;
    this.enemies.push(e);
    if (e.bossLike) {
      Audio.playMusic("boss");
      this.banner(e.name);
    }
  }

  dropItem(x: number, y: number, kind: ItemKind) {
    this.pickups.push(new Pickup(this, x, Phaser.Math.Clamp(y, Y_MIN, Y_MAX), kind));
  }

  onDefeated(f: Fighter) {
    if (f instanceof Boss) {
      this.bossDefeated(f);
      return;
    }
    if (!(f instanceof Enemy)) return;
    this.addScore(f.def.score);
    const big = f.kind === "brute" || f.bossLike;
    if (big) {
      this.fx.word(f.x, f.y - 70, "KNOCKOUT!", PAL.yellow, 16, true);
      this.shake(0.008, 200);
      this.slowMo(0.35, 500);
    } else if (Math.random() < 0.35) {
      this.fx.word(f.x, f.y - 60, pick(["KO!", "BAM!", "WHAM!"]), pick(WORD_COLORS), 16);
    }
    if (f.bossLike) Audio.playMusic("rampage");
    let drop = f.drop;
    if (!drop && Math.random() < f.def.dropChance) drop = pick<ItemKind>(["burger", "cash", "cash", "watch", "shake"]);
    if (drop) this.dropItem(f.x, f.y, drop);
    Arcade.progress().addStat("rampageKOs");
  }

  bossShockwave(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) this.rings.push(new ShockRing(x, y, i * 420));
  }

  tossBag(fromX: number, fromY: number, fromZ: number, tx: number, ty: number) {
    this.bags.push(new MoneyBag(this, fromX, fromY, fromZ, tx, ty));
  }

  playerAttack(src: Player, atk: AttackDef): number {
    let n = 0;
    const victims: Array<Enemy | Boss> = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const v of victims) {
      if (!v.hittable || src.hitSet.has(v)) continue;
      if (!hits(src.x, src.y, src.z, src.facing, atk, v.body())) continue;
      const dir = src.facing;
      if (!v.takeHit(atk, dir)) continue;
      src.hitSet.add(v);
      n++;
      this.onPlayerHitEnemy(v, atk, dir);
    }
    for (const pr of this.props) {
      if (pr.broken || src.hitSet.has(pr)) continue;
      if (!hits(src.x, src.y, src.z, src.facing, atk, pr.body())) continue;
      src.hitSet.add(pr);
      n++;
      this.hitProp(pr, atk.heavy ? 2 : 1);
    }
    for (const b of this.barrels) {
      if (!b.alive || !b.rolling || src.hitSet.has(b)) continue;
      if (!hits(src.x, src.y, src.z, src.facing, atk, { x: b.x, y: b.y, z: 0, hw: 9, h: 18 })) continue;
      src.hitSet.add(b);
      n++;
      this.fx.debrisBurst(b.x, b.y, 8, [2, 3, 2, 3], 1);
      this.fx.spark(b.x, b.y - 12, true);
      Audio.sfx("break");
      this.addScore(SCORE.object);
      b.kill();
    }
    if (n > 0) src.freeze = atk.stop;
    return n;
  }

  attackPlayer(src: Fighter, atk: AttackDef): boolean {
    const p = this.player;
    if (!p.vulnerable || src.hitSet.has(p)) return false;
    if (!hits(src.x, src.y, src.z, src.facing, atk, p.body())) return false;
    return this.damagePlayer(src, atk, src.facing);
  }

  hitPlayerArea(src: Fighter | null, atk: AttackDef, dir: number): boolean {
    return this.damagePlayer(src, atk, dir);
  }

  // ------------------------------------------------------------------ combat helpers

  private damagePlayer(src: Fighter | null, atk: AttackDef, dir: number): boolean {
    const p = this.player;
    if (src && src.hitSet.has(p)) return false;
    if (!p.takeHit(atk, dir)) return false;
    src?.hitSet.add(p);
    this.fx.spark(p.x - dir * 4, p.y - p.z - 30, !!atk.heavy);
    Audio.sfx(atk.heavy ? "heavyHit" : "hit");
    this.hud.react("shock", 500);
    if (atk.heavy) this.shake(0.006, 120);
    return true;
  }

  private onPlayerHitEnemy(v: Enemy | Boss, atk: AttackDef, dir: number) {
    const heavy = !!atk.heavy;
    this.fx.spark(v.x - dir * (v.hw - 4), v.y - v.z - v.h * 0.62, heavy);
    Audio.sfx(heavy ? "heavyHit" : "hit");
    this.addScore(heavy ? SCORE.heavy : SCORE.hit);
    this.player.power = Math.min(100, this.player.power + (heavy ? 7 : 4));
    if (heavy) {
      this.shake(0.005, 90);
      this.fx.word(v.x, v.y - v.h - 14, pick(HIT_WORDS), pick(WORD_COLORS));
    } else if (Math.random() < 0.18) this.fx.word(v.x, v.y - v.h - 10, "POW!", PAL.yellow, 8);
    if (!this.firstPunch) {
      this.firstPunch = true;
      Arcade.achieve("first-punch");
    }
    if (!this.activeBoss()) this.hud.showEnemy(v, v.name, v.hp, v.maxHp, false);
  }

  /** the boss or miniboss currently on screen (its bar stays up) */
  private activeBoss(): Enemy | Boss | null {
    if (this.boss && this.boss.alive && this.boss.state !== "intro") return this.boss;
    return this.enemies.find((e) => e.bossLike && e.alive && e.state !== "enter") ?? null;
  }

  private hitProp(pr: Destructible, times: number) {
    let broke = false;
    for (let i = 0; i < times && !pr.broken; i++) broke = pr.hit();
    this.fx.spark(pr.x, pr.y - PROP_INFO[pr.kind].h * 0.6, false);
    if (broke) {
      Audio.sfx("break");
      this.fx.debrisBurst(pr.x, pr.y, 10, PROP_INFO[pr.kind].debris, pr.kind === "booth" || pr.kind === "vending" ? 1.3 : 1);
      this.fx.dust(pr.x, pr.y);
      this.addScore(SCORE.object);
      if (pr.drop) this.dropItem(pr.x, pr.y + 2, pr.drop);
    } else Audio.sfx("hit");
  }

  private flexBlast(x: number, y: number) {
    this.fx.ring("flex", x, y, 380);
    this.shake(0.012, 260);
    this.fx.word(x, y - 70, "FLEX!", PAL.magentaLight, 16, true);
    this.hud.react("grin", 900);
    for (let i = 0; i < 6; i++) this.fx.sparkle(x + rand(-30, 30), y - rand(20, 70));
    let count = 0;
    const victims: Array<Enemy | Boss> = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const v of victims) {
      if (!v.hittable || v.z > 90) continue;
      if (!inEllipse(x, y, FLEX_RX, FLEX_RY, v.x, v.y)) continue;
      const dir = dirTo(x, v.x);
      if (v.takeHit(P_FLEX, dir)) {
        count++;
        this.fx.spark(v.x, v.y - v.z - v.h * 0.6, true);
        if (!this.activeBoss()) this.hud.showEnemy(v, v.name, v.hp, v.maxHp, false);
      }
    }
    for (const pr of this.props) if (!pr.broken && inEllipse(x, y, FLEX_RX, FLEX_RY, pr.x, pr.y)) this.hitProp(pr, 9);
    for (const b of this.barrels) if (b.alive && inEllipse(x, y, FLEX_RX, FLEX_RY, b.x, b.y)) b.kill();
    if (count > 0) {
      Audio.sfx("heavyHit");
      this.addScore(SCORE.flexHit * count);
      if (!this.firstPunch) {
        this.firstPunch = true;
        Arcade.achieve("first-punch");
      }
    }
    if (count >= 3) {
      Arcade.achieve("flex-appeal");
      this.fx.word(x, y - 92, `${count}X COMBO!`, PAL.yellow, 8, true);
    }
  }

  // ------------------------------------------------------------------ overlays

  private clearOverlay() {
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
    this.countTxt = null;
  }

  private ov<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 0): T {
    o.setScrollFactor(0);
    o.setDepth(30000 + d);
    this.overlay.push(o);
    return o;
  }

  private blackout(alpha: number) {
    return this.ov(this.add.image(0, 0, TEX.black).setOrigin(0).setDisplaySize(W, H).setAlpha(alpha));
  }

  private showTitleCard() {
    this.phase = "card";
    this.phaseT = 0;
    const bg = this.blackout(1);
    const band = this.ov(this.add.image(0, 112, TEX.px).setOrigin(0).setDisplaySize(W, 56).setTint(PAL.magenta), 1);
    const band2 = this.ov(this.add.image(0, 116, TEX.px).setOrigin(0).setDisplaySize(W, 48).setTint(PAL.navy), 2);
    const t1 = this.ov(this.txt(-120, 122, `STAGE ${this.stage.n}`, { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }), 3);
    const t2 = this.ov(this.txt(W + 160, 144, this.stage.title, { size: 16, color: PAL.offwhite, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }), 3);
    const face = this.ov(this.add.image(W / 2, 80, TEX.face("grin")).setScale(2), 3);
    this.tweens.add({ targets: t1, x: W / 2, duration: 380, ease: "Back.Out" });
    this.tweens.add({ targets: t2, x: W / 2, duration: 380, delay: 150, ease: "Back.Out" });
    this.tweens.add({ targets: face, y: 84, duration: 300, yoyo: true, repeat: -1 });
    const fadeOut = () => {
      this.tweens.add({
        targets: [bg, band, band2, t1, t2, face],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.clearOverlay();
          this.phase = "play";
          this.fx.word(this.player.x + 20, this.player.y - 70, "FIGHT!", PAL.yellow, 16, true);
        },
      });
    };
    this.time.delayedCall(1900, fadeOut);
    Audio.jingle(["C5", "E5", "G5", "C6"], 0.08);
  }

  private banner(name: string) {
    const t = this.txt(W / 2, 64, name, { size: 16, color: PAL.magentaLight, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 });
    t.setScrollFactor(0).setDepth(25000).setAlpha(0);
    const warn = this.txt(W / 2, 46, "WARNING!", { size: 8, color: PAL.yellow, stroke: PAL.ink, originX: 0.5 });
    warn.setScrollFactor(0).setDepth(25000);
    this.tweens.add({ targets: t, alpha: 1, duration: 200, yoyo: true, hold: 1600, onComplete: () => t.destroy() });
    this.tweens.add({ targets: warn, alpha: 0, duration: 120, yoyo: true, repeat: 7, onComplete: () => warn.destroy() });
    Audio.sfx("alarm");
  }

  // ------------------------------------------------------------------ main loop

  update(_time: number, delta: number) {
    const real = Math.min(delta, 50);
    if (this.slowT > 0) {
      this.slowT -= real;
      if (this.slowT <= 0) this.timeScale = 1;
    }
    this.tweens.timeScale = this.timeScale;
    const dt = real * this.timeScale;
    this.phaseT += real;

    switch (this.phase) {
      case "card":
        this.player.sync();
        this.updateCamera();
        break;
      case "play":
        this.now += dt;
        this.stepWorld(dt);
        this.updateWaves(dt);
        this.checkPlayerDeath();
        break;
      case "clear":
        this.now += dt;
        this.stepWorld(dt, false);
        this.updateClear(real);
        break;
      case "continue":
        this.updateContinue(real);
        break;
      case "gameover":
        if (this.pad.justDown("a") && this.phaseT > 600) this.finish(false);
        break;
      case "victory":
        this.now += dt;
        this.stepWorld(dt, false);
        this.updateVictory(real);
        break;
    }
    const boss = this.activeBoss();
    if (boss) this.hud.showEnemy(boss, boss.name, boss.hp, boss.maxHp, true);
    else if (this.hudBoss) this.hud.hideEnemy();
    this.hudBoss = !!boss;
    this.hud.update(real, this.player.hp, this.player.maxHp, this.player.lives, this.player.power, this.score);
  }

  private stepWorld(dt: number, control = true) {
    const p = this.player;
    p.minX = this.camX + 14;
    p.maxX = this.camX + W - 14;
    if (control) p.update(dt, this.pad);
    else this.autoPlayer(dt);

    for (const e of this.enemies) e.update(dt);
    if (this.boss && !this.boss.removed) this.boss.update(dt);
    this.enemies = this.enemies.filter((e) => !e.removed);

    // thrown bodies bowl over other thugs
    for (const e of this.enemies) {
      if (!e.bowling) continue;
      for (const o of this.enemies) {
        if (o === e || !o.hittable || e.hitSet.has(o)) continue;
        if (Math.abs(o.x - e.x) < 16 && Math.abs(o.y - e.y) < 10) {
          e.hitSet.add(o);
          if (o.takeHit(BOWL, e.vx > 0 ? 1 : -1)) {
            this.fx.spark(o.x, o.y - 30, true);
            Audio.sfx("heavyHit");
            this.addScore(SCORE.heavy);
          }
        }
      }
    }

    for (const pr of this.props) pr.update(dt);
    this.props = this.props.filter((pr) => !pr.broken);
    this.updatePickups(dt);
    this.updateHazards(dt);
    this.fx.update(dt);
    this.updateCamera();
  }

  private autoPlayer(dt: number) {
    const p = this.player;
    p.tick(dt);
    if (p.state === "kdAir" || p.z > 0) {
      p.x += p.vx * (dt / 1000);
      if (p.physicsZ(dt)) {
        p.vx = 0;
        p.vz = 0;
        p.pose(PF.idle[0]);
      }
    }
    p.updateAnim(dt);
    p.sync();
  }

  private updateCamera() {
    const st = this.stage;
    const p = this.player;
    let maxCam = st.worldW - W;
    if (this.waveIdx < st.waves.length) maxCam = Math.min(maxCam, st.waves[this.waveIdx].at);
    if (this.waveActive) {
      this.camX = st.waves[this.waveIdx].at;
    } else {
      const target = p.x - 140;
      if (target > this.camX) this.camX = Math.min(maxCam, this.camX + Math.min(target - this.camX, 3));
      this.camX = Math.max(this.camMin, Math.min(maxCam, this.camX));
    }
    this.cameras.main.scrollX = Math.round(this.camX);
    if (this.goUntil >= 0) {
      const show = !this.waveActive && this.camX < this.goUntil;
      this.goImg.setVisible(show && Math.floor(this.phaseT / 220) % 2 === 0);
      if (!show) {
        this.goUntil = -1;
        this.goImg.setVisible(false);
      }
    }
  }

  private updateWaves(dt: number) {
    const st = this.stage;
    if (!this.waveActive) {
      if (this.waveIdx < st.waves.length && this.camX >= st.waves[this.waveIdx].at - 0.5) this.startWave();
      // walking zones (falling flower pots etc.)
      for (const z of st.zones) {
        if (this.player.x >= z.x0 && this.player.x <= z.x1) {
          this.zoneT -= dt;
          if (this.zoneT <= 0) {
            this.zoneT = rand(z.hazard.min, z.hazard.max);
            this.triggerHazard(z.hazard.kind);
          }
        }
      }
      return;
    }
    const wave = st.waves[this.waveIdx];
    this.waveT += dt;
    const alive = this.enemyCount() + (this.boss && this.boss.alive && this.boss.hp > 0 ? 1 : 0);
    if (this.queue.length > 0 && this.waveT >= (this.queue[0].delay ?? 0) && alive < wave.maxAlive) {
      const s = this.queue.shift()!;
      this.spawnEnemy(s.type, s.side, s.y, s.drop);
    }
    for (const h of this.hazards) {
      h.t -= dt;
      if (h.t <= 0) {
        h.t = rand(h.spec.min, h.spec.max);
        this.triggerHazard(h.spec.kind);
      }
    }
    const bossAlive = this.boss !== null && this.boss.hp > 0;
    const pendingBoss = this.queue.some((s) => s.type === "boss" || s.type === "rex");
    const rexAlive = this.enemies.some((e) => e.bossLike && e.hp > 0);
    if (wave.boss && !bossAlive && !pendingBoss && !rexAlive && this.queue.length > 0) {
      // boss beaten: drop the backup spawns
      this.queue = [];
    }
    if (this.queue.length === 0 && this.enemyCount() === 0 && !bossAlive) this.endWave();
  }

  private startWave() {
    const wave = this.stage.waves[this.waveIdx];
    this.waveActive = true;
    this.waveT = 0;
    this.queue = wave.spawns.map((s) => ({ ...s })).sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0));
    this.hazards = (wave.hazards ?? []).map((spec) => ({ spec, t: rand(spec.min * 0.4, spec.min) }));
    this.goUntil = -1;
    this.goImg.setVisible(false);
  }

  private endWave() {
    const st = this.stage;
    const wave = st.waves[this.waveIdx];
    this.waveActive = false;
    this.hazards = [];
    this.camMin = wave.at;
    this.waveIdx++;
    this.tokens.clear();
    if (this.waveIdx >= st.waves.length) {
      if (!this.bossRef) this.stageClear();
      return;
    }
    this.goUntil = wave.at + 70;
    Audio.sfx("go");
  }

  private triggerHazard(kind: HazardSpec["kind"]) {
    const p = this.player;
    const camFn = () => this.camX;
    if (kind === "car") {
      const y = Phaser.Math.Clamp(p.y + rand(-4, 4), 238, Y_MAX - 2);
      this.cars.push(new Car(this, camFn, y, Math.random() < 0.5 ? 1 : -1));
      Audio.sfx("horn");
    } else if (kind === "barrel") {
      this.barrels.push(new RollingBarrel(this, camFn, Phaser.Math.Clamp(p.y, Y_MIN, Y_MAX)));
    } else {
      const x = Phaser.Math.Clamp(p.x + p.vx * 0.5 + rand(-8, 8), this.camX + 16, this.camX + W - 16);
      this.pots.push(new FallingPot(this, x, p.y));
      Audio.tone({ type: "triangle", freq: 1400, to: 500, dur: 0.6, vol: 0.06, slide: "lin" });
    }
  }

  private updateHazards(dt: number) {
    const p = this.player;
    for (const c of this.cars) {
      c.update(dt);
      if (c.phase !== "drive") continue;
      const inCar = (x: number, y: number, z: number) => Math.abs(y - c.y) < 11 && z < 26 && x > c.bodyX0 && x < c.bodyX1;
      if (!c.hitSet.has(p) && inCar(p.x, p.y, p.z) && p.vulnerable) {
        c.hitSet.add(p);
        this.damagePlayer(null, H_CAR, c.dir);
        this.fx.word(p.x, p.y - 70, "HONK!", PAL.yellow, 16, true);
      }
      for (const e of this.enemies) {
        if (c.hitSet.has(e) || !e.hittable || !inCar(e.x, e.y, e.z)) continue;
        c.hitSet.add(e);
        if (e.takeHit(H_CAR, c.dir)) {
          this.fx.spark(e.x, e.y - 30, true);
          Audio.sfx("heavyHit");
          this.addScore(SCORE.heavy * 3);
        }
      }
    }
    this.cars = this.cars.filter((c) => c.phase !== "done");

    for (const b of this.barrels) {
      if (!b.alive) continue;
      b.update(dt);
      if (!b.alive || !b.rolling) continue;
      const touch = (x: number, y: number, z: number) => Math.abs(y - b.y) < 9 && z < 14 && Math.abs(x - b.x) < 12;
      if (!b.hitSet.has(p) && p.vulnerable && touch(p.x, p.y, p.z)) {
        b.hitSet.add(p);
        this.damagePlayer(null, H_BARREL, -1);
      }
      for (const e of this.enemies) {
        if (b.hitSet.has(e) || !e.hittable || !touch(e.x, e.y, e.z)) continue;
        b.hitSet.add(e);
        if (e.takeHit(H_BARREL, -1)) Audio.sfx("heavyHit");
      }
    }
    this.barrels = this.barrels.filter((b) => b.alive);

    for (const pot of this.pots) {
      if (!pot.alive) continue;
      if (pot.update(dt)) {
        Audio.sfx("break");
        this.fx.debrisBurst(pot.x, pot.y, 4, [3, 3, 6], 0.7);
        this.fx.dust(pot.x, pot.y);
        if (p.vulnerable && Math.abs(p.x - pot.x) < 13 && Math.abs(p.y - pot.y) < 9 && p.z < 30) {
          this.damagePlayer(null, H_POT, p.facing > 0 ? -1 : 1);
          this.fx.word(p.x, p.y - 70, "OUCH!", PAL.yellow, 8, true);
        }
        for (const e of this.enemies)
          if (e.hittable && Math.abs(e.x - pot.x) < 13 && Math.abs(e.y - pot.y) < 9) {
            e.takeHit(H_POT, 1);
            this.addScore(SCORE.heavy);
          }
      }
    }
    this.pots = this.pots.filter((x) => x.alive);

    for (const bag of this.bags) {
      if (!bag.alive) continue;
      if (bag.update(dt)) {
        Audio.sfx("coin");
        for (let i = 0; i < 4; i++) this.fx.sparkle(bag.x + rand(-12, 12), bag.y - rand(2, 16), 10 + bag.y);
        this.fx.dust(bag.x, bag.y);
        if (p.vulnerable && Math.abs(p.x - bag.x) < 15 && Math.abs(p.y - bag.y) < 10 && p.z < 20) this.damagePlayer(null, B_BAG, dirTo(bag.x, p.x));
        if (Math.random() < 0.25) this.dropItem(bag.x, bag.y, "cash");
      }
    }
    this.bags = this.bags.filter((b) => b.alive);

    for (const r of this.rings) {
      r.t += dt;
      if (r.t >= 0 && !r.started) {
        r.started = true;
        this.fx.ring("slam", r.x, r.y, ShockRing.DUR);
        Audio.noise({ dur: 0.5, vol: 0.18, filter: "lowpass", freq: 600, to: 80 });
      }
      if (!r.started || r.hit) continue;
      if (p.vulnerable && p.z < 7 && onRing(r.x, r.y, r.radius, 9, 0.34, p.x, p.y)) {
        r.hit = true;
        this.damagePlayer(null, B_SHOCK, dirTo(r.x, p.x));
      }
    }
    this.rings = this.rings.filter((r) => !r.done);
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const k of this.pickups) {
      k.update(dt);
      if (k.gone || !p.alive || p.z > 4 || k.z > 4) continue;
      if (p.state === "dead" || p.state === "down" || p.state === "kdAir" || p.state === "grabbed") continue;
      if (Math.abs(p.x - k.x) < 15 && Math.abs(p.y - k.y) < 9) {
        const info = ITEM_INFO[k.kind];
        p.heal(info.heal);
        p.power = Math.min(100, p.power + info.power);
        this.addScore(info.score);
        if (info.heal > 0) {
          Audio.sfx("pickup");
          this.fx.word(k.x, k.y - 30, k.kind === "shake" ? "PROTEIN!" : "YUM!", PAL.green, 8, true);
          this.hud.react("laugh", 700);
        } else {
          Audio.sfx("coin");
          this.fx.word(k.x, k.y - 30, `+${info.score}`, PAL.yellow, 8, true);
        }
        for (let i = 0; i < 3; i++) this.fx.sparkle(k.x + rand(-8, 8), k.y - rand(6, 20), 10 + k.y);
        k.collect();
      }
    }
    this.pickups = this.pickups.filter((k) => !k.gone);
  }

  // ------------------------------------------------------------------ death / continue

  private checkPlayerDeath() {
    const p = this.player;
    if (p.state !== "dead" || p.st < 1100) return;
    p.lives--;
    if (p.lives > 0) {
      this.respawnPlayer();
      return;
    }
    p.lives = 0;
    this.showContinue();
  }

  private respawnPlayer() {
    const p = this.player;
    p.respawn(this.camX + 90, (Y_MIN + Y_MAX) / 2);
    this.hud.react("grin", 900);
    Audio.sfx("spring");
    // land with a mini shockwave that clears the area
    this.time.delayedCall(450, () => {
      this.fx.ring("flex", p.x, p.y, 320);
      for (const e of this.enemies) if (e.hittable && inEllipse(p.x, p.y, 80, 34, e.x, e.y)) e.takeHit(RESPAWN_PUSH, dirTo(p.x, e.x));
    });
  }

  private showContinue() {
    this.phase = "continue";
    this.phaseT = 0;
    this.countdown = 9;
    this.countT = 0;
    Audio.stopMusic();
    Audio.sfx("lose");
    this.blackout(0.72);
    if (this.run.credits <= 0) {
      this.showGameOver();
      return;
    }
    this.ov(this.txt(W / 2, 92, "CONTINUE?", { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }), 1);
    this.countTxt = this.ov(this.txt(W / 2, 128, "9", { size: 16, color: PAL.offwhite, stroke: PAL.magenta, strokeThickness: 4, originX: 0.5 }), 1);
    this.ov(this.add.image(W / 2, 170, TEX.face("sad")).setScale(2), 1);
    this.ov(this.txt(W / 2, 204, `CREDITS ${this.run.credits}`, { color: PAL.magentaLight, stroke: PAL.ink, originX: 0.5 }), 1);
    this.ov(this.txt(W / 2, 224, "A: CONTINUE   B: SKIP", { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }), 1);
  }

  private updateContinue(real: number) {
    this.countT += real;
    if (this.pad.justDown("a") && this.phaseT > 300) {
      this.run.credits--;
      this.clearOverlay();
      this.player.lives = 3;
      this.phase = "play";
      Audio.playMusic(this.boss || this.enemies.some((e) => e.bossLike) ? "boss" : "rampage");
      this.respawnPlayer();
      return;
    }
    if (this.pad.justDown("b")) this.countT += 1000;
    if (this.countT >= 1000) {
      this.countT -= 1000;
      this.countdown--;
      Audio.sfx("countdown");
      if (this.countdown < 0) {
        this.clearOverlay();
        this.blackout(0.72);
        this.showGameOver();
        return;
      }
      this.countTxt?.setText(String(this.countdown));
    }
  }

  private showGameOver() {
    this.phase = "gameover";
    this.phaseT = 0;
    this.ov(this.txt(W / 2, 96, "GAME OVER", { size: 16, color: PAL.red, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }), 1);
    this.ov(this.txt(W / 2, 134, `STAGE ${this.stage.n} - ${this.stage.title}`, { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }), 1);
    this.ov(this.txt(W / 2, 154, `SCORE ${Math.floor(this.score)}`, { color: PAL.yellow, stroke: PAL.ink, originX: 0.5 }), 1);
    const a = this.ov(this.txt(W / 2, 196, "A: EXIT", { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }), 1);
    this.tweens.add({ targets: a, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
  }

  private finish(completed: boolean) {
    if (this.finished) return;
    this.finished = true;
    Audio.stopMusic();
    Arcade.finish({ score: Math.floor(this.score), completed, detail: completed ? "CHAMPION" : `STAGE ${this.stage.n}` });
  }

  // ------------------------------------------------------------------ stage clear

  private stageClear() {
    this.phase = "clear";
    this.phaseT = 0;
    this.victoryStep = 0;
    const p = this.player;
    this.clearBonus = Math.round(p.hp) * SCORE.hpBonus;
    Audio.stopMusic();
    Audio.sfx("win");
    this.goImg.setVisible(false);
    p.setState("victory");
    p.vx = p.vy = 0;
  }

  /** auto-walk SCAMBOY during cut-scenes; returns true once he arrived */
  private walkPlayerTo(tx: number, ty: number, ms: number): boolean {
    const p = this.player;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const s = ms / 1000;
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return true;
    p.x += Math.sign(dx) * Math.min(Math.abs(dx), 80 * s);
    p.y += Math.sign(dy) * Math.min(Math.abs(dy), 50 * s);
    p.facing = dx < -2 ? -1 : 1;
    p.play(PF.walk, 10);
    return false;
  }

  private updateClear(real: number) {
    const p = this.player;
    if (this.victoryStep === 0 && p.grounded) {
      if (!this.walkPlayerTo(this.camX + 150, 238, real)) return;
      p.facing = 1;
      this.phaseT = 0;
      this.victoryStep = 1;
    }
    if (this.victoryStep === 0) return;
    const t = this.phaseT;
    if (p.grounded) p.pose(t < 600 ? PF.flexGather : Math.floor(t / 700) % 2 === 0 ? PF.vicSingle : PF.flexBiceps);
    if (this.victoryStep === 1 && t > 500) {
      this.victoryStep = 11;
      this.ov(this.txt(W / 2, 80, "STAGE CLEAR!", { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }), 1);
      Audio.sfx("flex");
    }
    if (this.victoryStep === 11 && t > 1300) {
      this.victoryStep = 2;
      this.ov(this.txt(W / 2, 108, `HEALTH BONUS ${this.clearBonus}`, { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }), 1);
      this.addScore(this.clearBonus);
      Audio.sfx("coin");
    }
    if (this.victoryStep === 2 && t > 2000 && Math.floor(t / 300) !== Math.floor((t - 16) / 300)) {
      this.fx.sparkle(p.x + rand(-24, 24), p.y - rand(20, 60));
    }
    if (this.victoryStep === 2 && (t > 3600 || (t > 1800 && this.pad.justDown("a")))) {
      this.victoryStep = 3;
      const bg = this.blackout(0);
      this.tweens.add({
        targets: bg,
        alpha: 1,
        duration: 400,
        onComplete: () => {
          this.scene.restart({
            stage: this.run.stage + 1,
            score: this.score,
            lives: this.player.lives,
            credits: this.run.credits,
            hp: this.player.hp,
            power: this.player.power,
          } satisfies RunData);
        },
      });
    }
  }

  // ------------------------------------------------------------------ victory

  private slowMo(scale: number, ms: number) {
    this.timeScale = scale;
    this.slowT = ms;
  }

  private bossDefeated(b: Boss) {
    this.phase = "victory";
    this.phaseT = 0;
    this.victoryStep = 0;
    this.slowMo(0.25, 1600);
    Audio.stopMusic();
    Audio.sfx("ko");
    this.shake(0.015, 400);
    this.fx.word(b.x, b.y - 90, "KNOCKOUT!", PAL.yellow, 16, true);
    this.addScore(SCORE.koBoss);
    for (const e of this.enemies) if (e.hittable) e.takeHit({ ...P_FLEX, dmg: 999, id: "ko" }, dirTo(b.x, e.x));
    this.queue = [];
    this.hazards = [];
    Arcade.achieve("street-champion");
    Arcade.progress().addStat("rampageWins");
    const p = this.player;
    if (p.state === "grabbed") {
      p.grabbed = false;
      p.z = 40;
      p.setState("kdAir");
    }
    p.invul = 99999;
  }

  private updateVictory(real: number) {
    const p = this.player;
    const t = this.phaseT;
    if (this.victoryStep === 0 && t > 1700) {
      this.victoryStep = 1;
      p.setState("victory");
      p.alive = true;
      if (p.hp <= 0) p.hp = 1;
    }
    if (this.victoryStep === 1) {
      // walk to centre stage
      const bx = this.bossRef ? this.bossRef.x : this.camX;
      const tx = bx > this.camX + 160 ? this.camX + 96 : this.camX + 224;
      const ty = 244;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const s = real / 1000;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        p.x += Math.sign(dx) * Math.min(Math.abs(dx), 70 * s);
        p.y += Math.sign(dy) * Math.min(Math.abs(dy), 45 * s);
        p.facing = 1;
        p.play(PF.walk, 10);
        p.updateAnim(real);
      } else {
        this.victoryStep = 2;
        this.phaseT = 0;
        Audio.jingle(["C5", "E5", "G5", "C6", "-", "G5", "C6", "-", "-"], 0.11);
      }
      p.sync();
      return;
    }
    if (this.victoryStep >= 2) {
      const poses = [PF.flexGather, PF.vicBicepsGrin, PF.vicSingle, PF.vicMost, PF.flexBiceps];
      const i = Math.floor(t / 750) % poses.length;
      p.facing = Math.floor(t / 750) % 4 === 3 ? -1 : 1;
      p.pose(poses[i]);
      if (Math.floor(t / 750) !== Math.floor((t - real) / 750)) {
        Audio.sfx("flex");
        this.shake(0.003, 80);
      }
      if (Math.floor(t / 140) !== Math.floor((t - real) / 140)) this.fx.sparkle(p.x + rand(-30, 30), p.y - rand(10, 64));
      p.sync();
      if (this.victoryStep === 2 && t > 2400) {
        this.victoryStep = 3;
        Audio.sfx("win");
        this.blackout(0.55);
        const title = this.ov(this.txt(W / 2, 56, "STREET CHAMPION!", { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }), 1);
        title.setScale(0.3);
        this.tweens.add({ targets: title, scale: 1, duration: 400, ease: "Back.Out" });
        this.ov(this.txt(W / 2, 82, "THE STREETS ARE SAFE... ISH", { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }), 1);
        this.ov(this.txt(W / 2, 100, `FINAL SCORE ${Math.floor(this.score)}`, { color: PAL.magentaLight, stroke: PAL.ink, originX: 0.5 }), 1);
        const a = this.ov(this.txt(W / 2, 270, "A: CONTINUE", { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }), 1);
        this.tweens.add({ targets: a, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
        // lift the champion above the dim layer
        p.spr.setDepth(30005);
      }
      if (this.victoryStep === 3) {
        p.spr.setDepth(30005);
        if (t > 3200 && this.pad.justDown("a")) this.finish(true);
      }
    }
  }
}
