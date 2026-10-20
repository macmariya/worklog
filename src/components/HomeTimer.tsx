"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { startAction, stopAction } from "@/app/actions";
import { colorClass } from "@/lib/colors";
import { formatElapsed, jstTime } from "@/lib/time";
import type { Activity } from "./types";

export type RunningView = {
  projectId: number;
  projectName: string;
  projectColor: string;
  activityName: string;
  startedAt: Date;
};

export type QuickProject = {
  id: number;
  name: string;
  color: string;
  isBusiness: boolean;
  defaultActivityId: number | null;
};

const QUICK_LIMIT = 8;

/** 稼働中カードとクイック開始（02 §2）。開始・停止は押した瞬間に表示を切り替え、失敗したら戻す */
export function HomeTimer({
  running,
  quick,
  activities,
  resume,
  serverNow,
}: {
  running: RunningView | null;
  quick: QuickProject[];
  activities: Activity[];
  resume: { projectId: number; activityId: number; projectName: string } | null;
  serverNow: Date;
}) {
  const [optimistic, setOptimistic] = useOptimistic<RunningView | null, RunningView | null>(
    running,
    (_, next) => next,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(serverNow.getTime());

  useEffect(() => {
    // 経過時間はクライアントで数える（サーバーへの問い合わせは開始・停止のときだけ）
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activityName = (id: number | null) => activities.find((a) => a.id === id)?.name ?? "";

  function start(p: QuickProject | { id: number; name: string; color: string }, activityId: number | null) {
    setError(null);
    startTransition(async () => {
      setOptimistic({
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        activityName: activityName(activityId ?? ("defaultActivityId" in p ? p.defaultActivityId : null)),
        startedAt: new Date(),
      });
      const r = await startAction(p.id, activityId);
      if (r.error) setError(r.error);
    });
  }

  function stop() {
    setError(null);
    startTransition(async () => {
      setOptimistic(null);
      const r = await stopAction();
      if (r.error) setError(r.error);
    });
  }

  const shown = showAll ? quick : quick.slice(0, QUICK_LIMIT);
  const resumeProject = resume && quick.find((q) => q.id === resume.projectId);

  return (
    <div className="space-y-4">
      <section
        className={`rounded-2xl border-2 p-4 ${
          optimistic ? colorClass(optimistic.projectColor).button : "border-slate-200 dark:border-slate-700"
        }`}
        aria-live="polite"
      >
        {optimistic ? (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className={`h-2.5 w-2.5 rounded-full ${colorClass(optimistic.projectColor).dot}`} />
              記録中 ・ {jstTime(optimistic.startedAt)} から
            </div>
            <div className="mt-1 text-xl font-bold">{optimistic.projectName}</div>
            <div className="text-sm text-slate-500">{optimistic.activityName}</div>
            <div className="my-3 text-center text-4xl font-bold tabular-nums">
              {formatElapsed(now - optimistic.startedAt.getTime())}
            </div>
            <button
              type="button"
              onClick={stop}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold text-white active:bg-red-700"
            >
              停止
            </button>
          </>
        ) : (
          <>
            <div className="text-center text-slate-500">記録なし</div>
            {resume && resumeProject && (
              <button
                type="button"
                onClick={() => start(resumeProject, resume.activityId)}
                className="mt-3 w-full rounded-xl bg-slate-900 py-4 text-lg font-bold text-white dark:bg-slate-100 dark:text-slate-900"
              >
                {resume.projectName} を再開
              </button>
            )}
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {pending && <p className="mt-2 text-center text-xs text-slate-400">保存中…</p>}
      </section>

      <section>
        <h2 className="mb-2 font-bold">開始する案件</h2>
        <div className="grid grid-cols-2 gap-2">
          {shown.map((p) => {
            const active = optimistic?.projectId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => start(p, null)}
                aria-pressed={active}
                className={`flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left ${
                  colorClass(p.color).button
                } ${active ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${colorClass(p.color).dot}`} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.isBusiness ? "事業" : "私用"}・{activityName(p.defaultActivityId) || "種別未設定"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {quick.length > QUICK_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 w-full py-2 text-sm text-slate-500"
          >
            {showAll ? "閉じる" : `すべて（${quick.length} 件）`}
          </button>
        )}
      </section>
    </div>
  );
}
