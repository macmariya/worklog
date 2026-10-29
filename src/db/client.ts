import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect(url: string, options: postgres.Options<Record<string, never>> = {}) {
  return drizzle(postgres(url, { max: 5, ...options }), { schema });
}

type DrizzleDb = ReturnType<typeof connect>;

// dev のホットリロードで接続が増え続けないよう、グローバルに 1 つだけ持つ
const g = globalThis as unknown as { worklogDb?: DrizzleDb };

// Cloudflare Workers（デモ）では接続をリクエストをまたいで使えないので、リクエストごとに作る。
// プールは Hyperdrive が持つ。キーはリクエストごとに別になる ExecutionContext
const perRequest = new WeakMap<object, DrizzleDb>();

function instance(): DrizzleDb {
  const url = process.env.DATABASE_URL;
  if (url) return (g.worklogDb ??= connect(url));

  const { env, ctx } = getCloudflareContext();
  const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
  if (!hyperdrive) throw new Error("DATABASE_URL が未設定です");
  let real = perRequest.get(ctx);
  if (!real) {
    // 配列型の列は無いので型の問い合わせを省いて 1 往復減らす（Hyperdrive の推奨設定）
    real = connect(hyperdrive.connectionString, { fetch_types: false, prepare: true });
    perRequest.set(ctx, real);
  }
  return real;
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
