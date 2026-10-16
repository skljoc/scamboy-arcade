"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consoleStore, useConsole } from "@/store/consoleStore";
import { useSettings } from "@/store/settingsStore";
import { destroyGame, setGamePaused, startGame } from "@/games/engine/GameManager";
import type { GameId } from "@/lib/games";
import { BootSequence } from "./BootSequence";
import { GameMenu } from "./GameMenu";
import { GameInfo } from "./GameInfo";
import { PauseMenu } from "./PauseMenu";
import { NameEntry } from "./NameEntry";
import { ScoresScreen } from "./ScoresScreen";
import { TrophiesScreen } from "./TrophiesScreen";
import { OptionsScreen } from "./OptionsScreen";

/** Mounts the Phaser game for the active cartridge; destroyed on unmount. */
function GameHost({ game, session }: { game: GameId; session: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    startGame(game, el).catch((e: unknown) => {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    });
    return () => destroyGame();
  }, [game, session]);
  return (
    <>
      <div className="os-loading absolute inset-0 flex items-center justify-center bg-black">
        <span className="pixel blink text-[10px] text-lcd0">{error ? "CARTRIDGE ERROR" : "LOADING..."}</span>
      </div>
      <div ref={ref} className="absolute inset-0" />
    </>
  );
}

function Toasts() {
  const toasts = useConsole((s) => s.toasts);
  if (!toasts.length) return null;
  const t = toasts[0];
  return (
    <div key={t.id} className="toast-in pointer-events-none absolute left-[24px] right-[24px] top-[6px] z-30">
      <div className="flex items-center gap-[8px] border-2 border-[#ffd23f] bg-[#1d2a5c] px-[6px] py-[5px] text-white shadow-[0_3px_0_#0d1433]">
        <svg width={14} height={14} viewBox="0 0 16 16" shapeRendering="crispEdges">
          <path
            d="M3 1h10v2h2v4h-1v1h-2v1h-1v1h-1v2h2v1h1v2h-10v-2h1v-1h2v-2h-1v-1h-1v-1h-2v-1h-1v-4h2zM2 4v2h1v-2zM13 4v2h1v-2z"
            fill="#ffd23f"
          />
        </svg>
        <div className="flex flex-col gap-[3px]">
          <span className="text-[#f0609a]">{t.title}</span>
          <span>{t.text}</span>
        </div>
      </div>
    </div>
  );
}

export function ConsoleScreen({ battery }: { battery: number }) {
  const screen = useConsole((s) => s.screen);
  const activeGame = useConsole((s) => s.activeGame);
  const session = useConsole((s) => s.session);
  const paused = useConsole((s) => s.paused);
  const bootCount = useConsole((s) => s.bootCount);
  const lcdGrid = useSettings((s) => s.lcdGrid);
  const crt = useSettings((s) => s.crt);

  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 320));
    ro.observe(el);
    setScale(el.clientWidth / 320);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setGamePaused(paused);
  }, [paused]);

  const onBootDone = useCallback(() => {
    if (consoleStore.getState().screen === "boot") consoleStore.getState().setScreen("menu");
  }, []);

  const inGame = screen === "game" && activeGame;
  const gridSize = scale >= 2.2 ? scale : scale * 2;

  return (
    <div ref={rootRef} className="absolute inset-0 bg-[#7d8a5c]">
      {screen === "off" ? (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#8a976a,#76835a)]" />
      ) : (
        <>
          {inGame && <GameHost game={activeGame} session={session} />}

          {/* OS layer, laid out at 320×288 logical pixels */}
          <div
            className={`os-layer absolute left-0 top-0 z-10 ${inGame && !paused ? "pointer-events-none" : ""}`}
            style={{ transform: `scale(${scale})` }}
          >
            {screen === "boot" && <BootSequence key={bootCount} onDone={onBootDone} />}
            {screen === "menu" && <GameMenu battery={battery} />}
            {screen === "info" && activeGame && <GameInfo game={activeGame} />}
            {screen === "nameEntry" && <NameEntry />}
            {screen === "scores" && <ScoresScreen />}
            {screen === "trophies" && <TrophiesScreen />}
            {screen === "options" && <OptionsScreen />}
            {inGame && paused && <PauseMenu />}
            <Toasts />
          </div>
        </>
      )}

      {lcdGrid && screen !== "off" && (
        <div
          className="lcd-grid absolute inset-0 z-20"
          style={{ backgroundSize: `${gridSize}px ${gridSize}px` }}
        />
      )}
      {crt && screen !== "off" && <div className="crt-fx absolute inset-0 z-20" />}
      <div className="screen-glass absolute inset-0 z-20" />
      {/* inner shadow from the bezel lip */}
      <div className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_3px_8px_rgba(0,0,0,0.45)]" />
    </div>
  );
}
