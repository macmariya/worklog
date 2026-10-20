import type { Activity, Project } from "@/db/schema";
import type { EntryView } from "@/lib/entries";

export type { Activity, EntryView, Project };

export type SheetDefaults = { date: string; start: string; end: string };
