import Link from "next/link";
import { notFound } from "next/navigation";
import { addMonths, isMonthString, monthReport, type Bucket } from "@/lib/reports";
import { formatMinutes, jstDateLabel } from "@/lib/time";

/** 秒 → 12時間30分 */
const hm = (sec: number) => formatMinutes(sec / 60);
/** 秒 → 12.5h（小数 2 桁まで） */
const hours = (sec: number) => `${Number((sec / 3600).toFixed(2))}h`;
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const slash = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

function Cell({ label, sec, value, strong }: { label: string; sec?: number; value?: string; strong?: boolean }) {
  const sub = strong ? "opacity-80" : "text-slate-500";
  return (
    <div
      className={`rounded-lg px-2 py-2 text-center ${
        strong ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800"
      }`}
    >
      <div className={`text-xs ${sub}`}>{label}</div>
      <div className="font-bold tabular-nums">{value ?? hm(sec!)}</div>
      {sec !== undefined && <div className={`text-xs tabular-nums ${sub}`}>{hours(sec)}</div>}
    </div>
  );
}

function BucketTable({ title, rows, total, showKind }: { title: string; rows: Bucket[]; total: number; showKind?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-500">記録はありません</p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="py-1.5 pr-2">
                  {r.name}
                  {showKind && <span className="ml-1 text-xs text-slate-500">{r.isBusiness ? "事業" : "私用"}</span>}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">{hm(r.seconds)}</td>
                <td className="w-14 py-1.5 text-right text-slate-500">
                  {total > 0 ? `${((r.seconds / total) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// 月次レポート（F06〜F08・02 §4）
export default async function MonthPage({ params }: PageProps<"/month/[month]">) {
  const { month } = await params;
  if (!isMonthString(month)) notFound();
  const r = await monthReport(month);
  const recorded = r.business + r.personal;
  const nav = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600";
  const btn = "flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-bold dark:border-slate-600";
  const [y, m] = month.split("-").map(Number);
  const lastDay = r.byDay[r.byDay.length - 1]?.date;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/month/${addMonths(month, -1)}`} className={nav} aria-label="前月">
          ◀ 前月
        </Link>
        <h1 className="text-lg font-bold">
          {y}年{m}月
          {r.isCurrent && <span className="ml-1 text-sm font-normal text-slate-500">今月</span>}
        </h1>
        <Link href={`/month/${addMonths(month, 1)}`} className={nav} aria-label="翌月">
          翌月 ▶
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">按分サマリ</h2>
        <p className="text-xs text-slate-500">
          集計期間: {r.days > 0 ? `${slash(r.from)}〜${slash(lastDay!)}（${r.days}日）` : "なし（記録開始前）"}
          {r.days > 0 && r.from !== `${month}-01` && `。${slash(r.from)} より前は記録開始前のため除いています`}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Cell label="事業" sec={r.business} />
          <Cell label="私用" sec={r.personal} />
          <Cell label="記録済み" sec={recorded} />
          <Cell label="総時間" sec={r.calendar} />
          <Cell label="事業÷総時間" value={pct(r.businessOfCalendar)} strong />
          <Cell label="事業÷記録済み" value={pct(r.businessOfRecorded)} />
        </div>
        <p className="text-xs text-slate-500">
          未記録 {hm(r.unrecorded)}
          {r.isCurrent &&
            "（今月は現在までの経過時間から数えています。総時間と事業÷総時間は月末までの日数で計算するので、月の途中では低く出ます）"}
        </p>
      </section>

      <div className="flex gap-2">
        <a href={`/api/month/${month}/entries.csv`} className={btn} download>
          明細 CSV
        </a>
        <a href={`/api/month/${month}/summary.csv`} className={btn} download>
          集計 CSV
        </a>
      </div>

      <BucketTable title="案件別" rows={r.byProject} total={recorded} showKind />
      <BucketTable title="作業種別別" rows={r.byActivity} total={recorded} />

      <section>
        <h2 className="mb-2 font-bold">日別</h2>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left font-normal">日付</th>
              <th className="py-1 text-right font-normal">事業</th>
              <th className="py-1 text-right font-normal">私用</th>
              <th className="py-1 text-right font-normal">未記録</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {r.byDay.map((d) => {
              const rec = d.business + d.personal;
              // 記録漏れの発見用: 終わった日で記録が 0 の日を強調する
              const missing = d.state === "past" && rec === 0;
              const dim = d.state === "future" || d.state === "before";
              const rowClass = missing
                ? "bg-red-50 font-bold text-red-700 dark:bg-red-950 dark:text-red-300"
                : dim
                  ? "text-slate-400"
                  : "";
              return (
                <tr key={d.date} className={rowClass}>
                  <td className="py-1.5">
                    <Link href={`/day/${d.date}`} className="underline-offset-2 hover:underline">
                      {jstDateLabel(d.date)}
                    </Link>
                  </td>
                  {d.state === "before" ? (
                    <td colSpan={3} className="py-1.5 text-right text-xs">
                      記録開始前
                    </td>
                  ) : d.state === "future" ? (
                    <td colSpan={3} />
                  ) : (
                    <>
                      <td className="py-1.5 text-right">{hm(d.business)}</td>
                      <td className="py-1.5 text-right">{hm(d.personal)}</td>
                      <td className="py-1.5 text-right">
                        {d.state === "today" ? "記録中" : missing ? "記録なし" : hm(Math.max(0, 24 * 3600 - rec))}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        総時間は暦の時間（集計期間の日数×24時間）で、睡眠時間などは引いていません。按分の分母をどう取るかは
        2027年2月の確定申告準備で決めます。時間は秒まで足してから、表示のときに分へ切り捨てています。
      </p>
    </div>
  );
}
