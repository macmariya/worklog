import { DaySummary } from "@/components/DaySummary";
import { EntryList } from "@/components/EntryList";
import { HomeTimer } from "@/components/HomeTimer";
import { sheetDefaults } from "@/lib/defaults";
import { getRunning, lastUsed, listDay, summarizeDay } from "@/lib/entries";
import { listActivities, listProjects, quickStartProjects } from "@/lib/masters";
import { jstDate, jstDateLabel } from "@/lib/time";

export default async function Home() {
  const now = new Date();
  const today = jstDate(now);
  const [running, quick, entries, resume, projects, activities] = await Promise.all([
    getRunning(),
    quickStartProjects(),
    listDay(today, now),
    lastUsed(),
    listProjects({ includeArchived: true }),
    listActivities({ includeArchived: true }),
  ]);
  const sum = summarizeDay(entries, today, now);
  const defaults = sheetDefaults(entries, today, now);

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">今日 {jstDateLabel(today)}</h1>
      <HomeTimer
        running={running}
        quick={quick}
        activities={activities.filter((a) => !a.archivedAt)}
        resume={resume}
        serverNow={now}
      />
      <DaySummary business={sum.business} personal={sum.personal} />
      <EntryList
        entries={entries}
        date={today}
        defaults={defaults}
        projects={projects}
        activities={activities}
        now={now}
      />
    </div>
  );
}
