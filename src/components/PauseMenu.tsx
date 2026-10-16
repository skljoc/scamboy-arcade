"use client";

import { consoleStore, useConsole } from "@/store/consoleStore";
import { settingsStore, useSettings } from "@/store/settingsStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { Cursor } from "./os/ui";

/** Retro pause menu drawn over the frozen game. */
export function PauseMenu() {
  const index = useConsole((s) => s.pauseIndex);
  const mode = useConsole((s) => s.pauseMode);
  const muted = useSettings((s) => s.muted);
  const items = ["RESUME", "RESTART", `SOUND: ${muted ? "OFF" : "ON"}`, "QUIT TO MENU"];

  const choose = (i: number) => {
    const st = consoleStore.getState();
    switch (i) {
      case 0:
        Audio.sfx("select");
        st.setPaused(false);
        break;
      case 1:
        Audio.sfx("select");
        st.restartGame();
        break;
      case 2: {
        const next = !settingsStore.getState().muted;
        settingsStore.getState().set({ muted: next });
        if (!next) Audio.sfx("select");
        break;
      }
      case 3:
        Audio.sfx("back");
        st.setPaused(true, 3, "quit");
        break;
    }
  };

  useButtons((b) => {
    const st = consoleStore.getState();
    if (mode === "quit") {
      if (b === "a" || b === "select") {
        Audio.sfx("back");
        st.quitToMenu();
      } else if (b === "b" || b === "start") {
        Audio.sfx("select");
        st.setPaused(true, 0, "menu");
      }
      return;
    }
    if (b === "up") {
      Audio.sfx("move");
      st.setPauseIndex((index + items.length - 1) % items.length);
    } else if (b === "down") {
      Audio.sfx("move");
      st.setPauseIndex((index + 1) % items.length);
    } else if (b === "a") choose(index);
    else if (b === "start" || b === "b") {
      Audio.sfx("select");
      st.setPaused(false);
    } else if (b === "select") {
      Audio.sfx("back");
      st.setPaused(true, 3, "quit");
    }
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,14,8,0.55)]">
      <div className="w-[200px] border-4 border-lcd3 bg-lcd0 p-[3px] shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
        <div className="border-2 border-lcd2 px-[10px] pb-[10px] pt-[8px]">
          {mode === "quit" ? (
            <>
              <div className="mb-[10px] text-center text-[16px] leading-[16px]">QUIT?</div>
              <p className="mb-[12px] text-center leading-[12px] text-lcd2">PROGRESS IN THIS GAME WILL BE LOST.</p>
              <div className="flex justify-between">
                <button type="button" className="bg-lcd3 px-[6px] py-[3px] text-lcd0" onClick={() => consoleStore.getState().quitToMenu()}>
                  A:YES
                </button>
                <button type="button" className="border-2 border-lcd3 px-[4px] py-[1px]" onClick={() => consoleStore.getState().setPaused(true, 0, "menu")}>
                  B:NO
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-[10px] text-center text-[16px] leading-[16px]">PAUSED</div>
              {items.map((it, i) => (
                <button
                  key={it}
                  type="button"
                  onClick={() => {
                    consoleStore.getState().setPauseIndex(i);
                    choose(i);
                  }}
                  className={`flex h-[16px] w-full items-center gap-[6px] px-[4px] text-left ${
                    i === index ? "bg-lcd3 text-lcd0" : ""
                  }`}
                >
                  <span className="w-[6px]">{i === index && <Cursor />}</span>
                  {it}
                </button>
              ))}
              <div className="mt-[8px] text-center text-lcd2">START: RESUME</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
