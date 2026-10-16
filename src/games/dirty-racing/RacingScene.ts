/**
 * DIRTY RACING — the race itself: world rendering, camera, effects, HUD,
 * countdown, results and progress / achievements.
 */
import * as Phaser from "phaser";
import { BaseScene, H, W } from "../engine/BaseScene";
import { Audio } from "../engine/AudioManager";
import { Arcade } from "../engine/bridge";
import { PAL } from "../engine/palette";
import { registerTexture } from "../engine/pixel";
import { CAR_KEYS, FACE_EXPRS, PORTRAIT_KEYS, registerRacingArt } from "./art";
import { Race, type Racer } from "./Race";
import { RIVALS } from "./RacerAI";
import { buildTrack, type TrackData } from "./Track";
import { renderMinimap, renderTrackArt } from "./trackArt";
import { TRACKS } from "./tracks";
import { IS_DUSTY, T } from "./terrain";
import type { CarInput } from "./Vehicle";

const trackCache: Array<TrackData | undefined> = [];

export function getTrack(i: number): TrackData {
  let td = trackCache[i];
  if (!td) {
    td = buildTrack(TRACKS[i]);
    trackCache[i] = td;
  }
  return td;
}

export function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const c = Math.floor((t * 100) % 100);
  return `${m}:${s.toString().padStart(2, "0")}.${c.toString().padStart(2, "0")}`;
}

const ORD = ["1ST", "2ND", "3RD", "4TH"];

interface CarView {
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Sprite;
  wheels: number[] | null;
  dustT: number;
  animT: number;
  fallSpin: number;
}

interface Fx {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  f0: number;
  nf: number;
  grow: number;
}

type FaceName = (typeof FACE_EXPRS)[number];

export class RacingScene extends BaseScene {
  private ti = 0;
  private td!: TrackData;
  private race!: Race;
  private views: CarView[] = [];
  private coneImgs: Phaser.GameObjects.Image[] = [];
  private coverImgs: Phaser.GameObjects.Image[] = [];
  private skidRT!: Phaser.GameObjects.RenderTexture;
  private fx: Fx[] = [];
  private fxPool: Phaser.GameObjects.Image[] = [];
  private camX = 0;
  private camY = 0;

  // HUD
  private lapTxt!: Phaser.GameObjects.Text;
  private posTxt!: Phaser.GameObjects.Text;
  private timeTxt!: Phaser.GameObjects.Text;
  private bestTxt!: Phaser.GameObjects.Text;
  private warnTxt!: Phaser.GameObjects.Text;
  private boostFill!: Phaser.GameObjects.Rectangle;
  private boostTxt!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private faceT = 0;
  private miniDots: Phaser.GameObjects.Image[] = [];
  private miniScale = 1;
  private miniX = 0;
  private miniY = 0;
  private hud: Phaser.GameObjects.GameObject[] = [];
  private banners = new Map<number, Phaser.GameObjects.Text>();

  private lastCount = 99;
  private skidSfxT = 0;
  private finishT = -1;
  private resultsShown = false;
  private finished = false;
  private score = 0;
  private place = 4;
  private resultLines: string[] = [];
  private won = false;

  constructor() {
    super("dr-race");
  }

  init(data: { track?: number }) {
    this.ti = Phaser.Math.Clamp(data?.track ?? 0, 0, TRACKS.length - 1);
    this.views = [];
    this.coneImgs = [];
    this.coverImgs = [];
    this.fx = [];
    this.fxPool = [];
    this.miniDots = [];
    this.hud = [];
    this.banners = new Map();
    this.lastCount = 99;
    this.finishT = -1;
    this.resultsShown = false;
    this.finished = false;
    this.faceT = 0;
    this.skidSfxT = 0;
    this.resultLines = [];
    this.won = false;
  }

