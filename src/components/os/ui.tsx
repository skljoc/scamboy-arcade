"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PixelSprite } from "../PixelSprite";
import { PAL } from "@/games/engine/palette";

export const LCD_PAL: Record<string, number> = {
  "0": PAL.lcd0,
  "1": PAL.lcd1,
  "2": PAL.lcd2,
  "3": PAL.lcd3,
};

/** Full-screen LCD page */
export function LcdPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`absolute inset-0 bg-lcd0 text-lcd3 ${className}`}>{children}</div>;
}

/** Top title bar with battery */
export function LcdHeader({ title, battery }: { title: string; battery?: number }) {
  return (
    <div className="absolute left-0 right-0 top-0 flex h-[18px] items-center justify-between bg-lcd3 px-[6px] text-lcd0">
      <span className="pt-px">{title}</span>
      {battery !== undefined && <BatteryIcon level={battery} />}
    </div>
  );
}

export function LcdFooter({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex h-[16px] items-center justify-center gap-3 border-t-2 border-lcd2 bg-lcd1 text-lcd3">
      {children}
    </div>
  );
}

export function BatteryIcon({ level }: { level: number }) {
  const bars = Math.max(0, Math.min(4, Math.ceil(level * 4)));
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (bars > 1) return;
    const i = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(i);
  }, [bars]);
  return (
    <svg width={22} height={10} viewBox="0 0 22 10" shapeRendering="crispEdges" aria-label={`Battery ${Math.round(level * 100)}%`}>
      <rect x={0} y={0} width={19} height={10} fill={`#${PAL.lcd0.toString(16)}`} />
      <rect x={1} y={1} width={17} height={8} fill={`#${PAL.lcd3.toString(16)}`} />
      <rect x={19} y={3} width={2} height={4} fill={`#${PAL.lcd0.toString(16)}`} />
      {Array.from({ length: 4 }).map((_, i) =>
        i < bars && !(blink && bars <= 1) ? (
          <rect key={i} x={2 + i * 4} y={2} width={3} height={6} fill={`#${PAL.lcd0.toString(16)}`} />
        ) : null,
      )}
    </svg>
  );
}

/** Blinking right-pointing pixel arrow */
export function Cursor({ className = "" }: { className?: string }) {
  return (
    <svg width={6} height={8} viewBox="0 0 6 8" shapeRendering="crispEdges" className={`blink inline-block ${className}`}>
      <path d="M0 0h2v1h1v1h1v1h1v2h-1v1h-1v1h-1v1h-2z" fill="currentColor" />
    </svg>
  );
}

/** Pixel star (completion indicator) */
export function Star({ filled = true }: { filled?: boolean }) {
  return (
    <svg width={9} height={9} viewBox="0 0 9 9" shapeRendering="crispEdges" className="inline-block align-[-1px]">
      <path
        d="M4 0h1v2h1v1h3v1h-1v1h-1v2h1v2h-1v-1h-2v-1h-1v1h-2v1h-1v-2h1v-2h-1v-1h-1v-1h3v-1h1z"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 0.8}
      />
    </svg>
  );
}

/** Pixel cartridge icon with the game number on its label */
export function Cartridge({ num, inverted }: { num: string; inverted?: boolean }) {
  const rows = [
    "33333333333333333333..",
    "30000000000000000000333",
    "300000000000000000000033",
    "301111111111111111111003",
    "301222222222222222221003",
    "301200000000000000021003",
    "301200000000000000021003",
    "301200000000000000021003",
    "301200000000000000021003",
    "301200000000000000021003",
    "301200000000000000021003",
    "301200000000000000021003",
    "301222222222222222221003",
    "301111111111111111111003",
    "300000000000000000000003",
    "300000000000000000000003",
    "300303030303030303030003",
    "300303030303030303030003",
    "300000000000000000000003",
    "333333333333333333333333",
  ].map((r) => r.padEnd(24, "."));
  const pal = inverted
    ? { "0": PAL.lcd2, "1": PAL.lcd1, "2": PAL.lcd0, "3": PAL.lcd0 }
    : LCD_PAL;
  return (
    <svg width={24} height={20} viewBox="0 0 24 20" className="block">
      <PixelSprite rows={rows} palette={pal} />
      <text
        x={11}
        y={11.5}
        textAnchor="middle"
        style={{ fontFamily: "var(--font-pixel)", fontSize: 8 }}
        fill={`#${(inverted ? PAL.lcd0 : PAL.lcd3).toString(16)}`}
      >
        {num}
      </text>
    </svg>
  );
}

export const pad = (n: number, len = 6) => String(Math.max(0, Math.floor(n))).padStart(len, "0");
