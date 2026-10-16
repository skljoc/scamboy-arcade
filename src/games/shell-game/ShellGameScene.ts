import * as Phaser from "phaser";
import { BaseScene, W } from "../engine/BaseScene";
import { PAL, hex } from "../engine/palette";
import { Audio } from "../engine/AudioManager";
import { Arcade } from "../engine/bridge";
import { registerAnim } from "../engine/pixel";
import { HEAD, TABLE_X, TABLE_Y, TEX, buildShellArt, panelTexture } from "./art";
import { CupManager, type CupView } from "./CupManager";
import { Scamboy, type Side } from "./Scamboy";
import { MAX_LEVEL, generateSequence, levelConfig, type LevelConfig, type Move } from "./ShuffleSystem";
import { pickOne, tweenP, waitP } from "./util";

type Phase = "title" | "busy" | "ready" | "choose" | "end";

const LIVES = 3;
const LIFT = 26;
const TIER_COLORS = [PAL.green, PAL.orange, PAL.magentaLight] as const;

const INTRO_LINES = ["Keep your eye on the stone!", "Watch closely, pal...", "Here's the stone!", "Follow the pebble!", "Easy peasy, right?"];
const CHOOSE_LINES = ["Pick a cup, any cup!", "Which one, champ?", "Go on, pick one!", "Feeling lucky?"];
const CORRECT_LINES = ["You got me!", "No way!", "Beginner's luck!", "Hey! How?!"];
const MASTER_LINES = ["Eyes on me...", "Faster now!", "Try THIS one!"];

interface Pigeon {
  sprite: Phaser.GameObjects.Sprite;
  next: number;
  baseX: number;
  dir: 1 | -1;
}

export class ShellGameScene extends BaseScene {
  private cups!: CupManager;
  private boy!: Scamboy;
  private phase: Phase = "title";
  private level = 1;
  private score = 0;
  private lives = LIVES;
  private streak = 0;
  private bestStreak = 0;
  private cursor = 1;
  private clock = 0;
  private finished = false;
  private endResult: { completed: boolean; detail: string } = { completed: false, detail: "LV 1" };

  private pointer!: Phaser.GameObjects.Sprite;
  private hudLevel!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private hudTier!: Phaser.GameObjects.Text;
  private hudStreak!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Sprite[] = [];
  private promptBox!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private neon!: Phaser.GameObjects.Sprite;
  private glow!: Phaser.GameObjects.Image;
  private cat!: Phaser.GameObjects.Sprite;
  private pigeons: Pigeon[] = [];
  private catBlinkUntil = 0;
  private nextCatBlink = 3000;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor() {
    super("ShellGame");
  }

  create() {
    buildShellArt(this);
    registerAnim(this, "sg-sparkle", TEX.sparkle, [0, 1, 2, 3, 2, 1, 0], 18, 0);

    this.phase = "title";
    this.level = 1;
    this.score = 0;
    this.lives = LIVES;
    this.streak = 0;
    this.bestStreak = 0;
    this.cursor = 1;
    this.clock = 0;
    this.finished = false;
    this.overlay = null;
    this.hearts = [];
    this.pigeons = [];
    this.confetti = null;

    // ---- world
    this.add.image(0, 0, TEX.bg).setOrigin(0, 0).setDepth(0);
    this.glow = this.add.image(17, 22, TEX.glow).setOrigin(0.5, 0.2).setDepth(2);
    this.tweens.add({ targets: this.glow, alpha: 0.75, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.neon = this.add.sprite(242, 58, TEX.neon, 0).setOrigin(0, 0).setDepth(3);
    this.cat = this.add.sprite(300, 135, TEX.cat, 0).setOrigin(0.5, 1).setDepth(4);
    this.addPigeon(18, 1);
    this.addPigeon(300, -1);
    this.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        const r = Math.random();
        this.neon.setFrame(r < 0.04 || (Number(this.neon.frame.name) === 1 && r < 0.5) ? 1 : 0);
      },
    });

    this.boy = new Scamboy(this);
    this.add.image(TABLE_X, TABLE_Y, TEX.table).setOrigin(0, 0).setDepth(40);
    this.cups = new CupManager(this);
    for (const cup of this.cups.cups) {
      cup.sprite.setInteractive({ useHandCursor: true });
      cup.sprite.on("pointerdown", () => this.onCupTapped(cup));
      cup.sprite.on("pointerover", () => this.onCupHover(cup));
    }

