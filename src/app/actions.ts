"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { COLORS } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { deleteEntry, saveEntry, startTimer, stopTimer } from "@/lib/entries";
import { AppError } from "@/lib/errors";
import { saveActivity, saveProject, setActivityArchived, setProjectArchived } from "@/lib/masters";

export type ActionState = { ok?: boolean; error?: string; warning?: string };

// proxy.ts でも弾いているが、Server Action は個別にも確かめる
async function requireAuth() {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) {
    throw new AppError("ログインし直してください");
  }
}

async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    await requireAuth();
    const r = (await fn()) ?? { ok: true };
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (e) {
    if (e instanceof AppError || e instanceof RangeError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues.map((i) => i.message).join("／") };
    console.error(e);
    return { error: "保存に失敗しました。時間をおいてもう一度試してください" };
  }
}

export async function startAction(projectId: number, activityId: number | null = null) {
  return run(async () => {
    await startTimer(projectId, activityId);
  });
}

export async function stopAction() {
  return run(async () => {
    await stopTimer();
  });
}

const id = z.coerce.number().int().positive();
const time = z.string().regex(/^\d{2}:\d{2}$/, "時刻は HH:MM で入力してください");

const entrySchema = z.object({
  id: id.optional(),
  projectId: z.coerce.number({ message: "案件を選んでください" }).int().positive("案件を選んでください"),
  activityId: z.coerce.number().int().positive("作業種別を選んでください"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください"),
  start: time,
  end: z.union([time, z.literal("")]),
  note: z.string().trim().max(200, "メモは 200 字までです"),
  confirmOverlap: z.literal("1").optional(),
});

export async function saveEntryAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const v = entrySchema.parse(Object.fromEntries(form));
    const r = await saveEntry({
      id: v.id,
      projectId: v.projectId,
      activityId: v.activityId,
      date: v.date,
      start: v.start,
      end: v.end || null,
      note: v.note,
      confirmOverlap: v.confirmOverlap === "1",
    });
    return r.ok ? { ok: true } : { warning: r.warning };
  });
}

export async function deleteEntryAction(entryId: number) {
  return run(async () => {
    await deleteEntry(id.parse(entryId));
  });
}

const projectSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "名前を入力してください").max(50, "名前は 50 字までです"),
  isBusiness: z.enum(["true", "false"]),
  defaultActivityId: z.union([id, z.literal("")]),
  color: z.enum(COLORS),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveProjectAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const v = projectSchema.parse(Object.fromEntries(form));
    await saveProject(v.id ?? null, {
      name: v.name,
      isBusiness: v.isBusiness === "true",
      defaultActivityId: v.defaultActivityId === "" ? null : v.defaultActivityId,
      color: v.color,
      sortOrder: v.sortOrder,
    });
  });
}

export async function archiveProjectAction(projectId: number, archived: boolean) {
  return run(async () => {
    await setProjectArchived(id.parse(projectId), archived);
  });
}

const activitySchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "名前を入力してください").max(30, "名前は 30 字までです"),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveActivityAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const v = activitySchema.parse(Object.fromEntries(form));
    await saveActivity(v.id ?? null, { name: v.name, sortOrder: v.sortOrder });
  });
}

export async function archiveActivityAction(activityId: number, archived: boolean) {
  return run(async () => {
    await setActivityArchived(id.parse(activityId), archived);
  });
}
