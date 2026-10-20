// エントリの読み書き。日付をまたぐ区間は必ず splitAtJstMidnight を通してから保存する（03 §4・F11）。
import { and, asc, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activities, projects, timeEntries } from "@/db/schema";
import { AppError, pgError } from "./errors";
import { addDays, fromJst, jstDate, jstTime, resolveManualRange, splitAtJstMidnight } from "./time";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type EntryView = {
  id: number;
  projectId: number;
  activityId: number;
  startedAt: Date;
  endedAt: Date | null;
  entryDate: string | null;
  note: string;
  source: string;
  projectName: string;
  projectColor: string;
  isBusiness: boolean;
  activityName: string;
};

const view = {
  id: timeEntries.id,
  projectId: timeEntries.projectId,
  activityId: timeEntries.activityId,
  startedAt: timeEntries.startedAt,
  endedAt: timeEntries.endedAt,
  entryDate: timeEntries.entryDate,
  note: timeEntries.note,
  source: timeEntries.source,
  projectName: projects.name,
  projectColor: projects.color,
  isBusiness: projects.isBusiness,
  activityName: activities.name,
};

function selectView(q: Tx | typeof db = db) {
  return q
    .select(view)
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(activities, eq(activities.id, timeEntries.activityId));
}

const RUNNING_TAKEN = "別の端末で記録が始まっています。画面を更新してください";

function rethrow(e: unknown): never {
  const { code, constraint } = pgError(e);
  if (code === "23505" && constraint === "time_entries_one_running") throw new AppError(RUNNING_TAKEN);
  if (code === "23514") throw new AppError(`保存できませんでした（制約 ${constraint ?? "不明"}）`);
  throw e;
}

export async function getRunning(): Promise<EntryView | null> {
  const [r] = await selectView().where(isNull(timeEntries.endedAt)).limit(1);
  return r ?? null;
}

/** その日のエントリ（JST）。前日から続く稼働中エントリも、その日が今日以前なら含める */
export async function listDay(date: string, now = new Date()): Promise<EntryView[]> {
  const rows = await selectView()
    .where(eq(timeEntries.entryDate, date))
    .orderBy(asc(timeEntries.startedAt), asc(timeEntries.id));
  const running = await getRunning();
  if (running && running.entryDate! < date && date <= jstDate(now)) rows.unshift(running);
  return rows;
}

/** その日の事業・私用・未記録（分）。稼働中は now まで、日の範囲で切って数える */
export function summarizeDay(entries: EntryView[], date: string, now = new Date()) {
  const dayStart = fromJst(date);
  const dayEnd = fromJst(addDays(date, 1));
  let business = 0;
  let personal = 0;
  for (const e of entries) {
    const s = Math.max(e.startedAt.getTime(), dayStart.getTime());
    const end = Math.min((e.endedAt ?? now).getTime(), dayEnd.getTime());
    if (end <= s) continue;
    const min = (end - s) / 60000;
    if (e.isBusiness) business += min;
    else personal += min;
  }
  business = Math.floor(business);
  personal = Math.floor(personal);
  return { business, personal, unrecorded: Math.max(0, 24 * 60 - business - personal) };
}

/** 稼働中を at で止める。0:00 をまたいでいれば分割する */
async function stopRunningTx(tx: Tx, at: Date) {
  const [r] = await tx.select().from(timeEntries).where(isNull(timeEntries.endedAt)).for("update");
  if (!r) return null;
  const end = at.getTime() > r.startedAt.getTime() ? at : new Date(r.startedAt.getTime() + 1000);
  const [first, ...rest] = splitAtJstMidnight(r.startedAt, end);
  await tx
    .update(timeEntries)
    .set({ endedAt: first.endedAt, updatedAt: sql`now()` })
    .where(eq(timeEntries.id, r.id));
  for (const seg of rest) {
    await tx.insert(timeEntries).values({
      projectId: r.projectId,
      activityId: r.activityId,
      startedAt: seg.startedAt,
      endedAt: seg.endedAt,
      note: r.note,
      source: r.source,
    });
  }
  return r;
}

export async function stopTimer(now = new Date()) {
  try {
    return await db.transaction((tx) => stopRunningTx(tx, now));
  } catch (e) {
    rethrow(e);
  }
}

/** 案件を選んで開始。稼働中があれば止めてから始める（F01）。同じ案件・種別が稼働中なら何もしない */
export async function startTimer(projectId: number, activityId: number | null, now = new Date()) {
  try {
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(projects).where(eq(projects.id, projectId));
      if (!p || p.archivedAt) throw new AppError("その案件は選べません");
      const act = activityId ?? p.defaultActivityId ?? (await firstActivityId(tx));
      const [running] = await tx.select().from(timeEntries).where(isNull(timeEntries.endedAt));
      if (running && running.projectId === projectId && running.activityId === act) return;
      await stopRunningTx(tx, now);
      await tx.insert(timeEntries).values({
        projectId,
        activityId: act,
        startedAt: now,
        endedAt: null,
        source: "timer",
      });
    });
  } catch (e) {
    rethrow(e);
  }
}