    this.pointer = this.add.sprite(160, 120, TEX.pointer, 0).setOrigin(0.5, 1).setDepth(600).setVisible(false);

    this.buildHud();
    this.buildPrompt();

    Audio.playMusic("shell");
    Arcade.setScore(0);
    this.showTitle();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  // ================================================================ setup helpers

  private addPigeon(x: number, dir: 1 | -1) {
    const sprite = this.add.sprite(x, 269, TEX.pigeon, 0).setOrigin(0.5, 1).setDepth(5).setFlipX(dir === 1);
    this.pigeons.push({ sprite, next: 500 + Math.random() * 1500, baseX: x, dir });
  }

  private buildHud() {
    this.add.image(0, 0, TEX.hud).setOrigin(0, 0).setDepth(800);
    this.hudLevel = this.txt(8, 3, "", { color: PAL.yellow }).setDepth(801);
    this.hudScore = this.txt(76, 3, "", { color: PAL.offwhite }).setDepth(801);
    this.hudTier = this.txt(8, 13, "", { color: PAL.green }).setDepth(801);
    this.hudStreak = this.txt(312, 13, "", { color: PAL.grayLight, originX: 1 }).setDepth(801);
    for (let i = 0; i < LIVES; i++) {
      this.hearts.push(this.add.sprite(286 + i * 10, 3, TEX.heart, 0).setOrigin(0, 0).setDepth(801));
    }
    this.txt(244, 3, "LIFE", { color: PAL.magentaLight }).setDepth(801);
    this.refreshHud();
  }

  private buildPrompt() {
    const bg = this.add.image(0, 0, TEX.prompt);
    this.promptText = this.txt(0, 1, "", { color: PAL.offwhite, originX: 0.5, originY: 0.5 });
    this.promptBox = this.add.container(W / 2, 277, [bg, this.promptText]).setDepth(850).setVisible(false);
    this.tweens.add({ targets: this.promptText, alpha: 0.45, duration: 520, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [2] });
  }

  private setPrompt(text: string | null) {
    if (!text) {
      this.promptBox.setVisible(false);
      return;
    }
    this.promptText.setText(text);
    this.promptBox.setVisible(true);
  }

  private refreshHud() {
    const cfg = levelConfig(this.level);
    this.hudLevel.setText(`LV ${String(this.level).padStart(2, "0")}`);
    this.hudScore.setText(`SCORE ${String(this.score).padStart(6, "0")}`);
    this.hudTier.setText(cfg.tierName).setColor(hex(TIER_COLORS[cfg.tier]));
    this.hudStreak.setText(`STREAK x${this.streak}`).setColor(this.streak >= 2 ? "#ffd23f" : "#c4c6d0");
    this.hearts.forEach((h, i) => h.setFrame(i < this.lives ? 0 : 1));
  }

  private addScore(n: number) {
    this.score += n;
    Arcade.setScore(this.score);
    this.refreshHud();
  }

  // ================================================================ overlays

  private clearOverlay() {
    if (!this.overlay) return;
    const o = this.overlay;
    this.overlay = null;
    this.tweens.add({ targets: o, y: o.y + 12, alpha: 0, duration: 160, onComplete: () => o.destroy() });
  }

  private makePanel(w: number, h: number, cy: number): Phaser.GameObjects.Container {
    const panel = this.add.image(0, 0, panelTexture(this, w, h));
    const c = this.add.container(W / 2, cy, [panel]).setDepth(900);
    c.setAlpha(0);
    c.y += 10;
    this.tweens.add({ targets: c, alpha: 1, y: cy, duration: 220, ease: "Back.easeOut" });
    return c;
  }

