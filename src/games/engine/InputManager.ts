/**
 * InputManager — the single source of truth for SCAMBOY console buttons.
 *
 * Keyboard, the on-screen SVG buttons and touch all feed into this manager.
 * React (console OS) subscribes to press events, Phaser scenes poll it via Pad.
 */

export type ButtonId = "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select";

export const BUTTONS: ButtonId[] = ["up", "down", "left", "right", "a", "b", "start", "select"];

type Listener = (btn: ButtonId, down: boolean) => void;

const KEYMAP: Record<string, ButtonId> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  KeyJ: "a",
  KeyZ: "a",
  KeyK: "b",
  KeyX: "b",
  Enter: "start",
  NumpadEnter: "start",
  Escape: "select",
  Backspace: "select",
};

class InputManagerImpl {
  /** active sources holding each button (e.g. "key:KeyJ", "ptr:3") */
  private holders: Record<ButtonId, Set<string>> = Object.fromEntries(
    BUTTONS.map((b) => [b, new Set<string>()]),
  ) as Record<ButtonId, Set<string>>;
  /** monotonically increasing press counters, used for edge detection */
  readonly pressCount: Record<ButtonId, number> = Object.fromEntries(
    BUTTONS.map((b) => [b, 0]),
  ) as Record<ButtonId, number>;
  readonly lastPressTime: Record<ButtonId, number> = Object.fromEntries(
    BUTTONS.map((b) => [b, 0]),
  ) as Record<ButtonId, number>;

  private listeners = new Set<Listener>();
  private stateListeners = new Set<() => void>();
  private attached = false;
  private version = 0;
  hapticsEnabled = true;

  isDown(btn: ButtonId): boolean {
    return this.holders[btn].size > 0;
  }

  press(btn: ButtonId, source: string) {
    const set = this.holders[btn];
    if (set.has(source)) return;
    const wasDown = set.size > 0;
    set.add(source);
    if (!wasDown) {
      this.pressCount[btn]++;
      this.lastPressTime[btn] = performance.now();
      this.version++;
      if (source.startsWith("ptr") && this.hapticsEnabled) this.vibrate(12);
      [...this.listeners].forEach((l) => l(btn, true));
      this.stateListeners.forEach((l) => l());
    }
  }

  release(btn: ButtonId, source: string) {
    const set = this.holders[btn];
    if (!set.has(source)) return;
    set.delete(source);
    if (set.size === 0) {
      this.version++;
      [...this.listeners].forEach((l) => l(btn, false));
      this.stateListeners.forEach((l) => l());
    }
  }

  /** release everything held by a source prefix (e.g. on blur) */
  releaseAll(prefix = "") {
    for (const b of BUTTONS) {
      for (const s of [...this.holders[b]]) {
        if (s.startsWith(prefix)) this.release(b, s);
      }
    }
  }

  /** Subscribe to button down/up events. Returns unsubscribe. */
  on(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** For React useSyncExternalStore */
  subscribe = (cb: () => void) => {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  };
  getVersion = () => this.version;

  vibrate(ms: number | number[]) {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
    } catch {
      /* unsupported */
    }
  }

  attachKeyboard() {
    if (this.attached || typeof window === "undefined") return () => {};
    this.attached = true;
    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const btn = KEYMAP[e.code];
      if (!btn) return;
      e.preventDefault();
      this.press(btn, `key:${e.code}`);
    };
    const up = (e: KeyboardEvent) => {
      const btn = KEYMAP[e.code];
      if (!btn) return;
      this.release(btn, `key:${e.code}`);
    };
    const blur = () => this.releaseAll();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      this.attached = false;
    };
  }
}

export const Input = new InputManagerImpl();

/**
 * Per-scene polling helper with frame-accurate edge detection.
 * Scenes call pad.beginFrame() once per frame (BaseScene does it for you).
 */
export class Pad {
  private seen: Record<ButtonId, number>;
  private just: Record<ButtonId, boolean>;
  constructor() {
    this.seen = { ...Input.pressCount };
    this.just = Object.fromEntries(BUTTONS.map((b) => [b, false])) as Record<ButtonId, boolean>;
  }
  beginFrame() {
    for (const b of BUTTONS) {
      const c = Input.pressCount[b];
      this.just[b] = c !== this.seen[b];
      this.seen[b] = c;
    }
  }
  /** forget any presses that happened (e.g. while paused) */
  sync() {
    for (const b of BUTTONS) {
      this.seen[b] = Input.pressCount[b];
      this.just[b] = false;
    }
  }
  isDown(b: ButtonId) {
    return Input.isDown(b);
  }
  justDown(b: ButtonId) {
    return this.just[b];
  }
  /** mark a just-press as handled so other code this frame won't see it */
  consume(b: ButtonId) {
    this.just[b] = false;
  }
  /** horizontal axis -1..1 */
  get x() {
    return (Input.isDown("right") ? 1 : 0) - (Input.isDown("left") ? 1 : 0);
  }
  /** vertical axis -1..1 */
  get y() {
    return (Input.isDown("down") ? 1 : 0) - (Input.isDown("up") ? 1 : 0);
  }
  /** performance.now() time of the latest press */
  lastPress(b: ButtonId) {
    return Input.lastPressTime[b];
  }
}
