/**
 * STREET RAMPAGE title: graffiti logo over the back alley, a giant flexing SCAMBOY with
 * sparkles, control hints and "A: FIGHT!".
 */
import { BaseScene, W, H } from "../engine/BaseScene";
import { Audio } from "../engine/AudioManager";
import { Arcade } from "../engine/bridge";
import { PAL } from "../engine/palette";
import { registerTexture } from "../engine/pixel";
import { registerCommon, registerBackground, TEX } from "./register";
import { BG_OFFSETS, FAR_F, MID_F, FACADE_TOP, GROUND_TOP, titleLogo } from "./bgArt";
import { PF } from "./art";
import { STAGES } from "./stages";
import type { RunData } from "./StreetRampageScene";
import type * as Phaser from "phaser";

const HINTS = ["A: PUNCH   B: JUMP", "A+B: FLEX SHOCKWAVE", ">> DOUBLE TAP: DASH", "DASH + A: SHOULDER CHARGE", "JUMP + A: DIVE PUNCH"];

export class TitleScene extends BaseScene {
  protected textYOffset = -4;
  private hero!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private sparkles: Phaser.GameObjects.Sprite[] = [];
  private hint!: Phaser.GameObjects.Text;
  private t = 0;
  private leaving = false;
  private scroll = 0;
  private layers: Array<{ img: Phaser.GameObjects.Image; f: number }> = [];

  constructor() {
    super("SR_Title");
  }

  create() {
    this.t = 0;
    this.leaving = false;
    this.scroll = 0;
    this.layers = [];
    this.sparkles = [];
    registerCommon(this);
    const st = STAGES[0];
    registerBackground(this, st.theme, st.worldW);
    if (!this.textures.exists("sr_logo")) registerTexture(this, "sr_logo", titleLogo());
    const off = BG_OFFSETS[st.theme];
    this.add.image(0, 0, TEX.bg(st.theme, "sky")).setOrigin(0);
    this.layers.push({ img: this.add.image(0, off.farY, TEX.bg(st.theme, "far")).setOrigin(0), f: FAR_F });
    this.layers.push({ img: this.add.image(0, off.midY, TEX.bg(st.theme, "mid")).setOrigin(0), f: MID_F });
    this.layers.push({ img: this.add.image(0, FACADE_TOP, TEX.bg(st.theme, "near")).setOrigin(0), f: 1 });
    this.layers.push({ img: this.add.image(0, GROUND_TOP, TEX.bg(st.theme, "ground")).setOrigin(0), f: 1 });
    // dim the backdrop so the logo pops
    this.add.image(0, 0, TEX.black).setOrigin(0).setDisplaySize(W, H).setAlpha(0.35);

    const logo = this.add.image(W / 2, 8, "sr_logo").setOrigin(0.5, 0).setScale(1);
    logo.setY(-110);
    this.tweens.add({ targets: logo, y: 6, duration: 600, ease: "Bounce.Out" });
    this.txt(W / 2, 4, "SCAMBOY", { color: PAL.magentaLight, stroke: PAL.ink, originX: 0.5 }).setDepth(5);

    this.shadow = this.add.image(W / 2, 252, TEX.shadowL).setScale(1.6, 1.4);
    this.hero = this.add.sprite(W / 2, 252, TEX.player, PF.flexBiceps).setOrigin(0.5, 62 / 64).setScale(2);
    for (let i = 0; i < 6; i++) this.sparkles.push(this.add.sprite(0, 0, TEX.sparkle, 0).setVisible(false).setDepth(10));

    const best = Arcade.progress().rampageBestStage;
    if (best > 0) this.txt(W - 4, 274, `BEST: STAGE ${best}`, { color: PAL.offwhite, stroke: PAL.ink, originX: 1 });
    this.hint = this.txt(W / 2, 258, HINTS[0], { color: PAL.offwhite, stroke: PAL.ink, originX: 0.5 }).setDepth(20);
    const fight = this.txt(W / 2, 272, "A: FIGHT!", { size: 8, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 3, originX: 0.5 }).setDepth(20);
    if (best > 0) fight.setX(W / 2 - 50);
    this.tweens.add({ targets: fight, alpha: 0.15, duration: 380, yoyo: true, repeat: -1 });
    Audio.playMusic("rampage");
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    this.t += dt;
    this.scroll += dt * 0.012;
    for (const l of this.layers) l.img.x = -Math.round(this.scroll * l.f);

    const poses = [PF.flexBiceps, PF.vicSingle, PF.vicMost, PF.vicBicepsGrin];
    const i = Math.floor(this.t / 900) % poses.length;
    this.hero.setFrame(poses[i]);
    if (Math.floor(this.t / 900) !== Math.floor((this.t - dt) / 900)) {
      this.hero.setScale(2.12, 1.92);
      this.tweens.add({ targets: this.hero, scaleX: 2, scaleY: 2, duration: 160 });
    }
    const k = Math.floor(this.t / 110);
    this.sparkles.forEach((s, j) => {
      const phase = (k + j * 3) % 18;
      if (phase < 4) {
        if (phase === 0) s.setPosition(W / 2 + Math.sin(j * 2.3 + k) * 56, 150 + Math.cos(j * 1.7 + k) * 40);
        s.setVisible(true).setFrame(phase);
      } else s.setVisible(false);
    });
    this.hint.setText(HINTS[Math.floor(this.t / 1800) % HINTS.length]);

    if (!this.leaving && this.pad.justDown("a")) {
      this.leaving = true;
      Audio.sfx("select");
      this.hero.setFrame(PF.flexBiceps);
      const fade = this.add.image(0, 0, TEX.black).setOrigin(0).setDisplaySize(W, H).setAlpha(0).setDepth(100);
      this.tweens.add({
        targets: fade,
        alpha: 1,
        duration: 350,
        onComplete: () => this.scene.start("SR_Stage", { stage: 0, score: 0, lives: 3, credits: 2 } satisfies RunData),
      });
    }
  }
}
