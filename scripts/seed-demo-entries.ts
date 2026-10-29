// 公開用のデモ記録（スクリーンショットとデモ環境用）。本番の DB には流さない。
// 記録が 1 件でもある DB では何もしない。乱数は固定なので、同じ日に流せば同じ記録になる。
//   DATABASE_URL=... npx tsx scripts/seed-demo-entries.ts [日数=28]
import postgres from "postgres";
import { insertDemoEntries } from "../src/lib/demo";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です");
  process.exit(1);
}
const days = Number(process.argv[2] ?? 28);

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const [{ n }] = await sql`select count(*)::int as n from time_entries`;
  if (n > 0) {
    console.log(`seed-demo-entries: 記録が ${n} 件あるので何もしない`);
  } else {
    const count = await insertDemoEntries(sql, days);
    console.log(`seed-demo-entries: OK（${count} 件、直近 ${days} 日）`);
  }
} catch (e) {
  console.error("seed-demo-entries: 失敗", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
