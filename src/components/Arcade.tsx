"use client";

import { useCallback, useRef } from "react";
import { ScamboyConsole } from "./ScamboyConsole";
import { ConsoleScreen } from "./ConsoleScreen";
import { GameDetails } from "./GameDetails";
import { Scoreboard } from "./Scoreboard";
import { SettingsPanel } from "./SettingsPanel";
import { useConsoleController } from "./useConsoleController";
import { consoleStore, useConsole } from "@/store/consoleStore";
import { Audio } from "@/games/engine/AudioManager";

export default function Arcade() {
  const { battery } = useConsoleController();
  const powered = useConsole((s) => s.screen !== "off");
  const fsRef = useRef<HTMLDivElement>(null);

  const togglePower = useCallback(() => {
    Audio.unlock();
    const st = consoleStore.getState();
    if (st.screen === "off") st.powerOn();
    else {
      Audio.sfx("back");
      st.powerOff();
    }
  }, []);

  const fullscreen = useCallback(() => {
    const el = fsRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-start gap-6 px-3 pb-10 lg:grid-cols-[minmax(240px,300px)_auto_minmax(260px,320px)] lg:gap-8">
      <aside className="order-2 lg:order-1 lg:pt-6">
        <GameDetails />
      </aside>

      <div ref={fsRef} className="fs-wrap order-1 flex justify-center lg:order-2">
        <div className="console-size">
          <ScamboyConsole
            powered={powered}
            onPowerToggle={togglePower}
            battery={battery}
            screen={<ConsoleScreen battery={battery} />}
          />
        </div>
      </div>

      <aside className="order-3 flex flex-col gap-4 lg:pt-6">
        <Scoreboard />
        <SettingsPanel onFullscreen={fullscreen} />
      </aside>
    </div>
  );
}
