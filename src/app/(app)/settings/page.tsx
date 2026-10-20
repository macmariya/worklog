import { logout } from "@/app/(auth)/login/actions";
import { ActivityEditor, ColorDot, ProjectEditor } from "@/components/MasterEditors";
import { listActivities, listProjects } from "@/lib/masters";

const row = "rounded-lg border border-slate-200 dark:border-slate-700";
const summary = "flex cursor-pointer items-center gap-2 px-3 py-3";

export default async function SettingsPage() {
  const [projects, activities] = await Promise.all([
    listProjects({ includeArchived: true }),
    listActivities({ includeArchived: true }),
  ]);
  const actName = (id: number | null) => activities.find((a) => a.id === id)?.name ?? "なし";
  // 有効なものを先に、アーカイブ済みは後ろに
  const sorted = <T extends { archivedAt: Date | null }>(xs: T[]) =>
    [...xs].sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt));

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-lg font-bold">案件</h1>
        <ul className="space-y-2">
          {sorted(projects).map((p) => (
            <li key={p.id} className={`${row} ${p.archivedAt ? "opacity-60" : ""}`}>
              <details>
                <summary className={summary}>
                  <ColorDot color={p.color} />
                  <span className="flex-1 truncate font-bold">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    {p.isBusiness ? "事業" : "私用"}・{actName(p.defaultActivityId)}・{p.sortOrder}
                    {p.archivedAt && "・アーカイブ済み"}
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                  <ProjectEditor project={p} activities={activities} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details className={row}>
          <summary className={summary}>＋ 案件を追加</summary>
          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            <ProjectEditor activities={activities} />
          </div>
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">作業種別</h2>
        <ul className="space-y-2">
          {sorted(activities).map((a) => (
            <li key={a.id} className={`${row} ${a.archivedAt ? "opacity-60" : ""}`}>
              <details>
                <summary className={summary}>
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-xs text-slate-500">
                    {a.sortOrder}
                    {a.archivedAt && "・アーカイブ済み"}
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                  <ActivityEditor activity={a} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details className={row}>
          <summary className={summary}>＋ 作業種別を追加</summary>
          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            <ActivityEditor />
          </div>
        </details>
      </section>

      <form action={logout}>
        <button type="submit" className="w-full rounded-lg border border-slate-300 py-2.5 text-slate-600 dark:border-slate-600">
          ログアウト
        </button>
      </form>
    </div>
  );
}
