import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が未設定です");
  return postgres(url, { max: 5 });
}

// dev のホットリロードで接続が増え続けないよう、グローバルに 1 本だけ持つ
const sql = globalForDb.pg ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.pg = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
