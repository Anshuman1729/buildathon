import { sql } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  transcript: text("transcript").notNull(),
  // 'meeting' | 'slack' | 'email'
  sourceType: text("source_type").notNull().default("meeting"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  owner: text("owner"),
  deadline: text("deadline"), // ISO date string or free text, nullable
  sourceMeeting: integer("source_meeting")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  // 'open' | 'done' | 'stale'
  status: text("status").notNull().default("open"),
  // Verbatim excerpt from the source text supporting this decision, when the
  // model can identify one. Null if not captured.
  sourceSnippet: text("source_snippet"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const openQuestions = pgTable("open_questions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  owner: text("owner"),
  sourceMeeting: integer("source_meeting")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Meeting = typeof meetings.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type OpenQuestion = typeof openQuestions.$inferSelect;