  private showTitle() {
    this.phase = "title";
    const c = this.makePanel(264, 108, 204);
    const best = Arcade.progress().shellBestLevel;
    c.add([
      this.txt(0, -42, "SCAMBOY'S", { color: PAL.magentaLight, originX: 0.5 }),
      this.txt(0, -30, "SHELL GAME", { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }),
      this.txt(0, -6, "KEEP YOUR EYE", { color: PAL.offwhite, originX: 0.5 }),
      this.txt(0, 5, "ON THE STONE", { color: PAL.offwhite, originX: 0.5 }),
      this.txt(0, 19, best > 0 ? `BEST: LV ${best}` : "10 LEVELS - 3 LIVES", { color: PAL.grayLight, originX: 0.5 }),
    ]);
    const start = this.txt(0, 34, "A: START", { color: PAL.yellow, originX: 0.5 });
    c.add(start);
    this.tweens.add({ targets: start, alpha: 0.2, duration: 420, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [1] });
    this.overlay = c;
    this.boy.setMood("grin");
    this.boy.say("Step right up!", 0);
  }

  private async showBanner(cfg: LevelConfig) {
    const w = 208;
    const h = 46;
    const panel = this.add.image(0, 0, panelTexture(this, w, h));
    const title = this.txt(0, -9, `LEVEL ${cfg.level}`, { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5, originY: 0.5 });
    const tier = this.txt(0, 11, cfg.tierName, { color: TIER_COLORS[cfg.tier], originX: 0.5, originY: 0.5 });
    const c = this.add.container(-w, 206, [panel, title, tier]).setDepth(900);
    Audio.sfx(cfg.level === 1 || cfg.level === 4 || cfg.level === 7 ? "go" : "countdown");
    await tweenP(this, { targets: c, x: W / 2, duration: 260, ease: "Back.easeOut" }).done;
    if (cfg.level === 4 || cfg.level === 7) {
      this.shake(0.004, 160);
      this.popText(W / 2, 170, "TIER UP!", TIER_COLORS[cfg.tier], 16);
    }
    await waitP(this, 950);
    await tweenP(this, { targets: c, x: W + w, duration: 220, ease: "Back.easeIn" }).done;
    c.destroy();
  }

  private sparkle(x: number, y: number, delay = 0) {
    this.time.delayedCall(delay, () => {
      const s = this.add.sprite(x, y, TEX.sparkle, 0).setDepth(620);
      s.play("sg-sparkle");
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    });
  }

  private sparkleStone() {
    const s = this.cups.stone;
    this.sparkle(s.x - 6, s.y - 8, 0);
    this.sparkle(s.x + 7, s.y - 4, 110);
    this.sparkle(s.x, s.y - 12, 220);
  }

  // ================================================================ game flow

  private startGame() {
    Audio.sfx("select");
    this.clearOverlay();
    this.boy.hush();
    void this.startLevel();
  }

  private async startLevel() {
    this.phase = "busy";
    const cfg = levelConfig(this.level);
    Arcade.progress().setShellBestLevel(this.level);
    this.refreshHud();
    this.boy.setMood("smile");
    await this.showBanner(cfg);
    await this.newRound();
  }

  /** hide the stone under a random cup, show it, then wait for A / B */
  private async newRound() {
    this.phase = "busy";
    this.cups.placeStone(Phaser.Math.Between(0, 2));
    this.boy.setMood("grin");
    this.boy.idleLook = true;
    this.boy.say(pickOne(INTRO_LINES), 2200);
    await this.revealStone();
    this.readyPhase();
  }

  private readyPhase() {
    this.phase = "ready";
    this.setPrompt("A: SHUFFLE  B: PEEK AGAIN");
  }

  /** lift the cup that owns the stone, hold, lower */
  private async revealStone() {
    const cfg = levelConfig(this.level);
    const cup = this.cups.cupAt(this.cups.stoneSlot);
    const side = this.boy.sideFor(cup.x);
    await this.boy.reach(side, cup, 240);
    Audio.sfx("lift");
    await this.cups.liftCup(cup, LIFT, 240);
    this.sparkleStone();
    await waitP(this, cfg.tier === 0 ? 1000 : cfg.tier === 1 ? 800 : 650);
    await this.cups.liftCup(cup, 0, 180);
    Audio.sfx("shuffle");
    await this.boy.rest(side, 200);
  }

  private async peekAgain() {
    this.phase = "busy";
    this.setPrompt(null);
    Audio.sfx("select");
    this.boy.say("Fine, one more look!", 1600);
    await this.revealStone();
    this.readyPhase();
  }

