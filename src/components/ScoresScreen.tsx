"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games";
import { consoleStore, useConsole } from "@/store/consoleStore";
import { useProgress } from "@/store/progressStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { LcdFooter, LcdHeader, LcdPage, pad } from "./os/ui";

export function ScoresScreen() {
  const focus = useConsole((s) => s.scoresFocus);
  const [tab, setTab] = useState(() => Math.max(0, GAMES.findIndex((g) => g.id === focus?.game)));
  const game = GAMES[tab];
  const list = useProgress((s) => s.highScores[game.id] ?? []);

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
    } else if (b === "a" || b === "b" || b === "start" || b === "select") leave();
  });

  return (
    <LcdPage>
      <LcdHeader title="HI-SCORES" />
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
          const e = list[i];
          const hl = focus && focus.game === game.id && focus.rank === i;
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
      </div>
      <LcdFooter>
        <span>L/R:GAME</span>
        <span>B:BACK</span>
      </LcdFooter>
    </LcdPage>
  );
}
