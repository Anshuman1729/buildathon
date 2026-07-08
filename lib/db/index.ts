import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// Resolve DB path (defaults to ./data/second-brain.db). The data dir is created
// on demand so the app runs with zero setup — no separate migration step needed.
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "second-brain.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
};

const sqlite = globalForDb.__sqlite ?? new Database(dbPath);
if (!globalForDb.__sqlite) {
  sqlite.pragma("journal_mode = WAL");
  ensureSchema(sqlite);
  globalForDb.__sqlite = sqlite;
}

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      transcript TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      owner TEXT,
      deadline TEXT,
      source_meeting INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS open_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      owner TEXT,
      source_meeting INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);
}

export const db = drizzle(sqlite, { schema });
export { schema };
