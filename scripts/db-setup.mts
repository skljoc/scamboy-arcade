/**
 * Creates the scores table on the database in DATABASE_URL (or POSTGRES_URL).
 *   npm run db:setup
 * The API also does this automatically on first use; this is for doing it up front.
 */
import pg from "pg";
import { SCHEMA_SQL } from "../src/server/schema.ts";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("Set DATABASE_URL (e.g. in .env.local) first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(SCHEMA_SQL);
const { rows } = await client.query<{ n: string }>("SELECT COUNT(*) AS n FROM scores");
console.log(`scores table ready (${rows[0].n} rows)`);
await client.end();
