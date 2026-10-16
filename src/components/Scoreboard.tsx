"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { useProgress } from "@/store/progressStore";

/** Right side panel: per-game high scores + achievements. */
export function Scoreboard() {
  const [tab, setTab] = useState(0);
  const game = GAMES[tab];
  const scores = useProgress((s) => s.highScores[game.id] ?? []);
  const completed = useProgress((s) => s.completed);
  const unlocked = useProgress((s) => s.achievements);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel p-4">
        <h3 className="pixel mb-3 text-[10px] text-navy">HIGH SCORES</h3>
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
        <ol className="flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => {
            const e = scores[i];
            return (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] ${i % 2 === 0 ? "bg-navy/5" : ""}`}
              >
                <span className="pixel w-6 text-[9px] text-magenta">{i + 1}.</span>
                <span className="pixel flex-1 truncate text-[9px] text-navy">{e?.name ?? "---"}</span>
                <span className="pixel text-[9px] tabular-nums text-navy">{e ? String(e.score).padStart(7, "0") : "-------"}</span>
              </li>
            );
          })}
        </ol>
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
