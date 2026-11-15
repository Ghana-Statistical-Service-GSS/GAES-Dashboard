import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { getDataset } from "@/lib/data/process";
import { loadRawExport } from "@/lib/data/raw";
import { viewFor } from "@/lib/data/view";
import { CALLS_VAR } from "@/lib/data/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Respondent / establishment identifiers hidden from viewers (spec §3.13) */
const PII = new Set([
  "m0q00a", "m0q00b", "m0q00d", "id02", "m0q10b", "id11c", "m1q01", "m0q09b", "id01b", "id06", "id07", "id09",
  "m0q12b", "m0q13b", "m0q14b", "m0q15", "id13__Latitude", "id13__Longitude", "m0q08__Latitude", "m0q08__Longitude",
]);
const SKIP = /^(interview__id|interview__key|sssys_irnd|has__errors|interview__status|assignment__id|qversion|id13__(Accuracy|Altitude|Timestamp)|ownership_total|m3err[12]|gpsAccuracy)$/;
const MONEY = /^(m4q0[12]|m4t|m5q01|m5t|m6q0[12]|m6t|m6q03b)/;

const SECTIONS: Record<string, string> = {
  cover: "Cover & identification", m0: "Call outcome, respondent & address", m1: "1 · Identification & classification",
  m2: "2 · Economic activities", m3: "3 · Employment", m4: "4 · Expenses", m5: "5 · Revenues", m6: "6 · Assets, liabilities & credit",
  m7: "7 · Supervisor review",
};
const sectionOf = (v: string) => v.match(/^m\d/i)?.[0].toLowerCase() ?? "cover";

export interface AnswerItem {
  variable: string;
  label: string;
  section: string;
  value: string | null;
  state: "answered" | "unanswered" | "skipped" | "hidden";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const data = viewFor(await getDataset(), s);
    // region restriction: only interviews this user may see
    const rec = data.records.find((r) => r.id === id) ?? data.excludedRecords.find((r) => r.id === id);
    if (!rec) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    const raw = await loadRawExport();
    const row = raw.main.find((r) => r.interview__id === id);
    if (!row) return NextResponse.json({ error: "Answers are not in the current export — refresh the data" }, { status: 404 });

    const L = raw.labels;
    const hidePII = s.role === "viewer";
    const items: AnswerItem[] = [];
    const multi = new Map<string, AnswerItem & { picked: string[]; any: boolean }>();

    items.push({ variable: "questionnaire", label: "Questionnaire version used for this interview", section: "cover", value: `Version ${rec.qv}`, state: "answered" });
    // walk the merged column list so questions keep their questionnaire order in every version
    const columns = raw.columns.length ? raw.columns : Object.keys(row);
    for (const v of columns) {
      if (SKIP.test(v)) continue;
      if (!(v in row)) {
        // question added in a later version: show it only when we recovered the answer another way
        if (v === CALLS_VAR && rec.callsSrc === "comment") {
          items.push({ variable: v, label: L.variables[v] ?? v, section: sectionOf(v), value: `${rec.calls} (taken from the supervisor's comment — not asked in version ${rec.qv})`, state: "answered" });
        }
        continue;
      }
      const rawVal = row[v];
      const val = (rawVal ?? "").trim();
      const m = v.match(/^(.+)__(\d+)$/);
      if (m) {
        // multi-select: one line listing the chosen options
        const full = L.variables[v] ?? v;
        const cut = full.lastIndexOf(":");
        let g = multi.get(m[1]);
        if (!g) {
          g = { variable: m[1], label: cut > 0 ? full.slice(0, cut) : full, section: sectionOf(v), value: null, state: "skipped", picked: [], any: false };
          multi.set(m[1], g);
          items.push(g);
        }
        if (val !== "" && val !== "-999999999") g.any = true;
        if (Number(val) > 0) g.picked.push(cut > 0 ? full.slice(cut + 1).trim() : v);
        continue;
      }
      const item: AnswerItem = { variable: v, label: L.variables[v] ?? v, section: sectionOf(v), value: null, state: "answered" };
      if (val === "") item.state = "skipped";
      else if (val === "-999999999" || val === "##N/A##") item.state = "unanswered";
      else if (hidePII && PII.has(v)) item.state = "hidden";
      else {
        const set = L.valueSets[L.values[v] || v];
        const lab = set?.[val];
        if (lab) item.value = `${lab} (${val})`;
        else if (MONEY.test(v) && /^-?\d+(\.\d+)?$/.test(val)) item.value = Number(val).toLocaleString("en-GB", { maximumFractionDigits: 2 });
        else item.value = val.replace(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d)(:\d\d)?$/, "$1 $2");
      }
      items.push(item);
    }
    for (const g of multi.values()) {
      if (g.any) {
        g.state = "answered";
        g.value = g.picked.length ? g.picked.join("; ") : "None selected";
      }
    }

    return NextResponse.json({
      id,
      key: rec.key,
      sections: Object.entries(SECTIONS).map(([k, title]) => ({ key: k, title })),
      items: items.map(({ variable, label, section, value, state }) => ({ variable, label, section, value, state })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
