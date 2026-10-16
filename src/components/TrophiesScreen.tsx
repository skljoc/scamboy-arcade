"use client";

import { useState } from "react";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { consoleStore } from "@/store/consoleStore";
import { useProgress } from "@/store/progressStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { LcdFooter, LcdHeader, LcdPage } from "./os/ui";

const VISIBLE = 7;

function TrophyIcon({ on }: { on: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" shapeRendering="crispEdges" className="shrink-0">
      {on ? (
        <path
          d="M3 1h10v2h2v4h-1v1h-2v1h-1v1h-1v2h2v1h1v2h-10v-2h1v-1h2v-2h-1v-1h-1v-1h-2v-1h-1v-4h2zM2 4v2h1v-2zM13 4v2h1v-2z"
          fill="currentColor"
        />
      ) : (
        <path d="M5 2h6v1h1v4h-1v1h1v6h-8v-6h1v-1h-1v-4h1zM6 4v3h4v-3zM7 9v3h2v-3z" fill="currentColor" opacity={0.6} />
      )}
    </svg>
  );
}

export function TrophiesScreen() {
  const unlocked = useProgress((s) => s.achievements);
  const [cursor, setCursor] = useState(0);
  const top = Math.min(Math.max(0, cursor - 3), ACHIEVEMENTS.length - VISIBLE);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  useButtons((b) => {
    if (b === "up" || b === "down") {
      Audio.sfx("move");
      setCursor((c) => Math.max(0, Math.min(ACHIEVEMENTS.length - 1, c + (b === "down" ? 1 : -1))));
    } else if (b === "b" || b === "a" || b === "start" || b === "select") {
      Audio.sfx("back");
      consoleStore.getState().setScreen("menu");
    }
  });

  return (
    <LcdPage>
      <LcdHeader title={`TROPHIES ${count}/${ACHIEVEMENTS.length}`} />
      <div className="absolute left-[8px] right-[8px] top-[24px] h-[6px] border border-lcd3">
        <div className="h-full bg-lcd3" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
      </div>
      <div className="absolute left-[8px] right-[8px] top-[36px]">
        {ACHIEVEMENTS.slice(top, top + VISIBLE).map((a, i) => {
          const idx = top + i;
          const on = !!unlocked[a.id];
          const sel = idx === cursor;
          return (
            <div
              key={a.id}
              className={`mb-[3px] flex h-[30px] items-center gap-[6px] border-2 px-[4px] ${
                sel ? "border-lcd3 bg-lcd3 text-lcd0" : on ? "border-lcd2" : "border-lcd1 text-lcd2"
              }`}
            >
              <TrophyIcon on={on} />
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span>{on ? a.title : "? ? ? ? ?"}</span>
                <span className={`truncate ${sel ? "text-lcd1" : "text-lcd2"}`}>{a.description.toUpperCase()}</span>
              </div>
            </div>
          );
        })}
      </div>
      {top > 0 && <div className="absolute right-[10px] top-[30px] text-lcd2">^</div>}
      {top + VISIBLE < ACHIEVEMENTS.length && <div className="absolute bottom-[18px] right-[10px] text-lcd2">v</div>}
      <LcdFooter>
        <span>UP/DN:SCROLL</span>
        <span>B:BACK</span>
      </LcdFooter>
    </LcdPage>
  );
}
