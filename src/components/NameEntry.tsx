"use client";

import { useEffect, useState } from "react";
import { gameById } from "@/lib/games";
import { consoleStore, useConsole } from "@/store/consoleStore";
import { progressStore, useProgress } from "@/store/progressStore";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { LcdFooter, LcdHeader, LcdPage, pad } from "./os/ui";
import { submitWorldScore, type SubmitResult } from "@/lib/onlineScores";
import type { GameResult } from "@/store/consoleStore";

/** Upload a finished run to the world leaderboard; reports the outcome as a console toast. */
function uploadRun(result: GameResult, name: string, toast: boolean) {
  const run = submitWorldScore(result, {
    game: result.game,
    name,
    score: result.score,
    detail: result.detail,
    completed: result.completed,
  });
  if (toast) {
    void run.then((r) => {
      const st = consoleStore.getState();
      if (r.status === "ok" && r.you) st.pushToast("WORLD RANK", `#${r.you.rank} OF ${r.you.players}`);
      else if (r.status === "error") st.pushToast("ONLINE", "UPLOAD FAILED");
    });
  }
  return run;
}

export const NAME_CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-!.";
const LEN = 8;

/** Arcade-style D-pad name editor */
export function NameEditor({
  initial,
  onDone,
  onCancel,
  active = true,
}: {
  initial: string;
  onDone: (name: string) => void;
  onCancel?: () => void;
  active?: boolean;
}) {
  const [chars, setChars] = useState<string[]>(() => initial.toUpperCase().padEnd(LEN, " ").slice(0, LEN).split(""));
  const [pos, setPos] = useState(() => Math.min(LEN - 1, initial.trimEnd().length));

  const finish = () => {
    const name = chars.join("").trim() || "SCAMBOY";
    Audio.sfx("select");
    onDone(name);
  };

  useButtons((b) => {
    if (b === "up" || b === "down") {
      const cur = NAME_CHARS.indexOf(chars[pos]);
      const next = (cur + (b === "up" ? 1 : -1) + NAME_CHARS.length) % NAME_CHARS.length;
      const c = [...chars];
      c[pos] = NAME_CHARS[next];
      setChars(c);
      Audio.sfx("click");
    } else if (b === "left") {
      setPos((p) => Math.max(0, p - 1));
      Audio.sfx("move");
    } else if (b === "right") {
      setPos((p) => Math.min(LEN - 1, p + 1));
      Audio.sfx("move");
    } else if (b === "a") {
      if (pos < LEN - 1) {
        setPos(pos + 1);
        Audio.sfx("move");
      } else finish();
    } else if (b === "start") finish();
    else if (b === "b") {
      if (pos > 0) {
        setPos(pos - 1);
        Audio.sfx("back");
      } else onCancel?.();
    }
  }, active);

  return (
    <div className="flex flex-col items-center gap-[8px]">
      <div className="flex gap-[4px]">
        {chars.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPos(i)}
            className={`relative flex h-[22px] w-[18px] items-center justify-center border-b-2 text-[16px] leading-[16px] ${
              i === pos ? "border-lcd3 bg-lcd3 text-lcd0" : "border-lcd2"
            }`}
          >
            {c === " " ? (i === pos ? <span className="blink">_</span> : "") : c}
          </button>
        ))}
      </div>
      <div className="text-lcd2">UP/DN:LETTER L/R:MOVE</div>
      <div className="text-lcd2">START:DONE</div>
    </div>
  );
}

/** Shown when a game session ends: score summary + high score name entry. */
export function NameEntry() {
  const result = useConsole((s) => s.lastResult);
  const nickname = useProgress((s) => s.nickname);
  const [qualifies] = useState(() => (result ? progressStore.getState().qualifies(result.game, result.score) : false));
  const hi = useProgress((s) => (result ? (s.highScores[result.game]?.[0]?.score ?? 0) : 0));
  const [world, setWorld] = useState<SubmitResult | "pending">("pending");

  // runs that don't make the local top 10 still count on the world board
  useEffect(() => {
    if (!result || qualifies || result.score <= 0) return;
    let live = true;
    const name = progressStore.getState().nickname || "PLAYER";
    void uploadRun(result, name, false).then((r) => live && setWorld(r));
    return () => {
      live = false;
    };
  }, [result, qualifies]);

  const proceed = () => {
    Audio.sfx("select");
    consoleStore.getState().setScreen("menu");
  };

  useButtons(
    (b) => {
      if (b === "a" || b === "start" || b === "b") proceed();
    },
    !qualifies,
  );

  if (!result) return null;
  const meta = gameById(result.game);

  return (
    <LcdPage>
      <LcdHeader title={meta.title} />
      <div className="absolute left-0 right-0 top-[30px] text-center text-[16px] leading-[16px]">
        {result.completed ? "COMPLETE!" : "GAME OVER"}
      </div>
      {result.detail && <div className="absolute left-0 right-0 top-[52px] text-center text-lcd2">{result.detail}</div>}
      <div className="absolute left-0 right-0 top-[72px] text-center">
        <div className="text-lcd2">SCORE</div>
        <div className="mt-[4px] text-[16px] leading-[16px]">{pad(result.score, 7)}</div>
      </div>

      {qualifies ? (
        <div className="absolute left-0 right-0 top-[124px] flex flex-col items-center gap-[10px]">
          <div className="blink bg-lcd3 px-[6px] py-[3px] text-lcd0">NEW HIGH SCORE!</div>
          <div>ENTER YOUR NAME</div>
          <NameEditor
            initial={nickname}
            onDone={(name) => {
              const ps = progressStore.getState();
              ps.setNickname(name);
              void uploadRun(result, name, true);
              const rank = ps.addScore(result.game, {
                name,
                score: result.score,
                date: Date.now(),
                detail: result.detail,
              });
              consoleStore.getState().setScoresFocus({ game: result.game, rank });
              consoleStore.getState().setScreen("scores");
            }}
          />
        </div>
      ) : (
        <div className="absolute left-0 right-0 top-[132px] flex flex-col items-center gap-[12px]">
          <div className="text-lcd2">HI-SCORE {pad(hi, 7)}</div>
          <div>{result.score > 0 ? "SO CLOSE. TRY AGAIN!" : "BETTER LUCK NEXT TIME"}</div>
          {result.score > 0 && (
            <div className="text-lcd2">
              {world === "pending"
                ? "UPLOADING SCORE..."
                : world.status === "ok" && world.you
                  ? `WORLD RANK #${world.you.rank} OF ${world.you.players}`
                  : world.status === "offline"
                    ? "WORLD BOARD OFFLINE"
                    : "UPLOAD FAILED"}
            </div>
          )}
        </div>
      )}
      <LcdFooter>{qualifies ? <span>A:NEXT  B:BACK</span> : <span className="blink">A:CONTINUE</span>}</LcdFooter>
    </LcdPage>
  );
}
