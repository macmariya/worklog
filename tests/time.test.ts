import { describe, expect, it } from "vitest";
import {
  addDays,
  formatElapsed,
  formatMinutes,
  fromJst,
  isDateString,
  jstDate,
  jstDateLabel,
  jstDateTime,
  jstTime,
  nextJstMidnight,
  resolveManualRange,
  splitAtJstMidnight,
} from "@/lib/time";

const iso = (r: { startedAt: Date; endedAt: Date }) => [jstDateTime(r.startedAt), jstDateTime(r.endedAt)];

describe("JST 変換", () => {
  it("UTC 15:00 は JST の翌日 0:00", () => {
    const d = new Date("2026-10-20T15:00:00Z");
    expect(jstDate(d)).toBe("2026-10-21");
    expect(jstTime(d)).toBe("00:00");
  });

  it("UTC 14:59 は JST の当日 23:59", () => {
    expect(jstDateTime(new Date("2026-10-20T14:59:00Z"))).toBe("2026-10-20 23:59");
  });

  it("fromJst は JST の壁時計を UTC の時刻に直す", () => {
    expect(fromJst("2026-10-21", "00:00").toISOString()).toBe("2026-10-20T15:00:00.000Z");
    expect(fromJst("2026-10-21", "09:30").toISOString()).toBe("2026-10-21T00:30:00.000Z");
  });

  it("月末・年末・うるう日をまたいで日付を足せる", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("存在しない日付は不正", () => {
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(() => fromJst("2026-13-01")).toThrow(RangeError);
    expect(() => fromJst("2026-10-01", "24:00")).toThrow(RangeError);
  });

  it("次の JST 0:00（ちょうど 0:00 なら翌日の 0:00）", () => {
    expect(jstDateTime(nextJstMidnight(fromJst("2026-10-20", "23:59")))).toBe("2026-10-21 00:00");
    expect(jstDateTime(nextJstMidnight(fromJst("2026-10-21", "00:00")))).toBe("2026-10-22 00:00");
  });

  it("曜日つきの表示", () => {
    expect(jstDateLabel("2026-10-20")).toBe("10/20（火）");
  });
});

describe("splitAtJstMidnight", () => {
  it("23:59→00:01 は 0:00 で 2 件に分かれる", () => {
    const r = splitAtJstMidnight(fromJst("2026-10-20", "23:59"), fromJst("2026-10-21", "00:01"));
    expect(r.map(iso)).toEqual([
      ["2026-10-20 23:59", "2026-10-21 00:00"],
      ["2026-10-21 00:00", "2026-10-21 00:01"],
    ]);
  });

  it("ちょうど 0:00 に終わる区間は分割しない（前日に属する）", () => {
    const r = splitAtJstMidnight(fromJst("2026-10-20", "23:30"), fromJst("2026-10-21", "00:00"));
    expect(r.map(iso)).toEqual([["2026-10-20 23:30", "2026-10-21 00:00"]]);
    expect(jstDate(r[0].startedAt)).toBe("2026-10-20");
  });

  it("0:00 に始まる区間は当日に属し分割しない", () => {
    const r = splitAtJstMidnight(fromJst("2026-10-21", "00:00"), fromJst("2026-10-21", "01:00"));
    expect(r).toHaveLength(1);
    expect(jstDate(r[0].startedAt)).toBe("2026-10-21");
  });

  it("2 日以上またぐ区間は日ごとに分かれる", () => {
    const r = splitAtJstMidnight(fromJst("2026-10-20", "22:00"), fromJst("2026-10-22", "02:00"));
    expect(r.map(iso)).toEqual([
      ["2026-10-20 22:00", "2026-10-21 00:00"],
      ["2026-10-21 00:00", "2026-10-22 00:00"],
      ["2026-10-22 00:00", "2026-10-22 02:00"],
    ]);
  });

  it("分割後の区間は隙間なく元の区間を覆う", () => {
    const s = fromJst("2026-10-31", "20:15");
    const e = fromJst("2026-11-02", "07:45");
    const r = splitAtJstMidnight(s, e);
    expect(r[0].startedAt).toEqual(s);
    expect(r.at(-1)!.endedAt).toEqual(e);
    for (let i = 1; i < r.length; i++) expect(r[i].startedAt).toEqual(r[i - 1].endedAt);
  });

  it("開始＝終了・終了が開始より前は拒否する", () => {
    const t = fromJst("2026-10-20", "10:00");
    expect(() => splitAtJstMidnight(t, t)).toThrow(RangeError);
    expect(() => splitAtJstMidnight(t, fromJst("2026-10-20", "09:00"))).toThrow(RangeError);
  });
});

describe("resolveManualRange", () => {
  it("終了が空なら稼働中（null）", () => {
    const r = resolveManualRange("2026-10-20", "09:00", null);
    expect(r.endedAt).toBeNull();
    expect(jstDateTime(r.startedAt)).toBe("2026-10-20 09:00");
    expect(resolveManualRange("2026-10-20", "09:00", "").endedAt).toBeNull();
  });

  it("終了が開始より前なら翌日の時刻（23:30–01:15）", () => {
    const r = resolveManualRange("2026-10-20", "23:30", "01:15");
    expect(jstDateTime(r.endedAt!)).toBe("2026-10-21 01:15");
    expect(splitAtJstMidnight(r.startedAt, r.endedAt!)).toHaveLength(2);
  });

  it("終了 00:00 は翌日 0:00（分割されない）", () => {
    const r = resolveManualRange("2026-10-20", "23:30", "00:00");
    expect(jstDateTime(r.endedAt!)).toBe("2026-10-21 00:00");
    expect(splitAtJstMidnight(r.startedAt, r.endedAt!)).toHaveLength(1);
  });
});

describe("表示", () => {
  it("分を 時間・分 で表す", () => {
    expect(formatMinutes(0)).toBe("0分");
    expect(formatMinutes(45)).toBe("45分");
    expect(formatMinutes(120)).toBe("2時間");
    expect(formatMinutes(125)).toBe("2時間5分");
  });

  it("経過時間を h:mm:ss で表す", () => {
    expect(formatElapsed(3723_000)).toBe("1:02:03");
    expect(formatElapsed(-5)).toBe("0:00:00");
  });
});
