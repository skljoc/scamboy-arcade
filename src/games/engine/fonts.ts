/** Resolve the pixel font family registered by next/font (CSS var --font-pixel). */
let cached: string | null = null;

export function pixelFont(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "monospace";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-pixel").trim();
  cached = v || "'Press Start 2P', monospace";
  return cached;
}

export async function ensurePixelFont() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.load(`8px ${pixelFont()}`);
    await document.fonts.load(`16px ${pixelFont()}`);
  } catch {
    /* ignore */
  }
}
