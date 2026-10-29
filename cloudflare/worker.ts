// Cloudflare のデモ（worklog-demo）の入口。画面と API は OpenNext が作った worker に任せ、
// 毎日 4:00 JST（wrangler.jsonc の crons）にデモを初期状態に戻す。
import postgres from "postgres";
// @ts-expect-error ビルド時に opennextjs-cloudflare build が作る
import { default as handler } from "../.open-next/worker.js";
import { resetDemo } from "../src/lib/demo";

type Env = { HYPERDRIVE: { connectionString: string } };
type Ctx = { waitUntil(p: Promise<unknown>): void };

const worker = {
  fetch: handler.fetch,
  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false, onnotice: () => {} });
    try {
      const { entries } = await resetDemo(sql);
      console.log(`reset-demo: OK（記録 ${entries} 件）`);
    } finally {
      ctx.waitUntil(sql.end());
    }
  },
};

export default worker;
