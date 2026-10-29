import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // 公開デモ（Cloudflare）だけ、ログイン画面にパスワードの案内を出す（wrangler.jsonc の vars）
  const hint = process.env.LOGIN_HINT;
  return (
    <main className="mx-auto w-full max-w-sm px-4 pt-24">
      <h1 className="mb-8 text-center text-2xl font-bold">worklog</h1>
      {hint && <p className="mb-6 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{hint}</p>}
      <LoginForm next={typeof next === "string" ? next : "/"} />
    </main>
  );
}
