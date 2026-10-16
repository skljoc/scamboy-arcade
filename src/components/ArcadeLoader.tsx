"use client";

import dynamic from "next/dynamic";

/** The arcade is purely client-side (Phaser, Web Audio, localStorage) — skip SSR to avoid hydration mismatches. */
const Arcade = dynamic(() => import("./Arcade"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center px-3">
      <div className="console-size flex aspect-[900/1480] items-center justify-center rounded-[40px_40px_200px_44px] bg-shell shadow-[0_24px_40px_rgba(17,26,60,0.2)]">
        <span className="pixel blink text-[10px] text-navy/60">POWERING ON…</span>
      </div>
    </div>
  ),
});

export function ArcadeLoader() {
  return <Arcade />;
}
