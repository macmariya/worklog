import { listDay, summarizeDay } from "@/lib/entries";
import { isDateString } from "@/lib/time";

// その日（JST）のエントリと事業／私用／未記録の分。F05 の JSON 版
export async function GET(_: Request, ctx: RouteContext<"/api/day/[date]">) {
  const { date } = await ctx.params;
  if (!isDateString(date)) return Response.json({ error: "日付は YYYY-MM-DD" }, { status: 400 });
  const now = new Date();
  const entries = await listDay(date, now);
  return Response.json({ date, summary: summarizeDay(entries, date, now), entries });
}