  private async shuffle() {
    this.phase = "busy";
    this.setPrompt(null);
    Audio.sfx("select");
    const cfg = levelConfig(this.level);
    const seq = generateSequence(this.level, this.cups.stoneSlot);
    this.boy.idleLook = false;
    this.boy.setLook(0);
    this.boy.setMood("grin");
    this.boy.say(cfg.tier === 2 ? pickOne(MASTER_LINES) : "Here we go!", 1000);
    await waitP(this, 350);

    for (const move of seq) {
      if (move.kind === "fake") await this.playFake(move, cfg);
      else await this.playReal(move, cfg);
      if (cfg.gapMs > 0) await waitP(this, cfg.gapMs);
    }
    await this.boy.restAll(240);
    this.choosePhase();
  }

  private async playReal(move: Move, cfg: LevelConfig) {
    const paths = this.cups.plan(move);
    // the two cups travelling furthest get a hand each; left hand takes the one starting further left
    const grabbed = [...paths]
      .sort((a, b) => Math.abs(b.toX - b.fromX) - Math.abs(a.toX - a.fromX))
      .slice(0, 2)
      .sort((a, b) => a.fromX - b.fromX);
    await Promise.all(grabbed.map((p, i) => this.boy.reach(i as Side, p.cup, cfg.reachMs)));
    Audio.sfx("shuffle");
    await this.cups.playMove(move, paths, cfg.moveMs);
  }

  private async playFake(move: Extract<Move, { kind: "fake" }>, cfg: LevelConfig) {
    if (move.style === "feint") {
      const lo = Math.min(move.a, move.b);
      const hi = Math.max(move.a, move.b);
      await Promise.all([this.boy.reach(0, this.cups.cupAt(lo), cfg.reachMs), this.boy.reach(1, this.cups.cupAt(hi), cfg.reachMs)]);
      Audio.sfx("whoosh");
      await this.cups.playFeint({ ...move, a: lo, b: hi }, cfg.moveMs);
    } else {
      const cup = this.cups.cupAt(move.a);
      // one hand wobbles a cup while the other fakes a grab on a different cup and pulls back
      const side = this.boy.sideFor(cup.x);
      const otherSide: Side = side === 0 ? 1 : 0;
      const decoySlot = otherSide === 0 ? (move.a === 0 ? 1 : 0) : move.a === 2 ? 1 : 2;
      await Promise.all([
        this.boy.reach(side, cup, cfg.reachMs),
        this.boy.reach(otherSide, this.cups.cupAt(decoySlot), cfg.reachMs),
      ]);
      Audio.sfx("click");
      await Promise.all([this.cups.playTwitch(move, cfg.moveMs), this.boy.rest(otherSide, cfg.moveMs * 0.8)]);
    }
  }

  private choosePhase() {
    this.phase = "choose";
    this.cursor = 1;
    this.boy.tapping = true;
    this.boy.setMood("smile");
    this.boy.say(pickOne(CHOOSE_LINES), 0);
    this.pointer.setVisible(true).setFrame(0);
    this.setPrompt("LEFT/RIGHT MOVE  A: PICK");
  }

  private moveCursor(slot: number) {
    if (slot === this.cursor) return;
    this.cursor = Phaser.Math.Clamp(slot, 0, 2);
    Audio.sfx("move");
  }

  private onCupHover(cup: CupView) {
    if (this.phase !== "choose") return;
    this.moveCursor(this.cups.slotOf(cup.id));
  }

  private onCupTapped(cup: CupView) {
    if (this.phase === "choose") {
      this.cursor = this.cups.slotOf(cup.id);
      void this.choose(this.cursor);
    }
  }

  private async choose(slot: number) {
    this.phase = "busy";
    this.setPrompt(null);
    Audio.sfx("select");
    this.pointer.setFrame(1);
    this.boy.tapping = false;
    this.boy.hush();
    const cup = this.cups.cupAt(slot);
    // the ONLY thing that decides the result: does this cup own the stone?
    const win = this.cups.isWinningSlot(slot);
    const side = this.boy.sideFor(cup.x);
    await this.boy.reach(side, cup, 200);
    this.pointer.setVisible(false);
    Audio.sfx("lift");
    await this.cups.liftCup(cup, LIFT, 260);
    if (win) await this.onCorrect(cup, side);
    else await this.onWrong(cup, side);
  }

