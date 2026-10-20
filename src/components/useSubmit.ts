"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionState } from "@/app/actions";

/**
 * Server Action を onSubmit から呼ぶ。<form action> は送信後にフォームを初期値へ戻すため、
 * 警告やエラーで差し戻したときに入力が消える。それを避けるために使う
 */
export function useSubmit(action: (prev: ActionState, form: FormData) => Promise<ActionState>) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      setState(await action(state, form));
    });
  }
  return { state, onSubmit, pending };
}
