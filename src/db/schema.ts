// テーブル定義の正本は Vault の 03_データ設計.md。変えたら同じコミットで 03 も直す。
// 生成列・部分ユニーク・CHECK の SQL は drizzle/ のマイグレーションで実物を確かめること。
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const COLORS = ["gray", "red", "orange", "amber", "green", "teal", "blue", "purple"] as const;
export type Color = (typeof COLORS)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const stamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};

export const activities = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(100),
  archivedAt: ts("archived_at"),
  ...stamps,
});

export const projects = pgTable(
  "projects",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull().unique(),
    isBusiness: boolean("is_business").notNull().default(true),
    defaultActivityId: integer("default_activity_id").references(
      (): AnyPgColumn => activities.id,
      { onDelete: "set null" },
    ),
    color: text("color").notNull().default("gray"),
    sortOrder: integer("sort_order").notNull().default(100),
    archivedAt: ts("archived_at"),
    ...stamps,
  },
  (t) => [
    check(
      "projects_color_check",
      sql`${t.color} in (${sql.raw(COLORS.map((c) => `'${c}'`).join(", "))})`,
    ),
  ],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
    // JST の日付。jst_date() は 0000_jst_date_function.sql で作る IMMUTABLE 関数
    entryDate: date("entry_date", { mode: "string" }).generatedAlwaysAs(sql`jst_date(started_at)`),
    note: text("note").notNull().default(""),
    source: text("source").notNull(),
    ...stamps,
  },
  (t) => [
    // 稼働中（ended_at IS NULL）は全体で 1 件だけ
    uniqueIndex("time_entries_one_running").on(sql`(true)`).where(sql`ended_at is null`),
    check("time_entries_end_after_start", sql`ended_at is null or ended_at > started_at`),
    // JST の日付をまたがない。ちょうど翌日 0:00 の終了は前日分として許す
    check(
      "time_entries_same_jst_day",
      sql`ended_at is null or jst_date(started_at) = jst_date(ended_at - interval '1 microsecond')`,
    ),
    check("time_entries_note_length", sql`char_length(note) <= 200`),
    check("time_entries_source_check", sql`source in ('timer', 'manual')`),
    index("time_entries_entry_date_idx").on(t.entryDate),
    index("time_entries_project_idx").on(t.projectId, t.entryDate),
  ],
);

export type Project = typeof projects.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
