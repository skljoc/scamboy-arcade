"use client";

import { useEffect, useState } from "react";
import { Input } from "@/games/engine/InputManager";
import { Audio } from "@/games/engine/AudioManager";
import { consoleStore } from "@/store/consoleStore";
import { settingsStore } from "@/store/settingsStore";

interface BatteryManagerLike {
  level: number;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener: (t: string, cb: () => void) => void;
}

/**
 * Global console wiring: keyboard, audio unlock, settings → engines,
 * START/SELECT during gameplay, auto-pause on tab switch, menu music, battery.
 */
export function useConsoleController() {
  const [battery, setBattery] = useState(1);

  // dev-only debugging handle
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __scamboy?: unknown }).__scamboy = { consoleStore, settingsStore, Input };
    }
  }, []);

  // keyboard + audio unlock
  useEffect(() => {
    const detach = Input.attachKeyboard();
    const unlock = () => Audio.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      detach();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // settings → audio / haptics
  useEffect(() => {
    const apply = () => {
      const s = settingsStore.getState();
      Audio.configure({ muted: s.muted, musicVolume: s.musicVolume, sfxVolume: s.sfxVolume });
      Input.hapticsEnabled = s.haptics;
    };
    apply();
    return settingsStore.subscribe(apply);
  }, []);

  // START / SELECT while a game is running
  useEffect(() => {
    return Input.on((b, down) => {
      if (!down) return;
      const st = consoleStore.getState();
      if (st.screen !== "game" || st.paused) return;
      if (b === "start") {
        Audio.sfx("pause");
        st.setPaused(true, 0, "menu");
      } else if (b === "select") {
        Audio.sfx("back");
        st.setPaused(true, 3, "quit");
      }
    });
  }, []);

  // auto-pause when the tab is hidden
  useEffect(() => {
    const onVis = () => {
      const st = consoleStore.getState();
      if (document.hidden && st.screen === "game" && !st.paused) st.setPaused(true, 0, "menu");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // music per screen + duck while paused
  useEffect(() => {
    const apply = () => {
      const { screen, paused } = consoleStore.getState();
      if (screen === "off" || screen === "boot") Audio.stopMusic();
      else if (screen !== "game") Audio.playMusic("menu");
      Audio.setDuck(screen === "game" && paused);
    };
    apply();
    return consoleStore.subscribe((s, prev) => {
      if (s.screen !== prev.screen || s.paused !== prev.paused) apply();
    });
  }, []);

  // real battery level where supported
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!nav.getBattery) return;
    let mgr: BatteryManagerLike | null = null;
    const update = () => mgr && setBattery(mgr.level);
    nav
      .getBattery()
      .then((m) => {
        mgr = m;
        update();
        m.addEventListener("levelchange", update);
      })
      .catch(() => {});
    return () => mgr?.removeEventListener("levelchange", update);
  }, []);

  return { battery };
}
