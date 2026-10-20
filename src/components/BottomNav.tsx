"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav({ today }: { today: string }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "ホーム", active: path === "/" },
    { href: `/day/${today}`, label: "日次", active: path.startsWith("/day") },
    { href: `/month/${today.slice(0, 7)}`, label: "月次", active: path.startsWith("/month") },
    { href: "/settings", label: "設定", active: path.startsWith("/settings") },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              href={i.href}
              className={`block py-3 text-center text-sm ${
                i.active ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
