import { getPool } from "@/server/db";
import { insertScore, secondsSinceLast, standing, topScores } from "@/server/scores";
import { UUID_RE, isGameId, validateSubmission } from "@/lib/scoreRules";

const NO_STORE = { "Cache-Control": "no-store" };
const MIN_SECONDS_BETWEEN_SUBMITS = 3;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * GET /api/scores?game=shell-game[&player=<uuid>][&limit=10]
 * → { enabled, top: WorldEntry[], you: PlayerStanding | null }
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  if (!isGameId(game)) return json({ error: "unknown game" }, 400);
  const playerParam = url.searchParams.get("player");
  const player = playerParam && UUID_RE.test(playerParam) ? playerParam.toLowerCase() : null;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));

  const pool = getPool();
  if (!pool) return json({ enabled: false, top: [], you: null });
  try {
    const [top, you] = await Promise.all([
      topScores(pool, game, limit, player),
      player ? standing(pool, game, player) : Promise.resolve(null),
    ]);
    return json({ enabled: true, top, you });
  } catch (e) {
    console.error("[scores] GET failed", e);
    return json({ enabled: true, error: "database unavailable" }, 503);
  }
}

/**
 * POST /api/scores  { game, playerId, name, score, detail?, completed? }
 * → { ok: true, you: PlayerStanding }
 */
export async function POST(request: Request) {
  const pool = getPool();
  if (!pool) return json({ enabled: false, error: "online scores disabled" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const sub = validateSubmission(body);
  if (typeof sub === "string") return json({ error: sub }, 400);

  try {
    const since = await secondsSinceLast(pool, sub.playerId);
    if (since !== null && since < MIN_SECONDS_BETWEEN_SUBMITS) return json({ error: "too many submissions" }, 429);
    await insertScore(pool, sub);
    const you = await standing(pool, sub.game, sub.playerId);
    return json({ ok: true, you }, 201);
  } catch (e) {
    console.error("[scores] POST failed", e);
    return json({ error: "database unavailable" }, 503);
  }
}
