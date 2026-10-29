// 公開用のデモ記録（スクリーンショットと Cloudflare のデモ用）。本番の DB には流さない。
// scripts/seed-demo-entries.ts（空の DB に足す）と cloudflare/worker.ts（毎日入れ直す）が使う。
import type { Sql } from "postgres";
import seed from "../../seed/seed.demo.json";

type Project = { id: number; is_business: boolean; default_activity_id: number | null };
type Activity = { id: number };
export type DemoEntry = {
  project_id: number;
  activity_id: number;
  started_at: Date;
  ended_at: Date;
  note: string;
  source: string;
};

// 再現できる乱数（mulberry32）。同じ日に作れば同じ記録になる
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// JST の壁時計（その日の分）を UTC の Date に直す
function jst(ymd: string, minutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - 9 * 60 * 60 * 1000);
}
function jstYmd(now: Date, daysAgo: number): { ymd: string; weekday: number } {
  const j = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() - daysAgo));
  return { ymd: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

// 直近 days 日分（今日は含めない）の記録を作る
export function buildDemoEntries(projects: Project[], activities: Activity[], days = 28, now = new Date()): DemoEntry[] {
  if (projects.length === 0 || activities.length === 0) throw new Error("先に案件と作業種別を入れてください");
  const rand = mulberry32(20261029);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
  const business = projects.filter((p) => p.is_business);
  const personal = projects.filter((p) => !p.is_business);

  const rows: DemoEntry[] = [];
  for (let ago = days; ago >= 1; ago--) {
    const { ymd, weekday } = jstYmd(now, ago);
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
  return rows;
}

export async function insertDemoEntries(sql: Sql, days = 28, now = new Date()): Promise<number> {
  const projects = await sql<Project[]>`
    select id, is_business, default_activity_id from projects where archived_at is null order by sort_order`;
  const activities = await sql<Activity[]>`select id from activities order by sort_order`;
  const rows = buildDemoEntries(projects, activities, days, now);
  await sql`insert into time_entries ${sql(rows, "project_id", "activity_id", "started_at", "ended_at", "note", "source")}`;
  return rows.length;
}

// デモを初期状態に戻す: 3 表を空にして、汎用名の案件・作業種別（seed.demo.json）と記録を入れ直す
export async function resetDemo(sql: Sql, now = new Date()): Promise<{ entries: number }> {
  return sql.begin(async (tx) => {
    const q = tx as unknown as Sql; // TransactionSql は呼び出しの型だけ落ちている
    await q`truncate time_entries, projects, activities restart identity cascade`;
    await q`insert into activities ${q(seed.activities.map((a) => ({ name: a.name, sort_order: a.sortOrder })))}`;
    for (const p of seed.projects) {
      await q`insert into projects (name, is_business, default_activity_id, color, sort_order)
              values (${p.name}, ${p.isBusiness}, (select id from activities where name = ${p.defaultActivity}),
                      ${p.color}, ${p.sortOrder})`;
    }
    return { entries: await insertDemoEntries(q, 28, now) };
  });
}
