"use client";

import { GAMES } from "@/lib/games";
import { useConsole } from "@/store/consoleStore";
import { useProgress } from "@/store/progressStore";

const KEYS: Array<[string, string[]]> = [
  ["D-PAD", ["ARROWS", "WASD"]],
  ["A", ["J", "Z"]],
  ["B", ["K", "X"]],
  ["START", ["ENTER"]],
  ["SELECT", ["ESC"]],
];

/** Left side panel: details of the highlighted / running cartridge + key map. */
export function GameDetails() {
  const screen = useConsole((s) => s.screen);
  const menuIndex = useConsole((s) => s.menuIndex);
  const active = useConsole((s) => s.activeGame);
  const live = useConsole((s) => s.liveScore);
  const completed = useProgress((s) => s.completed);

  const game = active ? GAMES.find((g) => g.id === active)! : GAMES[Math.min(menuIndex, 2)];
  const playing = screen === "game" && !!active;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ background: game.color }}>
          <span className="pixel text-[10px] text-white">CART {game.number}</span>
          {playing ? (
            <span className="pixel flex items-center gap-2 text-[9px] text-white">
              <span className="blink inline-block size-2 rounded-full bg-white" /> NOW PLAYING
            </span>
          ) : (
            completed[game.id] && <span className="pixel text-[9px] text-white">★ CLEARED</span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <h2 className="pixel text-[13px] leading-[18px] text-navy">{game.title}</h2>
          <p className="text-[15px] leading-snug text-navy/80">{game.description}</p>
          <ul className="flex flex-col gap-1.5">
            {game.controls.map(([k, v]) => (
              <li key={k} className="flex items-center gap-3 text-[14px]">
                <span className="kbd min-w-[64px] text-center">{k}</span>
                <span className="font-semibold text-navy">{v}</span>
              </li>
            ))}
          </ul>
          {playing && (
            <div className="mt-1 flex items-baseline justify-between rounded-lg bg-navy px-3 py-2 text-white">
              <span className="pixel text-[9px] text-magenta-light">SCORE</span>
              <span className="pixel text-[14px] tabular-nums">{String(live).padStart(7, "0")}</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="pixel mb-3 text-[10px] text-navy">KEYBOARD</h3>
        <ul className="flex flex-col gap-2">
          {KEYS.map(([btn, keys]) => (
            <li key={btn} className="flex items-center justify-between gap-2 text-[14px]">
              <span className="font-bold text-navy">{btn}</span>
              <span className="flex gap-1.5">
                {keys.map((k) => (
                  <span key={k} className="kbd">
                    {k}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
