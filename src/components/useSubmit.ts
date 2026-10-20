"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionState } from "@/app/actions";

/**
 * Server Action を onSubmit から呼ぶ。<form action> は送信後にフォームを初期値へ戻すため、
 * 警告やエラーで差し戻したときに入力が消える。それを避けるために使う
 */
export function useSubmit(
  action: (prev: ActionState, form: FormData) => Promise<ActionState>,
  onSuccess?: (form: HTMLFormElement) => void,
) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const form = new FormData(el);
    startTransition(async () => {
      const r = await action(state, form);
      setState(r);
      if (r.ok) onSuccess?.(el);
    });
  }
  return { state, onSubmit, pending };
}
