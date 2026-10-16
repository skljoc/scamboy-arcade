"use client";

import { useState } from "react";
import { useSettings, settingsStore, type SettingsState } from "@/store/settingsStore";
import { progressStore, useProgress } from "@/store/progressStore";
import { consoleStore, useConsole } from "@/store/consoleStore";
import { Audio } from "@/games/engine/AudioManager";

type ToggleKey = "lcdGrid" | "crt" | "haptics";

/** Settings / quick actions side panel (mirrors the in-console OPTIONS screen). */
export function SettingsPanel({ onFullscreen }: { onFullscreen: () => void }) {
  const s = useSettings((x) => x);
  const nickname = useProgress((x) => x.nickname);
  const inGame = useConsole((x) => x.screen === "game");
  const paused = useConsole((x) => x.paused);
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? nickname;

  const set = (patch: Partial<Omit<SettingsState, "set">>) => settingsStore.getState().set(patch);
  const toggles: Array<[ToggleKey, string]> = [
    ["lcdGrid", "LCD GRID"],
    ["crt", "CRT FX"],
    ["haptics", "VIBRATE"],
  ];

  return (
    <section className="panel flex flex-col gap-4 p-4">
      <h3 className="pixel text-[10px] text-navy">SETTINGS</h3>

      <label className="flex flex-col gap-1.5">
        <span className="pixel text-[8px] text-navy/70">PLAYER NAME</span>
        <input
          value={name}
          maxLength={8}
          onChange={(e) => setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9 \-!.]/g, ""))}
          onBlur={() => {
            if (draft !== null) progressStore.getState().setNickname(draft.trim());
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="SCAMBOY"
          className="pixel rounded-lg border-2 border-navy bg-white px-3 py-2.5 text-[11px] text-navy outline-none placeholder:text-navy/30 focus:border-magenta"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="pixel text-[8px] text-navy/70">SOUND</span>
          <button
            type="button"
            className="chip"
            data-on={!s.muted}
            onClick={() => {
              Audio.unlock();
              set({ muted: !s.muted });
            }}
          >
            {s.muted ? "MUTED" : "ON"}
          </button>
        </div>
        {(
          [
            ["musicVolume", "MUSIC"],
            ["sfxVolume", "SFX"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-3">
            <span className="pixel w-12 text-[8px] text-navy/70">{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={s[k]}
              onChange={(e) => set({ [k]: Number(e.target.value) })}
              onPointerUp={() => k === "sfxVolume" && Audio.sfx("coin")}
              className="h-2 flex-1 cursor-pointer accent-magenta"
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {toggles.map(([k, label]) => (
          <button key={k} type="button" className="chip" data-on={s[k]} onClick={() => set({ [k]: !s[k] })}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="chip" onClick={onFullscreen}>
          FULLSCREEN
        </button>
        <button
          type="button"
          className="chip disabled:opacity-40"
          disabled={!inGame}
          onClick={() => consoleStore.getState().restartGame()}
        >
          RESTART
        </button>
        <button
          type="button"
          className="chip disabled:opacity-40"
          disabled={!inGame}
          onClick={() => {
            const st = consoleStore.getState();
            st.setPaused(!paused, 0, "menu");
          }}
        >
          {paused ? "RESUME" : "PAUSE"}
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            const st = consoleStore.getState();
            if (st.screen === "off") st.powerOn();
            else st.quitToMenu();
          }}
        >
          MENU
        </button>
      </div>
    </section>
  );
}