  create() {
    registerRacingArt(this);
    this.td = getTrack(this.ti);
    const td = this.td;
    const key = `dr-track-${this.ti}`;
    if (!this.textures.exists(key)) {
      const art = renderTrackArt(td);
      registerTexture(this, key, art.base);
      art.covers.forEach((c, k) => registerTexture(this, `dr-cover-${this.ti}-${k}`, c.pc));
    }
    this.cameras.main.setBackgroundColor(td.def.theme === "desert" ? 0x4a2416 : 0x15131c);
    this.add.image(0, 0, key).setOrigin(0).setDepth(0);
    this.skidRT = this.add.renderTexture(0, 0, td.w, td.h).setOrigin(0).setDepth(1).setAlpha(0.55);
    td.covers.forEach((c, k) => {
      this.coverImgs.push(this.add.image(c.r.x, c.r.y, `dr-cover-${this.ti}-${k}`).setOrigin(0).setDepth(20));
    });

    this.race = new Race(td, (Date.now() & 0xffff) + this.ti * 977);
    for (const c of this.race.cones) this.coneImgs.push(this.add.image(c.x, c.y, "dr-cone", 0).setDepth(4));
    this.race.racers.forEach((r, i) => {
      const shadow = this.add.image(r.car.x, r.car.y, "dr-shadow").setAlpha(0.32).setDepth(5);
      const flame = this.add.sprite(r.car.x, r.car.y, "dr-flame", 0).setOrigin(1, 0.5).setDepth(6).setVisible(false);
      const body = this.add.sprite(r.car.x, r.car.y, CAR_KEYS[i], 0).setDepth(6);
      this.views.push({ body, shadow, flame, wheels: null, dustT: 0, animT: 0, fallSpin: 0 });
    });
    for (let i = 0; i < 70; i++) this.fxPool.push(this.add.image(-100, -100, "dr-fx", 0).setDepth(8).setVisible(false));

    const p = this.race.player.car;
    this.camX = p.x;
    this.camY = p.y;
    this.cameras.main.setBounds(0, 0, td.w, td.h);
    this.cameras.main.centerOn(p.x, p.y);

    this.buildHud();
    Audio.playMusic("racing");
    Audio.engineStart();
    const stop = () => Audio.engineStop();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    this.events.once(Phaser.Scenes.Events.DESTROY, stop);
    this.banner(TRACKS[this.ti].name, PAL.yellow, 76, 8, 1800);
  }

  // ================================================================== HUD
  private buildHud() {
    const add = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => {
      o.setScrollFactor(0);
      o.setDepth(100);
      this.hud.push(o);
      return o;
    };
    // top bar
    add(this.add.rectangle(0, 0, W, 22, PAL.ink, 0.72).setOrigin(0));
    add(this.add.rectangle(0, 22, W, 1, PAL.magenta, 0.9).setOrigin(0));
    add(this.add.image(4, 5, "dr-flag").setOrigin(0));
    this.lapTxt = add(this.txt(19, 4, "LAP 1/3", { size: 8, color: PAL.offwhite }));
    this.bestTxt = add(this.txt(19, 13, "", { size: 8, color: PAL.grayLight }));
    this.timeTxt = add(this.txt(W / 2 + 18, 7, "0:00.00", { size: 8, color: PAL.yellow, originX: 0.5 }));
    this.posTxt = add(this.txt(W - 4, 3, "4TH", { size: 16, color: PAL.magentaLight, stroke: PAL.ink, strokeThickness: 2, originX: 1 }));

    // bottom-left: portrait + boost
    add(this.add.image(3, H - 27, "dr-hud-frame").setOrigin(0));
    this.face = add(this.add.image(5, H - 25, PORTRAIT_KEYS[3], 0).setOrigin(0));
    add(this.add.rectangle(28, H - 15, 66, 12, PAL.ink, 0.72).setOrigin(0));
    add(this.add.image(30, H - 13, "dr-boost-bar").setOrigin(0));
    this.boostFill = add(this.add.rectangle(31, H - 12, 60, 6, PAL.magenta).setOrigin(0));
    this.boostTxt = add(this.txt(30, H - 24, "BOOST", { size: 8, color: PAL.offwhite, stroke: PAL.ink, strokeThickness: 2 }));

    // bottom-right: mini-map
    const size = 56;
    const mkey = `dr-mini-${this.ti}-${Arcade.progress().shortcuts.length}`;
    if (!this.textures.exists(mkey)) {
      const found = Arcade.progress().shortcuts;
      registerTexture(
        this,
        mkey,
        renderMinimap(TRACKS[this.ti], size, (i) => found.includes(`${this.ti}:${TRACKS[this.ti].shortcuts[i].id}`)),
      );
    }
    this.miniX = W - size - 4;
    this.miniY = H - size - 4;
    this.miniScale = size / this.td.w;
    add(this.add.rectangle(this.miniX - 2, this.miniY - 2, size + 4, size + 4, PAL.ink, 0.6).setOrigin(0));
    add(this.add.image(this.miniX, this.miniY, mkey).setOrigin(0));
    for (let i = 0; i < 4; i++) {
      const frame = i === 3 ? 0 : i + 1;
      this.miniDots.push(add(this.add.image(0, 0, "dr-dot", frame)));
    }
    this.miniDots[3].setDepth(101);

    this.warnTxt = add(
      this.txt(W / 2, 60, "", { size: 16, color: PAL.red, stroke: PAL.ink, strokeThickness: 4, originX: 0.5, originY: 0.5 }),
    );
  }

