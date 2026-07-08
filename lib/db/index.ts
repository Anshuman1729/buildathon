import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Nothing here runs at import time — connecting (and validating env vars) is
// deferred to first use, so importing this module never fails or does I/O
// during a build step (e.g. Next.js "Collecting page data", which imports
// every route module even for routes marked `dynamic = "force-dynamic"`).

const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __drizzleDb?: NodePgDatabase<typeof schema>;
  __schemaReady?: Promise<void>;
};

function getPool(): Pool {
  if (globalForDb.__pgPool) return globalForDb.__pgPool;

  // Accept either name: Vercel Postgres injects POSTGRES_URL when you attach
  // storage to the project; DATABASE_URL is the common generic name (Neon,
  // Supabase, Railway, local Postgres, etc.).
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "No database connection string found. Set POSTGRES_URL (Vercel Postgres) " +
        "or DATABASE_URL (any Postgres) in your environment."
    );
  }

  // Most hosted Postgres providers (Vercel Postgres, Neon, Supabase) require
  // SSL but use certs that `pg`'s default strict verification rejects. Local
  // dev Postgres has no SSL at all. Detect via the connection string.
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  globalForDb.__pgPool = pool;
  return pool;
}

/** The Drizzle client. Lazily constructed on first call. */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.__drizzleDb) {
    globalForDb.__drizzleDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__drizzleDb;
}

// Arbitrary fixed key for a Postgres advisory lock, used only to serialize
// concurrent schema-init attempts (e.g. multiple serverless cold starts, or
// several requests landing before the first init completes) so they don't
// race on `CREATE TABLE IF NOT EXISTS`.
const SCHEMA_LOCK_KEY = 8_732_991_001;

async function ensureSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        transcript TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'meeting',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        owner TEXT,
        deadline TEXT,
        source_meeting INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'open',
        source_snippet TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS open_questions (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        owner TEXT,
        source_meeting INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Additive migrations for databases created before these columns existed.
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'meeting';
      ALTER TABLE decisions ADD COLUMN IF NOT EXISTS source_snippet TEXT;
    `);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_KEY]);
    client.release();
  }
}

/** Await this before any query. Memoized so concurrent requests share one init. */
export function getSchemaReady(): Promise<void> {
  if (!globalForDb.__schemaReady) {
    globalForDb.__schemaReady = ensureSchema();
  }
  return globalForDb.__schemaReady;
}

export { schema };
