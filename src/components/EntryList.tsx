"use client";

import { useCallback, useState } from "react";
import { colorClass } from "@/lib/colors";
import { formatMinutes, jstDate, jstTime } from "@/lib/time";
import { EntrySheet } from "./EntrySheet";
import type { Activity, EntryView, Project, SheetDefaults } from "./types";

/** エントリの一覧。行をタップすると編集シート、追加ボタンで追加シート */
export function EntryList({
  entries,
  date,
  defaults,
  projects,
  activities,
  now,
}: {
  entries: EntryView[];
  date: string;
  defaults: SheetDefaults;
  projects: Project[];
  activities: Activity[];
  now: Date;
}) {
  const [sheet, setSheet] = useState<{ entry: EntryView | null } | null>(null);
  const close = useCallback(() => setSheet(null), []);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">記録（{entries.length} 件）</h2>
        <button
          type="button"
          onClick={() => setSheet({ entry: null })}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
        >
          ＋ 追加
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">記録はありません</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {entries.map((e) => {
            const end = e.endedAt ?? now;
            const min = Math.floor((end.getTime() - e.startedAt.getTime()) / 60000);
            const fromPrevDay = jstDate(e.startedAt) !== date;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSheet({ entry: e })}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colorClass(e.projectColor).dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-sm tabular-nums">
                      <span>
                        {fromPrevDay ? `${jstDate(e.startedAt).slice(5)} ` : ""}
                        {jstTime(e.startedAt)}–{e.endedAt ? (jstDate(e.endedAt) !== date ? "24:00" : jstTime(e.endedAt)) : "稼働中"}
                      </span>
                      <span className="text-slate-500">{formatMinutes(min)}</span>
                    </span>
                    <span className="block truncate">
                      {e.projectName}
                      <span className="ml-2 text-sm text-slate-500">{e.activityName}</span>
                      {!e.isBusiness && <span className="ml-2 text-xs text-slate-500">私用</span>}
                    </span>
                    {e.note && <span className="block truncate text-sm text-slate-500">{e.note}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {sheet && (
        <EntrySheet
          key={sheet.entry?.id ?? "new"}
          entry={sheet.entry}
          defaults={defaults}
          projects={projects}
          activities={activities}
          onClose={close}
        />
      )}
    </section>
  );
}
