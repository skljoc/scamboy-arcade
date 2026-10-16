"use client";

import { useRef, useSyncExternalStore } from "react";
import { Input, type ButtonId } from "@/games/engine/InputManager";
import { Audio } from "@/games/engine/AudioManager";

function useInputVersion() {
  return useSyncExternalStore(Input.subscribe, Input.getVersion, () => 0);
}

function pointerHandlers(btn: ButtonId) {
  const src = (id: number) => `ptr:${id}:${btn}`;
  return {
    onPointerDown: (e: React.PointerEvent<SVGGElement>) => {
      e.preventDefault();
      Audio.unlock();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      Input.press(btn, src(e.pointerId));
    },
    onPointerUp: (e: React.PointerEvent<SVGGElement>) => Input.release(btn, src(e.pointerId)),
    onPointerCancel: (e: React.PointerEvent<SVGGElement>) => Input.release(btn, src(e.pointerId)),
    onLostPointerCapture: (e: React.PointerEvent<SVGGElement>) => Input.release(btn, src(e.pointerId)),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

/* ------------------------------------------------------------------ D-PAD */

export function DPad({ cx, cy }: { cx: number; cy: number }) {
  useInputVersion();
  const active = useRef(new Map<number, Set<ButtonId>>());
  const up = Input.isDown("up");
  const down = Input.isDown("down");
  const left = Input.isDown("left");
  const right = Input.isDown("right");
  const tx = (right ? 1 : 0) - (left ? 1 : 0);
  const ty = (down ? 1 : 0) - (up ? 1 : 0);

  const dirsFor = (e: React.PointerEvent<SVGGElement>): Set<ButtonId> => {
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    const set = new Set<ButtonId>();
    if (!svg || !ctm) return set;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const dx = p.x - cx;
    const dy = p.y - cy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.hypot(dx, dy) < 14) return set;
    if (ax > ay * 0.42) set.add(dx > 0 ? "right" : "left");
    if (ay > ax * 0.42) set.add(dy > 0 ? "down" : "up");
    return set;
  };

  const apply = (id: number, next: Set<ButtonId>) => {
    const prev = active.current.get(id) ?? new Set<ButtonId>();
    for (const b of prev) if (!next.has(b)) Input.release(b, `ptr:${id}:dpad`);
    for (const b of next) if (!prev.has(b)) Input.press(b, `ptr:${id}:dpad`);
    active.current.set(id, next);
  };
  const end = (id: number) => {
    apply(id, new Set());
    active.current.delete(id);
  };

  return (
    <g
      className="console-btn"
      role="group"
      aria-label="Directional pad"
      onPointerDown={(e) => {
        e.preventDefault();
        Audio.unlock();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        apply(e.pointerId, dirsFor(e));
      }}
      onPointerMove={(e) => {
        if (active.current.has(e.pointerId)) apply(e.pointerId, dirsFor(e));
      }}
      onPointerUp={(e) => end(e.pointerId)}
      onPointerCancel={(e) => end(e.pointerId)}
      onLostPointerCapture={(e) => end(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* recessed well */}
      <circle cx={cx} cy={cy} r={128} fill="url(#well)" />
      <circle cx={cx} cy={cy} r={128} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} transform="translate(1.5 2.5)" />
      <circle cx={cx} cy={cy} r={128} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={2} />
      {/* hit area */}
      <circle cx={cx} cy={cy} r={124} fill="transparent" />

      <g transform={`translate(${cx} ${cy})`}>
        {/* drop shadow */}
        <g transform="translate(3 9)" opacity={0.35} filter="url(#soft)">
          <rect x={-108} y={-36} width={216} height={72} rx={10} fill="#000" />
          <rect x={-36} y={-108} width={72} height={216} rx={10} fill="#000" />
        </g>
        <g transform={`translate(${tx * 2.5} ${ty * 2.5 + (tx || ty ? 2 : 0)})`}>
          {/* side / thickness */}
          <rect x={-108} y={-30} width={216} height={72} rx={10} fill="#0c0c10" />
          <rect x={-36} y={-102} width={72} height={216} rx={10} fill="#0c0c10" />
          {/* top face */}
          <rect x={-108} y={-36} width={216} height={72} rx={10} fill="url(#dpadTop)" />
          <rect x={-36} y={-108} width={72} height={216} rx={10} fill="url(#dpadTop)" />
          {/* pressed arm shading */}
          {up && <rect x={-36} y={-108} width={72} height={72} rx={10} fill="#000" opacity={0.25} />}
          {down && <rect x={-36} y={36} width={72} height={72} rx={10} fill="#000" opacity={0.25} />}
          {left && <rect x={-108} y={-36} width={72} height={72} rx={10} fill="#000" opacity={0.25} />}
          {right && <rect x={36} y={-36} width={72} height={72} rx={10} fill="#000" opacity={0.25} />}
          {/* bevel highlight */}
          <path d="M-98 -34 H-38 V-98 Q-36 -106 -28 -106 H28" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
          {/* embossed arrows */}
          <g fill="#3a3a44" stroke="rgba(255,255,255,0.12)" strokeWidth={1}>
            <path d="M0 -94 L11 -78 H-11 Z" />
            <path d="M0 94 L11 78 H-11 Z" />
            <path d="M-94 0 L-78 11 V-11 Z" />
            <path d="M94 0 L78 11 V-11 Z" />
          </g>
          {/* center dimple */}
          <circle cx={0} cy={0} r={20} fill="url(#dimple)" />
        </g>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ A / B */

export function RoundButton({ btn, cx, cy, label }: { btn: "a" | "b"; cx: number; cy: number; label: string }) {
  useInputVersion();
  const pressed = Input.isDown(btn);
  return (
    <g className="console-btn" role="button" aria-label={`${label} button`} {...pointerHandlers(btn)}>
      {/* recess */}
      <circle cx={cx} cy={cy + 4} r={66} fill="url(#btnWell)" />
      <circle cx={cx} cy={cy} r={70} fill="transparent" />
      {/* shadow */}
      <ellipse
        cx={cx + 4}
        cy={cy + (pressed ? 8 : 14)}
        rx={56}
        ry={pressed ? 50 : 52}
        fill="#000"
        opacity={pressed ? 0.25 : 0.32}
        filter="url(#soft)"
      />
      <g transform={`translate(0 ${pressed ? 5 : 0})`}>
        {/* side */}
        <circle cx={cx} cy={cy + 7} r={56} fill="#7a0d38" />
        {/* cap */}
        <circle cx={cx} cy={cy} r={56} fill={pressed ? "url(#abPressed)" : "url(#ab)"} />
        <circle cx={cx} cy={cy} r={55} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
        {/* gloss */}
        <ellipse cx={cx - 17} cy={cy - 22} rx={20} ry={12} fill="#fff" opacity={pressed ? 0.25 : 0.45} transform={`rotate(-28 ${cx - 17} ${cy - 22})`} />
        <ellipse cx={cx + 22} cy={cy + 26} rx={14} ry={6} fill="#fff" opacity={0.08} transform={`rotate(-28 ${cx + 22} ${cy + 26})`} />
      </g>
      <text
        x={cx + 6}
        y={cy + 98}
        textAnchor="middle"
        fill="#1d2a5c"
        style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 34, letterSpacing: 1 }}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ SELECT / START */

export function PillButton({ btn, cx, cy, label }: { btn: "start" | "select"; cx: number; cy: number; label: string }) {
  useInputVersion();
  const pressed = Input.isDown(btn);
  return (
    <g className="console-btn" role="button" aria-label={`${label} button`} {...pointerHandlers(btn)}>
      <g transform={`rotate(-25 ${cx} ${cy})`}>
        {/* slot */}
        <rect x={cx - 58} y={cy - 22} width={116} height={44} rx={22} fill="url(#pillWell)" />
        <rect x={cx - 64} y={cy - 34} width={128} height={70} rx={30} fill="transparent" />
        <g transform={`translate(0 ${pressed ? 3 : 0})`}>
          <rect x={cx - 48} y={cy - 12} width={96} height={30} rx={15} fill="#4a4c56" />
          <rect x={cx - 48} y={cy - 15} width={96} height={28} rx={14} fill={pressed ? "#6f717c" : "url(#pill)"} />
          <rect x={cx - 38} y={cy - 11} width={60} height={5} rx={2.5} fill="#fff" opacity={pressed ? 0.12 : 0.28} />
        </g>
        <text
          x={cx}
          y={cy + 52}
          textAnchor="middle"
          fill="#1d2a5c"
          style={{ fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 22, letterSpacing: 2.5 }}
          pointerEvents="none"
        >
          {label}
        </text>
      </g>
    </g>
  );
}
