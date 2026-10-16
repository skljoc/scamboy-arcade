/**
 * Bridge between Phaser games and the console OS (React + stores).
 * Games must ONLY talk to the outside world through this object.
 */
import { consoleStore, type GameResult } from "@/store/consoleStore";
import { progressStore } from "@/store/progressStore";
import { achievementById, type AchievementId } from "@/lib/achievements";
import { Audio } from "./AudioManager";

export const Arcade = {
  /** Unlock an achievement (shows a toast the first time). */
  achieve(id: AchievementId) {
    const isNew = progressStore.getState().unlock(id);
    if (isNew) {
      const a = achievementById(id);
      consoleStore.getState().pushToast("TROPHY UNLOCKED", a?.title ?? id);
      Audio.sfx("achievement");
      // arcade legend: all three games completed
      const done = progressStore.getState().completed;
      if (id !== "arcade-legend" && done["street-rampage"] && done["dirty-racing"] && done["shell-game"]) {
        Arcade.achieve("arcade-legend");
      }
    }
  },

  /** Show a small console toast. */
  toast(title: string, text: string) {
    consoleStore.getState().pushToast(title, text);
  },

  /** Live score shown in the side panel. */
  setScore(score: number) {
    consoleStore.getState().setLiveScore(Math.floor(score));
  },

  /**
   * End the current game session. The console takes over (high-score name entry,
   * then the menu). Call once, after your own game-over / victory screen.
   */
  finish(result: Omit<GameResult, "game">) {
    const game = consoleStore.getState().activeGame;
    if (!game) return;
    if (result.completed) {
      progressStore.getState().markCompleted(game);
      const done = progressStore.getState().completed;
      if (done["street-rampage"] && done["dirty-racing"] && done["shell-game"]) Arcade.achieve("arcade-legend");
    }
    // defer so we never tear down Phaser in the middle of its own update loop
    setTimeout(() => consoleStore.getState().endGame({ ...result, game }), 0);
  },

  /** Persistent progress (high scores, unlocked tracks, etc.) */
  progress() {
    return progressStore.getState();
  },
};
