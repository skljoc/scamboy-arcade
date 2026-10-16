"use client";

import type { ReactNode } from "react";
import { DPad, PillButton, RoundButton } from "./ConsoleButtons";
import { ScamboyLogo } from "./ScamboyLogo";

/** SVG coordinate system of the handheld */
export const VB = { w: 900, h: 1480 };
/** LCD opening (10:9, matches the 320×288 logical game resolution) */
export const LCD = { x: 170, y: 168, w: 560, h: 504 };

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

interface Props {
  screen: ReactNode;
  powered: boolean;
  onPowerToggle: () => void;
  battery: number;
}

const BODY_PATH = "M62 20 H838 Q880 20 880 62 V1222 Q880 1460 642 1460 H72 Q20 1460 20 1408 V62 Q20 20 62 20 Z";

export function ScamboyConsole({ screen, powered, onPowerToggle, battery }: Props) {
  const slots = [
    { cx: 616, cy: 1300, len: 92 },
    { cx: 652, cy: 1278, len: 128 },
    { cx: 688, cy: 1256, len: 150 },
    { cx: 724, cy: 1234, len: 150 },
    { cx: 760, cy: 1212, len: 132 },
    { cx: 796, cy: 1190, len: 100 },
  ];
  const lowBattery = battery < 0.2;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
      <svg
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        className="console-shell absolute inset-0 h-full w-full select-none"
        role="application"
        aria-label="SCAMBOY handheld console"
      >
        <defs>
          <linearGradient id="shellBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2efe8" />
            <stop offset="0.5" stopColor="#e8e4da" />
            <stop offset="1" stopColor="#dcd7cb" />
          </linearGradient>
          <linearGradient id="shellSides" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.10" />
            <stop offset="0.035" stopColor="#000" stopOpacity="0" />
            <stop offset="0.965" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.13" />
          </linearGradient>
          <radialGradient id="shellSheen" cx="0.3" cy="0.18" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#55565d" />
            <stop offset="1" stopColor="#3c3d43" />
          </linearGradient>
          <linearGradient id="lcdOff" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8d9a6a" />
            <stop offset="1" stopColor="#77845a" />
          </linearGradient>
          <radialGradient id="well" cx="0.5" cy="0.42" r="0.6">
            <stop offset="0.7" stopColor="#d9d4c8" />
            <stop offset="1" stopColor="#cbc5b7" />
          </radialGradient>
          <radialGradient id="btnWell" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0.75" stopColor="#d8d3c7" stopOpacity="0.9" />
            <stop offset="1" stopColor="#c9c3b5" stopOpacity="0.9" />
          </radialGradient>
          <linearGradient id="pillWell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c6c0b2" />
            <stop offset="1" stopColor="#ddd8cd" />
          </linearGradient>
          <linearGradient id="dpadTop" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#3b3b44" />
            <stop offset="0.5" stopColor="#25252c" />
            <stop offset="1" stopColor="#1a1a20" />
          </linearGradient>
          <radialGradient id="dimple" cx="0.55" cy="0.6" r="0.6">
            <stop offset="0" stopColor="#2a2a31" />
            <stop offset="0.8" stopColor="#141418" />
            <stop offset="1" stopColor="#30303a" />
          </radialGradient>
          <radialGradient id="ab" cx="0.38" cy="0.32" r="0.72">
            <stop offset="0" stopColor="#f56a9d" />
            <stop offset="0.45" stopColor="#d12a68" />
            <stop offset="1" stopColor="#9a1446" />
          </radialGradient>
          <radialGradient id="abPressed" cx="0.45" cy="0.4" r="0.72">
            <stop offset="0" stopColor="#d84a80" />
            <stop offset="0.5" stopColor="#b51f57" />
            <stop offset="1" stopColor="#85103c" />
          </radialGradient>
          <linearGradient id="pill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a3a5b0" />
            <stop offset="1" stopColor="#7d7f8a" />
          </linearGradient>
          <linearGradient id="slot" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6d695f" />
            <stop offset="1" stopColor="#8f8a7e" />
          </linearGradient>
          <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.07" />
            </feComponentTransfer>
          </filter>
          <clipPath id="bodyClip">
            <path d={BODY_PATH} />
          </clipPath>
          <radialGradient id="ledOn" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#ffb3b8" />
            <stop offset="0.35" stopColor={lowBattery ? "#ff9b2f" : "#ff2d3f"} />
            <stop offset="1" stopColor={lowBattery ? "#a85500" : "#a10b19"} />
          </radialGradient>
        </defs>

        {/* ============ BODY ============ */}
        <path d={BODY_PATH} fill="url(#shellBase)" />
        <g clipPath="url(#bodyClip)">
          <rect x={0} y={0} width={VB.w} height={VB.h} fill="url(#shellSides)" />
          <rect x={0} y={0} width={VB.w} height={VB.h} fill="url(#shellSheen)" />
          <rect x={0} y={0} width={VB.w} height={VB.h} filter="url(#grain)" />
          {/* inner edge highlight + rim shadow */}
          <path d={BODY_PATH} fill="none" stroke="#fff" strokeWidth={8} opacity={0.65} />
          <path d={BODY_PATH} fill="none" stroke="#000" strokeWidth={3} opacity={0.12} transform="translate(0 -2)" />
          {/* top band grooves */}
          <line x1={20} y1={86} x2={880} y2={86} stroke="#000" strokeOpacity={0.14} strokeWidth={2.5} />
          <line x1={20} y1={89} x2={880} y2={89} stroke="#fff" strokeOpacity={0.8} strokeWidth={2} />
          <line x1={86} y1={20} x2={86} y2={86} stroke="#000" strokeOpacity={0.14} strokeWidth={2.5} />
          <line x1={89} y1={20} x2={89} y2={86} stroke="#fff" strokeOpacity={0.8} strokeWidth={2} />
          <line x1={814} y1={20} x2={814} y2={86} stroke="#000" strokeOpacity={0.14} strokeWidth={2.5} />
          <line x1={817} y1={20} x2={817} y2={86} stroke="#fff" strokeOpacity={0.8} strokeWidth={2} />
        </g>
        <path d={BODY_PATH} fill="none" stroke="#b9b3a5" strokeWidth={2} />

        {/* ============ POWER SWITCH ============ */}
        <g
          className="console-btn"
          role="switch"
          aria-checked={powered}
          aria-label="Power switch"
          onClick={onPowerToggle}
        >
          <rect x={118} y={36} width={150} height={40} fill="transparent" />
          <rect x={132} y={44} width={92} height={22} rx={11} fill="#cfc9bc" stroke="#b5ae9f" strokeWidth={2} />
          <rect x={powered ? 182 : 136} y={46} width={38} height={18} rx={9} fill="#8d8f99" stroke="#6c6e78" strokeWidth={1.5} />
          <line x1={powered ? 194 : 148} y1={50} x2={powered ? 194 : 148} y2={60} stroke="#5d5f69" strokeWidth={2} />
          <line x1={powered ? 201 : 155} y1={50} x2={powered ? 201 : 155} y2={60} stroke="#5d5f69" strokeWidth={2} />
          <line x1={powered ? 208 : 162} y1={50} x2={powered ? 208 : 162} y2={60} stroke="#5d5f69" strokeWidth={2} />
          <text x={238} y={62} fill="#8c8678" style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
            {powered ? "ON" : "OFF"}
          </text>
        </g>

        {/* ============ BEZEL ============ */}
        <rect x={92} y={124} width={716} height={600} rx={34} fill="#2a2b30" transform="translate(0 3)" />
        <rect x={92} y={122} width={716} height={600} rx={34} fill="url(#bezel)" />
        <rect x={93} y={123} width={714} height={598} rx={33} fill="none" stroke="#fff" strokeOpacity={0.09} strokeWidth={2} />
        {/* LCD recess */}
        <rect x={LCD.x - 8} y={LCD.y - 8} width={LCD.w + 16} height={LCD.h + 16} rx={6} fill="#1d1e22" />
        <rect x={LCD.x} y={LCD.y} width={LCD.w} height={LCD.h} fill="url(#lcdOff)" />

        {/* battery LED */}
        <circle cx={128} cy={360} r={11} fill="#2a2b30" />
        <circle
          cx={128}
          cy={360}
          r={8}
          fill={powered ? "url(#ledOn)" : "#4a2a2c"}
          className={powered ? "power-led-on" : undefined}
        />
        <text
          x={128}
          y={396}
          textAnchor="middle"
          fill="#a9aab3"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 11, letterSpacing: 1 }}
        >
          BATTERY
        </text>

        {/* ============ LOGO ============ */}
        <ScamboyLogo x={186} y={746} width={528} height={(528 * 132) / 640} />

        {/* ============ CONTROLS ============ */}
        <DPad cx={220} cy={1028} />
        <RoundButton btn="b" cx={590} cy={1064} label="B" />
        <RoundButton btn="a" cx={748} cy={966} label="A" />
        <PillButton btn="select" cx={352} cy={1222} label="SELECT" />
        <PillButton btn="start" cx={492} cy={1222} label="START" />

        {/* ============ SPEAKER ============ */}
        <g>
          {slots.map((s, i) => (
            <g key={i} transform={`rotate(30 ${s.cx} ${s.cy})`}>
              <rect x={s.cx - 8} y={s.cy - s.len / 2} width={16} height={s.len} rx={8} fill="url(#slot)" />
              <rect x={s.cx - 8} y={s.cy - s.len / 2} width={16} height={s.len} rx={8} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2} transform="translate(1.5 2)" />
              <rect x={s.cx - 5} y={s.cy - s.len / 2 + 3} width={6} height={s.len - 6} rx={3} fill="#3d3a33" opacity={0.55} />
            </g>
          ))}
        </g>

        {/* subtle "phones" label + engraved model */}
        <text
          x={70}
          y={1420}
          fill="#bdb6a6"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 13, letterSpacing: 2 }}
        >
          MODEL SB-89
        </text>
      </svg>

      {/* ============ SCREEN (DOM layer aligned to the SVG LCD opening) ============ */}
      <div
        className="screen-root absolute overflow-hidden"
        style={{
          left: pct(LCD.x, VB.w),
          top: pct(LCD.y, VB.h),
          width: pct(LCD.w, VB.w),
          height: pct(LCD.h, VB.h),
        }}
      >
        {screen}
      </div>
    </div>
  );
}
