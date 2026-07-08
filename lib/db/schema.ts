import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Kept intentionally plain (text + integer-epoch timestamps) so the same schema
// maps cleanly onto Postgres later — swap the driver + column helpers only.

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const decisions = sqliteTable("decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  owner: text("owner"),
  deadline: text("deadline"), // ISO date string or free text, nullable
  sourceMeeting: integer("source_meeting")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  // 'open' | 'done' | 'stale'
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const openQuestions = sqliteTable("open_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  owner: text("owner"),
  sourceMeeting: integer("source_meeting")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type Meeting = typeof meetings.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type OpenQuestion = typeof openQuestions.$inferSelect;