  /** big centred HUD message (a new message on the same row replaces the old one) */
  private banner(text: string, color: number, y = 100, size = 16, hold = 900) {
    const old = this.banners.get(y);
    if (old) {
      this.tweens.killTweensOf(old);
      old.destroy();
    }
    const t = this.txt(W / 2, y, text, { size, color, stroke: PAL.ink, strokeThickness: 4, originX: 0.5, originY: 0.5 });
    t.setScrollFactor(0).setDepth(150).setScale(0.3);
    this.banners.set(y, t);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: "Back.Out" });
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: y - 14,
      delay: hold,
      duration: 300,
      onComplete: () => {
        if (this.banners.get(y) === t) this.banners.delete(y);
        t.destroy();
      },
    });
    return t;
  }

  private setFace(name: FaceName, hold = 0.9) {
    this.face.setFrame(FACE_EXPRS.indexOf(name));
    this.faceT = hold;
  }

  // ================================================================== loop
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    const pad = this.pad;
    const input: CarInput = {
      throttle: pad.isDown("up") ? 1 : 0,
      brake: pad.isDown("down") ? 1 : 0,
      steer: pad.x,
      handbrake: pad.isDown("b"),
      boost: pad.isDown("a"),
    };
    if (this.resultsShown) {
      if (pad.justDown("a") && !this.finished) {
        this.finished = true;
        Audio.sfx("select");
        Arcade.finish({
          score: this.score,
          completed: this.won && this.ti === TRACKS.length - 1,
          detail: `${TRACKS[this.ti].short} P${this.place}`,
        });
      }
    }
    // fixed-ish substeps for stable physics at any frame rate
    const steps = dt > 1 / 45 ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      this.race.step(dt / steps, input);
      this.handleEvents();
    }
    this.updateCountdown();
    this.updateViews(dt);
    this.updateFx(dt);
    this.updateCamera(dt);
    this.updateHud(dt);
    this.updateAudio(dt, input);

    if (this.finishT >= 0) {
      this.finishT += dt;
      if (this.finishT > 2.6 && !this.resultsShown) this.showResults();
    }
  }

  private updateCountdown() {
    const r = this.race;
    if (r.phase === "countdown") {
      const n = Math.ceil(r.countdown);
      if (n <= 3 && n !== this.lastCount && r.countdown < 3) {
        this.lastCount = n;
        Audio.sfx("countdown");
        this.banner(String(n), PAL.yellow, 100, 16, 600);
      }
    } else if (this.lastCount !== 0) {
      this.lastCount = 0;
      Audio.sfx("go");
      this.banner("GO!", PAL.green, 100, 16, 700);
      this.setFace("laugh", 1);
    }
  }

  private handleEvents() {
    const race = this.race;
    const player = race.player;
    for (const e of race.events) {
      switch (e.type) {
        case "car": {
          const isP = e.racer.isPlayer;
          const car = e.racer.car;
          if (e.kind === "crash") {
            this.sparks(car.x, car.y, 5);
            if (isP) {
              Audio.sfx("crash");
              this.shake(0.006, 120);
              this.setFace("shock", 0.6);
            }
          } else if (e.kind === "jump") {
            if (isP) {
              Audio.sfx("jump");
              this.banner("AIR TIME!", PAL.sky, 120, 8, 500);
            }
          } else if (e.kind === "land") {
            this.puffs(car.x, car.y, 4, 3);
            if (isP) {
              Audio.sfx("land");
              this.shake(0.004, 90);
            }
          } else if (e.kind === "fall") {
            this.splash(car.x, car.y);
            if (isP) {
              Audio.sfx("fall");
              this.setFace("sad", 1.5);
              this.banner(this.td.def.theme === "desert" ? "TOO SHORT!" : "SPLASH!", PAL.sky, 100, 16, 900);
            }
          } else if (e.kind === "oil") {
            if (isP) {
              Audio.sfx("skid");
              this.setFace("shock", 1);
              this.banner("OIL!", PAL.purple, 120, 8, 500);
            }
          } else if (e.kind === "pad") {
            if (isP) {
              Audio.sfx("boost");
              this.setFace("laugh", 0.8);
            }
          } else if (e.kind === "boostStart") {
            if (isP) {
              Audio.sfx("boost");
              this.setFace("grin", 0.6);
            }
          }
          break;
        }
        case "lap":
          if (e.racer.isPlayer) {
            Audio.sfx("lap");
            const final = e.lap === race.laps;
            this.banner(final ? "FINAL LAP!" : `LAP ${e.lap}`, final ? PAL.magentaLight : PAL.yellow, 100, 16, 900);
            if (e.best) this.banner(`BEST ${fmtTime(e.time)}`, PAL.green, 120, 8, 1100);
          }
          break;
        case "finish":
          if (e.racer.isPlayer) this.onPlayerFinish(e.place);
          break;
        case "shortcut":
          if (e.racer.isPlayer) this.onShortcut(e.sc, e.firstInRace);
          break;
        case "respawn":
          if (e.racer.isPlayer) {
            this.cameras.main.flash(160, 255, 255, 255);
            this.banner("+1 SEC", PAL.red, 120, 8, 700);
          }
          break;
        case "cone":
          if (e.racer.isPlayer) Audio.sfx("hit");
          break;
        case "bump":
          if (e.a === player || e.b === player) {
            const other = e.a === player ? e.b : e.a;
            if (e.force > 50) {
              Audio.sfx(other.name === "BIG RICO" ? "horn" : "hit");
              this.shake(0.003, 80);
              this.setFace("angry", 0.7);
            }
          }
          break;
      }
    }
  }

  private onShortcut(sc: number, first: boolean) {
    const def = this.td.shortcuts[sc].def;
    if (first) {
      Audio.sfx("secret");
      this.banner(def.hidden ? "SECRET PASSAGE!" : "SHORTCUT!", def.hidden ? PAL.magentaLight : PAL.yellow, 100, 16, 1000);
      this.banner(def.name, PAL.offwhite, 120, 8, 1000);
      this.setFace("wink", 1.2);
    } else {
      Audio.sfx("coin");
      this.banner("SHORTCUT +300", PAL.yellow, 120, 8, 700);
    }
    const prog = Arcade.progress();
    if (prog.discoverShortcut(`${this.ti}:${def.id}`)) {
      Arcade.achieve("first-shortcut");
      Arcade.toast("SHORTCUT FOUND", def.name);
      if (Arcade.progress().shortcuts.length >= 6) Arcade.achieve("shortcut-king");
    }
  }

  private onPlayerFinish(place: number) {
    this.place = place;
    this.won = place === 1;
    this.finishT = 0;
    Audio.stopMusic();
    Audio.sfx(this.won ? "win" : "lose");
    this.banner("FINISH!", PAL.offwhite, 100, 16, 2000);
    this.banner(ORD[place - 1], this.won ? PAL.yellow : PAL.grayLight, 122, 16, 2000);
    this.setFace(this.won ? "laugh" : "sad", 3);
    if (this.won) for (let i = 0; i < 40; i++) this.confetti();

    // ---- score, records, unlocks, achievements
    const race = this.race;
    const p = race.player;
    const prog = Arcade.progress();
    const par = (this.td.L * race.laps) / 132;
    const posBonus = [5000, 3000, 1500, 500][place - 1];
    const timeBonus = Math.max(0, Math.round((par - p.finishTime) * 40));
    const scBonus = p.scUses * 300;
    this.score = posBonus + timeBonus + scBonus;
    Arcade.setScore(this.score);
    const lines: string[] = [];
    lines.push(`POSITION  +${posBonus}`);
    lines.push(`TIME      +${timeBonus}`);
    lines.push(`SHORTCUTS +${scBonus} (${p.scUses}X)`);
    if (prog.setBestRace(this.ti, Math.round(p.finishTime * 1000))) lines.push("NEW RACE RECORD!");
    if (p.bestLap > 0 && prog.setBestLap(this.ti, Math.round(p.bestLap * 1000))) lines.push("NEW LAP RECORD!");
    if (this.won) {
      if (this.ti + 2 <= TRACKS.length && prog.unlockedTracks < this.ti + 2) {
        prog.unlockTrack(this.ti + 2);
        lines.push("NEW TRACK UNLOCKED!");
      }
      if (p.scUses >= 3) Arcade.achieve("dirty-driver");
      if (this.ti === 2) Arcade.achieve("millionaire");
    }
    prog.addStat("races");
    if (this.won) prog.addStat("raceWins");
    this.resultLines = lines;
  }

  private showResults() {
    this.resultsShown = true;
    Audio.engineStop();
    Audio.playMusic("menu");
    const add = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => {
      o.setScrollFactor(0);
      o.setDepth(200);
      return o;
    };
    add(this.add.rectangle(0, 0, W, H, PAL.navyDark, 0.9).setOrigin(0));
    add(this.add.rectangle(6, 6, W - 12, H - 12, 0x000000, 0).setOrigin(0).setStrokeStyle(2, PAL.magenta));
    add(this.txt(W / 2, 9, this.won ? "YOU WIN!" : "RESULTS", { size: 16, color: this.won ? PAL.yellow : PAL.offwhite, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }));
    add(this.txt(W / 2, 36, TRACKS[this.ti].name, { size: 8, color: PAL.grayLight, originX: 0.5 }));
    const res = this.race.results();
    res.forEach((row, i) => {
      const y = 50 + i * 26;
      const r = row.r;
      const isP = r.isPlayer;
      add(this.add.rectangle(12, y - 2, W - 24, 24, isP ? PAL.magentaDark : PAL.navy, isP ? 0.9 : 0.6).setOrigin(0));
      add(this.txt(18, y + 6, ORD[i], { size: 8, color: i === 0 ? PAL.yellow : PAL.offwhite }));
      const pk = isP ? PORTRAIT_KEYS[3] : PORTRAIT_KEYS[r.id];
      const frame = isP ? FACE_EXPRS.indexOf(this.won ? "laugh" : "sad") : undefined;
      add(this.add.image(52, y, pk, frame).setOrigin(0));
      add(this.txt(78, y + 2, r.name, { size: 8, color: isP ? PAL.offwhite : RIVALS[r.id].body }));
      add(this.txt(78, y + 12, r.bestLap > 0 ? `BEST LAP ${fmtTime(r.bestLap)}` : "", { size: 8, color: PAL.grayLight }));
      add(this.txt(W - 18, y + 6, (row.est ? "~" : "") + fmtTime(row.time), { size: 8, color: PAL.offwhite, originX: 1 }));
    });
    let y = 158;
    for (const l of this.resultLines) {
      const special = l.endsWith("!");
      add(this.txt(W / 2, y, l, { size: 8, color: special ? PAL.yellow : PAL.offwhite, originX: 0.5 }));
      y += 12;
    }
    add(this.txt(W / 2, Math.max(y + 4, 230), `SCORE ${this.score}`, { size: 16, color: PAL.magentaLight, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }));
    const prompt = add(this.txt(W / 2, H - 22, "PRESS A", { size: 8, color: PAL.yellow, originX: 0.5 }));
    this.tweens.add({ targets: prompt, alpha: 0.2, yoyo: true, repeat: -1, duration: 420 });
  }

  // ================================================================== views & effects
  private updateViews(dt: number) {
    const race = this.race;
    const player = race.player;
    const coverOfPlayer = player.covered;
    race.racers.forEach((r, i) => {
      const v = this.views[i];
      const car = r.car;
      const h = car.height;
      const air = car.air > 0;
      v.body.setPosition(Math.round(car.x), Math.round(car.y));
      v.body.setRotation(car.angle);
      // wheel animation by speed
      v.animT += dt * Math.min(30, car.speed * 0.15);
      v.body.setFrame(Math.floor(v.animT) % 2);
      let scale = 1 + h * 0.45;
      let alpha = 1;
      if (car.falling > 0) {
        const k = Math.max(0, car.falling / 1.1);
        scale = 0.25 + 0.75 * k;
        v.fallSpin += dt * 8;
        v.body.setRotation(car.angle + v.fallSpin);
        alpha = k;
      } else v.fallSpin = 0;
      if (r.respawnT > 0 && Math.floor(this.time.now / 80) % 2 === 0) alpha = 0.3;
      v.body.setScale(scale).setAlpha(alpha);
      v.body.setDepth(air ? 25 : r.isPlayer ? 7 : 6);
      // hidden under a cover: darken
      v.body.setTint(r.covered ? 0x404058 : 0xffffff);
      v.shadow
        .setPosition(Math.round(car.x + 2 + h * 9), Math.round(car.y + 3 + h * 13))
        .setRotation(car.angle)
        .setScale(1 - h * 0.25)
        .setVisible(car.falling <= 0 && !r.covered);
      // boost flame
      const boosting = (car.boosting || car.padBoost > 0) && car.falling <= 0;
      v.flame.setVisible(boosting);
      if (boosting) {
        v.flame
          .setPosition(car.x - Math.cos(car.angle) * 9 * scale, car.y - Math.sin(car.angle) * 9 * scale)
          .setRotation(car.angle)
          .setFrame(Math.floor(this.time.now / 60) % 3)
          .setDepth(v.body.depth)
          .setScale(scale);
      }
      // skid marks & dust
      const drifting = car.drifting || car.spin > 0 || (car.throttle === 0 && car.speed > 90 && car.fwdSpeed > 0 && this.isBraking(r));
      const wheels = this.rearWheels(r);
      const surf = car.surface;
      const onGround = !air && car.falling <= 0;
      if (onGround && drifting && !IS_DUSTY[surf] && surf !== T.WATER) {
        if (v.wheels) this.stampSkid(v.wheels, wheels);
        v.wheels = wheels;
        if (Math.random() < 0.25) this.emit(wheels[0], wheels[1], 3, 3, 0.5, 0, 0, 1.2);
        if (r.isPlayer) {
          this.skidSfxT -= dt;
          if (this.skidSfxT <= 0) {
            Audio.sfx("skid");
            this.skidSfxT = 0.28;
          }
        }
      } else v.wheels = null;
      if (onGround && IS_DUSTY[surf] && car.speed > 40) {
        v.dustT -= dt;
        if (v.dustT <= 0) {
          v.dustT = 0.06;
          const back = Math.random() < 0.5 ? 0 : 2;
          this.emit(wheels[back], wheels[back + 1], 0, 3, 0.45, -car.vx * 0.1, -car.vy * 0.1, 1);
        }
      }
    });
    // covers: reveal the one the player is in
    this.coverImgs.forEach((img, k) => {
      const target = coverOfPlayer === k + 1 ? 0.42 : 1;
      img.setAlpha(img.alpha + (target - img.alpha) * Math.min(1, dt * 10));
    });
    // cones
    race.cones.forEach((c, k) => {
      const img = this.coneImgs[k];
      img.setPosition(Math.round(c.x), Math.round(c.y)).setRotation(c.angle).setFrame(c.knocked > 0 ? 1 : 0);
      img.setAlpha(c.knocked > 0 && c.knocked < 0.5 ? c.knocked * 2 : 1);
      if (c.knocked > 0 && c.knocked < 0.02) {
        img.setScale(0.2);
        this.tweens.add({ targets: img, scale: 1, duration: 200, ease: "Back.Out" });
      }
    });
  }

  private isBraking(r: Racer) {
    return r.isPlayer ? this.pad.isDown("down") : false;
  }

  private rearWheels(r: Racer) {
    const c = r.car;
    const ca = Math.cos(c.angle);
    const sa = Math.sin(c.angle);
    const bx = c.x - ca * 6;
    const by = c.y - sa * 6;
    return [bx - sa * 4, by + ca * 4, bx + sa * 4, by - ca * 4];
  }

  private stampSkid(a: number[], b: number[]) {
    const rt = this.skidRT;
    rt.beginDraw();
    for (let w = 0; w < 4; w += 2) {
      const dx = b[w] - a[w];
      const dy = b[w + 1] - a[w + 1];
      const d = Math.hypot(dx, dy);
      if (d > 30) continue;
      const n = Math.max(1, Math.ceil(d / 1.5));
      for (let i = 1; i <= n; i++) {
        rt.batchDrawFrame("dr-skid", undefined, Math.round(a[w] + (dx * i) / n) - 1, Math.round(a[w + 1] + (dy * i) / n) - 1);
      }
    }
    rt.endDraw();
  }

  private emit(x: number, y: number, f0: number, nf: number, life: number, vx: number, vy: number, grow: number) {
    const img = this.fxPool.pop();
    if (!img) return;
    img.setVisible(true).setPosition(x, y).setFrame(f0).setAlpha(1).setScale(1).setRotation(0);
    this.fx.push({ img, vx: vx + (Math.random() - 0.5) * 20, vy: vy + (Math.random() - 0.5) * 20, life, max: life, f0, nf, grow });
  }

  private puffs(x: number, y: number, n: number, f0: number) {
    for (let i = 0; i < n; i++) this.emit(x, y, f0, 3, 0.5, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 1.4);
  }

  private sparks(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.emit(x, y, 6, 2, 0.3, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 0);
  }

  private splash(x: number, y: number) {
    const f = this.td.def.theme === "desert" ? 0 : 8;
    for (let i = 0; i < 10; i++)
      this.emit(x, y, f, f === 8 ? 2 : 3, 0.7, Math.cos((i / 10) * 6.28) * 70, Math.sin((i / 10) * 6.28) * 70, 0.6);
  }

  private confetti() {
    const cam = this.cameras.main;
    const x = cam.scrollX + Math.random() * W;
    const y = cam.scrollY - 10 + Math.random() * 40;
    this.emit(x, y, 10 + Math.floor(Math.random() * 4), 1, 2.2, (Math.random() - 0.5) * 50, 60 + Math.random() * 80, 0);
  }

  private updateFx(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const p = this.fx[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        this.fxPool.push(p.img);
        this.fx.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.vx *= Math.exp(-3 * dt);
      p.vy *= Math.exp(-3 * dt);
      p.img.setFrame(p.f0 + Math.min(p.nf - 1, Math.floor(k * p.nf)));
      p.img.setAlpha(1 - k * 0.8);
      p.img.setScale(1 + k * p.grow);
      if (p.f0 >= 10) p.img.rotation += dt * 8;
    }
  }

  private updateCamera(dt: number) {
    const c = this.race.player.car;
    const lead = 0.32;
    let lx = c.vx * lead;
    let ly = c.vy * lead;
    const ll = Math.hypot(lx, ly);
    if (ll > 64) {
      lx *= 64 / ll;
      ly *= 64 / ll;
    }
    const k = 1 - Math.exp(-dt * 5);
    this.camX += (c.x + lx - this.camX) * k;
    this.camY += (c.y + ly + 6 - this.camY) * k;
    this.cameras.main.centerOn(Math.round(this.camX), Math.round(this.camY));
  }

  private updateHud(dt: number) {
    const race = this.race;
    const p = race.player;
    const lap = Math.min(race.laps, p.started ? p.lapsDone + 1 : 1);
    this.lapTxt.setText(`LAP ${lap}/${race.laps}`);
    const lapTime = p.started && !p.finished ? race.time - p.lapStart : 0;
    this.bestTxt.setText(p.bestLap > 0 ? `BEST ${fmtTime(p.bestLap)}` : `LAP ${fmtTime(lapTime)}`);
    this.timeTxt.setText(fmtTime(p.finished ? p.finishTime : race.time));
    this.posTxt.setText(ORD[p.rank - 1]);
    this.posTxt.setColor(p.rank === 1 ? "#ffd23f" : "#f0609a");
    const m = p.car.boostMeter;
    this.boostFill.width = Math.max(0, Math.round(60 * m));
    const glow = p.car.boosting || p.car.padBoost > 0;
    this.boostFill.fillColor = glow ? PAL.yellow : m > 0.98 ? (Math.floor(this.time.now / 150) % 2 ? PAL.magentaLight : PAL.magenta) : PAL.magenta;
    this.boostTxt.setColor(m > 0.98 ? "#ffd23f" : "#ece7dc");
    // face
    if (this.faceT > 0) {
      this.faceT -= dt;
      if (this.faceT <= 0) this.face.setFrame(FACE_EXPRS.indexOf(p.car.drifting ? "grin" : "smile"));
    } else if (p.car.drifting) this.face.setFrame(FACE_EXPRS.indexOf("grin"));
    // mini-map dots
    race.racers.forEach((r, i) => {
      const d = this.miniDots[i];
      d.setPosition(Math.round(this.miniX + r.car.x * this.miniScale), Math.round(this.miniY + r.car.y * this.miniScale));
      if (r.isPlayer) d.setVisible(Math.floor(this.time.now / 200) % 4 !== 0);
    });
    // warnings
    const L = this.td.L;
    const seg = L / race.cpS.length;
    const toNext = (race.cpS[p.nextCp] - p.s + L) % L;
    let warn = "";
    if (race.phase === "racing" && !p.finished && p.car.active) {
      if (p.wrongWay > 1.0) warn = "WRONG WAY!";
      else if (p.started && toNext > seg * 1.6) warn = "GO BACK!";
    }
    this.warnTxt.setText(warn);
    this.warnTxt.setVisible(warn !== "" && Math.floor(this.time.now / 250) % 2 === 0);
  }

  private updateAudio(_dt: number, input: CarInput) {
    if (this.resultsShown) return;
    const c = this.race.player.car;
    const speed01 = c.speed / c.stats.maxSpeed;
    const thr = this.race.phase === "countdown" ? (input.throttle ? 1 : 0.1) : c.throttle;
    Audio.engineUpdate(this.race.phase === "countdown" && input.throttle ? 0.5 : speed01, thr);
  }
}
