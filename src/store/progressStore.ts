import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStore } from "zustand";
import type { GameId } from "@/lib/games";
import type { AchievementId } from "@/lib/achievements";

export interface ScoreEntry {
  name: string;
  score: number;
  date: number;
  detail?: string;
}

export interface ProgressState {
  nickname: string;
  highScores: Record<GameId, ScoreEntry[]>;
  completed: Record<GameId, boolean>;
  achievements: Partial<Record<AchievementId, number>>;
  /** number of racing tracks unlocked (1..3) */
  unlockedTracks: number;
  /** best lap per track index (ms) */
  bestLaps: Record<number, number>;
  /** best total race time per track index (ms) */
  bestRaces: Record<number, number>;
  /** discovered shortcut ids, e.g. "0:alley" */
  shortcuts: string[];
  /** highest shell game level reached */
  shellBestLevel: number;
  /** highest street rampage stage reached (1..3) */
  rampageBestStage: number;
  stats: Record<string, number>;

  setNickname: (name: string) => void;
  qualifies: (game: GameId, score: number) => boolean;
  addScore: (game: GameId, entry: ScoreEntry) => number;
  markCompleted: (game: GameId) => void;
  /** returns true if newly unlocked */
  unlock: (id: AchievementId) => boolean;
  unlockTrack: (count: number) => void;
  /** returns true if new record */
  setBestLap: (track: number, ms: number) => boolean;
  setBestRace: (track: number, ms: number) => boolean;
  /** returns true if newly discovered */
  discoverShortcut: (id: string) => boolean;
  setShellBestLevel: (lvl: number) => void;
  setRampageBestStage: (stage: number) => void;
  addStat: (key: string, n?: number) => void;
  resetAll: () => void;
}

const MAX_SCORES = 10;

const initial = () => ({
  nickname: "",
  highScores: { "street-rampage": [], "dirty-racing": [], "shell-game": [] } as Record<GameId, ScoreEntry[]>,
  completed: { "street-rampage": false, "dirty-racing": false, "shell-game": false } as Record<GameId, boolean>,
  achievements: {},
  unlockedTracks: 1,
  bestLaps: {},
  bestRaces: {},
  shortcuts: [] as string[],
  shellBestLevel: 0,
  rampageBestStage: 0,
  stats: {},
});

export const progressStore = createStore<ProgressState>()(
  persist(
    (set, get) => ({
      ...initial(),
      setNickname: (name) => set({ nickname: name.toUpperCase().slice(0, 8) }),
      qualifies: (game, score) => {
        if (score <= 0) return false;
        const list = get().highScores[game] ?? [];
        return list.length < MAX_SCORES || score > list[list.length - 1].score;
      },
      addScore: (game, entry) => {
        const list = [...(get().highScores[game] ?? []), entry]
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_SCORES);
        set({ highScores: { ...get().highScores, [game]: list } });
        return list.indexOf(entry);
      },
      markCompleted: (game) => set({ completed: { ...get().completed, [game]: true } }),
      unlock: (id) => {
        if (get().achievements[id]) return false;
        set({ achievements: { ...get().achievements, [id]: Date.now() } });
        return true;
      },
      unlockTrack: (count) => set({ unlockedTracks: Math.max(get().unlockedTracks, Math.min(3, count)) }),
      setBestLap: (track, ms) => {
        const cur = get().bestLaps[track];
        if (cur !== undefined && cur <= ms) return false;
        set({ bestLaps: { ...get().bestLaps, [track]: ms } });
        return true;
      },
      setBestRace: (track, ms) => {
        const cur = get().bestRaces[track];
        if (cur !== undefined && cur <= ms) return false;
        set({ bestRaces: { ...get().bestRaces, [track]: ms } });
        return true;
      },
      discoverShortcut: (id) => {
        if (get().shortcuts.includes(id)) return false;
        set({ shortcuts: [...get().shortcuts, id] });
        return true;
      },
      setShellBestLevel: (lvl) => set({ shellBestLevel: Math.max(get().shellBestLevel, lvl) }),
      setRampageBestStage: (stage) => set({ rampageBestStage: Math.max(get().rampageBestStage, stage) }),
      addStat: (key, n = 1) => set({ stats: { ...get().stats, [key]: (get().stats[key] ?? 0) + n } }),
      resetAll: () => set({ ...initial() }),
    }),
    {
      name: "scamboy-progress",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        nickname: s.nickname,
        highScores: s.highScores,
        completed: s.completed,
        achievements: s.achievements,
        unlockedTracks: s.unlockedTracks,
        bestLaps: s.bestLaps,
        bestRaces: s.bestRaces,
        shortcuts: s.shortcuts,
        shellBestLevel: s.shellBestLevel,
        rampageBestStage: s.rampageBestStage,
        stats: s.stats,
      }),
    },
  ),
);

export function useProgress<T>(selector: (s: ProgressState) => T): T {
  return useStore(progressStore, selector);
}
