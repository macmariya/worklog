// デモ DB を初期状態に戻す（案件・作業種別・記録をすべて消して入れ直す）。Cloudflare のデモは毎日 cloudflare/worker.ts が同じことをする。
// 本番の DB を消さないよう、WORKLOG_DEMO=1 を付けたときだけ動く。
//   WORKLOG_DEMO=1 DATABASE_URL=... npx tsx scripts/reset-demo.ts
import postgres from "postgres";
import { resetDemo } from "../src/lib/demo";

const url = process.env.DATABASE_URL;
if (!url || process.env.WORKLOG_DEMO !== "1") {
  console.error("デモ DB を指す DATABASE_URL と WORKLOG_DEMO=1 を付けてください");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const { entries } = await resetDemo(sql);
  console.log(`reset-demo: OK（記録 ${entries} 件）`);
} catch (e) {
  console.error("reset-demo: 失敗", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
