import { describe, expect, it } from "vitest";
import type { EntryView } from "@/lib/entries";
import { addMonths, entriesCsv, isMonthString, summarizeMonth, summaryCsv, toCsv } from "@/lib/reports";
import { fromJst } from "@/lib/time";

let nextId = 1;
function entry(
  date: string,
  start: string,
  end: string | null,
  opts: { project?: string; business?: boolean; activity?: string; note?: string; endDate?: string } = {},
): EntryView {
  return {
    id: nextId++,
    projectId: 1,
    activityId: 1,
    startedAt: fromJst(date, start),
    endedAt: end === null ? null : fromJst(opts.endDate ?? date, end),
    entryDate: date,
    note: opts.note ?? "",
    source: "timer",
    projectName: opts.project ?? (opts.business === false ? "家事・私用" : "受託開発"),
    projectColor: "gray",
    isBusiness: opts.business ?? true,
    activityName: opts.activity ?? "開発",
  };
}

const H = 3600;

describe("月の文字列", () => {
  it("YYYY-MM だけを受け付ける", () => {
    expect(isMonthString("2026-10")).toBe(true);
    expect(isMonthString("2026-13")).toBe(false);
    expect(isMonthString("2026-1")).toBe(false);
  });
  it("年をまたいで月を足し引きする", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("summarizeMonth", () => {
  const after = new Date("2026-12-01T00:00:00Z"); // 10 月・11 月とも終わった後

  it("事業・私用・按分率と、暦時間（日数×24h）", () => {
    const r = summarizeMonth(
      [entry("2026-10-05", "09:00", "12:00"), entry("2026-10-05", "12:00", "13:00", { business: false })],
      "2026-10",
      after,
    );
    expect(r.days).toBe(31);
    expect(r.calendar).toBe(31 * 24 * H);
    expect(r.business).toBe(3 * H);
    expect(r.personal).toBe(1 * H);
    expect(r.unrecorded).toBe(31 * 24 * H - 4 * H);
    expect(r.businessOfCalendar).toBeCloseTo(3 / (31 * 24));
    expect(r.businessOfRecorded).toBeCloseTo(0.75);
  });

  it("月末 23:30 から翌月 1:00 までの記録は、保存時に分割された 2 件がそれぞれの月に入る", () => {
    const rows = [
      entry("2026-10-31", "23:30", "00:00", { endDate: "2026-11-01" }),
      entry("2026-11-01", "00:00", "01:00"),
    ];
    expect(summarizeMonth(rows, "2026-10", after).business).toBe(30 * 60);
    expect(summarizeMonth(rows, "2026-11", after).business).toBe(1 * H);
  });

  it("月をまたいで稼働中の記録は、now までを 0:00 で切って両方の月に入れる", () => {
    const now = fromJst("2026-11-01", "02:00");
    const rows = [entry("2026-10-31", "22:00", null)];
    const oct = summarizeMonth(rows, "2026-10", now);
    const nov = summarizeMonth(rows, "2026-11", now);
    expect(oct.business).toBe(2 * H);
    expect(nov.business).toBe(2 * H);
    expect(nov.segments[0].running).toBe(true);
    expect(oct.byDay.find((d) => d.date === "2026-10-31")!.business).toBe(2 * H);
  });

  it("今月は now までを経過時間とし、明日以降を future、今日を today にする", () => {
    const now = fromJst("2026-10-28", "08:00");
    const r = summarizeMonth([entry("2026-10-28", "00:00", "06:00")], "2026-10", now);
    expect(r.isCurrent).toBe(true);
    expect(r.elapsed).toBe((27 * 24 + 8) * H);
    expect(r.unrecorded).toBe((27 * 24 + 2) * H);
    expect(r.byDay.find((d) => d.date === "2026-10-28")!.state).toBe("today");
    expect(r.byDay.find((d) => d.date === "2026-10-29")!.state).toBe("future");
    expect(r.byDay.find((d) => d.date === "2026-10-27")!.state).toBe("past");
  });

  it("記録開始日より前の日は分母にも分子にも入れない（2026-10 は 10/21 から）", () => {
    const rows = [entry("2026-10-20", "19:00", "20:00"), entry("2026-10-21", "09:00", "10:00")];
    const r = summarizeMonth(rows, "2026-10", after, "2026-10-21");
    expect(r.from).toBe("2026-10-21");
    expect(r.days).toBe(11);
    expect(r.calendar).toBe(11 * 24 * H);
    expect(r.business).toBe(1 * H);
    expect(r.byDay.find((d) => d.date === "2026-10-20")!.state).toBe("before");
    // 開始日が過ぎた月には効かない
    expect(summarizeMonth([], "2026-11", after, "2026-10-21").days).toBe(30);
  });

  it("記録の無い月は 0 で、率は null", () => {
    const r = summarizeMonth([], "2026-09", after);
    expect(r.business).toBe(0);
    expect(r.businessOfRecorded).toBeNull();
    expect(r.byProject).toEqual([]);
  });

  it("案件別・作業種別別は合計の降順", () => {
    const r = summarizeMonth(
      [
        entry("2026-10-01", "09:00", "10:00", { project: "ブログ運営", activity: "執筆" }),
        entry("2026-10-01", "10:00", "13:00", { project: "受託開発", activity: "開発" }),
        entry("2026-10-02", "10:00", "11:00", { project: "ブログ運営", activity: "開発" }),
      ],
      "2026-10",
      after,
    );
    expect(r.byProject.map((p) => [p.name, p.seconds / H])).toEqual([
      ["受託開発", 3],
      ["ブログ運営", 2],
    ]);
    expect(r.byActivity.map((a) => [a.name, a.seconds / H])).toEqual([
      ["開発", 4],
      ["執筆", 1],
    ]);
  });
});

describe("CSV", () => {
  const after = new Date("2026-12-01T00:00:00Z");

  it("BOM 付き・CRLF・必要なときだけ引用符で囲む", () => {
    expect(toCsv([["a", 'b"c', "d,e"], [1, true, "x\ny"]])).toBe('﻿a,"b""c","d,e"\r\n1,true,"x\ny"\r\n');
  });

  it("明細は JST の YYYY-MM-DD HH:MM、稼働中の終了は空欄。分は秒から小数で出す", () => {
    const now = fromJst("2026-10-28", "08:00");
    const r = summarizeMonth(
      [entry("2026-10-28", "06:00", "07:30", { note: "見積, 初回" }), entry("2026-10-28", "07:30", null)],
      "2026-10",
      now,
    );
    const lines = entriesCsv(r).replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("date,started_at,ended_at,minutes,project,is_business,activity,note");
    expect(lines[1]).toBe('2026-10-28,2026-10-28 06:00,2026-10-28 07:30,90,受託開発,true,開発,"見積, 初回"');
    expect(lines[2]).toBe("2026-10-28,2026-10-28 07:30,,30,受託開発,true,開発,");
  });

  it("集計 CSV は案件×作業種別で、明細の分を足すと一致する", () => {
    const r = summarizeMonth(
      [
        entry("2026-10-01", "09:00", "10:20"),
        entry("2026-10-02", "09:00", "09:40"),
        entry("2026-10-02", "10:00", "11:00", { business: false, activity: "その他" }),
      ],
      "2026-10",
      after,
    );
    const lines = summaryCsv(r).replace("﻿", "").trim().split("\r\n");
    expect(lines).toEqual([
      "month,project,is_business,activity,minutes,hours",
      "2026-10,受託開発,true,開発,120,2",
      "2026-10,家事・私用,false,その他,60,1",
    ]);
  });
});