async function firstActivityId(tx: Tx) {
  const [a] = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(isNull(activities.archivedAt))
    .orderBy(asc(activities.sortOrder), asc(activities.id))
    .limit(1);
  if (!a) throw new AppError("作業種別がありません。設定で追加してください");
  return a.id;
}

export type EntryInput = {
  id?: number;
  projectId: number;
  activityId: number;
  date: string;
  start: string;
  end: string | null;
  note: string;
  confirmOverlap: boolean;
};

export type SaveResult = { ok: true; dates: string[] } | { ok: false; warning: string };

/** 手入力・修正（F03・F04）。重複は警告して、確認されたら保存する */
export async function saveEntry(input: EntryInput, now = new Date()): Promise<SaveResult> {
  const { startedAt, endedAt } = resolveManualRange(input.date, input.start, input.end);
  if ((endedAt ?? startedAt).getTime() > now.getTime()) {
    throw new AppError("未来の時刻は入力できません");
  }
  const segments = endedAt
    ? splitAtJstMidnight(startedAt, endedAt)
    : [{ startedAt, endedAt: null as Date | null }];

  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx.select().from(projects).where(eq(projects.id, input.projectId));
      const [a] = await tx.select().from(activities).where(eq(activities.id, input.activityId));
      if (!p || !a) throw new AppError("案件か作業種別が見つかりません");

      const others = input.id ? ne(timeEntries.id, input.id) : undefined;
      if (!endedAt) {
        const [r] = await tx
          .select({ id: timeEntries.id })
          .from(timeEntries)
          .where(and(isNull(timeEntries.endedAt), others));
        if (r) throw new AppError("他に稼働中の記録があります。終了時刻を入れるか、先に停止してください");
      }

      if (!input.confirmOverlap) {
        const until = endedAt ?? now;
        const overlaps = await selectView(tx)
          .where(
            and(
              others,
              lt(timeEntries.startedAt, until),
              sql`coalesce(${timeEntries.endedAt}, now()) > ${startedAt.toISOString()}::timestamptz`,
            ),
          )
          .orderBy(asc(timeEntries.startedAt))
          .limit(5);
        if (overlaps.length > 0) {
          const list = overlaps
            .map((o) => `${jstTime(o.startedAt)}–${o.endedAt ? jstTime(o.endedAt) : "稼働中"} ${o.projectName}`)
            .join("、");
          return { ok: false as const, warning: `次の記録と時間が重なっています: ${list}` };
        }
      }

      const [first, ...rest] = segments;
      const values = { projectId: input.projectId, activityId: input.activityId, note: input.note };
      if (input.id) {
        const updated = await tx
          .update(timeEntries)
          .set({ ...values, startedAt: first.startedAt, endedAt: first.endedAt, updatedAt: sql`now()` })
          .where(eq(timeEntries.id, input.id))
          .returning({ id: timeEntries.id });
        if (updated.length === 0) throw new AppError("記録が見つかりません（削除された可能性があります）");
      } else {
        await tx.insert(timeEntries).values({ ...values, ...first, source: "manual" });
      }
      for (const seg of rest) {
        await tx.insert(timeEntries).values({ ...values, ...seg, source: "manual" });
      }
      return { ok: true as const, dates: segments.map((s) => jstDate(s.startedAt)) };
    });
  } catch (e) {
    if (e instanceof AppError) throw e;
    rethrow(e);
  }
}

export async function deleteEntry(id: number) {
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

/** その日の最後の記録の終了時刻（追加シートの既定の開始） */
export function lastEndOfDay(entries: EntryView[], date: string): string | null {
  const ends = entries
    .filter((e) => e.endedAt && e.entryDate === date)
    .map((e) => e.endedAt!.getTime())
    .sort((a, b) => b - a);
  if (ends.length === 0) return null;
  const d = new Date(ends[0]);
  return jstDate(d) === date ? jstTime(d) : "23:59";
}

/** 直前に使った案件と種別（「再開」ボタン用） */
export async function lastUsed() {
  const [r] = await db
    .select({ projectId: timeEntries.projectId, activityId: timeEntries.activityId, projectName: projects.name })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(isNull(projects.archivedAt))
    .orderBy(desc(timeEntries.startedAt))
    .limit(1);
  return r ?? null;
}

