// JST の日付・時刻の変換と、日付をまたぐ区間の分割（03_データ設計 §4）。
// 表示と日付境界は Asia/Tokyo 固定。日本は UTC+9 で夏時間が無い前提を DB の jst_date() と共有するので、
// Intl やホストの TZ に頼らず固定オフセットで計算する（ホストが UTC でも JST でも同じ結果になる）。

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** JST の壁時計として読んだときの各部分 */
function jstParts(d: Date) {
  const s = new Date(d.getTime() + JST_OFFSET_MS);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    d: s.getUTCDate(),
    hh: s.getUTCHours(),
    mm: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
}

/** 2026-10-20 */
export function jstDate(d: Date): string {
  const p = jstParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** 09:05 */
export function jstTime(d: Date): string {
  const p = jstParts(d);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

/** 2026-10-20 09:05 */
export function jstDateTime(d: Date): string {
  return `${jstDate(d)} ${jstTime(d)}`;
}

export function isDateString(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
}

export function isTimeString(s: string): boolean {
  const m = TIME_RE.exec(s);
  return !!m && +m[1] < 24 && +m[2] < 60;
}

/** JST の 日付＋時刻 → 時刻（UTC の Date） */
export function fromJst(date: string, time = "00:00"): Date {
  if (!isDateString(date)) throw new RangeError(`日付の形式が不正です: ${date}`);
  if (!isTimeString(time)) throw new RangeError(`時刻の形式が不正です: ${time}`);
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hh, mm) - JST_OFFSET_MS);
}

/** JST の日付に n 日足す */
export function addDays(date: string, n: number): string {
  return jstDate(new Date(fromJst(date).getTime() + n * DAY_MS));
}

/** d より後で最初の JST 0:00 */
export function nextJstMidnight(d: Date): Date {
  return fromJst(addDays(jstDate(d), 1));
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 10/20（火） */
export function jstDateLabel(date: string): string {
  const p = jstParts(fromJst(date));
  return `${p.m}/${p.d}（${WEEKDAYS[p.dow]}）`;
}

export type Range = { startedAt: Date; endedAt: Date };

/**
 * 区間を JST の 0:00 で分割する。各区間は 1 日の中に収まり、終了がちょうど翌日 0:00 の区間は前日に属する
 * （DB の CHECK time_entries_same_jst_day と同じ規則）。
 */
export function splitAtJstMidnight(startedAt: Date, endedAt: Date): Range[] {
  if (!(endedAt.getTime() > startedAt.getTime())) {
    throw new RangeError("終了は開始より後にしてください");
  }
  const out: Range[] = [];
  let s = startedAt;
  while (true) {
    const boundary = nextJstMidnight(s);
    if (endedAt.getTime() <= boundary.getTime()) {
      out.push({ startedAt: s, endedAt });
      return out;
    }
    out.push({ startedAt: s, endedAt: boundary });
    s = boundary;
  }
}

/**
 * 手入力の 日付・開始・終了（JST）を時刻に直す。終了が開始以前なら翌日の時刻とみなす（23:30–01:15）。
 * 終了が空なら稼働中（null）。
 */
export function resolveManualRange(
  date: string,
  start: string,
  end: string | null,
): { startedAt: Date; endedAt: Date | null } {
  const startedAt = fromJst(date, start);
  if (end === null || end === "") return { startedAt, endedAt: null };
  let endedAt = fromJst(date, end);
  if (endedAt.getTime() <= startedAt.getTime()) endedAt = fromJst(addDays(date, 1), end);
  return { startedAt, endedAt };
}

/** 分（端数切り捨て） */
export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MINUTE_MS);
}

/** 125 → 2時間5分 */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}分`;
  return r === 0 ? `${h}時間` : `${h}時間${r}分`;
}

/** 経過時間 1:02:03 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}
