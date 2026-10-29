// 公開用のデモ記録（スクリーンショットとデモ環境用）。本番の DB には流さない。
// 記録が 1 件でもある DB では何もしない。乱数は固定なので、同じ日に流せば同じ記録になる。
//   DATABASE_URL=... npx tsx scripts/seed-demo-entries.ts [日数=28]
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です");
  process.exit(1);
}
const days = Number(process.argv[2] ?? 28);

// 再現できる乱数（mulberry32）
let state = 20261029;
function rand(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

// JST の壁時計（その日の分）を UTC の Date に直す
function jst(ymd: string, minutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - 9 * 60 * 60 * 1000);
}
function jstYmd(daysAgo: number): { ymd: string; weekday: number } {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  return { ymd: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const [{ n }] = await sql`select count(*)::int as n from time_entries`;
  if (n > 0) {
    console.log(`seed-demo-entries: 記録が ${n} 件あるので何もしない`);
  } else {
    const projects = await sql<{ id: number; name: string; is_business: boolean; default_activity_id: number | null }[]>`
      select id, name, is_business, default_activity_id from projects where archived_at is null order by sort_order`;
    const activities = await sql<{ id: number }[]>`select id from activities order by sort_order`;
    if (projects.length === 0 || activities.length === 0) throw new Error("先に npm run db:seed で案件と作業種別を入れてください");
    const business = projects.filter((p) => p.is_business);
    const personal = projects.filter((p) => !p.is_business);

    const rows: { project_id: number; activity_id: number; started_at: Date; ended_at: Date; note: string; source: string }[] = [];
    for (let ago = days; ago >= 1; ago--) {
      const { ymd, weekday } = jstYmd(ago);
      if (weekday === 0) continue; // 日曜は休み
      if (rand() < 0.08) continue; // ときどき記録の無い日（月次レポートで強調される）
      let t = 9 * 60 + Math.floor(rand() * 4) * 15; // 9:00〜9:45 に始める
      const blocks = weekday === 6 ? 2 : 3 + Math.floor(rand() * 2);
      for (let i = 0; i < blocks; i++) {
        const p = pick(business.length ? business : projects);
        const len = 45 + Math.floor(rand() * 8) * 15; // 45 分〜2 時間 30 分
        rows.push({
          project_id: p.id,
          activity_id: p.default_activity_id ?? pick(activities).id,
          started_at: jst(ymd, t),
          ended_at: jst(ymd, t + len),
          note: "",
          source: rand() < 0.7 ? "timer" : "manual",
        });
        t += len + 15 + (i === 1 ? 60 : 0); // 2 本目の後に昼休み
      }
      if (personal.length && rand() < 0.5) {
        const p = pick(personal);
        const start = 20 * 60 + Math.floor(rand() * 4) * 15;
        rows.push({
          project_id: p.id,
          activity_id: p.default_activity_id ?? pick(activities).id,
          started_at: jst(ymd, start),
          ended_at: jst(ymd, start + 30 + Math.floor(rand() * 4) * 15),
          note: "",
          source: "manual",
        });
      }
    }
    await sql`insert into time_entries ${sql(rows, "project_id", "activity_id", "started_at", "ended_at", "note", "source")}`;
    console.log(`seed-demo-entries: OK（${rows.length} 件、直近 ${days} 日）`);
  }
} catch (e) {
  console.error("seed-demo-entries: 失敗", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
