import { z } from "zod";
import { getRunning, startTimer } from "@/lib/entries";
import { apiError } from "../../respond";

const body = z.object({
  projectId: z.number().int().positive(),
  activityId: z.number().int().positive().nullable().optional(),
});

// 案件を選んで開始（稼働中があれば止めてから）。F01 の JSON 版
export async function POST(request: Request) {
  try {
    const v = body.parse(await request.json());
    await startTimer(v.projectId, v.activityId ?? null);
    return Response.json({ running: await getRunning() });
  } catch (e) {
    return apiError(e);
  }
}
