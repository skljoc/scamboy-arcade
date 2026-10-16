"use client";

import { gameById, type GameId } from "@/lib/games";
import { consoleStore } from "@/store/consoleStore";
import { useProgress } from "@/store/progressStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { Cartridge, LcdFooter, LcdHeader, LcdPage, Star, pad } from "./os/ui";

/** "How to play" card shown before launching a cartridge */
export function GameInfo({ game }: { game: GameId }) {
  const meta = gameById(game);
  const best = useProgress((s) => s.highScores[game]?.[0]);
  const done = useProgress((s) => s.completed[game]);

  useButtons((b) => {
    const st = consoleStore.getState();
    if (b === "a" || b === "start") {
      Audio.sfx("select");
      st.launchGame(game);
    } else if (b === "b" || b === "select") {
      Audio.sfx("back");
      st.quitToMenu();
    }
  });

  return (
    <LcdPage>
      <LcdHeader title={`CARTRIDGE ${meta.number}`} />
      <div className="absolute left-[10px] right-[10px] top-[26px] flex items-center gap-[8px]">
        <Cartridge num={meta.number} />
        <div className="flex flex-col gap-[4px]">
          <span className="text-[16px] leading-[16px]">{meta.short}</span>
          <span className="text-lcd2">{meta.title}</span>
        </div>
      </div>

      <p className="absolute left-[10px] right-[10px] top-[64px] leading-[12px] text-lcd3">{meta.description.toUpperCase()}</p>

      <div className="absolute left-[10px] right-[10px] top-[132px] border-2 border-lcd2 p-[6px]">
        <div className="mb-[6px] text-lcd2">HOW TO PLAY</div>
        <div className="grid grid-cols-[72px_1fr] gap-x-[6px] gap-y-[5px]">
          {meta.controls.map(([k, v]) => (
            <div key={k} className="contents">
              <span className="bg-lcd3 px-[3px] py-[1px] text-center text-lcd0">{k}</span>
              <span className="py-[1px]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute left-[10px] right-[10px] top-[246px] flex justify-between text-lcd2">
        <span>
          HI {pad(best?.score ?? 0)} {best ? best.name : ""}
        </span>
        {done && (
          <span className="flex items-center gap-[3px] text-lcd3">
            <Star /> CLEAR
          </span>
        )}
      </div>
      <LcdFooter>
        <span className="blink">A:PLAY</span>
        <span>B:BACK</span>
      </LcdFooter>
    </LcdPage>
  );
}
