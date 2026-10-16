import type * as Phaser from "phaser";
import { CUP_H, TEX, cupFrame } from "./art";
import { applyMove, isValidOrder, SLOTS, type Move } from "./ShuffleSystem";
import { counterP } from "./util";

/** x position of each table slot */
export const SLOT_X: readonly number[] = [96, 160, 224];
/** resting baseline (bottom of the cups) on the felt */
export const REST_Y = 184;
const ARC_FRONT = 8;
const ARC_BACK = -10;
const ARC_WRAP = -15;
const ARC_SLIDE = 6;

/** One physical cup. The scene animates these numbers; `sync()` pushes them to sprites. */
export class CupView {
  x: number;
  baseY = REST_Y;
  lift = 0;
  /** jiggle offset used by fakes */
  jx = 0;
  tilt = 0;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly id: number,
    x: number,
  ) {
    this.x = x;
    this.shadow = scene.add.image(x, REST_Y, TEX.shadow).setAlpha(0.32).setDepth(60);
    this.sprite = scene.add.sprite(x, REST_Y, TEX.cup, cupFrame(id, false)).setOrigin(0.5, 1);
    this.sync();
  }

  get depth() {
    return 100 + this.baseY;
  }

  /** screen-space y of the top of the cup (where a hand grips it) */
  get topY() {
    return this.baseY - this.lift - CUP_H + 3;
  }

  get screenX() {
    return this.x + this.jx;
  }

  sync() {
    const px = Math.round(this.x + this.jx);
    this.sprite.setPosition(px, Math.round(this.baseY - this.lift) + 2);
    this.sprite.setAngle(this.tilt);
    this.sprite.setFrame(cupFrame(this.id, this.lift > 5));
    this.sprite.setDepth(this.depth);
    const k = Math.max(0.5, 1 - this.lift / 60);
    this.shadow.setPosition(px, Math.round(this.baseY) - 1);
    this.shadow.setScale(k, 1);
    this.shadow.setAlpha(0.32 * k);
  }
}

export interface MovePath {
  cup: CupView;
  fromX: number;
  toX: number;
  arc: number;
}

/**
 * Owns the three cups, their logical order and the stone.
 * `order` is the single source of truth: order[slot] = cup id. The stone belongs to
 * a cup id (`stoneCup`) and therefore moves with that cup through every permutation.
 */
