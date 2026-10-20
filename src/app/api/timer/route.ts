import { getRunning } from "@/lib/entries";

// 稼働中のエントリ（無ければ null）。認証は proxy.ts の Cookie 検証
export async function GET() {
  return Response.json({ running: await getRunning() });
}
