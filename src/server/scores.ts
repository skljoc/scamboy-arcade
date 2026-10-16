import "server-only";
import type { Pool } from "pg";
import type { GameId } from "@/lib/games";
import type { ScoreSubmission } from "@/lib/scoreRules";
import { ensureSchema } from "./db";

export interface WorldEntry {
  name: string;
  score: number;
  detail: string | null;
  date: string;
  mine: boolean;
}

export interface PlayerStanding {
  best: number;
  rank: number;
  players: number;
}

/** World leaderboard: each player's best run, highest first (ties → earliest). */
export async function topScores(pool: Pool, game: GameId, limit: number, playerId: string | null): Promise<WorldEntry[]> {
  await ensureSchema(pool);
  const { rows } = await pool.query<{ name: string; score: number; detail: string | null; created_at: Date; mine: boolean }>(
    `SELECT name, score, detail, created_at, COALESCE(player_id = $3::uuid, false) AS mine
       FROM (
         SELECT DISTINCT ON (player_id) player_id, name, score, detail, created_at
           FROM scores
          WHERE game = $1
          ORDER BY player_id, score DESC, created_at ASC
       ) best
      ORDER BY score DESC, created_at ASC
      LIMIT $2`,
    [game, limit, playerId],
  );
  return rows.map((r) => ({
    name: r.name,
    score: r.score,
    detail: r.detail,
    date: r.created_at.toISOString(),
    mine: r.mine,
  }));
}

/** A player's best score and world rank for one game (null if they have none). */
export async function standing(pool: Pool, game: GameId, playerId: string): Promise<PlayerStanding | null> {
  await ensureSchema(pool);
  const { rows } = await pool.query<{ best: number; rank: string; players: string }>(
    `WITH best AS (
       SELECT player_id, MAX(score) AS score FROM scores WHERE game = $1 GROUP BY player_id
     )
     SELECT b.score AS best,
            (SELECT COUNT(*) FROM best WHERE score > b.score) + 1 AS rank,
            (SELECT COUNT(*) FROM best) AS players
       FROM best b
      WHERE b.player_id = $2::uuid`,
    [game, playerId],
  );
  if (!rows.length) return null;
  return { best: rows[0].best, rank: Number(rows[0].rank), players: Number(rows[0].players) };
}

/** Seconds since this player's last submission (any game), or null. */
export async function secondsSinceLast(pool: Pool, playerId: string): Promise<number | null> {
  await ensureSchema(pool);
  const { rows } = await pool.query<{ s: number }>(
    `SELECT EXTRACT(EPOCH FROM (now() - MAX(created_at)))::float AS s FROM scores WHERE player_id = $1::uuid`,
    [playerId],
  );
  return rows[0]?.s ?? null;
}

export async function insertScore(pool: Pool, s: ScoreSubmission) {
  await ensureSchema(pool);
  await pool.query(
    `INSERT INTO scores (game, player_id, name, score, detail, completed) VALUES ($1, $2::uuid, $3, $4, $5, $6)`,
    [s.game, s.playerId, s.name, s.score, s.detail ?? null, s.completed ?? false],
  );
}
