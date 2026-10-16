/**
 * GameManager — owns the single live Phaser.Game instance.
 * Exactly one game loop exists at a time; switching games destroys the previous instance.
 */
import type * as PhaserNS from "phaser";
import type { GameId } from "@/lib/games";
import { ensurePixelFont } from "./fonts";
import { Audio } from "./AudioManager";

type SceneList = PhaserNS.Types.Scenes.SceneType[];

const loaders: Record<GameId, () => Promise<{ scenes: SceneList }>> = {
  "street-rampage": () => import("../street-rampage"),
  "dirty-racing": () => import("../dirty-racing"),
  "shell-game": () => import("../shell-game"),
};

let current: PhaserNS.Game | null = null;
let token = 0;

export async function startGame(id: GameId, parent: HTMLElement): Promise<PhaserNS.Game | null> {
  destroyGame();
  const my = ++token;
  const [Phaser, mod] = await Promise.all([import("phaser"), loaders[id](), ensurePixelFont()]);
  if (my !== token) return null; // superseded while loading
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 320,
    height: 288,
    backgroundColor: "#000000",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    audio: { noAudio: true },
    fps: { target: 60, smoothStep: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { keyboard: false, gamepad: false, mouse: true, touch: true },
    disableContextMenu: true,
    physics: { default: "arcade", arcade: { debug: false } },
    scene: mod.scenes,
  });
  current = game;
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __scamboyGame?: PhaserNS.Game }).__scamboyGame = game;
  }
  return game;
}

export function destroyGame() {
  token++;
  Audio.stopAllLoops();
  if (current) {
    const g = current;
    current = null;
    try {
      g.destroy(true);
    } catch {
      /* ignore */
    }
  }
}

export function setGamePaused(paused: boolean) {
  const g = current;
  if (!g) return;
  for (const s of g.scene.getScenes(false)) {
    if (paused && s.scene.isActive()) {
      s.scene.pause();
      (s as unknown as { __osPaused?: boolean }).__osPaused = true;
    } else if (!paused && (s as unknown as { __osPaused?: boolean }).__osPaused) {
      (s as unknown as { __osPaused?: boolean }).__osPaused = false;
      s.scene.resume();
    }
  }
  if (paused) Audio.engineUpdate(0, 0);
}

export function currentGame() {
  return current;
}