  private async onCorrect(cup: CupView, side: Side) {
    Audio.sfx("correct");
    this.sparkleStone();
    this.boy.express(HEAD.sweat, 900);
    this.boy.say(pickOne(CORRECT_LINES), 1800);
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const bonus = this.streak > 1 ? 50 * (this.streak - 1) * this.level : 0;
    const gain = 100 * this.level + bonus;
    this.addScore(gain);
    this.popText(cup.x, cup.topY - 6, `+${gain}`, PAL.yellow, 8);
    if (this.streak >= 2) this.time.delayedCall(260, () => this.popText(W / 2, 128, `STREAK x${this.streak}!`, PAL.magentaLight, 16));
    Arcade.achieve("lucky-guess");
    if (this.streak >= 5) Arcade.achieve("hot-streak");
    await waitP(this, 900);
    this.boy.express(HEAD.angry, 900);
    await waitP(this, 700);
    await this.cups.liftCup(cup, 0, 180);
    await this.boy.rest(side, 200);

    if (this.level >= MAX_LEVEL) {
      this.victory();
      return;
    }
    this.level++;
    await this.startLevel();
  }

  private async onWrong(cup: CupView, side: Side) {
    Audio.sfx("wrong");
    this.boy.laugh(2600);
    this.shake(0.005, 140);
    await waitP(this, 420);
    // show where the stone really was
    const real = this.cups.cupAt(this.cups.stoneSlot);
    const other: Side = side === 0 ? 1 : 0;
    await this.boy.reach(other, real, 220);
    Audio.sfx("lift");
    await this.cups.liftCup(real, LIFT, 240);
    this.sparkleStone();
    this.boy.say("YOU GOT SCAMMED!", 2000);
    this.streak = 0;
    this.lives = Math.max(0, this.lives - 1);
    this.refreshHud();
    const heart = this.hearts[this.lives];
    if (heart) {
      heart.setFrame(0);
      this.tweens.add({
        targets: heart,
        scale: 1.8,
        duration: 140,
        yoyo: true,
        repeat: 1,
        onComplete: () => heart.setScale(1).setFrame(1),
      });
    }
    this.popText(W / 2, 128, "-1 LIFE", PAL.red, 16);
    await waitP(this, 1800);
    await Promise.all([this.cups.liftCup(cup, 0, 180), this.cups.liftCup(real, 0, 180)]);
    await this.boy.restAll(220);

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    this.boy.say("Again! Same level!", 1400);
    await waitP(this, 700);
    await this.newRound();
  }

