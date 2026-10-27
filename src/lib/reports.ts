// 月次レポート（F06〜F08・02 §4・03 §5）。
// 1 か月分のエントリは多くても数百件なので、DB からは entry_date で月の行だけを取り、
// 集計は純粋関数 summarizeMonth で行う（月境界・稼働中・記録開始日の扱いをテストで固めるため）。
// 時間は秒で足し、表示と CSV の段階で分・時間に直す。明細の行を足すと集計に一致する。
import { and, asc, gte, isNull, lt, or } from "drizzle-orm";
import { timeEntries } from "@/db/schema";
import { listEntries, type EntryView } from "./entries";
import { addDays, fromJst, isDateString, jstDate, jstDateTime, splitAtJstMidnight } from "./time";

const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_SEC = 24 * 60 * 60;

export function isMonthString(s: string): boolean {
  const m = MONTH_RE.exec(s);
  return !!m && +m[2] >= 1 && +m[2] <= 12;
}

/** 2026-10 → 2026-11 */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** 月の初日と翌月の初日（JST の日付） */
export function monthRange(month: string) {
  return { first: `${month}-01`, next: `${addMonths(month, 1)}-01` };
}

/**
 * 記録の開始日（REPORT_START=YYYY-MM-DD）。これより前の日は分母にも分子にも入れない。
 * 2026-10 は 10/21 から記録を始めたので、10/1〜10/20 を「未記録」として数えないために使う（G2）。
 */
export function reportStart(): string | null {
  const s = process.env.REPORT_START?.trim();
  return s && isDateString(s) ? s : null;
}

export type Segment = {
  entryId: number;
  date: string;
  startedAt: Date;
  endedAt: Date;
  running: boolean;
  seconds: number;
  projectName: string;
  isBusiness: boolean;
  activityName: string;
  note: string;
};

export type Bucket = { name: string; isBusiness?: boolean; seconds: number };

export type DayRow = {
  date: string;
  /** past: 終わった日 / today: 今日（途中） / future: まだ来ていない日 / before: 記録開始前 */
  state: "past" | "today" | "future" | "before";
  business: number;
  personal: number;
};

export type MonthReport = {
  month: string;
  /** 集計した期間（JST の日付。first 以上 next 未満） */
  from: string;
  next: string;
  days: number;
  /** 暦時間（日数 × 24h）。02 §4 の「総時間」 */
  calendar: number;
  /** 今月なら now まで、過去の月なら calendar と同じ。未記録の計算に使う */
  elapsed: number;
  business: number;
  personal: number;
  unrecorded: number;
  /** 事業 ÷ 総時間、事業 ÷ (事業＋私用)。分母が 0 なら null */
  businessOfCalendar: number | null;
  businessOfRecorded: number | null;
  byProject: Bucket[];
  byActivity: Bucket[];
  byDay: DayRow[];
  segments: Segment[];
  isCurrent: boolean;
};

/**
 * エントリを日ごとの区間にする。保存済みのエントリは 1 日に収まっている（F11）。
 * 稼働中は now までを 0:00 で切って、それぞれの日に入れる（停止したときの分割と同じ結果になる）。
 */
export function toSegments(entries: EntryView[], now: Date): Segment[] {
  const out: Segment[] = [];
  for (const e of entries) {
    const end = e.endedAt ?? now;
    if (end.getTime() <= e.startedAt.getTime()) continue;
    const parts = e.endedAt ? [{ startedAt: e.startedAt, endedAt: e.endedAt }] : splitAtJstMidnight(e.startedAt, end);
    for (const p of parts) {
      out.push({
        entryId: e.id,
        date: e.endedAt ? (e.entryDate ?? jstDate(p.startedAt)) : jstDate(p.startedAt),
        startedAt: p.startedAt,
        endedAt: p.endedAt,
        running: !e.endedAt,
        seconds: Math.floor((p.endedAt.getTime() - p.startedAt.getTime()) / 1000),
        projectName: e.projectName,
        isBusiness: e.isBusiness,
        activityName: e.activityName,
        note: e.note,
      });
    }
  }
  return out;
}

function ranked(map: Map<string, Bucket>): Bucket[] {
  return [...map.values()].sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name, "ja"));
}

