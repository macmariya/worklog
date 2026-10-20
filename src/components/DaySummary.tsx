import { formatMinutes } from "@/lib/time";

export function DaySummary({ business, personal, unrecorded }: { business: number; personal: number; unrecorded?: number }) {
  const cell = "rounded-lg bg-slate-100 px-2 py-2 text-center dark:bg-slate-800";
  return (
    <div className={`grid gap-2 ${unrecorded === undefined ? "grid-cols-2" : "grid-cols-3"}`}>
      <div className={cell}>
        <div className="text-xs text-slate-500">事業</div>
        <div className="font-bold tabular-nums">{formatMinutes(business)}</div>
      </div>
      <div className={cell}>
        <div className="text-xs text-slate-500">私用</div>
        <div className="font-bold tabular-nums">{formatMinutes(personal)}</div>
      </div>
      {unrecorded !== undefined && (
        <div className={cell}>
          <div className="text-xs text-slate-500">未記録</div>
          <div className="font-bold tabular-nums">{formatMinutes(unrecorded)}</div>
        </div>
      )}
    </div>
  );
}