export class CupManager {
  readonly cups: CupView[] = [];
  order: number[] = [0, 1, 2];
  stoneCup = 0;
  readonly stone: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    for (let i = 0; i < SLOTS; i++) this.cups.push(new CupView(scene, i, SLOT_X[i]));
    this.stone = scene.add.image(0, 0, TEX.stone).setOrigin(0.5, 1);
    this.sync();
  }

  cupAt(slot: number): CupView {
    return this.cups[this.order[slot]];
  }

  slotOf(cupId: number): number {
    return this.order.indexOf(cupId);
  }

  get stoneSlot(): number {
    return this.slotOf(this.stoneCup);
  }

  /** hide the stone under the cup currently standing on `slot` */
  placeStone(slot: number) {
    this.stoneCup = this.order[slot];
  }

  /** the ONLY win test: does the cup on this slot own the stone? */
  isWinningSlot(slot: number): boolean {
    return this.order[slot] === this.stoneCup;
  }

  /** visual paths for a real move, derived from the very same permutation the logic applies */
  plan(move: Move): MovePath[] {
    const next = applyMove(this.order, move);
    const paths: MovePath[] = [];
    for (const cup of this.cups) {
      const from = this.order.indexOf(cup.id);
      const to = next.indexOf(cup.id);
      if (from !== to) paths.push({ cup, fromX: SLOT_X[from], toX: SLOT_X[to], arc: 0 });
    }
    if (paths.length === 2) {
      // one cup passes in front (lower on screen, drawn on top), the other behind
      const front = Math.random() < 0.5 ? 0 : 1;
      paths[front].arc = ARC_FRONT;
      paths[1 - front].arc = ARC_BACK;
    } else {
      // rotation: the cup travelling two slots swings round the back
      for (const p of paths) p.arc = Math.abs(p.toX - p.fromX) > SLOT_X[1] - SLOT_X[0] ? ARC_WRAP : ARC_SLIDE;
    }
    return paths;
  }

  /** animate a real move, then commit it to the logical order and snap to slots */
  async playMove(move: Move, paths: MovePath[], ms: number): Promise<void> {
    await counterP(this.scene, ms, (t) => {
      for (const p of paths) {
        p.cup.x = p.fromX + (p.toX - p.fromX) * t;
        p.cup.baseY = REST_Y + Math.sin(Math.PI * t) * p.arc;
      }
    });
    this.order = applyMove(this.order, move);
    this.snap();
  }

  /** cups on slots a and b start to swap, hesitate, and slide back home */
  async playFeint(move: Extract<Move, { kind: "fake" }>, ms: number): Promise<void> {
    const before = this.order.join();
    const ca = this.cupAt(move.a);
    const cb = this.cupAt(move.b);
    const ax = SLOT_X[move.a];
    const bx = SLOT_X[move.b];
    const reach = 0.3;
    await counterP(
      this.scene,
      ms * 0.5,
      (t) => {
        ca.x = ax + (bx - ax) * t;
        cb.x = bx + (ax - bx) * t;
        ca.baseY = REST_Y + Math.sin(Math.PI * t) * ARC_FRONT;
        cb.baseY = REST_Y + Math.sin(Math.PI * t) * ARC_BACK;
      },
      { to: reach, yoyo: true, hold: 60, ease: "Quad.easeOut" },
    );
    this.assertUnchanged(before);
    this.snap();
  }

  /** a cup twitches as if it is about to move, then settles */
  async playTwitch(move: Extract<Move, { kind: "fake" }>, ms: number): Promise<void> {
    const before = this.order.join();
    const c = this.cupAt(move.a);
    await counterP(
      this.scene,
      ms * 0.9,
      (t) => {
        // wobble only — never lifts, so the stone can't peek out
        const w = Math.sin(t * Math.PI * 6) * (1 - t);
        c.jx = Math.round(w * 3);
        c.tilt = w * 6;
      },
      { ease: "Linear" },
    );
    c.tilt = 0;
    this.assertUnchanged(before);
    this.snap();
  }

  liftCup(cup: CupView, height: number, ms: number): Promise<void> {
    const from = cup.lift;
    const fromTilt = cup.tilt;
    const toTilt = height > 0 ? (cup.x < SLOT_X[1] ? -7 : cup.x > SLOT_X[1] ? 7 : -5) : 0;
    return counterP(
      this.scene,
      ms,
      (t) => {
        cup.lift = from + (height - from) * t;
        cup.tilt = fromTilt + (toTilt - fromTilt) * t;
      },
      { ease: height > from ? "Back.easeOut" : "Quad.easeIn" },
    );
  }

  /** Put every cup exactly on the slot its logical order says (no drift, ever). */
  snap() {
    if (!isValidOrder(this.order)) throw new Error(`ShellGame: invalid cup order ${this.order.join()}`);
    for (let slot = 0; slot < SLOTS; slot++) {
      const cup = this.cupAt(slot);
      cup.x = SLOT_X[slot];
      cup.baseY = REST_Y;
      cup.jx = 0;
    }
    this.sync();
  }

  private assertUnchanged(before: string) {
    if (this.order.join() !== before) throw new Error("ShellGame: a fake move changed the cup order");
  }

  /** push model -> sprites; the stone rides with the cup that owns it */
  sync() {
    for (const c of this.cups) c.sync();
    const owner = this.cups[this.stoneCup];
    this.stone.setPosition(Math.round(owner.screenX), Math.round(owner.baseY) + 1);
    this.stone.setDepth(owner.depth - 0.5);
  }
}
