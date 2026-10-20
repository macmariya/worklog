import type { EntryView } from "./entries";
import { lastEndOfDay } from "./entries";
import { fromJst, jstDate, jstTime } from "./time";

/**
 * 追加シートの既定値（02 §3-1）。開始は「この日の最後のエントリの終了時刻」、
 * 終了は「現在時刻（当日）または開始＋60分（過去日。0:00 で頭打ち）」
 */
export function sheetDefaults(entries: EntryView[], date: string, now = new Date()) {
  const today = jstDate(now);
  const last = lastEndOfDay(entries, date);
  if (date === today) {
    const hourAgo = new Date(Math.max(now.getTime() - 3600_000, fromJst(date).getTime()));
    return { date, start: last ?? jstTime(hourAgo), end: jstTime(now) };
  }
  const start = last ?? "09:00";
  const plus60 = fromJst(date, start).getTime() + 3600_000;
  const end = jstDate(new Date(plus60)) === date ? jstTime(new Date(plus60)) : "00:00";
  return { date, start, end };
}
