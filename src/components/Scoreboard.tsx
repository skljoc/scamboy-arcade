"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { useProgress } from "@/store/progressStore";
import { useWorldBoard } from "./useWorldBoard";

/** Right side panel: per-game high scores + achievements. */
export function Scoreboard() {
  const [tab, setTab] = useState(0);
  const game = GAMES[tab];
  const [world, setWorld] = useState(false);
  const local = useProgress((s) => s.highScores[game.id] ?? []);
  const board = useWorldBoard(game.id, world);
  const scores: Array<{ name: string; score: number; mine?: boolean }> = world
    ? board?.status === "ok"
      ? board.top
      : []
    : local;
  const worldMsg = world && board?.status !== "ok" ? (board === null ? "LOADING…" : board.status === "offline" ? "ONLINE BOARD NOT CONNECTED YET" : "COULDN'T REACH THE SERVER") : null;
  const completed = useProgress((s) => s.completed);
  const unlocked = useProgress((s) => s.achievements);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="pixel text-[10px] text-navy">HIGH SCORES</h3>
          <div className="flex gap-1.5" role="tablist" aria-label="Leaderboard">
            <button type="button" role="tab" aria-selected={!world} data-on={!world} onClick={() => setWorld(false)} className="chip !px-1.5 !py-1 !text-[7px]">
              MINE
            </button>
            <button type="button" role="tab" aria-selected={world} data-on={world} onClick={() => setWorld(true)} className="chip !px-1.5 !py-1 !text-[7px]">
              WORLD
            </button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-1.5" role="tablist">
          {GAMES.map((g, i) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              data-on={i === tab}
              onClick={() => setTab(i)}
              className="chip !px-1 !text-[8px]"
            >
              {g.short}
              {completed[g.id] ? " ★" : ""}
            </button>
          ))}
        </div>
        {worldMsg && <p className="pixel mb-2 text-center text-[8px] leading-relaxed text-navy/60">{worldMsg}</p>}
        <ol className="flex flex-col">
          {Array.from({ length: world ? 10 : 5 }).map((_, i) => {
            const e = scores[i];
            return (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] ${e?.mine ? "bg-magenta/15" : i % 2 === 0 ? "bg-navy/5" : ""}`}
              >
                <span className="pixel w-6 text-[9px] text-magenta">{i + 1}.</span>
                <span className="pixel flex-1 truncate text-[9px] text-navy">{e?.name ?? "---"}</span>
                <span className="pixel text-[9px] tabular-nums text-navy">{e ? String(e.score).padStart(7, "0") : "-------"}</span>
              </li>
            );
          })}
        </ol>
        {world && board?.status === "ok" && (
          <p className="pixel mt-3 text-center text-[8px] text-navy/70">
            {board.you ? `YOUR BEST: #${board.you.rank} OF ${board.you.players}` : "PLAY A GAME TO JOIN THE WORLD BOARD"}
          </p>
        )}
      </section>

      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="pixel text-[10px] text-navy">TROPHIES</h3>
          <span className="pixel text-[9px] text-magenta">
            {count}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="mb-3 h-2.5 overflow-hidden rounded-full border-2 border-navy bg-white">
          <div className="h-full bg-magenta transition-all" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
        <ul className="grid grid-cols-1 gap-1">
          {ACHIEVEMENTS.map((a) => {
            const on = !!unlocked[a.id];
            return (
              <li key={a.id} className={`flex items-center gap-2 text-[13px] ${on ? "text-navy" : "text-navy/40"}`} title={a.description}>
                <span className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border-2 ${on ? "border-magenta bg-magenta text-white" : "border-navy/30"}`}>
                  {on && (
                    <svg viewBox="0 0 8 8" className="size-2.5">
                      <path d="M1.3 4.3 L3.2 6.2 L6.8 1.9" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="whitespace-nowrap font-bold">{a.title}</span>
                <span className="ml-auto truncate text-[12px] opacity-75">{on ? "" : a.description}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
