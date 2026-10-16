import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStore } from "zustand";

export interface SettingsState {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  lcdGrid: boolean;
  crt: boolean;
  haptics: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const settingsStore = createStore<SettingsState>()(
  persist(
    (set) => ({
      muted: false,
      musicVolume: 0.6,
      sfxVolume: 0.8,
      lcdGrid: true,
      crt: false,
      haptics: true,
      set: (patch) => set(patch),
    }),
    {
      name: "scamboy-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        muted: s.muted,
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
        lcdGrid: s.lcdGrid,
        crt: s.crt,
        haptics: s.haptics,
      }),
    },
  ),
);

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}
