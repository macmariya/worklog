"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm text-slate-500">パスワード</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-3 text-base dark:border-slate-600"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 py-3 font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {pending ? "確認中…" : "ログイン"}
      </button>
    </form>
  );
}
