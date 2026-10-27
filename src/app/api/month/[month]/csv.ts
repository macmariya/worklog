import { isMonthString, monthReport, type MonthReport } from "@/lib/reports";

// 月次 CSV の共通部分（02 §4）。ファイル名は ASCII にする（Safari・Excel で文字化けしないため）
export async function csvResponse(month: string, kind: "entries" | "summary", body: (r: MonthReport) => string) {
  if (!isMonthString(month)) return Response.json({ error: "月は YYYY-MM" }, { status: 400 });
  const report = await monthReport(month);
  return new Response(body(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="worklog_${month}_${kind}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
