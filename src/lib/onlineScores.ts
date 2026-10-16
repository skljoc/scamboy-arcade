"use client";

import type { GameId } from "./games";
import { progressStore } from "@/store/progressStore";

/** Client for the /api/scores world leaderboard. Every call degrades gracefully offline. */

export interface WorldEntry {
  name: string;
  score: number;
  detail: string | null;
  date: string;
  mine: boolean;
}

export interface Standing {
  best: number;
  rank: number;
  players: number;
}

export type WorldBoard =
  | { status: "ok"; top: WorldEntry[]; you: Standing | null }
  | { status: "offline" }
  | { status: "error" };

export async function fetchWorldBoard(game: GameId, limit = 10): Promise<WorldBoard> {
  const player = progressStore.getState().ensurePlayerId();
  try {
    const res = await fetch(`/api/scores?game=${game}&limit=${limit}&player=${player}`, { cache: "no-store" });
    const data = (await res.json()) as { enabled?: boolean; top?: WorldEntry[]; you?: Standing | null };
    if (data.enabled === false) return { status: "offline" };
    if (!res.ok || !data.top) return { status: "error" };
    return { status: "ok", top: data.top, you: data.you ?? null };
  } catch {
    return { status: "error" };
  }
}

export type SubmitResult = { status: "ok"; you: Standing | null } | { status: "offline" } | { status: "error" };

/** Upload one finished run. Results are cached per run so a re-render never double-submits. */
const submitted = new WeakMap<object, Promise<SubmitResult>>();

export function submitWorldScore(
  run: object,
  entry: { game: GameId; name: string; score: number; detail?: string; completed?: boolean },
): Promise<SubmitResult> {
  const prev = submitted.get(run);
  if (prev) return prev;
  const p = (async (): Promise<SubmitResult> => {
    if (entry.score <= 0) return { status: "error" };
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, playerId: progressStore.getState().ensurePlayerId() }),
      });
      const data = (await res.json().catch(() => ({}))) as { enabled?: boolean; you?: Standing | null };
      if (data.enabled === false) return { status: "offline" };
      if (!res.ok) return { status: "error" };
      return { status: "ok", you: data.you ?? null };
    } catch {
      return { status: "error" };
    }
  })();
  submitted.set(run, p);
  return p;
}