/** 純粋関数。entries は月の前後を含んでいてよい（期間外の区間は捨てる） */
export function summarizeMonth(
  entries: EntryView[],
  month: string,
  now: Date,
  start: string | null = null,
): MonthReport {
  const range = monthRange(month);
  const from = start && start > range.first ? (start < range.next ? start : range.next) : range.first;
  const today = jstDate(now);

  const segments = toSegments(entries, now).filter((s) => s.date >= from && s.date < range.next);
  segments.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.entryId - b.entryId);

  const byProject = new Map<string, Bucket>();
  const byActivity = new Map<string, Bucket>();
  const perDay = new Map<string, { business: number; personal: number }>();
  let business = 0;
  let personal = 0;
  for (const s of segments) {
    if (s.isBusiness) business += s.seconds;
    else personal += s.seconds;
    const p = byProject.get(s.projectName) ?? { name: s.projectName, isBusiness: s.isBusiness, seconds: 0 };
    p.seconds += s.seconds;
    byProject.set(s.projectName, p);
    const a = byActivity.get(s.activityName) ?? { name: s.activityName, seconds: 0 };
    a.seconds += s.seconds;
    byActivity.set(s.activityName, a);
    const d = perDay.get(s.date) ?? { business: 0, personal: 0 };
    if (s.isBusiness) d.business += s.seconds;
    else d.personal += s.seconds;
    perDay.set(s.date, d);
  }

  const byDay: DayRow[] = [];
  for (let d = range.first; d < range.next; d = addDays(d, 1)) {
    const state: DayRow["state"] = d < from ? "before" : d > today ? "future" : d === today ? "today" : "past";
    const v = perDay.get(d) ?? { business: 0, personal: 0 };
    byDay.push({ date: d, state, ...v });
  }

  const days = byDay.filter((d) => d.state !== "before").length;
  const calendar = days * DAY_SEC;
  const fromAt = fromJst(from).getTime();
  const nextAt = fromJst(range.next).getTime();
  const elapsed = Math.max(0, Math.floor((Math.min(now.getTime(), nextAt) - fromAt) / 1000));
  const recorded = business + personal;

  return {
    month,
    from,
    next: range.next,
    days,
    calendar,
    elapsed,
    business,
    personal,
    unrecorded: Math.max(0, elapsed - recorded),
    businessOfCalendar: calendar > 0 ? business / calendar : null,
    businessOfRecorded: recorded > 0 ? business / recorded : null,
    byProject: ranked(byProject),
    byActivity: ranked(byActivity),
    byDay,
    segments,
    isCurrent: today >= range.first && today < range.next,
  };
}

/** その月（JST）のエントリと、月より前から続いている稼働中エントリ */
export async function listMonth(month: string): Promise<EntryView[]> {
  const { first, next } = monthRange(month);
  return listEntries(
    or(
      and(gte(timeEntries.entryDate, first), lt(timeEntries.entryDate, next)),
      and(isNull(timeEntries.endedAt), lt(timeEntries.entryDate, next)),
    ),
    [asc(timeEntries.startedAt), asc(timeEntries.id)],
  );
}

export async function monthReport(month: string, now = new Date()): Promise<MonthReport> {
  return summarizeMonth(await listMonth(month), month, now, reportStart());
}

// ---- CSV（02 §4: UTF-8 BOM・CRLF・JST の YYYY-MM-DD HH:MM） ----

function csvField(v: string | number | boolean): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | boolean)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** 秒 → 分（小数 2 桁）。行を足して集計と比べられるよう、切り捨てずに小数で出す */
export const minutesOf = (sec: number) => Math.round((sec / 60) * 100) / 100;
export const hoursOf = (sec: number) => Math.round((sec / 3600) * 100) / 100;

export function entriesCsv(r: MonthReport): string {
  const header = ["date", "started_at", "ended_at", "minutes", "project", "is_business", "activity", "note"];
  const rows = r.segments.map((s) => [
    s.date,
    jstDateTime(s.startedAt),
    s.running ? "" : jstDateTime(s.endedAt),
    minutesOf(s.seconds),
    s.projectName,
    s.isBusiness,
    s.activityName,
    s.note,
  ]);
  return toCsv([header, ...rows]);
}

export function summaryCsv(r: MonthReport): string {
  const map = new Map<string, { project: string; isBusiness: boolean; activity: string; seconds: number }>();
  for (const s of r.segments) {
    const key = `${s.projectName}\u0000${s.activityName}`;
    const v = map.get(key) ?? { project: s.projectName, isBusiness: s.isBusiness, activity: s.activityName, seconds: 0 };
    v.seconds += s.seconds;
    map.set(key, v);
  }
  const rows = [...map.values()]
    .sort((a, b) => b.seconds - a.seconds)
    .map((v) => [r.month, v.project, v.isBusiness, v.activity, minutesOf(v.seconds), hoursOf(v.seconds)]);
  return toCsv([["month", "project", "is_business", "activity", "minutes", "hours"], ...rows]);
}