  private victory() {
    this.phase = "busy";
    Arcade.achieve("master-scammer");
    Arcade.progress().setShellBestLevel(MAX_LEVEL);
    Audio.sfx("win");
    this.boy.express(HEAD.shock, 1500);
    this.time.delayedCall(1500, () => this.boy.express(HEAD.sad, 600000));
    this.boy.say("Teach me, master!", 0);
    this.confetti = this.add.particles(0, -6, TEX.confetti, {
      frame: [0, 1, 2, 3, 4, 5, 6, 7],
      x: { min: 0, max: W },
      speedY: { min: 40, max: 100 },
      speedX: { min: -25, max: 25 },
      gravityY: 18,
      lifespan: 4200,
      quantity: 2,
      frequency: 50,
    });
    this.confetti.setDepth(950);
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => this.sparkle(Phaser.Math.Between(20, W - 20), Phaser.Math.Between(40, 260)),
    });
    const c = this.makePanel(296, 112, 200);
    c.add([
      this.txt(0, -40, "YOU ARE THE", { size: 16, color: PAL.offwhite, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }),
      this.txt(0, -20, "MASTER SCAMMER!", { size: 16, color: PAL.yellow, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }),
      this.txt(0, 4, `SCORE ${String(this.score).padStart(6, "0")}`, { color: PAL.offwhite, originX: 0.5 }),
      this.txt(0, 16, `BEST STREAK x${this.bestStreak}`, { color: PAL.magentaLight, originX: 0.5 }),
    ]);
    const cont = this.txt(0, 32, "A: CONTINUE", { color: PAL.yellow, originX: 0.5 });
    c.add(cont);
    this.tweens.add({ targets: cont, alpha: 0.2, duration: 420, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [1] });
    this.overlay = c;
    this.shake(0.006, 220);
    this.endResult = { completed: true, detail: "LV10 CLEAR" };
    this.time.delayedCall(900, () => (this.phase = "end"));
  }

  private gameOver() {
    this.phase = "busy";
    Audio.sfx("lose");
    this.boy.laugh(600000);
    this.boy.say("Better luck next time!", 0);
    const c = this.makePanel(244, 104, 204);
    c.add([
      this.txt(0, -36, "GAME OVER", { size: 16, color: PAL.red, stroke: PAL.ink, strokeThickness: 4, originX: 0.5 }),
      this.txt(0, -12, `SCORE ${String(this.score).padStart(6, "0")}`, { color: PAL.offwhite, originX: 0.5 }),
      this.txt(0, 0, `REACHED LV ${this.level}`, { color: PAL.grayLight, originX: 0.5 }),
      this.txt(0, 12, `BEST STREAK x${this.bestStreak}`, { color: PAL.magentaLight, originX: 0.5 }),
    ]);
    const cont = this.txt(0, 28, "A: CONTINUE", { color: PAL.yellow, originX: 0.5 });
    c.add(cont);
    this.tweens.add({ targets: cont, alpha: 0.2, duration: 420, yoyo: true, repeat: -1, ease: "Stepped", easeParams: [1] });
    this.overlay = c;
    this.endResult = { completed: false, detail: `LV ${this.level}` };
    this.time.delayedCall(900, () => (this.phase = "end"));
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    Audio.sfx("select");
    Arcade.finish({ score: this.score, completed: this.endResult.completed, detail: this.endResult.detail });
  }

  // ================================================================ per frame

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 100);
    this.clock += dt;
    const pad = this.pad;

    switch (this.phase) {
      case "title":
        if (pad.justDown("a")) this.startGame();
        break;
      case "ready":
        if (pad.justDown("a")) void this.shuffle();
        else if (pad.justDown("b")) void this.peekAgain();
        break;
      case "choose":
        if (pad.justDown("left")) this.moveCursor(this.cursor - 1);
        else if (pad.justDown("right")) this.moveCursor(this.cursor + 1);
        else if (pad.justDown("a")) void this.choose(this.cursor);
        break;
      case "end":
        if (pad.justDown("a")) this.finish();
        break;
      case "busy":
        break;
    }

    if (this.phase === "choose") this.boy.setLook(this.cursor === 0 ? -1 : this.cursor === 2 ? 1 : 0);
    this.boy.update(dt);
    this.cups.sync();

    if (this.pointer.visible) {
      const cup = this.cups.cupAt(this.cursor);
      this.pointer.setPosition(Math.round(cup.screenX), Math.round(cup.topY - 3 + Math.sin(this.clock / 130) * 2));
    }

    this.updateAmbient(dt);
  }

  private updateAmbient(dt: number) {
    // cat: lazy tail swish + blinks
    const tail = [0, 1, 2, 1][Math.floor(this.clock / 260) % 4];
    if (this.clock > this.nextCatBlink) {
      this.catBlinkUntil = this.clock + 160;
      this.nextCatBlink = this.clock + 2500 + Math.random() * 3500;
    }
    this.cat.setFrame(this.clock < this.catBlinkUntil ? 3 : tail);

    // pigeons: peck, shuffle about
    for (const p of this.pigeons) {
      p.next -= dt;
      if (p.next > 0) continue;
      const frame = Number(p.sprite.frame.name);
      if (frame !== 0) {
        p.sprite.setFrame(0);
        p.next = 400 + Math.random() * 1400;
      } else if (Math.random() < 0.6) {
        p.sprite.setFrame(1);
        p.next = 180 + Math.random() * 120;
      } else {
        p.sprite.setFrame(2);
        const nx = p.sprite.x + (Math.random() < 0.5 ? -2 : 2);
        p.sprite.x = Phaser.Math.Clamp(nx, p.baseX - 8, p.baseX + 8);
        p.next = 160;
      }
    }
  }

  private cleanup() {
    this.confetti?.destroy();
    this.confetti = null;
    if (Audio.currentSong === "shell") Audio.stopMusic();
  }
}

