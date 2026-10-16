import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { GameId } from "@/lib/games";

export type Screen =
  | "off"
  | "boot"
  | "menu"
  | "info"
  | "game"
  | "nameEntry"
  | "result"
  | "scores"
  | "options"
  | "trophies";

export interface GameResult {
  game: GameId;
  score: number;
  completed: boolean;
  /** short text for the scoreboard, e.g. "STAGE 2" or "TRACK 3 1ST" */
  detail?: string;
}

export interface Toast {
  id: number;
  title: string;
  text: string;
}

export interface ConsoleState {
  screen: Screen;
  menuIndex: number;
  activeGame: GameId | null;
  /** bump to force-remount the Phaser game (restart) */
  session: number;
  paused: boolean;
  pauseIndex: number;
  /** "menu" = normal pause menu, "quit" = SELECT pressed: confirm quit */
  pauseMode: "menu" | "quit";
  liveScore: number;
  lastResult: GameResult | null;
  toasts: Toast[];
  bootCount: number;
  /** highlight a freshly entered high score on the scores screen */
  scoresFocus: { game: GameId; rank: number } | null;

  setScreen: (s: Screen) => void;
  setMenuIndex: (i: number) => void;
  powerOn: () => void;
  powerOff: () => void;
  openInfo: (id: GameId) => void;
  launchGame: (id: GameId) => void;
  restartGame: () => void;
  quitToMenu: () => void;
  setPaused: (p: boolean, index?: number, mode?: "menu" | "quit") => void;
  setPauseIndex: (i: number) => void;
  setLiveScore: (n: number) => void;
  endGame: (r: GameResult) => void;
  pushToast: (title: string, text: string) => void;
  dismissToast: (id: number) => void;
  setScoresFocus: (f: { game: GameId; rank: number } | null) => void;
}

let toastId = 1;

export const consoleStore = createStore<ConsoleState>()((set, get) => ({
  screen: "boot",
  menuIndex: 0,
  activeGame: null,
  session: 0,
  paused: false,
  pauseIndex: 0,
  pauseMode: "menu",
  liveScore: 0,
  lastResult: null,
  toasts: [],
  bootCount: 0,
  scoresFocus: null,

  setScreen: (screen) => set({ screen }),
  setMenuIndex: (menuIndex) => set({ menuIndex }),
  powerOn: () => set({ screen: "boot", bootCount: get().bootCount + 1, activeGame: null, paused: false }),
  powerOff: () => set({ screen: "off", activeGame: null, paused: false }),
  openInfo: (id) => set({ screen: "info", activeGame: id }),
  launchGame: (id) =>
    set({ screen: "game", activeGame: id, paused: false, liveScore: 0, session: get().session + 1 }),
  restartGame: () => set({ paused: false, liveScore: 0, session: get().session + 1, screen: "game" }),
  quitToMenu: () => set({ screen: "menu", activeGame: null, paused: false, liveScore: 0 }),
  setPaused: (paused, index = 0, mode = "menu") => set({ paused, pauseIndex: index, pauseMode: mode }),
  setPauseIndex: (pauseIndex) => set({ pauseIndex }),
  setLiveScore: (liveScore) => set({ liveScore }),
  endGame: (r) => set({ lastResult: r, screen: "nameEntry", paused: false }),
  pushToast: (title, text) => {
    const t = { id: toastId++, title, text };
    set({ toasts: [...get().toasts, t] });
    setTimeout(() => get().dismissToast(t.id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setScoresFocus: (scoresFocus) => set({ scoresFocus }),
}));

export function useConsole<T>(selector: (s: ConsoleState) => T): T {
  return useStore(consoleStore, selector);
}
