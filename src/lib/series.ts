import type { Dataset, Rec } from "./data/types";
import type { Filters } from "@/components/data/DataProvider";
import { dateRange } from "./fmt";

export function todayOf(data: Dataset): string {
  return (data.exportedAt ?? data.generatedAt).slice(0, 10);
}

/** Most recent day with any fieldwork activity (start or completion) in the whole dataset. */
export function lastActiveDay(data: Dataset): string | null {
  let last: string | null = null;
  for (const r of data.records) {
    for (const d of [r.date, r.completeDate]) if (d && d <= todayOf(data) && (!last || d > last)) last = d;
  }
  return last;
}

/** Fieldwork days from the start to the last day with activity (never beyond today / field end). */
export function surveyDays(data: Dataset): string[] {
  const today = todayOf(data);
  const last = lastActiveDay(data) ?? today;
  let end = last < today ? last : today;
  if (end > data.survey.fieldEnd) end = data.survey.fieldEnd;
  return end >= data.survey.fieldStart ? dateRange(data.survey.fieldStart, end) : [];
}

export function daily(rows: Rec[], days: string[], pick: (r: Rec) => string | null): number[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const d = pick(r);
    if (d) m.set(d, (m.get(d) ?? 0) + 1);
  }
  return days.map((d) => m.get(d) ?? 0);
}

export function cumulative(a: number[]): number[] {
  let s = 0;
  return a.map((x) => (s += x));
}

/** Target matching the active filters (national, team, interviewer or region). */
export function targetFor(data: Dataset, f: Filters): { value: number | null; label: string } {
  const t = data.targets;
  if (f.interviewer) return { value: t.byInterviewer[f.interviewer] ?? null, label: `${f.interviewer} assignments` };
  if (f.region) {
    const v = t.byRegion[f.region];
    return { value: v ?? null, label: v ? `${f.region} target` : "Region target not loaded" };
  }
  if (f.section) {
    const v = t.bySection[f.section];
    return { value: v ?? null, label: v ? `Section ${f.section} target` : "Sector target not loaded" };
  }
  if (f.team) return { value: t.byTeam[f.team] ?? null, label: `Team ${f.team} assignments` };
  if (data.viewer.regions.length) {
    const vals = data.viewer.regions.map((r) => t.byRegion[r]).filter((x): x is number => !!x);
    return vals.length === data.viewer.regions.length ? { value: vals.reduce((a, b) => a + b, 0), label: "Your regions' target" } : { value: null, label: "Region target not loaded" };
  }
  return { value: t.national, label: "National sample" };
}

export interface Pace {
  workdays: string[];
  elapsed: number; // working days up to and including today
  total: number;
  left: number;
  timeShare: number;
  today: string;
  lastWorkday: string | null; // most recent workday strictly before today (for "yesterday")
}

export function paceOf(data: Dataset): Pace {
  const today = todayOf(data);
  const wd = data.survey.workdays;
  const elapsed = wd.filter((d) => d <= today).length;
  const before = wd.filter((d) => d < today);
  return {
    workdays: wd, elapsed, total: wd.length, left: Math.max(0, wd.filter((d) => d > today).length),
    timeShare: wd.length ? elapsed / wd.length : 0, today, lastWorkday: before.length ? before[before.length - 1] : null,
  };
}
