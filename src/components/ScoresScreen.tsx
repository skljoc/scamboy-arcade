"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games";
import { consoleStore, useConsole } from "@/store/consoleStore";
import { useProgress } from "@/store/progressStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { LcdFooter, LcdHeader, LcdPage, pad } from "./os/ui";
import { useWorldBoard } from "./useWorldBoard";

interface Row {
  name: string;
  score: number;
  detail?: string | null;
  highlight: boolean;
}

export function ScoresScreen() {
  const focus = useConsole((s) => s.scoresFocus);
  const [tab, setTab] = useState(() => Math.max(0, GAMES.findIndex((g) => g.id === focus?.game)));
  const game = GAMES[tab];
  const local = useProgress((s) => s.highScores[game.id] ?? []);
  const [view, setView] = useState<"local" | "world">("local");
  const world = useWorldBoard(game.id, view === "world");

  const rows: Row[] =
    view === "local"
      ? local.map((e, i) => ({ ...e, highlight: !!focus && focus.game === game.id && focus.rank === i }))
      : world?.status === "ok"
        ? world.top.map((e) => ({ ...e, highlight: e.mine }))
        : [];
  const worldMsg =
    view === "world" && world?.status !== "ok"
      ? world === null
        ? "LOADING..."
        : world.status === "offline"
          ? "WORLD BOARD OFFLINE"
          : "CONNECTION ERROR"
      : null;

  const leave = () => {
    Audio.sfx("back");
    const st = consoleStore.getState();
    st.setScoresFocus(null);
    st.setScreen("menu");
  };

  useButtons((b) => {
    if (b === "left" || b === "right") {
      Audio.sfx("move");
      setTab((t) => (t + (b === "right" ? 1 : GAMES.length - 1)) % GAMES.length);
    } else if (b === "up" || b === "down") {
      Audio.sfx("move");
      setView((v) => (v === "local" ? "world" : "local"));
    } else if (b === "a" || b === "b" || b === "start" || b === "select") leave();
  });

  return (
    <LcdPage>
      <LcdHeader title={view === "local" ? "HI-SCORES: THIS SCAMBOY" : "HI-SCORES: WORLD"} />
      <div className="absolute left-[8px] right-[8px] top-[24px] flex items-center justify-between bg-lcd1 px-[4px] py-[4px]">
        <button type="button" onClick={() => setTab((tab + GAMES.length - 1) % GAMES.length)}>
          {"<"}
        </button>
        <span>
          {game.number} {game.title}
        </span>
        <button type="button" onClick={() => setTab((tab + 1) % GAMES.length)}>
          {">"}
        </button>
      </div>
      <div className="absolute left-[8px] right-[8px] top-[48px]">
        <div className="mb-[4px] grid grid-cols-[28px_76px_64px_1fr] text-lcd2">
          <span>#</span>
          <span>NAME</span>
          <span>SCORE</span>
          <span className="text-right">INFO</span>
        </div>
        {Array.from({ length: 10 }).map((_, i) => {
          const e = rows[i];
          const hl = e?.highlight;
          return (
            <div
              key={i}
              className={`grid h-[18px] grid-cols-[28px_76px_64px_1fr] items-center ${hl ? "blink bg-lcd3 text-lcd0" : i % 2 ? "" : "bg-[rgba(145,162,108,0.35)]"}`}
            >
              <span className="pl-[2px]">{String(i + 1).padStart(2, "0")}</span>
              <span>{e ? e.name : "--------"}</span>
              <span>{e ? pad(e.score, 7) : "-------"}</span>
              <span className="truncate pr-[2px] text-right text-lcd2">{e?.detail ?? ""}</span>
            </div>
          );
        })}
        {worldMsg && (
          <div className="absolute left-0 right-0 top-[80px] flex justify-center">
            <span className="bg-lcd0 px-[6px] py-[3px] outline-2 outline-lcd3">{worldMsg}</span>
          </div>
        )}
      </div>
      {view === "world" && world?.status === "ok" && (
        <div className="absolute left-0 right-0 top-[252px] text-center text-lcd2">
          {world.you ? `YOU: #${world.you.rank} OF ${world.you.players}  BEST ${pad(world.you.best, 7)}` : "NO ONLINE SCORE YET"}
        </div>
      )}
      <LcdFooter>
        <span>L/R:GAME</span>
        <span>U/D:{view === "local" ? "WORLD" : "LOCAL"}</span>
        <span>B:BACK</span>
      </LcdFooter>
    </LcdPage>
  );
}
