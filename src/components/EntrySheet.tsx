"use client";

import { useState, useTransition } from "react";
import { deleteEntryAction, saveEntryAction } from "@/app/actions";
import { jstDate, jstTime } from "@/lib/time";
import type { Activity, EntryView, Project, SheetDefaults } from "./types";
import { useSubmit } from "./useSubmit";

const field =
  "mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-base dark:border-slate-600";

/** 追加・修正の共通シート（02 §3-2） */
export function EntrySheet({
  entry,
  defaults,
  projects,
  activities,
  onClose,
}: {
  entry: EntryView | null;
  defaults: SheetDefaults;
  projects: Project[];
  activities: Activity[];
  onClose: () => void;
}) {
  const { state, onSubmit, pending } = useSubmit(saveEntryAction, onClose);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // アーカイブ済みは除外。ただしこのエントリが参照していれば出す
  const projectOptions = projects.filter((p) => !p.archivedAt || p.id === entry?.projectId);
  const activityOptions = activities.filter((a) => !a.archivedAt || a.id === entry?.activityId);

  const [projectId, setProjectId] = useState<number | "">(entry?.projectId ?? "");
  const [activityId, setActivityId] = useState<number | "">(entry?.activityId ?? "");
  const [activityTouched, setActivityTouched] = useState(!!entry);

  function onProject(v: string) {
    const id = v ? Number(v) : "";
    setProjectId(id);
    // 案件を変えたら既定の種別に追従する（手で変えていたら維持）
    if (!activityTouched) {
      const p = projects.find((x) => x.id === id);
      setActivityId(p?.defaultActivityId ?? "");
    }
  }

  const date = entry ? jstDate(entry.startedAt) : defaults.date;
  const start = entry ? jstTime(entry.startedAt) : defaults.start;
  const end = entry ? (entry.endedAt ? jstTime(entry.endedAt) : "") : defaults.end;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={entry ? "記録の修正" : "記録の追加"}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{entry ? "記録の修正" : "記録の追加"}</h2>
          <button type="button" onClick={onClose} className="px-2 py-1 text-slate-500">
            閉じる
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          {entry && <input type="hidden" name="id" value={entry.id} />}
          <label className="block">
            <span className="text-sm text-slate-500">案件</span>
            <select
              name="projectId"
              required
              value={projectId}
              onChange={(e) => onProject(e.target.value)}
              className={field}
            >
              <option value="">選んでください</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.isBusiness ? "事業" : "私用"}）
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-500">作業種別</span>
            <select
              name="activityId"
              required
              value={activityId}
              onChange={(e) => {
                setActivityTouched(true);
                setActivityId(e.target.value ? Number(e.target.value) : "");
              }}
              className={field}
            >
              <option value="">選んでください</option>
              {activityOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-500">日付（開始日）</span>
            <input type="date" name="date" required defaultValue={date} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-slate-500">開始</span>
              <input type="time" name="start" required defaultValue={start} className={field} />
            </label>
            <label className="block">
              <span className="text-sm text-slate-500">終了（空欄＝稼働中）</span>
              <input type="time" name="end" defaultValue={end} className={field} />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            終了が開始より前なら翌日の時刻として扱い、0:00 で 2 件に分けて保存します。
          </p>
          <label className="block">
            <span className="text-sm text-slate-500">メモ</span>
            <input type="text" name="note" maxLength={200} defaultValue={entry?.note ?? ""} className={field} />
          </label>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.warning && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p>{state.warning}</p>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" name="confirmOverlap" value="1" />
                重なりを承知で保存する
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-900 py-3 font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </form>

        {entry && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            {deleteError && <p className="mb-2 text-sm text-red-600">{deleteError}</p>}
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (!confirm("この記録を削除しますか？")) return;
                startDelete(async () => {
                  const r = await deleteEntryAction(entry.id);
                  if (r.error) setDeleteError(r.error);
                  else onClose();
                });
              }}
              className="w-full rounded-lg border border-red-300 py-2.5 text-red-600 disabled:opacity-50"
            >
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
