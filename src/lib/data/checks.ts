import type { CheckDef, Flag, Severity } from "./types";
import type { I } from "./derive";
import { FIN_ITEMS, fmtN, haversine, hhmm, isoDate, median, normName, normPhone } from "./derive";
import { GHANA_BBOX, REGION_BBOX, REGIONS, SURVEY, T, TEAM_OF, MODE_LABEL, DISP_LABEL } from "./config";
import { CALLS_MAX, CALLS_VAR } from "./calls";

/* ------------------------------------------------------------------ */
/* Catalogue (spec §3)                                                  */
/* ------------------------------------------------------------------ */

const C = (id: string, name: string, cat: string, sev: CheckDef["sev"], modes: string, scope: string, desc: string): CheckDef =>
  ({ id, name, cat, sev, modes, scope, desc });

export const CHECKS: CheckDef[] = [
  C("DQ-ID-01", "Interviewer ID does not match login", "Identification", "critical", "CATI·CAPI·Web", "All", "Interviewer code recorded differs from the Survey Solutions login that did the interview."),
  C("DQ-ID-02", "Interviewer name, ID and contact disagree", "Identification", "major", "CATI·CAPI·Web", "All", "The three cover fields share one code; they differ or are blank."),
  C("DQ-ID-03", "Interviewer not in the stated team", "Identification", "major", "CATI·CAPI·Web", "All", "Interviewer belongs to another team than id10."),
  C("DQ-ID-04", "District code not in region", "Identification", "major", "CATI·CAPI·Web", "All", "floor(district/100) must equal region code."),
  C("DQ-ID-05", "Interview outside the fieldwork window", "Identification", "critical", "CATI·CAPI·Web", "All", "Start before fieldwork, in the future, or end before start. Purged from analysis."),
  C("DQ-ID-06", "Test or training record", "Identification", "critical", "CATI·CAPI·Web", "All", "Name fields contain test/dummy/training text. Purged from analysis."),
  C("DQ-ID-07", "Mode or start time not recorded", "Identification", "major", "CATI·CAPI·Web", "Submitted", "interview_mode or datetime blank on a submitted interview."),
  C("DQ-ID-08", "Establishment ceased before the reference year", "Identification", "major", "CATI·CAPI·Web", "Complete", "Stopped before 2025 yet reports FY2025 revenue or workers."),
  C("DQ-DU-01", "Duplicate establishment", "Duplication", "critical", "CATI·CAPI·Web", "All", "Same establishment serial (id01a) completed more than once, or recorded twice in one questionnaire version. A fresh attempt in a newer questionnaire version is not a duplicate."),
  C("DQ-DU-02", "Assignment with more than one interview", "Duplication", "critical", "CATI·CAPI·Web", "All", "Assignment quantity is 1."),
  C("DQ-DU-03", "Same establishment phone on different establishments", "Duplication", "major", "CATI·CAPI·Web", "All", "Frame duplicate or wrong unit called."),
  C("DQ-DU-04", "Same respondent phone on different establishments", "Duplication", "major", "CATI·CAPI·Web", "Complete", "One person answering for several units, or fabrication."),
  C("DQ-DU-05", "Respondent phone is a field officer's phone", "Duplication", "critical", "CATI·CAPI·Web", "All", "Respondent phone matches an interviewer contact number — fabrication signal."),
  C("DQ-DU-06", "Same establishment name in the same district", "Duplication", "minor", "CATI·CAPI·Web", "All", "Possible frame duplicate (normalised name)."),
  C("DQ-CP-01", "Key variable missing", "Completeness", "critical", "CATI·CAPI·Web", "Complete", "Any key output variable is blank."),
  C("DQ-CP-02", "Unanswered interviewer questions", "Completeness", "major", "CATI·CAPI·Web", "Submitted", "Unanswered questions excluding the 7 supervisor-only items."),
  C("DQ-CP-03", "Partial interview submitted", "Completeness", "major", "CATI·CAPI·Web", "Submitted", "Submitted without end time or the credit question."),
  C("DQ-CP-04", "Zero-filled financial modules", "Completeness", "varies", "CATI·CAPI·Web", "Complete, active", "≥90% of the 47 money items are zero (critical if all)."),
  C("DQ-CP-05", "Active establishment with no revenue", "Completeness", "major", "CATI·CAPI·Web", "Complete, active", "Total revenue is zero."),
  C("DQ-CP-06", "Active establishment with no workers", "Completeness", "major", "CATI·CAPI·Web", "Complete, active", "Workers in 2025 is zero (working owners count)."),
  C("DQ-CP-07", "Respondent details incomplete", "Completeness", "minor", "CATI·CAPI", "Complete", "Respondent name or a valid Ghana phone missing."),
  C("DQ-CP-08", "No financial records kept", "Completeness", "info", "CATI·CAPI·Web", "Complete", "Money values are respondent estimates."),
  C("DQ-CP-09", "Call attempts missing or implausible", "Completeness", "minor", "CATI·CAPI·Web", "Complete, questionnaire v2+", `The number of calls before completion (${CALLS_VAR}) is blank, zero or above ${CALLS_MAX}.`),
  C("DQ-TM-01", "Interview impossibly short", "Timing", "critical", "CATI·CAPI", "Complete", `Active time under ${T.tooShortCritical} min.`),
  C("DQ-TM-02", "Interview very short", "Timing", "major", "CATI·CAPI", "Complete", `Active time ${T.tooShortCritical}–${T.tooShortMajor} min.`),
  C("DQ-TM-03", "Interview very long", "Timing", "minor", "CATI·CAPI", "Complete", `Active time over ${T.tooLongCati} min (CAPI ${T.tooLongCapi}).`),
  C("DQ-TM-04", "Web interview too short", "Timing", "major", "Web", "Complete", `Web form completed in under ${T.webTooShort} min.`),
  C("DQ-TM-05", "Answers entered too fast", "Timing", "major", "CATI·CAPI", "Complete", `Median gap < ${T.medGapSecMin}s or > ${T.pctFastMax * 100}% of gaps under 2s.`),
  C("DQ-TM-06", "Financial items entered too fast", "Timing", "major", "CATI·CAPI", "Complete", `Median gap on money items < ${T.finMedGapSecMin}s.`),
  C("DQ-TM-07", "Started outside calling hours", "Timing", "varies", "CATI", "All", `Start before ${T.callHourStart}:00 or from ${T.callHourEnd}:00 (rule 08:00–17:00 with 1 h tolerance).`),
  C("DQ-TM-08", "Night-time interview", "Timing", "major", "CATI·CAPI", "All", `Start or end between ${T.nightStart}:00 and 0${T.nightEnd}:00.`),
  C("DQ-TM-09", "Start time re-stamped", "Timing", "major", "CATI·CAPI·Web", "All", "The start-time button was pressed more than once."),
  C("DQ-TM-10", "Recorded elapsed time disagrees with active time", "Timing", "minor", "CATI·CAPI", "Complete", "timespent vs paradata active time differs widely (interruptions)."),
  C("DQ-TM-11", "Interview spread over more than one day", "Timing", "minor", "CATI·CAPI", "Complete", "End date differs from start date."),
  C("DQ-TM-12", "Many answers after the end stamp", "Timing", "minor", "CATI·CAPI", "Complete", `More than ${T.afterEndAnswers} answers entered after the end time.`),
  C("DQ-TM-13", "Overlapping interviews by one interviewer", "Timing", "major", "CATI·CAPI", "Complete", `Active sessions (≥${T.overlapMinAnswers} answers) of two interviews overlap > ${T.overlapMin} min.`),
  C("DQ-TM-14", "Rapid succession", "Timing", "major", "CATI·CAPI", "Complete", `Next interview starts < ${T.rapidGapMin} min after previous ends, or ≥${T.rapidWindowCount} completes in ${T.rapidWindowMin} min.`),
  C("DQ-AR-01", "Ownership shares do not sum to 100", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Private national + foreign + state ≠ 100%."),
  C("DQ-AR-02", "Occupation breakdown ≠ total workers", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Workers by occupation must sum to total workers."),
  C("DQ-AR-03", "Contract breakdown ≠ total workers", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Permanent + temporary + unpaid must equal total workers."),
  C("DQ-AR-04", "Sub-group exceeds total workers", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Female / SSNIT / trained workers exceed total workers."),
  C("DQ-AR-05", "Expense total ≠ sum of blocks", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Block totals or grand total do not equal their items."),
  C("DQ-AR-06", "Revenue total ≠ sum of items", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Total revenue ≠ operating + non-operating items."),
  C("DQ-AR-07", "Asset or liability total ≠ sum of items", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Balance-sheet totals ≠ items."),
  C("DQ-AR-08", "Percentage out of range or negative money", "Arithmetic", "critical", "CATI·CAPI·Web", "Complete", "Shares outside 0–100, negative values or impossible start year."),
  C("DQ-CN-01", "Paid employees but no wages", "Consistency", "major", "CATI·CAPI·Web", "Complete", "Permanent/temporary staff reported, gross wages zero."),
  C("DQ-CN-02", "Wages but no paid employees", "Consistency", "major", "CATI·CAPI·Web", "Complete", "Wages reported without paid employees."),
  C("DQ-CN-03", "Wage per employee far below minimum wage", "Consistency", "major", "CATI·CAPI·Web", "Complete", `Under 25% of the annual minimum wage (≈GHS ${fmtN(T.minWageAnnual)}). Monthly figure entered?`),
  C("DQ-CN-04", "Wage per employee below minimum wage", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "25–100% of the annual minimum wage."),
  C("DQ-CN-05", "Wage per employee implausibly high", "Consistency", "major", "CATI·CAPI·Web", "Complete", `Above GHS ${fmtN(T.wpwHigh)} per employee per year.`),
  C("DQ-CN-06", "Large operating loss", "Consistency", "major", "CATI·CAPI·Web", "Complete", `Operating expenses over ${T.lossMajorRatio}× revenue.`),
  C("DQ-CN-07", "Operating loss", "Consistency", "minor", "CATI·CAPI·Web", "Complete", `Operating expenses ${T.lossMinorRatio}–${T.lossMajorRatio}× revenue.`),
  C("DQ-CN-08", "Implausibly high margin", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Operating expenses under 5% of revenue."),
  C("DQ-CN-09", "Wages exceed revenue", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Gross wages larger than total revenue."),
  C("DQ-CN-10", "Degree share looks like a head-count", "Consistency", "major", "CATI·CAPI·Web", "Complete", "Share × workers < 0.5 person: a number was entered, not a percentage."),
  C("DQ-CN-11", "Foreign share looks like a head-count", "Consistency", "major", "CATI·CAPI·Web", "Complete", "Share × workers < 0.5 person."),
  C("DQ-CN-12", "Large change in workers 2024→2025", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Change ≥10 and more than ×3 either way."),
  C("DQ-CN-13", "Start year inconsistent with 2024 data", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "New in 2025 but reports 2024 data, or vice-versa."),
  C("DQ-CN-14", "Registered before it began", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Registration year before start year."),
  C("DQ-CN-15", "Legal form inconsistent", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Legal form vs registration/ownership answers."),
  C("DQ-CN-16", "TIN format invalid", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Not a GRA TIN (P0012345678) or Ghana Card PIN (GHA-123456789-0)."),
  C("DQ-CN-17", "Electricity cost ≠ grid electricity", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Expense item and energy item should match (manual 4.2)."),
  C("DQ-CN-18", "Trade purchases and trade revenue disagree", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Goods bought for resale without trade revenue, or vice-versa."),
  C("DQ-CN-19", "Social security workers and cost disagree", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "SSNIT workers vs social security cost."),
  C("DQ-CN-20", "Loan received but no liabilities", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Credit received in 2025 with zero liabilities."),
  C("DQ-CN-21", "Bank debt and interest disagree", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Bank liabilities without interest, or interest without debt."),
  C("DQ-CN-22", "Tangible assets below this year's investment", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Fixed assets smaller than 2025 capital investment, or no assets for an active earner."),
  C("DQ-CN-23", "Trade answers inconsistent", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Exports/imports vs sales reach and shares."),
  C("DQ-CN-24", "Capacity and status inconsistent", "Consistency", "minor", "CATI·CAPI·Web", "Complete", "Capacity/operational status vs revenue and workers."),
  C("DQ-RO-01", "Revenue outlier", "Range-Outlier", "varies", "CATI·CAPI·Web", "Complete", "Robust z (log10, median/MAD) > 3.5 minor, > 5 major."),
  C("DQ-RO-02", "Operating expenses outlier", "Range-Outlier", "varies", "CATI·CAPI·Web", "Complete", "Robust z on log10 operating expenses."),
  C("DQ-RO-03", "Workers outlier", "Range-Outlier", "varies", "CATI·CAPI·Web", "Complete", "Robust z on log10 workers."),
  C("DQ-RO-04", "Revenue per worker outlier", "Range-Outlier", "varies", "CATI·CAPI·Web", "Complete", "Robust z on log10 revenue per worker."),
  C("DQ-RO-05", "Total assets outlier", "Range-Outlier", "varies", "CATI·CAPI·Web", "Complete", "Robust z on log10 assets."),
  C("DQ-RO-06", "Revenue too small to be annual cedis", "Range-Outlier", "major", "CATI·CAPI·Web", "Complete", `0 < revenue < GHS ${fmtN(T.revTooSmall)}: monthly figure or thousands?`),
  C("DQ-RO-07", "Single item dominates implausibly", "Range-Outlier", "major", "CATI·CAPI·Web", "Complete", "An item > 100× revenue, assets > 1000× revenue, or any value ≥ 1 billion."),
  C("DQ-RO-08", "Worker count implausible", "Range-Outlier", "minor", "CATI·CAPI·Web", "Complete", "> 500 workers, sole proprietor > 50, or began before 1900."),
  C("DQ-GP-01", "CAPI interview without GPS", "GPS", "major", "CAPI", "CAPI started", "No GPS reading for a face-to-face interview."),
  C("DQ-GP-02", "GPS outside Ghana", "GPS", "critical", "CAPI", "CAPI started", "Invalid fix or mock location."),
  C("DQ-GP-03", "GPS outside the establishment's region", "GPS", "major", "CAPI", "CAPI started", "Outside region bounding box (+0.1°)."),
  C("DQ-GP-04", "Far from the frame location", "GPS", "varies", "CAPI", "CAPI started", "40–500 m minor, 0.5–5 km major, > 5 km critical."),
  C("DQ-GP-05", "Poor GPS accuracy", "GPS", "varies", "CAPI", "CAPI started", "Accuracy 5–20 m minor, > 20 m major."),
  C("DQ-GP-06", "GPS reading suspicious", "GPS", "varies", "CAPI", "CAPI started", "Taken > 30 min from interview start (minor) or identical to another establishment (major)."),
  C("DQ-MD-01", "Web mode claimed but keyed by an interviewer", "Mode-specific", "major", "Web", "Web", "No switch to CAWI and answers keyed under interviewer login."),
  C("DQ-MD-02", "Mode changed during the interview", "Mode-specific", "minor", "CATI·CAPI·Web", "All", "First and last recorded mode differ."),
  C("DQ-MD-03", "Non-contact closed with too few attempts", "Mode-specific", "major", "CATI", "Approved non-contact", `Fewer than ${T.nonContactMinAttempts} recorded attempts.`),
  C("DQ-MD-04", "Burst of call attempts", "Mode-specific", "major", "CATI", "Non-interviews", `${T.burstCount}+ call outcomes logged within ${T.burstWindowMin} minutes.`),
  C("DQ-MD-05", "Refusal or non-contact without a comment", "Mode-specific", "minor", "CATI", "Submitted", "Manual: record the reason and numbers tried."),
  C("DQ-PR-01", "Late submission", "Process", "minor", "CATI·CAPI·Web", "Completed", `Reached supervisor > ${T.lateSubmitH} h after completion.`),
  C("DQ-PR-02", "Waiting for supervisor too long", "Process", "minor", "CATI·CAPI·Web", "Awaiting supervisor", `Waiting > ${T.waitSupH} h for review (supervisor indicator, not scored).`),
  C("DQ-PR-03", "Returned interview not resubmitted", "Process", "minor", "CATI·CAPI·Web", "Returned", `Returned > ${T.returnedH} h ago.`),
  C("DQ-PR-04", "Approved without review evidence", "Process", "major", "CATI·CAPI·Web", "Approved", "Blank review questions or < 2 min opened (supervisor indicator, not scored)."),
  C("DQ-PR-05", "Approved with unresolved critical flags", "Process", "major", "CATI·CAPI·Web", "Approved", "Approval hides a critical problem (supervisor indicator, not scored)."),
  C("DQ-PR-06", "Repeatedly rejected", "Process", "minor", "CATI·CAPI·Web", "All", "Rejected two or more times."),
  C("DQ-PR-07", "Device clock offset", "Process", "info", "CATI·CAPI·Web", "Paradata", "Device time zone is not UTC+0 (Ghana)."),
  C("DQ-IB-01", "Short average duration", "Interviewer-behaviour", "major", "CATI·CAPI", "Interviewer", "Median duration < 60% of the pooled median."),
  C("DQ-IB-02", "Heaping of money values", "Interviewer-behaviour", "minor", "CATI·CAPI·Web", "Interviewer", "> 80% of non-zero money values are round thousands."),
  C("DQ-IB-03", "High share of interviews with a critical flag", "Interviewer-behaviour", "major", "CATI·CAPI·Web", "Interviewer", "> 20% of completes carry a critical flag."),
  C("DQ-IB-04", "High rejection rate", "Interviewer-behaviour", "minor", "CATI·CAPI·Web", "Interviewer", "> 30% of submitted interviews rejected."),
  C("DQ-IB-05", "Zero-filling", "Interviewer-behaviour", "major", "CATI·CAPI·Web", "Interviewer", "Mean zero share > pooled + 15 pts, or > 20% of completes zero-filled."),
  C("DQ-IB-06", "Low yield", "Interviewer-behaviour", "minor", "CATI", "Interviewer", "Completion rate under half the pooled rate."),
  C("DQ-IB-07", "Unusual non-contact or refusal share", "Interviewer-behaviour", "minor", "CATI", "Interviewer", "Refusal or non-contact share > 2× pooled."),
  C("DQ-IB-08", "Near-identical interviews", "Interviewer-behaviour", "critical", "CATI·CAPI·Web", "Interviewer", "Two completes with ≥40/47 identical money values — copy-paste fabrication."),
  C("DQ-IB-09", "No activity", "Interviewer-behaviour", "info", "CATI·CAPI·Web", "Interviewer", "No interview in the last 2 fieldwork days."),
];

export const CHECK_BY_ID = new Map(CHECKS.map((c) => [c.id, c]));

/* ------------------------------------------------------------------ */
/* Runner                                                               */
/* ------------------------------------------------------------------ */

export interface CheckContext {
  exportMs: number;
  interviewerContacts: Map<string, string>; // normPhone -> name
  interviewerNames: Record<string, string>;
  actionsById: Map<string, { action: number; t: number; role: number }[]>;
  commentsById: Map<string, { role: number; text: string }[]>;
  /** does this questionnaire version ask the call-attempts question? */
  asksCalls: (qv: number) => boolean;
  tzByUser: Map<string, Set<string>>;
}

const NOT_SCORED = new Set(["DQ-PR-02", "DQ-PR-04", "DQ-PR-05", "DQ-PR-07", "DQ-CP-08"]);
const sevRank: Record<Severity, number> = { info: 0, minor: 1, major: 2, critical: 3 };

export function runChecks(items: I[], ctx: CheckContext): Flag[] {
  const flags: Flag[] = [];
  const seen = new Map<string, Flag>(); // iid|check -> flag (one per check per interview, keep highest)

  const add = (i: I | null, check: string, sev: Severity, msg: string, who?: { interviewer: string | null; team: number | null }) => {
    const def = CHECK_BY_ID.get(check);
    const f: Flag = {
      iid: i?.id ?? "", key: i?.key ?? "", check, sev, cat: def?.cat ?? "Other", msg,
      interviewer: i?.login ?? who?.interviewer ?? null, team: i?.team ?? who?.team ?? null, region: i?.region ?? null,
      scored: !!i && !NOT_SCORED.has(check) && !check.startsWith("DQ-IB") && sev !== "info",
    };
    if (i) {
      const k = `${i.id}|${check}`;
      const prev = seen.get(k);
      if (prev) {
        if (sevRank[sev] > sevRank[prev.sev]) Object.assign(prev, { sev, msg, scored: f.scored });
        return;
      }
      seen.set(k, f);
    }
    flags.push(f);
  };

  const fieldStartMs = Date.parse(SURVEY.fieldStart + "T00:00:00Z");
  const testRe = /\b(test|testing|dummy|training|trial|xxx+|asdf)\b/i;

  for (const i of items) {
    const { n, s } = i;
    const submitted = (i.status ?? 0) >= 100 || i.status === 65;
    const cp = i.mode === 1 || i.mode === 2; // CATI or CAPI

    /* ---------------- Identification ---------------- */
    const idb = n("id11b");
    if (idb !== null) {
      const recorded = `GAES${String(idb).padStart(2, "0")}`;
      const resp = (i.diag?.responsible || "").toUpperCase();
      const first = (i.para?.firstInterviewerLogin || "").toUpperCase();
      if (recorded !== resp && recorded !== first && (resp || first) && !/^GAES0[1-5]$/.test(first || resp)) {
        add(i, "DQ-ID-01", "critical", `Interviewer code ${recorded} recorded, but the interview was done under login ${first || resp}.`);
      }
    }
    {
      const a = n("id11a"), b = n("id11b"), c = n("id11c");
      const anyMissing = a === null || b === null || c === null;
      if ((anyMissing && i.disp !== "NOT_STARTED") || (!anyMissing && !(a === b && b === c))) {
        add(i, "DQ-ID-02", "major", `Interviewer name/ID/contact codes differ or are blank (${a ?? "–"}/${b ?? "–"}/${c ?? "–"}).`);
      }
      if (b !== null && n("id10") !== null && TEAM_OF[b] !== undefined && TEAM_OF[b] !== n("id10")) {
        add(i, "DQ-ID-03", "major", `Interviewer GAES${String(b).padStart(2, "0")} belongs to team ${TEAM_OF[b]} but the case is in team ${n("id10")}.`);
      }
    }
    {
      const reg = n("id04b"), dis = n("id05b");
      let bad = reg !== null && dis !== null && Math.floor(dis / 100) !== reg;
      if (n("m0q16a") === 1 && n("m0q16b") !== null && n("m0q16c") !== null && Math.floor(n("m0q16c")! / 100) !== n("m0q16b")) bad = true;
      if (bad) add(i, "DQ-ID-04", "major", `District ${dis} is not in region ${reg}.`);
    }
    if (i.startMs !== null) {
      const bad = i.startMs < fieldStartMs || i.startMs > ctx.exportMs + 3600_000 || (i.endMs !== null && i.endMs < i.startMs);
      if (bad) add(i, "DQ-ID-05", "critical", `Start ${s("datetime") ?? "–"} / end ${s("endtime") ?? "–"} is outside the fieldwork window or out of order.`);
    }
    for (const v of ["id01b", "m0q00a", "m0q09b"]) {
      const t = s(v);
      if (t && testRe.test(t)) {
        add(i, "DQ-ID-06", "critical", `Looks like a test record ("${t.slice(0, 40)}").`);
        break;
      }
    }
    if (i.mode === null || !s("datetime")) {
      if (submitted) add(i, "DQ-ID-07", "major", "Interview mode or start time is blank.");
      else if ((i.para?.ansRole1 ?? 0) > 20) add(i, "DQ-ID-07", "info", "Interview in progress has no mode or start time yet.");
    }
    if (i.complete && [2, 3, 4].includes(n("m1q14") ?? 0)) {
      const m = (s("m1q14a") || "").match(/^(\d{1,2})\/(\d{4})$/);
      if (m) {
        const mm = Number(m[1]), yy = Number(m[2]);
        if (mm < 1 || mm > 12 || yy < 1990 || yy > 2026) add(i, "DQ-ID-08", "major", `Stop date "${s("m1q14a")}" is not a valid month/year.`);
        else if (yy < 2025 && ((i.rev ?? 0) > 0 || (i.emp25 ?? 0) > 0)) add(i, "DQ-ID-08", "major", `Stopped operating ${s("m1q14a")} but FY2025 revenue ${fmtN(i.rev)} / workers ${fmtN(i.emp25)} reported.`);
      }
    }

    /* ---------------- Completeness ---------------- */
    if (i.complete) {
      const KEY = ["m1q02", "m1q14", "m3q01", "m3q02", "m4q01a", "m4q01y", "m5q01j", "m6q01_total", "m6q02_total", "m6q03a"];
      const miss = KEY.filter((v) => n(v) === null);
      if (miss.length) add(i, "DQ-CP-01", "critical", `Key value missing: ${miss.join(", ")}.`);
    }
    if ((i.status ?? 0) >= 100 && i.started) {
      const nu = Number(i.diag?.n_questions_unanswered ?? 0) || 0;
      const supQ = ["m1qend", "m2qend", "m3qend", "m4qend", "m5qend", "m6qend", "m7q01"].filter((v) => i.row[v] !== "" && n(v) === null).length;
      const real = nu - supQ;
      if (real > 0) add(i, "DQ-CP-02", "major", `${real} question(s) left unanswered.`);
    }
    if (i.disp === "PARTIAL" && (i.status ?? 0) >= 100) add(i, "DQ-CP-03", "major", "Interview submitted before the end (no end time or credit question).");
    if (i.complete) {
      const active = n("m1q14") === 1;
      if (active && i.zeroShare !== null && i.zeroShare >= T.zeroShareMajor) {
        add(i, "DQ-CP-04", i.zeroShare === 1 ? "critical" : "major", `${Math.round(i.zeroShare * 100)}% of the 47 money items are zero for an active establishment.`);
      }
      if (active && i.rev === 0) add(i, "DQ-CP-05", "major", "Active establishment reports zero revenue.");
      if (active && i.emp25 === 0) add(i, "DQ-CP-06", "major", "Active establishment reports zero workers in 2025.");
      if (i.mode !== 3) {
        const nm = s("m0q00a");
        const ph = normPhone(s("m0q00b"));
        if (!nm || nm.length < 3 || !ph || !/^0[235]\d{8}$/.test(ph)) add(i, "DQ-CP-07", "minor", "Respondent name or phone missing/invalid.");
      }
      if (n("m1q09") === 2) add(i, "DQ-CP-08", "info", "Establishment keeps no financial records; values are estimates.");
      if (ctx.asksCalls(i.qv)) {
        const c = n(CALLS_VAR);
        if (c === null) add(i, "DQ-CP-09", "minor", "The number of calls made before completion was not recorded.");
        else if (c < 1 || c > CALLS_MAX || !Number.isInteger(c)) add(i, "DQ-CP-09", "minor", `Recorded ${fmtN(c)} calls before completion — not a plausible count.`);
      }
    }

    /* ---------------- Timing ---------------- */
    const d = i.duration;
    if (i.complete && d !== null) {
      if (cp) {
        if (d < T.tooShortCritical) add(i, "DQ-TM-01", "critical", `Completed in ${fmtN(d, 1)} min (design: about 30).`);
        else if (d < T.tooShortMajor) add(i, "DQ-TM-02", "major", `Completed in ${fmtN(d, 1)} min.`);
        if (d > (i.mode === 2 ? T.tooLongCapi : T.tooLongCati)) add(i, "DQ-TM-03", "minor", `Active time ${fmtN(d, 1)} min.`);
      } else if (i.mode === 3 && d < T.webTooShort) add(i, "DQ-TM-04", "major", `Web form completed in ${fmtN(d, 1)} min.`);
    }
    if (i.complete && cp && i.para) {
      const p = i.para;
      if ((p.medGapSec !== null && p.medGapSec < T.medGapSecMin) || (p.pctFast !== null && p.pctFast > T.pctFastMax)) {
        add(i, "DQ-TM-05", "major", `Median ${fmtN(p.medGapSec, 1)}s between answers; ${Math.round((p.pctFast ?? 0) * 100)}% under 2 s.`);
      }
      if ((i.zeroShare ?? 1) < T.zeroShareMajor && p.finMedGapSec !== null && p.finMedGapSec < T.finMedGapSecMin) {
        add(i, "DQ-TM-06", "major", `Money items entered every ${fmtN(p.finMedGapSec, 1)}s.`);
      }
    }
    const startLocal = parseHour(s("datetime"));
    if (startLocal && i.mode === 1) {
      const { h, m, wd } = startLocal;
      if (h < T.callHourStart || h >= T.callHourEnd) add(i, "DQ-TM-07", "minor", `Call started at ${pad(h)}:${pad(m)}${wd === 0 || wd === 6 ? " (weekend)" : ""}.`);
      else if ((wd === 0 || wd === 6) && !SURVEY.weekendsAreWorkdays) add(i, "DQ-TM-07", "info", `Call made on a ${wd === 6 ? "Saturday" : "Sunday"} (weekend).`);
    }
    if (cp) {
      const e = parseHour(s("endtime"));
      const night = (x: { h: number } | null) => !!x && (x.h >= T.nightStart || x.h < T.nightEnd);
      if (night(startLocal) || night(e)) {
        const x = night(startLocal) ? startLocal! : e!;
        add(i, "DQ-TM-08", "major", `Interview at ${pad(x.h)}:${pad(x.m)}.`);
      }
    }
    if ((i.para?.nDatetimeSets ?? 0) > 1) add(i, "DQ-TM-09", "major", `Start time was reset ${i.para!.nDatetimeSets - 1} time(s); recorded start is not the real start.`);
    if (i.complete && cp && d !== null && i.timespent !== null && Math.abs(i.timespent - d) > Math.max(T.elapsedVsActiveAbs, T.elapsedVsActiveRel * d)) {
      add(i, "DQ-TM-10", "minor", `Recorded ${fmtN(i.timespent)} min, active ${fmtN(d, 1)} min.`);
    }
    if (i.complete && cp && i.startMs !== null && i.endMs !== null && isoDate(i.startMs) !== isoDate(i.endMs)) {
      add(i, "DQ-TM-11", "minor", `Started ${s("datetime")?.replace("T", " ")}, ended ${s("endtime")?.replace("T", " ")}.`);
    }
    if (i.complete && cp && (i.para?.nAfterEnd ?? 0) > T.afterEndAnswers) add(i, "DQ-TM-12", "minor", `${i.para!.nAfterEnd} answers were entered after the end time was stamped.`);

    /* ---------------- Arithmetic ---------------- */
    if (i.complete) {
      const own = [n("m1q06a"), n("m1q06b"), n("m1q06c")];
      if (own.some((x) => x !== null)) {
        const sm = own.reduce<number>((a, b) => a + (b ?? 0), 0);
        if (Math.abs(sm - 100) > 0.5 || n("ownership_total") === 0) add(i, "DQ-AR-01", "critical", `Ownership shares sum to ${fmtN(sm, 1)}%.`);
      }
      const emp = i.emp25;
      if (emp !== null) {
        const occ = sumV(n, ["m3q04a", "m3q04b", "m3q04c", "m3q04d", "m3q04e"]);
        if ((occ !== null && Math.abs(occ - emp) > 0.5) || n("m3err1") === 0) add(i, "DQ-AR-02", "critical", `Workers by occupation sum to ${fmtN(occ)}; total is ${fmtN(emp)}.`);
        const con = sumV(n, ["m3q05a", "m3q05b", "m3q05c"]);
        if ((con !== null && Math.abs(con - emp) > 0.5) || n("m3err2") === 0) add(i, "DQ-AR-03", "critical", `Workers by type sum to ${fmtN(con)}; total is ${fmtN(emp)}.`);
        if ((n("m3q02a") ?? 0) > emp || (n("m3q02b") ?? 0) > emp || (n("m3q09b") ?? 0) > emp) add(i, "DQ-AR-04", "critical", "Female / SSNIT-covered / trained workers exceed total workers.");
      }
      const blocks: [string, string[]][] = [
        ["m4t1", ["m4q01a", "m4q01b", "m4q01c_oth"]], ["m4t2", ["m4q01d", "m4q01e", "m4q01f"]],
        ["m4t3", ["m4q01g", "m4q01h", "m4q01i", "m4q01j", "m4q01k"]], ["m4t4", ["m4q01l", "m4q01m"]],
        ["m4t5", ["m4q01n", "m4q01o", "m4q01p"]], ["m4t6", ["m4q01q", "m4q01r", "m4q01s", "m4q01t"]],
        ["m4t7", ["m4q01u", "m4q01v", "m4q01w", "m4q01x"]],
      ];
      let tot = 0;
      const badBlocks: string[] = [];
      for (const [t, its] of blocks) {
        const sm = sumV(n, its) ?? 0;
        tot += sm;
        if (n(t) !== null && Math.abs(n(t)! - sm) > 0.5) badBlocks.push(t);
      }
      if (badBlocks.length || (n("m4q01y") !== null && Math.abs(n("m4q01y")! - tot) > 0.5)) {
        add(i, "DQ-AR-05", "critical", `Total expenses ${fmtN(n("m4q01y"))} ≠ sum of blocks ${fmtN(tot)}${badBlocks.length ? ` (block ${badBlocks.join(", ")} wrong)` : ""}.`);
      }
      const revSum = sumV(n, ["m5q01a", "m5q01b", "m5q01c", "m5q01d_oth", "m5q01e", "m5q01f", "m5q01g", "m5q01h", "m5q01i_oth"]);
      if (i.rev !== null && revSum !== null && Math.abs(i.rev - revSum) > 0.5) add(i, "DQ-AR-06", "critical", `Total revenue ${fmtN(i.rev)} ≠ sum of items ${fmtN(revSum)}.`);
      const aSum = sumV(n, ["m6q01a", "m6q01b", "m6q01c", "m6q01d", "m6q01e_oth"]);
      const lSum = sumV(n, ["m6q02a", "m6q02b", "m6q02c_oth", "m6q02d", "m6q02e_oth"]);
      if ((i.assets !== null && aSum !== null && Math.abs(i.assets - aSum) > 0.5) || (i.liab !== null && lSum !== null && Math.abs(i.liab - lSum) > 0.5)) {
        add(i, "DQ-AR-07", "critical", `Total assets/liabilities (${fmtN(i.assets)} / ${fmtN(i.liab)}) do not equal the items (${fmtN(aSum)} / ${fmtN(lSum)}).`);
      }
      const bad: string[] = [];
      for (const v of ["m1q17", "m2q04a", "m3q06", "m3q07a", "m4q04", "m4q05", "m5q04", "m5q05"]) {
        const x = n(v);
        if (x !== null && (x < 0 || x > 100)) bad.push(`${v} = ${fmtN(x)}`);
      }
      FIN_ITEMS.forEach((v, k) => { if ((i.fin[k] ?? 0) < 0) bad.push(`${v} = ${fmtN(i.fin[k])}`); });
      if ((n("m3q01") ?? 0) < 0) bad.push(`m3q01 = ${n("m3q01")}`);
      if ((n("m3q02") ?? 0) < 0) bad.push(`m3q02 = ${n("m3q02")}`);
      const y = n("m1q02");
      if (y !== null && (y < 1800 || y > 2026)) bad.push(`m1q02 = ${y}`);
      if (bad.length) add(i, "DQ-AR-08", "critical", `${bad.slice(0, 3).join("; ")} is outside the valid range.`);
    }

    /* ---------------- Consistency ---------------- */
    if (i.complete) consistency(i, add);

    /* ---------------- Absolute range ---------------- */
    if (i.complete) {
      const rev = i.rev;
      if (rev !== null && rev > 0 && rev < T.revTooSmall) add(i, "DQ-RO-06", "major", `Annual revenue of GHS ${fmtN(rev)}. Monthly figure or thousands?`);
      let dom: string | null = null;
      FIN_ITEMS.forEach((v, k) => {
        const x = i.fin[k];
        if (dom || x === null) return;
        if (x >= T.hugeValue) dom = `${v} = ${fmtN(x)}`;
        else if (rev !== null && rev > 0 && x > T.itemVsRevRatio * rev) dom = `${v} = ${fmtN(x)}`;
      });
      if (!dom && rev !== null && rev >= T.revTooSmall && (i.assets ?? 0) > T.assetsVsRevRatio * rev) dom = `Total assets = ${fmtN(i.assets)}`;
      if (dom) add(i, "DQ-RO-07", "major", `${dom} against revenue ${fmtN(rev)}. Check the number of zeros.`);
      const e = i.emp25 ?? 0;
      if (e > T.bigEmp || (n("m1q07") === 1 && e > T.soleBigEmp) || (n("m1q02") !== null && n("m1q02")! < 1900)) {
        add(i, "DQ-RO-08", "minor", `${fmtN(i.emp25)} workers / began in ${n("m1q02") ?? "–"}.`);
      }
    }

    /* ---------------- GPS (CAPI) ---------------- */
    if (i.mode === 2 && i.started && !["NOT_STARTED"].includes(i.disp)) gps(i, add);

    /* ---------------- Mode-specific ---------------- */
    if (i.mode === 3) {
      const acts = ctx.actionsById.get(i.id) ?? [];
      const switched = acts.some((a) => a.action === 19);
      const share = i.para && i.para.nAns ? i.para.ansRole1 / Math.max(1, i.para.ansAll) : 0;
      if (!switched || share > 0.2) add(i, "DQ-MD-01", "major", "Marked as Web self-interview but answers were keyed under an interviewer login.");
    }
    if ((i.para?.nModeSets ?? 0) > 1 && i.para!.firstMode !== i.para!.lastMode) {
      add(i, "DQ-MD-02", "minor", `Mode changed from ${MODE_LABEL[Number(i.para!.firstMode)] ?? i.para!.firstMode} to ${MODE_LABEL[Number(i.para!.lastMode)] ?? i.para!.lastMode}.`);
    }
    const nonContact = i.dispGroup === "Non-contact";
    if (nonContact && i.mode === 1 && [120, 130].includes(i.status ?? 0) && (i.para?.nCompleted ?? 0) < T.nonContactMinAttempts) {
      add(i, "DQ-MD-03", "major", `Approved as non-contact after ${i.para?.nCompleted ?? 0} recorded attempt(s); ${T.nonContactMinAttempts} required.`);
    }
    if (i.mode === 1 && ["REFUSED", "UNREACHABLE"].includes(i.disp) && (i.status ?? 0) >= 100) {
      const com = ctx.commentsById.get(i.id) ?? [];
      if (!com.some((c) => c.role === 1)) add(i, "DQ-MD-05", "minor", `No comment explains this ${DISP_LABEL[i.disp].toLowerCase()}.`);
    }

    /* ---------------- Process ---------------- */
    const p = i.para;
    if (p?.completedAt) {
      if (p.receivedAt !== null) {
        const lag = (p.receivedAt - p.completedAt) / 3600_000;
        if (lag > T.lateSubmitH) add(i, "DQ-PR-01", "minor", `Reached the server ${fmtN(lag, 1)} h after completion.`);
      } else if ((ctx.exportMs - p.completedAt) / 3600_000 > T.lateSubmitH && (i.status ?? 0) < 100 && i.status !== 65) {
        add(i, "DQ-PR-01", "minor", `Completed ${fmtN((ctx.exportMs - p.completedAt) / 3600_000, 0)} h ago and not yet synchronised.`);
      }
    }
    if (i.status === 100 && p?.lastCompletedAt) {
      const h = (ctx.exportMs - p.lastCompletedAt) / 3600_000;
      if (h > T.waitSupH) add(i, "DQ-PR-02", "minor", `Waiting ${fmtN(h, 0)} h for supervisor review.`);
    }
    if ((i.status === 65 || i.status === 125) && p?.lastRejectAt) {
      const h = (ctx.exportMs - p.lastRejectAt) / 3600_000;
      if (h > T.returnedH) add(i, "DQ-PR-03", "minor", `Returned ${fmtN(h, 0)} h ago and not resubmitted.`);
    }
    if ([120, 130].includes(i.status ?? 0) && i.complete) {
      const blank = ["m1qend", "m2qend", "m3qend", "m4qend", "m5qend", "m6qend", "m7q01"].filter((v) => n(v) === null);
      const open = p?.supOpenMin ?? 0;
      if (blank.length || open < T.supOpenMinMin) add(i, "DQ-PR-04", "major", `Approved after ${fmtN(open, 1)} min of review${blank.length ? ` / with ${blank.length} blank review question(s)` : ""}.`);
    }
    if (i.rejSup + i.rejHq >= T.repeatRejections) add(i, "DQ-PR-06", "minor", `Rejected ${i.rejSup + i.rejHq} times.`);
  }

  crossInterview(items, add, ctx);

  // PR-05 must run after all interview-level critical flags exist
  const crit = new Map<string, number>();
  for (const f of flags) if (f.iid && f.sev === "critical" && f.check !== "DQ-PR-05") crit.set(f.iid, (crit.get(f.iid) ?? 0) + 1);
  for (const i of items) {
    if ([120, 130].includes(i.status ?? 0) && (crit.get(i.id) ?? 0) > 0) add(i, "DQ-PR-05", "major", `Approved while ${crit.get(i.id)} critical flag(s) are open.`);
  }
  for (const [user, offs] of ctx.tzByUser) {
    for (const o of offs) {
      const code = Number(user.replace(/\D/g, ""));
      add(null, "DQ-PR-07", "info", `Device of ${user} is set to UTC+${o.slice(0, 5)}.`, { interviewer: user, team: TEAM_OF[code] ?? (code <= 5 ? code : null) });
    }
  }
  return flags;
}

type Add = (i: I | null, check: string, sev: Severity, msg: string, who?: { interviewer: string | null; team: number | null }) => void;

function sumV(n: (v: string) => number | null, vs: string[]): number | null {
  const xs = vs.map(n);
  if (xs.every((x) => x === null)) return null;
  return xs.reduce<number>((a, b) => a + (b ?? 0), 0);
}
const pad = (x: number) => String(x).padStart(2, "0");
function parseHour(v: string | null): { h: number; m: number; wd: number } | null {
  if (!v) return null;
  const t = Date.parse(/[zZ]$/.test(v) ? v : v + "Z");
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), wd: d.getUTCDay() };
}

function consistency(i: I, add: Add) {
  const { n, s } = i;
  const rev = i.rev, opex = i.opex, wages = i.wages, paid = i.paid, emp = i.emp25, emp24 = i.emp24;
  if (paid !== null && paid > 0 && wages === 0) add(i, "DQ-CN-01", "major", `${fmtN(paid)} paid employees but gross wages are zero.`);
  if (paid === 0 && (wages ?? 0) > 0) add(i, "DQ-CN-02", "major", `Wages of ${fmtN(wages)} with no permanent or temporary employees.`);
  if (paid !== null && paid > 0 && (wages ?? 0) > 0 && i.wpw !== null) {
    if (i.wpw < 0.25 * T.minWageAnnual) add(i, "DQ-CN-03", "major", `GHS ${fmtN(i.wpw)} per paid employee per year (minimum wage is about ${fmtN(T.minWageAnnual)}). Monthly figure entered?`);
    else if (i.wpw < T.minWageAnnual) add(i, "DQ-CN-04", "minor", `GHS ${fmtN(i.wpw)} per paid employee per year is below the minimum wage.`);
    if (i.wpw > T.wpwHigh) add(i, "DQ-CN-05", "major", `GHS ${fmtN(i.wpw)} per paid employee per year. Extra zero?`);
  }
  let cn06 = false;
  if (rev !== null && rev > 0 && opex !== null) {
    if (opex > T.lossMajorRatio * rev) {
      cn06 = true;
      add(i, "DQ-CN-06", "major", `Operating expenses ${fmtN(opex)} are ${fmtN(opex / rev, 1)} times revenue ${fmtN(rev)}.`);
    } else if (opex > T.lossMinorRatio * rev) add(i, "DQ-CN-07", "minor", `Operating expenses ${fmtN(opex)} exceed revenue ${fmtN(rev)} by more than half.`);
    if (rev >= T.lowCostMinRev && opex < T.lowCostShare * rev) add(i, "DQ-CN-08", "minor", `Operating expenses are only ${fmtN((opex / rev) * 100, 1)}% of revenue.`);
  }
  if (rev !== null && rev > 0 && (wages ?? 0) > rev && !cn06) add(i, "DQ-CN-09", "minor", `Gross wages ${fmtN(wages)} exceed total revenue ${fmtN(rev)}.`);
  const deg = n("m3q06");
  if (deg !== null && deg > 0 && emp !== null && emp > 0 && (deg * emp) / 100 < 0.5) add(i, "DQ-CN-10", "major", `${fmtN(deg)}% of ${fmtN(emp)} workers is less than one person. A number was entered instead of a percentage.`);
  const forn = n("m3q07a");
  if (forn !== null && forn > 0 && emp !== null && emp > 0 && (forn * emp) / 100 < 0.5) add(i, "DQ-CN-11", "major", `${fmtN(forn)}% of ${fmtN(emp)} workers is less than one person.`);
  if (emp !== null && emp24 !== null && Math.abs(emp - emp24) >= 10 && (emp > 3 * emp24 || emp24 > 3 * emp)) add(i, "DQ-CN-12", "minor", `Workers went from ${fmtN(emp24)} to ${fmtN(emp)}.`);
  const y = n("m1q02"), rc = n("m5q02");
  if (y !== null && ((y >= 2025 && (emp24 ?? 0) > 0) || (y >= 2025 && rc !== null && rc !== 97) || (y < 2025 && rc === 97) || y === 2026)) {
    add(i, "DQ-CN-13", "minor", `Began in ${y} but reports 2024 workers (${fmtN(emp24)}) / revenue change answer ${rc ?? "–"}.`);
  }
  const reg = n("m1q04");
  if (reg !== null && y !== null && reg < y) add(i, "DQ-CN-14", "minor", `Registered ${reg}, began ${y}.`);
  const lf = n("m1q07");
  if ((lf !== null && [3, 4].includes(lf) && n("m1q03") === 2) || (lf === 1 && n("m1q17") !== null && ![0, 100].includes(n("m1q17")!)) || (lf === 1 && (n("m1q06c") ?? 0) > 0)) {
    const lab: Record<number, string> = { 1: "Sole proprietorship", 2: "Partnership", 3: "Private limited", 4: "Public limited", 5: "Cooperative", 96: "Other" };
    add(i, "DQ-CN-15", "minor", `Legal form ${lab[lf!] ?? lf} does not fit registration / ownership answers.`);
  }
  if (n("m1q01a") === 1) {
    const tin = (s("m1q01") || "").toUpperCase().trim();
    if (!/^[A-Z]\d{10}$/.test(tin) && !/^GHA-\d{9}-\d$/.test(tin)) add(i, "DQ-CN-16", "minor", `TIN "${tin.slice(0, 30)}" is not a valid TIN or Ghana Card number.`);
  }
  if (n("m4q01h") !== null && n("m4q02a") !== null && Math.abs(n("m4q01h")! - n("m4q02a")!) > 0.5) add(i, "DQ-CN-17", "minor", `Electricity ${fmtN(n("m4q01h"))} in expenses but ${fmtN(n("m4q02a"))} for grid electricity.`);
  const tp = n("m4q01f"), tr = n("m5q01b");
  if ((tp !== null && tp > 0 && tr === 0) || (tr !== null && tr > 0 && tp === 0)) add(i, "DQ-CN-18", "minor", `Trade goods purchased ${fmtN(tp)}, trade revenue ${fmtN(tr)}.`);
  const sw = n("m3q02b"), sc = n("m4q01b");
  if ((sw !== null && sw > 0 && sc === 0) || (sc !== null && sc > 0 && sw === 0)) add(i, "DQ-CN-19", "minor", `${fmtN(sw)} workers covered by SSNIT but social security cost is ${fmtN(sc)}.`);
  if (n("m6q03a") === 1 && [1, 2, 3].includes(n("m6q03d") ?? 0) && i.liab === 0) add(i, "DQ-CN-20", "minor", `Received a loan of ${fmtN(n("m6q03b"))} in 2025 but total liabilities are zero.`);
  const bank = (n("m6q02b") ?? 0) + (n("m6q02d") ?? 0), int = n("m4q01n");
  if ((bank > 0 && int === 0) || ((int ?? 0) > 0 && i.liab === 0 && n("m6q03a") === 2)) add(i, "DQ-CN-21", "minor", `Bank liabilities ${fmtN(bank)} with interest paid ${fmtN(int)}.`);
  const inv = (n("m4q01u") ?? 0) + (n("m4q01v") ?? 0) + (n("m4q01w") ?? 0);
  if ((n("m6q01a") !== null && n("m6q01a")! < inv) || (i.assets === 0 && n("m1q14") === 1 && (rev ?? 0) > 0)) {
    add(i, "DQ-CN-22", "minor", i.assets === 0 ? `No assets reported for an active establishment with revenue ${fmtN(rev)}.` : `Tangible fixed assets ${fmtN(n("m6q01a"))} are below 2025 capital investment ${fmtN(inv)}.`);
  }
  const reachX = (n("m2q03__3") ?? 0) + (n("m2q03__4") ?? 0) + (n("m2q03__5") ?? 0);
  const ex = n("m5q03"), im = n("m4q03");
  if ((ex === 1 && reachX === 0 && i.row["m2q03__3"] !== "") || (ex === 1 && n("m5q04") === 0 && n("m5q05") === 0) || (im === 1 && n("m4q04") === 0 && n("m4q05") === 0) || (ex === 2 && reachX > 0)) {
    add(i, "DQ-CN-23", "minor", "Export/import answers do not agree with sales reach or shares.");
  }
  const st = n("m1q14");
  if ((n("m2q04a") === 0 && (rev ?? 0) > 0) || (st !== null && [3, 4].includes(st) && ((rev ?? 0) > 0 || (emp ?? 0) > 0)) || (st === 2 && emp === 0 && (rev ?? 0) > 100000)) {
    add(i, "DQ-CN-24", "minor", `Capacity/operational status does not fit reported revenue ${fmtN(rev)} and workers ${fmtN(emp)}.`);
  }
}

function gps(i: I, add: Add) {
  const { n } = i;
  const lat = n("m0q08__Latitude"), lon = n("m0q08__Longitude");
  if (lat === null || lon === null) {
    add(i, "DQ-GP-01", "major", "Face-to-face interview has no GPS reading.");
    return;
  }
  const [a, b, c, d] = GHANA_BBOX;
  if ((lat === 0 && lon === 0) || lat < a || lat > b || lon < c || lon > d) {
    add(i, "DQ-GP-02", "critical", `GPS (${lat.toFixed(5)}, ${lon.toFixed(5)}) is outside Ghana.`);
    return;
  }
  const rc = i.regionCode;
  if (rc !== null && REGION_BBOX[rc]) {
    const [la, lb, lc, ld] = REGION_BBOX[rc];
    const p = T.regionBboxPad;
    if (lat < la - p || lat > lb + p || lon < lc - p || lon > ld + p) add(i, "DQ-GP-03", "major", `GPS is outside ${title(REGIONS[rc])}.`);
  }
  const fl = n("id13__Latitude"), fo = n("id13__Longitude");
  if (fl !== null && fo !== null && !(fl === 0 && fo === 0)) {
    const dist = haversine(lat, lon, fl, fo);
    const sev: Severity | null = dist > T.gpsFarM ? "critical" : dist > T.gpsMidM ? "major" : dist > T.gpsNearM ? "minor" : null;
    if (sev) add(i, "DQ-GP-04", sev, `Interview taken ${fmtN(dist)} m from the establishment's recorded location.`);
  }
  const acc = n("m0q08__Accuracy");
  if (acc !== null && acc > T.gpsAccMinor) add(i, "DQ-GP-05", acc > T.gpsAccMajor ? "major" : "minor", `GPS accuracy ${fmtN(acc, 1)} m.`);
  const gt = Date.parse(String(i.row["m0q08__Timestamp"] || "").replace(" ", "T").replace(/(\d)$/, "$1Z"));
  if (Number.isFinite(gt) && i.startMs !== null) {
    const m = Math.abs(gt - i.startMs) / 60000;
    if (m > T.gpsTimeMin) add(i, "DQ-GP-06", "minor", `GPS taken ${fmtN(m)} min from the interview start.`);
  }
}

function title(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------------- Cross-interview checks ---------------- */
function crossInterview(items: I[], add: Add, ctx: CheckContext) {
  const group = <K,>(xs: I[], key: (i: I) => K | null) => {
    const m = new Map<K, I[]>();
    for (const i of xs) {
      const k = key(i);
      if (k === null || k === undefined || (k as unknown) === "") continue;
      let g = m.get(k);
      if (!g) m.set(k, (g = []));
      g.push(i);
    }
    return m;
  };

  for (const [k, g] of group(items, (i) => i.n("id01a"))) {
    if (g.length < 2) continue;
    // After a questionnaire upgrade an unfinished v1 record and its fresh v2 attempt legitimately coexist.
    const completes = g.filter((x) => x.complete).length;
    const sameVersion = new Set(g.map((x) => x.qv)).size < g.length;
    if (completes > 1 || sameVersion) for (const i of g) add(i, "DQ-DU-01", "critical", `Establishment ${k} has ${g.length} interviews${completes > 1 ? ` (${completes} completed)` : ""}: ${g.map((x) => x.key).join(", ")}.`);
  }
  for (const [k, g] of group(items, (i) => i.n("assignment__id"))) {
    if (g.length > 1) for (const i of g) add(i, "DQ-DU-02", "critical", `Assignment ${k} has ${g.length} interviews.`);
  }
  for (const [ph, g] of group(items, (i) => normPhone(i.n("m0q10a") === 1 ? i.s("m0q10b") : i.s("id02")))) {
    const ids = new Set(g.map((x) => x.n("id01a")));
    if (g.length > 1 && ids.size > 1) for (const i of g) add(i, "DQ-DU-03", "major", `Phone ${ph} is used by establishments ${[...ids].join(", ")}.`);
  }
  const completes = items.filter((i) => i.complete);
  for (const [ph, g] of group(completes, (i) => normPhone(i.s("m0q00b")))) {
    const ids = new Set(g.map((x) => x.n("id01a")));
    if (g.length > 1 && ids.size > 1) for (const i of g) add(i, "DQ-DU-04", "major", `Respondent phone ${ph} appears in ${g.length} interviews.`);
  }
  for (const i of items) {
    const ph = normPhone(i.s("m0q00b"));
    if (ph && ctx.interviewerContacts.has(ph)) add(i, "DQ-DU-05", "critical", `Respondent phone ${ph} belongs to field officer ${ctx.interviewerContacts.get(ph)}.`);
  }
  for (const [, g] of group(items, (i) => {
    const nm = normName(i.n("m0q09a") === 1 ? i.s("m0q09b") : i.s("id01b"));
    return nm ? `${nm}|${i.n("id05b")}` : null;
  })) {
    const ids = new Set(g.map((x) => x.n("id01a")));
    if (g.length > 1 && ids.size > 1) for (const i of g) add(i, "DQ-DU-06", "minor", `"${i.s("id01b")}" appears ${g.length} times in district ${i.s("id05a") ?? i.n("id05b")}.`);
  }

  // GP-06 identical coordinates on different establishments
  const capi = items.filter((i) => i.mode === 2 && i.n("m0q08__Latitude") !== null);
  for (const [, g] of group(capi, (i) => `${i.n("m0q08__Latitude")!.toFixed(5)},${i.n("m0q08__Longitude")!.toFixed(5)}`)) {
    const ids = new Set(g.map((x) => x.n("id01a")));
    if (g.length > 1 && ids.size > 1) for (const i of g) add(i, "DQ-GP-06", "major", `GPS identical to interview ${g.find((x) => x !== i)!.key}.`);
  }

  // Robust outliers RO-01..05
  const outlier = (check: string, label: string, get: (i: I) => number | null, money: boolean) => {
    const vals = completes.map((i) => ({ i, x: get(i) })).filter((v): v is { i: I; x: number } => v.x !== null && v.x > 0);
    if (vals.length < T.outlierMinGroup) return;
    const bySec = new Map<string, typeof vals>();
    for (const v of vals) {
      const k = v.i.section ?? "?";
      let g = bySec.get(k);
      if (!g) bySec.set(k, (g = []));
      g.push(v);
    }
    const stat = (g: typeof vals) => {
      const y = g.map((v) => Math.log10(v.x));
      const med = median(y)!;
      const mad = median(y.map((t) => Math.abs(t - med)))!;
      return { med, mad };
    };
    const pooled = stat(vals);
    const secStats = new Map<string, { med: number; mad: number }>();
    for (const [k, g] of bySec) if (g.length >= T.outlierMinGroup) secStats.set(k, stat(g));
    for (const v of vals) {
      const st = secStats.get(v.i.section ?? "?") ?? pooled;
      if (!st.mad) continue;
      const mz = (0.6745 * (Math.log10(v.x) - st.med)) / st.mad;
      if (Math.abs(mz) > T.outlierMinor) {
        const groupName = secStats.has(v.i.section ?? "?") ? `section ${v.i.section}` : "all establishments";
        add(v.i, check, Math.abs(mz) > T.outlierMajor ? "major" : "minor",
          `${label} ${money ? "GHS " : ""}${fmtN(v.x)} is unusually ${mz > 0 ? "high" : "low"} for ${groupName} (median ${fmtN(10 ** st.med)}).`);
      }
    }
  };
  outlier("DQ-RO-01", "Total revenue", (i) => i.rev, true);
  outlier("DQ-RO-02", "Operating expenses", (i) => i.opex, true);
  outlier("DQ-RO-03", "Workers", (i) => i.emp25, false);
  outlier("DQ-RO-04", "Revenue per worker", (i) => i.rpw, true);
  outlier("DQ-RO-05", "Total assets", (i) => i.assets, true);

  // Per interviewer timing: TM-13 overlap, TM-14 rapid succession, MD-04 bursts
  const byInt = group(items, (i) => i.login);
  for (const [, g] of byInt) {
    const comp = g.filter((i) => i.complete && (i.mode === 1 || i.mode === 2) && i.para);
    // TM-13
    for (let a = 0; a < comp.length; a++) {
      for (let b = a + 1; b < comp.length; b++) {
        const A = comp[a].para!.sessions.filter((s) => s.answers >= T.overlapMinAnswers);
        const B = comp[b].para!.sessions.filter((s) => s.answers >= T.overlapMinAnswers);
        let best = 0;
        for (const x of A) for (const y of B) best = Math.max(best, Math.min(x.end, y.end) - Math.max(x.start, y.start));
        const m = best / 60000;
        if (m > T.overlapMin) {
          add(comp[a], "DQ-TM-13", "major", `Sessions overlap by ${fmtN(m, 0)} min with interview ${comp[b].key}.`);
          add(comp[b], "DQ-TM-13", "major", `Sessions overlap by ${fmtN(m, 0)} min with interview ${comp[a].key}.`);
        }
      }
    }
    // TM-14
    const ord = comp
      .map((i) => ({ i, s: i.para!.tStart ?? i.startMs, e: i.para!.tEnd ?? i.endMs }))
      .filter((x): x is { i: I; s: number; e: number } => x.s !== null && x.e !== null)
      .sort((x, y) => x.s - y.s);
    for (let k = 1; k < ord.length; k++) {
      const gap = (ord[k].s - ord[k - 1].e) / 60000;
      if (gap >= 0 && gap < T.rapidGapMin) {
        add(ord[k].i, "DQ-TM-14", "major", `Started ${fmtN(gap, 1)} min after interview ${ord[k - 1].i.key} ended.`);
      }
    }
    const ends = [...ord].sort((x, y) => x.e - y.e);
    for (let k = 0; k + T.rapidWindowCount - 1 < ends.length; k++) {
      const span = (ends[k + T.rapidWindowCount - 1].e - ends[k].e) / 60000;
      if (span <= T.rapidWindowMin) {
        for (let j = k; j < k + T.rapidWindowCount; j++) add(ends[j].i, "DQ-TM-14", "major", `${T.rapidWindowCount} interviews completed within ${fmtN(span, 0)} min.`);
      }
    }
    // MD-04
    const nonInt = g
      .filter((i) => i.mode === 1 && ["Non-contact", "Pending", "Refused"].includes(i.dispGroup) && i.startMs !== null)
      .sort((x, y) => x.startMs! - y.startMs!);
    for (let k = 0; k + T.burstCount - 1 < nonInt.length; k++) {
      let j = k + T.burstCount - 1;
      if ((nonInt[j].startMs! - nonInt[k].startMs!) / 60000 <= T.burstWindowMin) {
        while (j + 1 < nonInt.length && (nonInt[j + 1].startMs! - nonInt[k].startMs!) / 60000 <= T.burstWindowMin) j++;
        const span = (nonInt[j].startMs! - nonInt[k].startMs!) / 60000;
        for (let z = k; z <= j; z++) add(nonInt[z], "DQ-MD-04", "major", `${j - k + 1} call outcomes logged in ${fmtN(span, 0)} minutes (from ${hhmm(nonInt[k].startMs!)}).`);
      }
    }
  }
}

export { sevRank };
