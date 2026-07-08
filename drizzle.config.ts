import type { Config } from "drizzle-kit";

// Optional: `npm run db:generate` / `db:push` to manage migrations.
// The app also self-initializes the schema at runtime (see lib/db/index.ts),
// so this config is here mainly for the eventual Postgres swap / explicit migrations.
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/second-brain.db",
  },
} satisfies Config;
