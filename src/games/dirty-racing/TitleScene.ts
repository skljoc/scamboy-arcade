/**
 * DIRTY RACING — title & track select.
 * LEFT/RIGHT choose a track, A starts it (locked tracks can't be started).
 */
import * as Phaser from "phaser";
import { BaseScene, H, W } from "../engine/BaseScene";
import { Audio } from "../engine/AudioManager";
import { Arcade } from "../engine/bridge";
import { PAL } from "../engine/palette";
import { PixelCanvas, registerTexture } from "../engine/pixel";
import { CAR_KEYS, registerRacingArt } from "./art";
import { fmtTime } from "./RacingScene";
import { RIVALS } from "./RacerAI";
import { renderMinimap } from "./trackArt";
import { TRACKS } from "./tracks";

const THEME_COLORS: Record<string, number> = { city: 0x34478c, desert: 0xc0632a, lux: 0x2a9d8f };

export class TitleScene extends BaseScene {
  private sel = 0;
  private card: Phaser.GameObjects.GameObject[] = [];
  private cardBox!: Phaser.GameObjects.Container;
  private dots: Phaser.GameObjects.Rectangle[] = [];
  private loading = false;

  constructor() {
    super("dr-title");
  }

  init() {
    this.loading = false;
    this.card = [];
    this.dots = [];
  }

  create() {
    registerRacingArt(this);
    this.makeBackground();
    this.add.image(0, 0, "dr-title-bg").setOrigin(0);

    // header: SCAMBOY + logo
    this.add.image(10, 8, "dr-face-scam-big").setOrigin(0);
    const kart = this.add.sprite(292, 30, CAR_KEYS[3], 0).setScale(2);
    this.tweens.add({ targets: kart, y: 27, yoyo: true, repeat: -1, duration: 260, ease: "Sine.InOut" });
    this.time.addEvent({ delay: 90, loop: true, callback: () => kart.setFrame((Number(kart.frame.name) + 1) % 2) });
    this.txt(62, 10, "SCAMBOY", { size: 8, color: PAL.offwhite });
    const logo = this.txt(62, 22, "DIRTY RACING", { size: 16, color: PAL.magentaLight, stroke: PAL.ink, strokeThickness: 4 });
    this.tweens.add({ targets: logo, y: 21, yoyo: true, repeat: -1, duration: 700 });
    this.txt(62, 46, "WIN BY CHEATING. RESPONSIBLY.", { size: 8, color: PAL.yellow });

    // rivals strip
    this.txt(W / 2, 206, "- RIVALS -", { size: 8, color: PAL.grayLight, originX: 0.5 });
    const keys = ["dr-face-granny", "dr-face-skid", "dr-face-rico"];
    RIVALS.forEach((r, i) => {
      const x = 54 + i * 106;
      this.add.image(x, 216, keys[i]).setOrigin(0.5, 0);
      this.txt(x, 238, r.name, { size: 8, color: r.body, originX: 0.5, stroke: PAL.ink, strokeThickness: 2 });
    });
    this.txt(W / 2, 255, "UP GAS  B DRIFT  A BOOST", { size: 8, color: PAL.offwhite, originX: 0.5 });
    const hint = this.txt(W / 2, 267, "< > TRACK    A START", { size: 8, color: PAL.yellow, originX: 0.5 });
    this.tweens.add({ targets: hint, alpha: 0.35, yoyo: true, repeat: -1, duration: 500 });

    // arrows
    const la = this.add.image(18, 128, "dr-arrow", 0);
    const ra = this.add.image(W - 18, 128, "dr-arrow", 1);
    this.tweens.add({ targets: la, x: 14, yoyo: true, repeat: -1, duration: 400 });
    this.tweens.add({ targets: ra, x: W - 14, yoyo: true, repeat: -1, duration: 400 });

    for (let i = 0; i < TRACKS.length; i++) {
      this.dots.push(this.add.rectangle(W / 2 - 12 + i * 12, 197, 6, 6, PAL.grayDark).setStrokeStyle(1, PAL.ink));
    }
    this.cardBox = this.add.container(0, 0);
    const unlocked = Arcade.progress().unlockedTracks;
    this.sel = Phaser.Math.Clamp(unlocked - 1, 0, TRACKS.length - 1);
    this.drawCard();
    Audio.playMusic("menu");
  }

  private makeBackground() {
    if (this.textures.exists("dr-title-bg")) return;
    const pc = new PixelCanvas(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const band = Math.floor((x + y * 0.6) / 18) % 2;
        let c = band ? PAL.navyDark : 0x16204a;
        if ((x + y * 0.6) % 18 < 1) c = PAL.navy;
        pc.set(x, y, c);
      }
    // checkered strips
    for (const y0 of [0, H - 6]) for (let x = 0; x < W; x += 3) pc.rect(x, y0 + ((x / 3) % 2) * 3, 3, 3, PAL.offwhite);
    for (const y0 of [0, H - 6]) for (let x = 0; x < W; x += 3) pc.rect(x, y0 + (((x / 3) + 1) % 2) * 3, 3, 3, PAL.ink);
    // speed streaks
    for (let i = 0; i < 26; i++) {
      const y = 10 + ((i * 53) % (H - 20));
      const x = (i * 97) % W;
      pc.rect(x, y, 10 + (i % 4) * 6, 1, PAL.navyLight);
    }
    registerTexture(this, "dr-title-bg", pc);
  }

