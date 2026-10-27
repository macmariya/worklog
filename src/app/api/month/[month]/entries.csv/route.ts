import { entriesCsv } from "@/lib/reports";
import { csvResponse } from "../csv";

// 明細 CSV（F08）: date, started_at, ended_at, minutes, project, is_business, activity, note
export async function GET(_: Request, ctx: RouteContext<"/api/month/[month]/entries.csv">) {
  const { month } = await ctx.params;
  return csvResponse(month, "entries", entriesCsv);
}
