import Link from "next/link";
import { notFound } from "next/navigation";
import { DayPicker } from "@/components/DayPicker";
import { DaySummary } from "@/components/DaySummary";
import { EntryList } from "@/components/EntryList";
import { sheetDefaults } from "@/lib/defaults";
import { listDay, summarizeDay } from "@/lib/entries";
import { listActivities, listProjects } from "@/lib/masters";
import { addDays, isDateString, jstDate, jstDateLabel } from "@/lib/time";

export default async function DayPage({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  if (!isDateString(date)) notFound();
  const now = new Date();
  const [entries, projects, activities] = await Promise.all([
    listDay(date, now),
    listProjects({ includeArchived: true }),
    listActivities({ includeArchived: true }),
  ]);
  const sum = summarizeDay(entries, date, now);
  const isToday = date === jstDate(now);
  const nav = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/day/${addDays(date, -1)}`} className={nav} aria-label="前日">
          ◀ 前日
        </Link>
        <h1 className="text-lg font-bold">
          {jstDateLabel(date)}
          {isToday && <span className="ml-1 text-sm font-normal text-slate-500">今日</span>}
        </h1>
        <Link href={`/day/${addDays(date, 1)}`} className={nav} aria-label="翌日">
          翌日 ▶
        </Link>
      </div>
      <div className="flex justify-center">
        <DayPicker date={date} />
      </div>
      <DaySummary business={sum.business} personal={sum.personal} unrecorded={sum.unrecorded} />
      <EntryList
        entries={entries}
        date={date}
        defaults={sheetDefaults(entries, date, now)}
        projects={projects}
        activities={activities}
        now={now}
      />
    </div>
  );
}
