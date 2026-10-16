import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { SCHEMA_SQL } from "./schema";

/**
 * Postgres connection (Neon on Vercel). Reads DATABASE_URL — the variable the
 * Neon integration sets — falling back to POSTGRES_URL. With neither set, the
 * online leaderboard is disabled and the console keeps scores in localStorage.
 */
const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "")
  // pg already treats these as verify-full; say so explicitly (silences pg's deprecation warning)
  .replace(/sslmode=(prefer|require|verify-ca)\b/, "sslmode=verify-full");

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function dbEnabled() {
  return connectionString !== "";
}

export function getPool(): Pool | null {
  if (!dbEnabled()) return null;
  if (!pool) {
    // TLS comes from the URL itself (Neon URLs carry `sslmode=require`)
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    // lets Vercel Fluid compute close idle clients before a function is suspended
    attachDatabasePool(pool);
  }
  return pool;
}

/** Create the table/indexes once per server instance. */
export async function ensureSchema(p: Pool) {
  if (!schemaReady) {
    schemaReady = p
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e: unknown) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}
