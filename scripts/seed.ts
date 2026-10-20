// 初期データ（冪等。何度実行しても増えない）。
// 使うファイル: 引数 > SEED_FILE > seed/seed.local.json（gitignore。本番の案件名）> seed/seed.demo.json（公開用の汎用名）
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

type SeedFile = {
  activities: { name: string; sortOrder: number }[];
  projects: {
    name: string;
    isBusiness: boolean;
    defaultActivity: string;
    color: string;
    sortOrder: number;
  }[];
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です");
  process.exit(1);
}

const dir = path.join(process.cwd(), "seed");
const local = path.join(dir, "seed.local.json");
const file =
  process.argv[2] ??
  process.env.SEED_FILE ??
  (existsSync(local) ? local : path.join(dir, "seed.demo.json"));
const data = JSON.parse(readFileSync(file, "utf8")) as SeedFile;

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    for (const a of data.activities) {
      await tx`insert into activities (name, sort_order) values (${a.name}, ${a.sortOrder})
               on conflict (name) do nothing`;
    }
    for (const p of data.projects) {
      await tx`insert into projects (name, is_business, default_activity_id, color, sort_order)
               values (${p.name}, ${p.isBusiness},
                       (select id from activities where name = ${p.defaultActivity}),
                       ${p.color}, ${p.sortOrder})
               on conflict (name) do nothing`;
    }
  });
  const [c] = await sql`select (select count(*) from activities)::int as a, (select count(*) from projects)::int as p`;
  console.log(`seed: OK（${path.basename(file)}。activities ${c.a} 件・projects ${c.p} 件）`);
} catch (e) {
  console.error("seed: 失敗", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
