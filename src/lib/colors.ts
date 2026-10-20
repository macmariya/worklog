import type { Color } from "@/db/schema";

// Tailwind が拾えるようにクラス名は文字列のまま持つ
export const COLOR_CLASS: Record<Color, { dot: string; button: string; label: string }> = {
  gray: { dot: "bg-slate-400", button: "border-slate-400 bg-slate-50 dark:bg-slate-800", label: "グレー" },
  red: { dot: "bg-red-500", button: "border-red-400 bg-red-50 dark:bg-red-950", label: "赤" },
  orange: { dot: "bg-orange-500", button: "border-orange-400 bg-orange-50 dark:bg-orange-950", label: "オレンジ" },
  amber: { dot: "bg-amber-400", button: "border-amber-400 bg-amber-50 dark:bg-amber-950", label: "黄" },
  green: { dot: "bg-green-500", button: "border-green-500 bg-green-50 dark:bg-green-950", label: "緑" },
  teal: { dot: "bg-teal-500", button: "border-teal-500 bg-teal-50 dark:bg-teal-950", label: "青緑" },
  blue: { dot: "bg-blue-500", button: "border-blue-500 bg-blue-50 dark:bg-blue-950", label: "青" },
  purple: { dot: "bg-purple-500", button: "border-purple-500 bg-purple-50 dark:bg-purple-950", label: "紫" },
};

export function colorClass(c: string) {
  return COLOR_CLASS[(c in COLOR_CLASS ? c : "gray") as Color];
}
