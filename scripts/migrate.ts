// drizzle/ のマイグレーション SQL を順に適用する。
// 本番では docker compose exec app npm run db:migrate で手動実行する（起動時に自動実行しない。03 §7）
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const folder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

try {
  await migrate(drizzle(sql), { migrationsFolder: folder });
  const rows = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log(`migrate: OK（適用済み ${rows[0].n} 件）`);
} catch (e) {
  console.error("migrate: 失敗", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
