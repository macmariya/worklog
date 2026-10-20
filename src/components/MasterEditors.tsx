"use client";

import { useState, useTransition } from "react";
import {
  archiveActivityAction,
  archiveProjectAction,
  saveActivityAction,
  saveProjectAction,
  type ActionState,
} from "@/app/actions";
import { COLORS } from "@/db/schema";
import { COLOR_CLASS, colorClass } from "@/lib/colors";
import type { Activity, Project } from "./types";
import { useSubmit } from "./useSubmit";

const field =
  "mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-base dark:border-slate-600";
const primary =
  "rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900";
const secondary = "rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50 dark:border-slate-600";

function Message({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-green-700 dark:text-green-400">保存しました</p>;
  return null;
}

function ArchiveButton({
  archived,
  onToggle,
}: {
  archived: boolean;
  onToggle: () => Promise<ActionState>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={secondary}
        onClick={() =>
          start(async () => {
            const r = await onToggle();
            setError(r.error ?? null);
          })
        }
      >
        {archived ? "復元" : "アーカイブ"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}

export function ProjectEditor({ project, activities }: { project?: Project; activities: Activity[] }) {
  const [color, setColor] = useState(project?.color ?? "gray");
  // 新規追加は保存できたら空に戻す
  const { state, onSubmit, pending } = useSubmit(saveProjectAction, (form) => {
    if (project) return;
    form.reset();
    setColor("gray");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {project && <input type="hidden" name="id" value={project.id} />}
      <label className="block">
        <span className="text-sm text-slate-500">名前</span>
        <input name="name" required maxLength={50} defaultValue={project?.name} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-slate-500">区分</span>
          <select name="isBusiness" defaultValue={String(project?.isBusiness ?? true)} className={field}>
            <option value="true">事業</option>
            <option value="false">私用</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">並び順</span>
          <input
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            defaultValue={project?.sortOrder ?? 100}
            className={field}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-slate-500">既定の作業種別</span>
        <select name="defaultActivityId" defaultValue={project?.defaultActivityId ?? ""} className={field}>
          <option value="">なし</option>
          {activities
            .filter((a) => !a.archivedAt || a.id === project?.defaultActivityId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm text-slate-500">表示色</legend>
        <input type="hidden" name="color" value={color} />
        <div className="mt-1 flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={COLOR_CLASS[c].label}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full ${COLOR_CLASS[c].dot} ${
                color === c ? "ring-2 ring-slate-900 ring-offset-2 dark:ring-white" : ""
              }`}
            />
          ))}
        </div>
      </fieldset>
      <Message state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primary}>
          {project ? "保存" : "追加"}
        </button>
        {project && (
          <ArchiveButton
            archived={!!project.archivedAt}
            onToggle={() => archiveProjectAction(project.id, !project.archivedAt)}
          />
        )}
      </div>
    </form>
  );
}

export function ActivityEditor({ activity }: { activity?: Activity }) {
  const { state, onSubmit, pending } = useSubmit(saveActivityAction, (form) => {
    if (!activity) form.reset();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {activity && <input type="hidden" name="id" value={activity.id} />}
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="block">
          <span className="text-sm text-slate-500">名前</span>
          <input name="name" required maxLength={30} defaultValue={activity?.name} className={field} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">並び順</span>
          <input
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            defaultValue={activity?.sortOrder ?? 100}
            className={field}
          />
        </label>
      </div>
      <Message state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primary}>
          {activity ? "保存" : "追加"}
        </button>
        {activity && (
          <ArchiveButton
            archived={!!activity.archivedAt}
            onToggle={() => archiveActivityAction(activity.id, !activity.archivedAt)}
          />
        )}
      </div>
    </form>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${colorClass(color).dot}`} />;
}