  private drawCard() {
    this.cardBox.removeAll(true);
    const i = this.sel;
    const def = TRACKS[i];
    const prog = Arcade.progress();
    const locked = i >= prog.unlockedTracks;
    const found = prog.shortcuts;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      if (o instanceof Phaser.GameObjects.Text) o.setStroke("#15131c", 3);
      this.cardBox.add(o);
      return o;
    };
    const x0 = 34;
    const y0 = 60;
    const cw = W - 68;
    const ch = 130;
    add(this.add.rectangle(x0 + 3, y0 + 3, cw, ch, 0x000000, 0.45).setOrigin(0));
    add(this.add.rectangle(x0, y0, cw, ch, THEME_COLORS[def.theme], 1).setOrigin(0).setStrokeStyle(2, locked ? PAL.grayDark : PAL.magenta));
    add(this.add.rectangle(x0 + 4, y0 + 4, cw - 8, 14, PAL.ink, 0.6).setOrigin(0));
    add(this.txt(W / 2, y0 + 7, `${i + 1}. ${def.name}`, { size: 8, color: locked ? PAL.grayLight : PAL.yellow, originX: 0.5 }));

    const mkey = `dr-prev-${i}-${found.length}`;
    if (!this.textures.exists(mkey)) {
      registerTexture(this, mkey, renderMinimap(def, 72, (k) => found.includes(`${i}:${def.shortcuts[k].id}`)));
    }
    add(this.add.rectangle(x0 + 8, y0 + 24, 80, 80, PAL.ink, 0.7).setOrigin(0));
    const mini = add(this.add.image(x0 + 12, y0 + 28, mkey).setOrigin(0));
    const sx = x0 + 98;
    if (locked) {
      mini.setAlpha(0.25);
      add(this.add.image(x0 + 48, y0 + 64, "dr-lock"));
      add(this.txt(sx, y0 + 34, "LOCKED", { size: 8, color: PAL.red }));
      add(this.txt(sx, y0 + 50, `WIN ${TRACKS[i - 1].short}`, { size: 8, color: PAL.offwhite }));
      add(this.txt(sx, y0 + 62, "TO UNLOCK", { size: 8, color: PAL.offwhite }));
    } else {
      const bl = prog.bestLaps[i];
      const br = prog.bestRaces[i];
      const secrets = def.shortcuts.filter((s) => found.includes(`${i}:${s.id}`)).length;
      add(this.txt(sx, y0 + 28, "BEST LAP", { size: 8, color: PAL.grayLight }));
      add(this.txt(sx, y0 + 38, bl ? fmtTime(bl / 1000) : "--:--.--", { size: 8, color: PAL.offwhite }));
      add(this.txt(sx, y0 + 52, "BEST RACE", { size: 8, color: PAL.grayLight }));
      add(this.txt(sx, y0 + 62, br ? fmtTime(br / 1000) : "--:--.--", { size: 8, color: PAL.offwhite }));
      add(this.txt(sx, y0 + 76, "SHORTCUTS", { size: 8, color: PAL.grayLight }));
      add(this.txt(sx, y0 + 86, `${secrets}/${def.shortcuts.length} FOUND`, { size: 8, color: secrets === def.shortcuts.length ? PAL.yellow : PAL.offwhite }));
    }
    add(this.txt(W / 2, y0 + ch - 18, `${def.laps} LAPS  4 RACERS`, { size: 8, color: PAL.offwhite, originX: 0.5 }));
    this.dots.forEach((d, k) => d.setFillStyle(k === i ? PAL.magenta : k < prog.unlockedTracks ? PAL.grayLight : PAL.grayDark));
    this.cardBox.setScale(1);
  }

  update() {
    if (this.loading) return;
    const pad = this.pad;
    const n = TRACKS.length;
    if (pad.justDown("left") || pad.justDown("right")) {
      this.sel = (this.sel + (pad.justDown("left") ? n - 1 : 1)) % n;
      Audio.sfx("move");
      this.drawCard();
      this.cardBox.x = pad.justDown("left") ? -12 : 12;
      this.tweens.add({ targets: this.cardBox, x: 0, duration: 120, ease: "Quad.Out" });
    }
    if (pad.justDown("a")) {
      if (this.sel >= Arcade.progress().unlockedTracks) {
        Audio.sfx("error");
        this.tweens.add({ targets: this.cardBox, x: 4, yoyo: true, repeat: 3, duration: 40 });
        return;
      }
      Audio.sfx("select");
      this.loading = true;
      this.add.rectangle(0, 0, W, H, PAL.ink, 0.75).setOrigin(0).setDepth(50);
      this.txt(W / 2, H / 2 - 8, "LOADING TRACK...", { size: 8, color: PAL.yellow, originX: 0.5 }).setDepth(51);
      this.txt(W / 2, H / 2 + 8, "TIGHTEN YOUR CAP", { size: 8, color: PAL.offwhite, originX: 0.5 }).setDepth(51);
      const track = this.sel;
      this.time.delayedCall(60, () => this.scene.start("dr-race", { track }));
    }
  }
}
