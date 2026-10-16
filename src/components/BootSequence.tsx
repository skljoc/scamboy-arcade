"use client";

import { useEffect, useState } from "react";
import { ScamboyLogo } from "./ScamboyLogo";
import { PixelSprite } from "./PixelSprite";
import { faceRows, FACE_PALETTE_LCD, HAND_FRAMES } from "@/games/engine/sprites";
import { Audio } from "@/games/engine/AudioManager";
import { useButtons } from "./os/useButtons";
import { LcdPage } from "./os/ui";

const GREETING = "HI! READY TO HUSTLE?";

/**
 * Power-on sequence: logo scrolls down (with the classic "ding"), the pixel
 * SCAMBOY pops up waving, then the arcade menu loads.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  const [wave, setWave] = useState(0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    Audio.unlock();
    const t = [
      setTimeout(() => setPhase(1), 150),
      setTimeout(() => {
        setPhase(2);
        Audio.sfx("boot");
      }, 1650),
      setTimeout(() => setPhase(3), 2050),
      setTimeout(() => setPhase(4), 4300),
      setTimeout(onDone, 4700),
    ];
    return () => t.forEach(clearTimeout);
  }, [onDone]);

  useEffect(() => {
    if (phase < 3) return;
    const w = setInterval(() => setWave((v) => v + 1), 230);
    const ty = setInterval(() => setTyped((v) => Math.min(GREETING.length, v + 1)), 55);
    return () => {
      clearInterval(w);
      clearInterval(ty);
    };
  }, [phase]);

  useButtons((b) => {
    if ((b === "a" || b === "start") && phase >= 2) onDone();
  });

  const face = faceRows(wave % 6 === 5 ? "wink" : "smile");

  return (
    <LcdPage className={phase === 4 ? "opacity-0 transition-opacity duration-300" : ""}>
      {/* logo scroll */}
      <div
        className="absolute left-1/2"
        style={{
          width: 236,
          marginLeft: -118,
          top: 0,
          transform: `translateY(${phase >= 1 ? 52 : -70}px)`,
          transition: phase >= 1 ? "transform 1.45s steps(30, end)" : "none",
        }}
      >
        <ScamboyLogo variant="lcd" className="block h-auto w-full" />
      </div>

      {/* waving SCAMBOY */}
      {phase >= 3 && (
        <div className="absolute left-1/2 top-[124px] -ml-[48px]">
          <svg width={96} height={80} viewBox="0 0 32 26" shapeRendering="crispEdges" style={{ overflow: "visible" }}>
            <g transform={`translate(0 ${wave % 2 === 0 ? 0 : -1})`}>
              <PixelSprite rows={face} palette={FACE_PALETTE_LCD} x={2} y={4} />
            </g>
            <PixelSprite rows={HAND_FRAMES[wave % 2]} palette={FACE_PALETTE_LCD} x={23} y={3 + (wave % 2)} />
          </svg>
        </div>
      )}

      {phase >= 3 && (
        <div className="absolute left-0 right-0 top-[216px] text-center">
          {GREETING.slice(0, typed)}
          {typed < GREETING.length && <span className="blink">_</span>}
        </div>
      )}

      {phase >= 2 && (
        <div className="blink absolute bottom-[10px] left-0 right-0 text-center text-lcd2">PRESS START</div>
      )}
    </LcdPage>
  );
}
