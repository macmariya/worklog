import { summaryCsv } from "@/lib/reports";
import { csvResponse } from "../csv";

// 集計 CSV（F08）: month, project, is_business, activity, minutes, hours
export async function GET(_: Request, ctx: RouteContext<"/api/month/[month]/summary.csv">) {
  const { month } = await ctx.params;
  return csvResponse(month, "summary", summaryCsv);
}
