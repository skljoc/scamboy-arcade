"use client";

import { useEffect, useState } from "react";
import type { GameId } from "@/lib/games";
import { fetchWorldBoard, type WorldBoard } from "@/lib/onlineScores";

/** Loads the world leaderboard for a game while `active`; null while loading. */
export function useWorldBoard(game: GameId, active: boolean, limit = 10) {
  const [state, setState] = useState<{ key: string; board: WorldBoard } | null>(null);
  const key = `${game}:${limit}`;

  useEffect(() => {
    if (!active) return;
    let live = true;
    void fetchWorldBoard(game, limit).then((board) => live && setState({ key, board }));
    return () => {
      live = false;
    };
  }, [game, limit, active, key]);

  return state && state.key === key ? state.board : null;
}
