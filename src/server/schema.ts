/**
 * SCAMBOY Arcade — online scores schema (PostgreSQL / Neon).
 * Applied automatically by the API on first use, or manually with `npm run db:setup`.
 * Kept import-free so the setup script can load it directly with Node.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS scores (
  id          BIGSERIAL PRIMARY KEY,
  game        TEXT        NOT NULL CHECK (game IN ('street-rampage', 'dirty-racing', 'shell-game')),
  player_id   UUID        NOT NULL,
  name        VARCHAR(8)  NOT NULL,
  score       INTEGER     NOT NULL CHECK (score > 0),
  detail      VARCHAR(24),
  completed   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_game_score_idx ON scores (game, score DESC, created_at);
CREATE INDEX IF NOT EXISTS scores_player_idx ON scores (player_id, created_at DESC);
`;
