"use client";

import { GAMES } from "@/lib/games";
import { useConsole, consoleStore } from "@/store/consoleStore";
import { useProgress } from "@/store/progressStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { Cartridge, Cursor, LcdFooter, LcdHeader, LcdPage, Star, pad } from "./os/ui";

const EXTRA = [
  { label: "SCORES", screen: "scores" as const },
  { label: "TROPHY", screen: "trophies" as const },
  { label: "OPTION", screen: "options" as const },
];

export function GameMenu({ battery }: { battery: number }) {
  const index = useConsole((s) => s.menuIndex);
  const highScores = useProgress((s) => s.highScores);
  const completed = useProgress((s) => s.completed);
  const trophies = useProgress((s) => Object.keys(s.achievements).length);

  const move = (i: number) => {
    if (i === index) return;
    Audio.sfx("move");
    consoleStore.getState().setMenuIndex(i);
  };

  useButtons((b) => {
    const st = consoleStore.getState();
    if (b === "up") move(index >= 3 ? 2 : Math.max(0, index - 1));
    else if (b === "down") move(index < 2 ? index + 1 : index === 2 ? 3 : index);
    else if (b === "left" && index >= 3) move(Math.max(3, index - 1));
    else if (b === "right" && index >= 3) move(Math.min(5, index + 1));
    else if (b === "a" || b === "start") {
      Audio.sfx("select");
      if (index < 3) st.openInfo(GAMES[index].id);
      else st.setScreen(EXTRA[index - 3].screen);
    }
  });

  return (
    <LcdPage>
      <LcdHeader title="SCAMBOY ARCADE" battery={battery} />
      <div className="absolute left-0 right-0 top-[22px]">
        {GAMES.map((g, i) => {
          const sel = index === i;
          const best = highScores[g.id]?.[0]?.score ?? 0;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                if (sel) {
                  Audio.sfx("select");
                  consoleStore.getState().openInfo(g.id);
                } else move(i);
              }}
              className={`relative mx-[6px] mb-[4px] flex h-[58px] w-[308px] items-center gap-[8px] border-2 px-[6px] text-left ${
                sel ? "border-lcd3 bg-lcd3 text-lcd0" : "border-lcd2 bg-lcd0 text-lcd3"
              }`}
            >
              <span className="w-[6px]">{sel && <Cursor />}</span>
              <Cartridge num={g.number} inverted={sel} />
              <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <span className={sel ? "text-lcd0" : "text-lcd3"}>{g.title}</span>
                <span className={`truncate ${sel ? "text-lcd1" : "text-lcd2"}`}>{g.tagline.toUpperCase()}</span>
                <span className="flex items-center gap-[6px]">
                  <span>HI {pad(best)}</span>
                  {completed[g.id] && (
                    <span className="flex items-center gap-[3px]">
                      <Star /> CLEAR
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="absolute left-[6px] right-[6px] top-[214px] flex gap-[6px]">
        {EXTRA.map((e, i) => {
          const sel = index === i + 3;
          return (
            <button
              key={e.label}
              type="button"
              onClick={() => {
                if (sel) {
                  Audio.sfx("select");
                  consoleStore.getState().setScreen(e.screen);
                } else move(i + 3);
              }}
              className={`flex h-[24px] flex-1 items-center justify-center gap-[4px] border-2 ${
                sel ? "border-lcd3 bg-lcd3 text-lcd0" : "border-lcd2 text-lcd3"
              }`}
            >
              {e.label}
              {e.screen === "trophies" && <span className={sel ? "text-lcd1" : "text-lcd2"}>{trophies}</span>}
            </button>
          );
        })}
      </div>

      <div className="absolute left-0 right-0 top-[248px] text-center text-lcd2">PICK A CARTRIDGE</div>
      <LcdFooter>
        <span>D-PAD:MOVE</span>
        <span>A:SELECT</span>
      </LcdFooter>
    </LcdPage>
  );
}
