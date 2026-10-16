"use client";

import { useState } from "react";
import { consoleStore } from "@/store/consoleStore";
import { progressStore, useProgress } from "@/store/progressStore";
import { settingsStore, useSettings, type SettingsState } from "@/store/settingsStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { Cursor, LcdFooter, LcdHeader, LcdPage } from "./os/ui";
import { NameEditor } from "./NameEntry";

type Row =
  | { kind: "toggle"; label: string; key: "muted" | "lcdGrid" | "crt" | "haptics"; invert?: boolean }
  | { kind: "volume"; label: string; key: "musicVolume" | "sfxVolume" }
  | { kind: "action"; label: string; id: "name" | "reset" | "back" };

const ROWS: Row[] = [
  { kind: "toggle", label: "SOUND", key: "muted", invert: true },
  { kind: "volume", label: "MUSIC", key: "musicVolume" },
  { kind: "volume", label: "SFX", key: "sfxVolume" },
  { kind: "toggle", label: "LCD GRID", key: "lcdGrid" },
  { kind: "toggle", label: "CRT FX", key: "crt" },
  { kind: "toggle", label: "VIBRATION", key: "haptics" },
  { kind: "action", label: "PLAYER", id: "name" },
  { kind: "action", label: "RESET SAVE DATA", id: "reset" },
  { kind: "action", label: "BACK", id: "back" },
];

function Bars({ v }: { v: number }) {
  const n = Math.round(v * 5);
  return (
    <span className="flex gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`inline-block h-[8px] w-[6px] ${i < n ? "bg-current" : "border border-current opacity-50"}`} />
      ))}
    </span>
  );
}

export function OptionsScreen() {
  const settings = useSettings((s) => s);
  const nickname = useProgress((s) => s.nickname);
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = (patch: Partial<Omit<SettingsState, "set">>) => settingsStore.getState().set(patch);

  const activate = (row: Row, dir: 1 | -1 | 0) => {
    if (row.kind === "toggle") {
      set({ [row.key]: !settings[row.key] });
      Audio.sfx("click");
    } else if (row.kind === "volume") {
      const step = dir === 0 ? 0.2 : dir * 0.2;
      let v = Math.round((settings[row.key] + step) * 5) / 5;
      if (dir === 0 && v > 1.001) v = 0;
      set({ [row.key]: Math.max(0, Math.min(1, v)) });
      Audio.sfx(row.key === "sfxVolume" ? "coin" : "click");
    } else if (row.id === "back") {
      Audio.sfx("back");
      consoleStore.getState().setScreen("menu");
    } else if (row.id === "name") {
      Audio.sfx("select");
      setEditing(true);
    } else if (row.id === "reset") {
      if (!confirmReset) {
        Audio.sfx("alarm");
        setConfirmReset(true);
      } else {
        progressStore.getState().resetAll();
        Audio.sfx("break");
        setConfirmReset(false);
        consoleStore.getState().pushToast("SAVE DATA", "ERASED");
      }
    }
  };

  useButtons((b) => {
    const row = ROWS[cursor];
    if (b === "up" || b === "down") {
      Audio.sfx("move");
      setConfirmReset(false);
      setCursor((c) => (c + (b === "down" ? 1 : ROWS.length - 1)) % ROWS.length);
    } else if (b === "left" || b === "right") {
      if (row.kind !== "action") activate(row, b === "right" ? 1 : -1);
    } else if (b === "a") activate(row, 0);
    else if (b === "b" || b === "select" || b === "start") {
      Audio.sfx("back");
      consoleStore.getState().setScreen("menu");
    }
  }, !editing);

  const value = (row: Row) => {
    if (row.kind === "toggle") {
      const on = row.invert ? !settings[row.key] : settings[row.key];
      return on ? "ON" : "OFF";
    }
    if (row.kind === "volume") return <Bars v={settings[row.key]} />;
    if (row.id === "name") return nickname || "--------";
    if (row.id === "reset") return confirmReset ? "SURE? A" : "";
    return "";
  };

  return (
    <LcdPage>
      <LcdHeader title="OPTIONS" />
      {editing ? (
        <div className="absolute left-0 right-0 top-[70px] flex flex-col items-center gap-[14px]">
          <div>PLAYER NAME</div>
          <NameEditor
            initial={nickname}
            onDone={(n) => {
              progressStore.getState().setNickname(n);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="absolute left-[8px] right-[8px] top-[26px]">
          {ROWS.map((row, i) => (
            <button
              type="button"
              key={row.label}
              onClick={() => {
                setCursor(i);
                activate(row, 0);
              }}
              className={`flex h-[24px] w-full items-center justify-between px-[6px] ${
                i === cursor ? "bg-lcd3 text-lcd0" : i % 2 ? "" : "bg-[rgba(145,162,108,0.3)]"
              }`}
            >
              <span className="flex items-center gap-[6px]">
                <span className="w-[6px]">{i === cursor && <Cursor />}</span>
                {row.label}
              </span>
              <span>{value(row)}</span>
            </button>
          ))}
        </div>
      )}
      <LcdFooter>
        <span>A/L/R:CHANGE</span>
        <span>B:BACK</span>
      </LcdFooter>
    </LcdPage>
  );
}
