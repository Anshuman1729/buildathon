import type { Config } from "drizzle-kit";

// Optional: `npm run db:generate` / `db:push` to manage explicit migrations.
// The app also self-initializes the schema at runtime (see lib/db/index.ts),
// so this config is here mainly for explicit migrations if you want them.
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.POSTGRES_URL ?? process.env.DATABASE_URL)!,
  },
} satisfies Config;
