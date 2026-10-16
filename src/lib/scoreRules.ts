import type { GameId } from "./games";

/** Validation rules shared by the client and the /api/scores route. */

export const GAME_IDS: GameId[] = ["street-rampage", "dirty-racing", "shell-game"];

/** Generous upper bounds — anything above is rejected as impossible. */
export const MAX_SCORE: Record<GameId, number> = {
  "street-rampage": 5_000_000,
  "dirty-racing": 200_000,
  "shell-game": 200_000,
};

export const NAME_RE = /^[A-Z0-9 \-!.]{1,8}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ScoreSubmission {
  game: GameId;
  playerId: string;
  name: string;
  score: number;
  detail?: string;
  completed?: boolean;
}

export function isGameId(v: unknown): v is GameId {
  return typeof v === "string" && (GAME_IDS as string[]).includes(v);
}

/** Returns a cleaned submission or an error message. */
export function validateSubmission(body: unknown): ScoreSubmission | string {
  if (!body || typeof body !== "object") return "invalid body";
  const b = body as Record<string, unknown>;
  if (!isGameId(b.game)) return "unknown game";
  if (typeof b.playerId !== "string" || !UUID_RE.test(b.playerId)) return "invalid player id";
  const name = typeof b.name === "string" ? b.name.toUpperCase().trim() : "";
  if (!NAME_RE.test(name)) return "invalid name";
  const score = b.score;
  if (typeof score !== "number" || !Number.isInteger(score) || score <= 0 || score > MAX_SCORE[b.game]) {
    return "invalid score";
  }
  let detail: string | undefined;
  if (b.detail !== undefined && b.detail !== null) {
    if (typeof b.detail !== "string" || b.detail.length > 24 || !/^[A-Z0-9 \-!.:]*$/i.test(b.detail)) {
      return "invalid detail";
    }
    detail = b.detail.toUpperCase();
  }
  return {
    game: b.game,
    playerId: b.playerId.toLowerCase(),
    name,
    score,
    detail,
    completed: b.completed === true,
  };
}
