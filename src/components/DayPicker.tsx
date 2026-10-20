"use client";

import { useRouter } from "next/navigation";

/** カレンダーで任意の日へ移動する */
export function DayPicker({ date }: { date: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      aria-label="日付を選ぶ"
      value={date}
      onChange={(e) => e.target.value && router.push(`/day/${e.target.value}`)}
      className="rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-slate-600"
    />
  );
}
