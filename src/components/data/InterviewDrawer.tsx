"use client";

import { useEffect, useMemo } from "react";
import { ExternalLink, ListChecks, X, AlertTriangle, AlertOctagon, AlertCircle, Info } from "lucide-react";
import { useData } from "./DataProvider";
import { BandChip, SevChip } from "@/components/ui/kit";
import { fmt, pct, titleCase, cedi } from "@/lib/fmt";

const MODE: Record<number, string> = { 1: "CATI · phone", 2: "CAPI · face-to-face", 3: "Web" };
const STATUS: Record<number, string> = {
  60: "Interviewer assigned", 65: "Rejected by supervisor", 80: "Ready", 95: "Restarted", 100: "Completed — awaiting supervisor",
  120: "Approved by supervisor — awaiting HQ", 125: "Rejected by HQ", 130: "Approved by HQ",
};
const DISP: Record<string, string> = {
  COMPLETE: "Complete", PARTIAL: "Partial", NO_ANSWER: "No answer", UNREACHABLE: "Unreachable", SWITCHED_OFF: "Switched off",
  CALL_DROPPED: "Call dropped", LANGUAGE: "Language barrier", CALLBACK: "Call-back requested", REFUSED: "Refused", NOT_STARTED: "Not started",
};
const SEV_ORDER: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
const SevIcon = ({ sev }: { sev: string }) =>
  sev === "critical" ? <AlertOctagon size={16} className="text-[var(--bad)]" /> :
  sev === "major" ? <AlertTriangle size={16} className="text-[#d17a22]" /> :
  sev === "minor" ? <AlertCircle size={16} className="text-[#c9a227]" /> : <Info size={16} className="text-[var(--muted)]" />;

export default function InterviewDrawer() {
  const { data, selected, setSelected, setAnswersId } = useData();
  const rec = useMemo(
    () => (selected && data ? data.records.find((r) => r.id === selected) ?? data.excludedRecords?.find((r) => r.id === selected) ?? null : null),
    [selected, data]
  );
  const flags = useMemo(
    () => (data && rec ? data.flags.filter((f) => f.iid === rec.id).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]) : []),
    [data, rec]
  );
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [setSelected]);
  if (!rec || !data) return null;
  const checkName = (id: string) => data.checks.find((c) => c.id === id)?.name ?? id;
  const canReview = data.viewer.role !== "viewer";

  return (
    <>
      <div className="modal-backdrop !bg-black/30" onClick={() => setSelected(null)} />
      <aside className="drawer" role="dialog" aria-label={`Interview ${rec.key}`}>
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <div className="min-w-0">
            <div className="eyebrow">Interview</div>
            <div className="font-mono text-lg font-bold">{rec.key}</div>
            <div className="truncate text-sm text-[var(--muted)]">{rec.estName ?? (rec.estId ? `Establishment ${rec.estId}` : "Establishment details hidden")}</div>
          </div>
          <button className="icon-btn ml-auto" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <BandChip band={rec.band} />
            {rec.score !== null && <span className="chip chip-primary">Score {rec.score}/100</span>}
            <span className="chip chip-muted">{DISP[rec.disp] ?? rec.disp}</span>
            {rec.excluded && <span className="chip chip-bad">Excluded: {rec.excluded}</span>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item k="Region" v={titleCase(rec.region)} />
            <Item k="District" v={titleCase(rec.district)} />
            <Item k="Interviewer" v={`${rec.interviewer ?? "–"}${rec.interviewer && data.interviewerNames[rec.interviewer] ? ` · ${data.interviewerNames[rec.interviewer]}` : ""}`} />
            <Item k="Team / supervisor" v={rec.team ? `Team ${rec.team} · ${(rec.supervisor && data.supervisorNames?.[rec.supervisor]) || rec.supervisor}` : "–"} />
            <Item k="Mode" v={rec.mode ? MODE[rec.mode] : "Not set"} />
            <Item k="Status" v={rec.status !== null ? STATUS[rec.status] ?? String(rec.status) : "–"} />
            <Item k="Started" v={rec.startTs ? new Date(rec.startTs).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) : "–"} />
            <Item k="Active time" v={rec.activeMin !== null ? `${fmt(rec.activeMin, 1)} min` : "–"} />
            <Item k="Recorded time (timespent)" v={rec.timespent !== null ? `${fmt(rec.timespent)} min` : "–"} />
            <Item k="Median gap / fast answers" v={rec.medGapSec !== null ? `${fmt(rec.medGapSec, 1)}s · ${pct(rec.pctFast)}` : "–"} />
            <Item k="Sector (ISIC)" v={rec.isicSection ? `${rec.isicSection} · ${rec.isic4}` : "–"} />
            <Item k="Rejections" v={String(rec.rejections)} />
            {rec.disp === "COMPLETE" && <>
              <Item k="Workers 2025" v={fmt(rec.emp25)} />
              <Item k="Revenue FY2025" v={cedi(rec.rev)} />
              <Item k="Operating expenses" v={cedi(rec.opex)} />
              <Item k="Wage per paid employee" v={cedi(rec.wpw)} />
            </>}
            {rec.disp === "COMPLETE" && <Item k="Calls before completion" v={rec.calls !== null ? `${rec.calls}${rec.callsSrc === "comment" ? " (from supervisor's comment)" : ""}` : "Not recorded"} />}
            <Item k="Questionnaire" v={`Version ${rec.qv}`} />
            {rec.callback && <Item k="Call-back" v={rec.callback} />}
          </dl>

          <div>
            <h4 className="section-title mb-2">Quality flags <span className="text-sm font-normal text-[var(--muted)]">({flags.length})</span></h4>
            {flags.length === 0 ? (
              <div className="notice notice-ok">No quality issues found for this interview.</div>
            ) : (
              <ul className="space-y-2">
                {flags.map((f, k) => (
                  <li key={k} className="rounded-xl border border-[var(--border)] p-3">
                    <div className="flex items-center gap-2">
                      <SevIcon sev={f.sev} />
                      <span className="text-sm font-semibold">{checkName(f.check)}</span>
                      <span className="ml-auto flex items-center gap-1.5"><span className="font-mono text-[11px] text-[var(--muted)]">{f.check}</span><SevChip sev={f.sev} /></span>
                    </div>
                    <p className="mt-1.5 pl-6 text-sm text-[var(--muted)]">{f.msg}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn btn-ghost w-full justify-center" onClick={() => setAnswersId(rec.id)}>
            <ListChecks size={15} /> View all answers
          </button>
          {canReview && (
            <a className="btn btn-primary w-full justify-center" href={rec.reviewUrl} target="_blank" rel="noreferrer">
              Open in Survey Solutions <ExternalLink size={15} />
            </a>
          )}
        </div>
      </aside>
    </>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{k}</dt>
      <dd className="mt-0.5 font-medium">{v || "–"}</dd>
    </div>
  );
}
