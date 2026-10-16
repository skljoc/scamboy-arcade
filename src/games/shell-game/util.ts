import type * as Phaser from "phaser";

/**
 * Promise wrappers around the scene clock / tween manager.
 * They resolve on completion *or* when the tween is stopped, so an interrupted
 * animation never leaves an awaiting coroutine hanging. If the scene shuts down,
 * pending promises simply never resolve and the coroutine is garbage collected.
 */
export function waitP(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(Math.max(0, ms), () => resolve());
  });
}

export function tweenP(scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): { tween: Phaser.Tweens.Tween; done: Promise<void> } {
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const tween = scene.tweens.add({
    ...cfg,
    onComplete: () => resolve(),
    onStop: () => resolve(),
  });
  return { tween, done };
}

/** animate a 0..1 (or from..to) counter; `onValue` gets the eased value each frame */
export function counterP(
  scene: Phaser.Scene,
  duration: number,
  onValue: (v: number) => void,
  opts: { from?: number; to?: number; ease?: string; yoyo?: boolean; hold?: number } = {},
): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: opts.from ?? 0,
      to: opts.to ?? 1,
      duration: Math.max(1, duration),
      ease: opts.ease ?? "Sine.easeInOut",
      yoyo: opts.yoyo ?? false,
      hold: opts.hold ?? 0,
      onUpdate: (tw: Phaser.Tweens.Tween) => onValue(tw.getValue() ?? 0),
      onComplete: () => resolve(),
      onStop: () => resolve(),
    });
  });
}

export function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length) % list.length];
}
