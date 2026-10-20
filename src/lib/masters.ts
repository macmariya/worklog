// 案件・作業種別のマスタ（F09・F10）
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, projects, timeEntries, type Color } from "@/db/schema";
import { AppError, pgError } from "./errors";

export async function listActivities(opts: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(activities)
    .where(opts.includeArchived ? undefined : isNull(activities.archivedAt))
    .orderBy(asc(activities.sortOrder), asc(activities.id));
}

export async function listProjects(opts: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(projects)
    .where(opts.includeArchived ? undefined : isNull(projects.archivedAt))
    .orderBy(asc(projects.sortOrder), asc(projects.id));
}

/** クイック開始用: 有効な案件を直近使用順に（未使用は並び順） */
export async function quickStartProjects() {
  const lastUsed = sql<Date | null>`max(${timeEntries.startedAt})`;
  return db
    .select({
      id: projects.id,
      name: projects.name,
      color: projects.color,
      isBusiness: projects.isBusiness,
      defaultActivityId: projects.defaultActivityId,
    })
    .from(projects)
    .leftJoin(timeEntries, eq(timeEntries.projectId, projects.id))
    .where(isNull(projects.archivedAt))
    .groupBy(projects.id)
    .orderBy(sql`${lastUsed} desc nulls last`, asc(projects.sortOrder), asc(projects.id));
}

function uniqueName(e: unknown, what: string): never {
  const { code } = pgError(e);
  if (code === "23505") throw new AppError(`同じ名前の${what}があります`);
  throw e;
}

export type ProjectInput = {
  name: string;
  isBusiness: boolean;
  defaultActivityId: number | null;
  color: Color;
  sortOrder: number;
};

export async function saveProject(id: number | null, v: ProjectInput) {
  try {
    if (id) {
      await db.update(projects).set({ ...v, updatedAt: sql`now()` }).where(eq(projects.id, id));
    } else {
      await db.insert(projects).values(v);
    }
  } catch (e) {
    uniqueName(e, "案件");
  }
}

export async function setProjectArchived(id: number, archived: boolean) {
  await db
    .update(projects)
    .set({ archivedAt: archived ? sql`now()` : null, updatedAt: sql`now()` })
    .where(eq(projects.id, id));
}

export async function saveActivity(id: number | null, v: { name: string; sortOrder: number }) {
  try {
    if (id) {
      await db.update(activities).set({ ...v, updatedAt: sql`now()` }).where(eq(activities.id, id));
    } else {
      await db.insert(activities).values(v);
    }
  } catch (e) {
    uniqueName(e, "作業種別");
  }
}

export async function setActivityArchived(id: number, archived: boolean) {
  if (archived) {
    const [left] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(activities)
      .where(and(isNull(activities.archivedAt), sql`${activities.id} <> ${id}`));
    if (left.n === 0) throw new AppError("作業種別を全部アーカイブすることはできません");
  }
  await db
    .update(activities)
    .set({ archivedAt: archived ? sql`now()` : null, updatedAt: sql`now()` })
    .where(eq(activities.id, id));
}

