import { stopTimer } from "@/lib/entries";
import { apiError } from "../../respond";

// 稼働中を止める（0:00 をまたいでいれば分割）。F02 の JSON 版
export async function POST() {
  try {
    const stopped = await stopTimer();
    return Response.json({ stopped: stopped ? stopped.id : null });
  } catch (e) {
    return apiError(e);
  }
}
