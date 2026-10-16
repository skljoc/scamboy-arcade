"use client";

import { useEffect, useRef } from "react";
import { Input, type ButtonId } from "@/games/engine/InputManager";

const REPEATABLE: ButtonId[] = ["up", "down", "left", "right"];

/**
 * Subscribe to console button presses while mounted.
 * Directional buttons auto-repeat when held (menus, name entry).
 */
export function useButtons(handler: (b: ButtonId) => void, active = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const timers = new Map<ButtonId, ReturnType<typeof setTimeout>>();
    const stop = (b: ButtonId) => {
      const t = timers.get(b);
      if (t) clearTimeout(t);
      timers.delete(b);
    };
    const off = Input.on((b, down) => {
      if (!down) {
        stop(b);
        return;
      }
      ref.current(b);
      if (REPEATABLE.includes(b)) {
        stop(b);
        const tick = (delay: number) => {
          timers.set(
            b,
            setTimeout(() => {
              if (!Input.isDown(b)) return stop(b);
              ref.current(b);
              tick(85);
            }, delay),
          );
        };
        tick(380);
      }
    });
    return () => {
      off();
      timers.forEach((t) => clearTimeout(t));
    };
  }, [active]);
}
