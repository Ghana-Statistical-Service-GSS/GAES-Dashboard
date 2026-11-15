import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { getDataset } from "@/lib/data/process";
import { loadRawExport } from "@/lib/data/raw";
import { viewFor } from "@/lib/data/view";
import { zipSync } from "fflate";
import { downloadJobFile } from "@/lib/suso";
import { toCSV } from "@/lib/fmt";
import { DERIVED_DICTIONARY } from "@/lib/data/dictionary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Respondent / officer identifiers (spec §3.13): admins only */
const PII_ADMIN = ["m0q00a", "m0q00b", "m0q00d", "id02", "m0q10b", "id11c", "m1q01", "m0q09b"];
/** Helper / placeholder / supervisor-process fields dropped from the analysis file */
const DROP = /^(ownership_total|m3err1|m3err2|gpsAccuracy|id13__Accuracy|id13__Altitude|id13__Timestamp|m[1-6]qend|m7q0[12]|m4t2|m4t8|m4q01y|sssys_irnd|has__errors|interview__status)$/;

function csvResponse(name: string, body: string) {
  return new Response("﻿" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { kind } = await ctx.params;
  // viewers can look at the dashboard but cannot take data files away
  if (s.role === "viewer") return NextResponse.json({ error: "Downloads are not available for viewer accounts" }, { status: 403 });
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    if (kind === "raw") {
      if (s.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
      const raw = await loadRawExport();
      const jobs = raw.jobs.filter((j) => j.type === "Tabular");
      if (!jobs.length) return NextResponse.json({ error: "No export available" }, { status: 404 });
      // one questionnaire version: its export as is; several: one archive holding each version's export
      let bytes: Uint8Array;
      if (jobs.length === 1) bytes = await downloadJobFile(jobs[0].jobId);
      else {
        const parts = await Promise.all(jobs.map(async (j) => {
          const q = raw.questionnaires.find((x) => x.QuestionnaireIdentity === j.qid);
          return [`${q?.Variable ?? "questionnaire"}_v${q?.Version ?? j.jobId}.zip`, await downloadJobFile(j.jobId)] as const;
        }));
        bytes = zipSync(Object.fromEntries(parts.map(([name, b]) => [name, [b, { level: 0 }]])));
      }
      return new Response(new Blob([bytes as BlobPart]), {
        headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="gaes-tabular-export-${stamp}.zip"` },
      });
    }

    const data = viewFor(await getDataset(), s);
    if (kind === "flags") {
      const rows = data.flags.map((f) => ({
        interview_key: f.key, interview_id: f.iid, check_id: f.check, check_name: data.checks.find((c) => c.id === f.check)?.name,
        severity: f.sev, category: f.cat, message: f.msg, interviewer: f.interviewer, team: f.team, region: f.region, counts_in_score: f.scored,
      }));
      return csvResponse(`gaes-flags-${stamp}.csv`, toCSV(rows));
    }
    if (kind === "interviewers") {
      const rows = data.interviewers.map((i) => ({
        login: i.login, name: i.name, team: i.team, supervisor: data.teams.find((t) => t.team === i.team)?.supervisorName ?? "", assigned: i.assigned, received_on_tablet: i.receivedOnTablet, attempted: i.attempted,
        complete: i.complete, non_contact: i.nonContact, refused: i.refused, pending: i.pending, completes_per_day: i.perDay,
        cooperation_rate: i.coopRate, median_active_min: i.medDuration, mean_score: i.meanScore, quality_index: i.iqi,
        rejections: i.rejections, submitted: i.submitted, heap_share: i.heapShare, zero_share: i.zeroShare, alerts: i.flags.join(";"), last_activity: i.lastActivity,
      }));
      return csvResponse(`gaes-interviewers-${stamp}.csv`, toCSV(rows));
    }
    if (kind === "clean") {
      const raw = await loadRawExport();
      const byId = new Map(raw.main.map((r) => [r.interview__id, r]));
      const all = [...data.records, ...(data.excludedRecords ?? [])];
      const dropPII = new Set(s.role === "admin" ? [] : PII_ADMIN);
      const rawCols = (raw.columns.length ? raw.columns : Object.keys(raw.main[0] ?? {})).filter((k) => k !== "interview__key" && k !== "interview__id" && k !== "qversion" && !DROP.test(k) && !dropPII.has(k));
      const rows = all.map((r) => {
        const src = byId.get(r.id) ?? {};
        const out: Record<string, unknown> = {
          interview__key: r.key, interview__id: r.id, disposition: r.disp, disposition_group: r.dispGroup, status: r.status, stage: r.stage,
          excluded_reason: r.excluded ?? "", analysable: r.analysable ? 1 : 0, quality_score: r.score, quality_band: r.band,
          n_critical: r.nCritical, n_major: r.nMajor, n_minor: r.nMinor, interviewer: r.interviewer, team: r.team,
          active_min: r.activeMin, session_min: r.sessMin, median_gap_s: r.medGapSec, n_answer_changes: r.nChanges,
          isic4_final: r.isic4, isic_section: r.isicSection, size_class: r.sizeClass, workers_2025: r.emp25, paid_employees: r.paid,
          revenue: r.rev, opex: r.opex, capex: r.capex, assets: r.assets, liabilities: r.liab, wage_per_paid_employee: r.wpw,
          revenue_per_worker: r.rpw, operating_margin: r.margin, zero_share: r.zeroShare, heap_share: r.heapShare,
          fin_source: r.records === false ? "estimate" : r.records === true ? "records" : "",
          questionnaire_version: r.qv, call_attempts: r.calls, call_attempts_source: r.callsSrc ?? "",
        };
        // every version gets the same columns; a question a version did not ask stays blank
        for (const k of rawCols) {
          const v = (src as Record<string, string>)[k];
          out[k] = v === undefined || v === "-999999999" || v === "##N/A##" ? "" : v;
        }
        return out;
      });
      return csvResponse(`gaes-clean-${stamp}.csv`, toCSV(rows, rows.length ? [...Object.keys(rows[0])] : undefined));
    }
    if (kind === "dictionary") {
      const raw = await loadRawExport();
      const rows = [
        ...DERIVED_DICTIONARY.map((d) => ({ variable: d.v, source: "derived", description: d.d })),
        ...Object.entries(raw.labels.variables).filter(([k]) => !DROP.test(k)).map(([k, l]) => ({ variable: k, source: "questionnaire", description: l })),
      ];
      return csvResponse(`gaes-data-dictionary.csv`, toCSV(rows));
    }
    return NextResponse.json({ error: "Unknown download" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
