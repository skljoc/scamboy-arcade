"use client";

import { useId } from "react";
import { PixelSprite } from "./PixelSprite";
import { faceRows, FACE_PALETTE_LCD } from "@/games/engine/sprites";


/**
 * The SCAMBOY wordmark, built entirely from vector paths:
 * chunky rounded letters (stroked skeletons with a navy outline and extruded depth),
 * the "O" as a little LCD screen with the pixel SCAMBOY, and the "Y" as a handheld
 * with two magenta buttons and speaker slots.
 */

const SW = 24; // letter stroke width
const OB = 9; // outline thickness each side

type Glyph = { x: number; strokes?: string[]; fills?: string[] };

const GLYPHS: Glyph[] = [
  // S
  {
    x: 0,
    strokes: [
      "M58 23 Q55 12 40 12 L28 12 Q12 12 12 30 Q12 46 30 48 L40 50 Q58 52 58 70 Q58 88 40 88 L26 88 Q14 88 10 77",
    ],
  },
  // C
  { x: 74, strokes: ["M58 25 Q54 12 38 12 L32 12 Q12 12 12 32 L12 68 Q12 88 32 88 L38 88 Q54 88 58 75"] },
  // A
  { x: 146, strokes: ["M12 88 L31 20 Q38 4 45 20 L64 88", "M24 64 L52 64"] },
  // M
  { x: 224, strokes: ["M12 88 L12 13 L45 54 L78 13 L78 88"] },
  // B
  {
    x: 316,
    strokes: ["M12 50 L12 12 L38 12 Q56 12 56 30 Q56 48 38 50 L12 50 L12 88 L42 88 Q60 88 60 69 Q60 50 40 50"],
  },
  // O (screen frame)
  { x: 392, strokes: ["M12 12 L84 12 L84 88 L12 88 Z"] },
  // Y
  {
    x: 492,
    strokes: ["M12 12 L44 54"],
    fills: [
      "M33 57 L80 8 Q88 0 98 4 L108 10 Q117 17 110 27 L73 73 L73 92 Q73 100 65 100 L41 100 Q33 100 33 92 Z",
    ],
  },
];

export const LOGO_VIEWBOX = { x: -14, y: -14, w: 640, h: 132 };

interface Props {
  className?: string;
  /** classic monochrome LCD colours (boot screen) */
  variant?: "color" | "lcd";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
}

export function ScamboyLogo({ className, variant = "color", x, y, width, height, title = "SCAMBOY" }: Props) {
  const uid = useId().replace(/[:«»]/g, "");
  const lcd = variant === "lcd";
  const C = lcd
    ? { depth: "#1e2a18", outline: "#1e2a18", fillA: "#c8d4a0", fillB: "#aebc86", screen: "#91a26c", btn: "#4f5e3a", btnHi: "#91a26c", slot: "#1e2a18" }
    : { depth: "#0d1433", outline: "#1d2a5c", fillA: "#fbfaf6", fillB: "#d6d0c3", screen: "#a7b57c", btn: "#c8245f", btnHi: "#f27aa6", slot: "#1d2a5c" };

  const glyphLayer = (stroke: string, width: number, fill: string, fillStroke: number, dy = 0) =>
    GLYPHS.map((g, i) => (
      <g key={i} transform={`translate(${g.x} ${dy})`}>
        {g.strokes?.map((d, j) => (
          <path key={`s${j}`} d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {g.fills?.map((d, j) => (
          <path key={`f${j}`} d={d} fill={fill} stroke={stroke} strokeWidth={fillStroke} strokeLinejoin="round" />
        ))}
      </g>
    ));

  const fillUrl = `url(#lg-fill-${uid})`;
  const face = faceRows("smile");

  return (
    <svg
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`lg-fill-${uid}`} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.fillA} />
          <stop offset="0.55" stopColor={C.fillA} />
          <stop offset="1" stopColor={C.fillB} />
        </linearGradient>
        <radialGradient id={`lg-btn-${uid}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor={C.btnHi} />
          <stop offset="0.55" stopColor={C.btn} />
          <stop offset="1" stopColor={lcd ? C.btn : "#7d0f3b"} />
        </radialGradient>
        <linearGradient id={`lg-scr-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lcd ? C.screen : "#b4c288"} />
          <stop offset="1" stopColor={lcd ? C.screen : "#94a468"} />
        </linearGradient>
      </defs>

      {/* extruded depth */}
      {glyphLayer(C.depth, SW + OB * 2, C.depth, OB * 2, 7)}
      {/* outline */}
      {glyphLayer(C.outline, SW + OB * 2, C.outline, OB * 2)}
      {/* face */}
      {glyphLayer(fillUrl, SW, fillUrl, 0)}
      {/* O → LCD screen with pixel SCAMBOY */}
      <g transform={`translate(${GLYPHS[5].x} 0)`}>
        <rect x={22} y={22} width={52} height={56} rx={3} fill={C.outline} />
        <rect x={25} y={25} width={46} height={50} rx={2} fill={`url(#lg-scr-${uid})`} />
        <PixelSprite rows={face} palette={FACE_PALETTE_LCD} px={2.1} x={27.5} y={30} />
        {!lcd && <rect x={25} y={25} width={46} height={12} fill="#ffffff" opacity={0.12} />}
      </g>

      {/* Y → buttons + speaker slots */}
      <g transform={`translate(${GLYPHS[6].x} 0)`}>
        <circle cx={91} cy={21} r={9.5} fill={C.outline} />
        <circle cx={74.5} cy={38.5} r={9.5} fill={C.outline} />
        <circle cx={91} cy={21} r={7.5} fill={`url(#lg-btn-${uid})`} />
        <circle cx={74.5} cy={38.5} r={7.5} fill={`url(#lg-btn-${uid})`} />
        {!lcd && (
          <>
            <ellipse cx={88.5} cy={18} rx={3} ry={2} fill="#fff" opacity={0.6} />
            <ellipse cx={72} cy={35.5} rx={3} ry={2} fill="#fff" opacity={0.6} />
          </>
        )}
        <g stroke={C.slot} strokeWidth={3.2} strokeLinecap="round">
          <line x1={45} y1={94} x2={56} y2={83} />
          <line x1={52} y1={94} x2={63} y2={83} />
          <line x1={59} y1={94} x2={68} y2={85} />
        </g>
      </g>
    </svg>
  );
}


