import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が未設定です");
  return drizzle(postgres(url, { max: 5 }), { schema });
}

type DrizzleDb = ReturnType<typeof connect>;

// dev のホットリロードで接続が増え続けないよう、グローバルに 1 つだけ持つ
const g = globalThis as unknown as { worklogDb?: DrizzleDb };

function instance(): DrizzleDb {
  return (g.worklogDb ??= connect());
}

// 接続は最初のクエリまで作らない（next build は DATABASE_URL 無しでモジュールを読み込むため）
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    const real = instance();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
export type Db = DrizzleDb;
