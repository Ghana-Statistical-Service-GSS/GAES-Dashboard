import "server-only";
import { after } from "next/server";
import { loadRawExport, maybeAutoExport, resolveJobs, type RawExport } from "./raw";
import { summariseParadata, moduleOf } from "./paradata";
import { derive, isoDate, median, normPhone, quantile, type I, fmtN, FIN_ITEMS } from "./derive";
import { CHECKS, runChecks, sevRank } from "./checks";
import { CALLS_MAX, CALLS_VAR, callsFromComments } from "./calls";
import {
  ISIC_SECTIONS, REGIONS, SCORE_CAP, SCORE_W, STAGES, SUPERVISOR_OF_TEAM, SURVEY, T, TEAM_OF, bandOf, isWorkday,
  loginOf, workdaysBetween,
} from "./config";
import { readJson, writeJson } from "../store";
import { listSupervisorNames } from "../suso";
import type { Dataset, Flag, InterviewerRow, ItemNR, QuestionTiming, Rec, Targets, TeamRow } from "./types";

export interface UploadedTargets {
  byRegion: Record<string, number>;
  bySection: Record<string, number>;
  updatedAt: string;
  updatedBy: string;
}

let cache: { key: string; data: Dataset; at: number } | null = null;
const CHECK_EVERY_MS = 60_000;
/** Bump when processing logic changes so stored datasets are rebuilt. */
const ENGINE_VERSION = "1.3.0";

/**
 * Processed dataset, cached three ways so serverless cold starts stay fast:
 *  1. in memory (same warm instance)
 *  2. in the JSON store (Netlify Blobs / Vercel Blob / file), keyed by export job ids + targets
 *  3. otherwise download the export zips and process them
 */
/** How long each step of the last data load took (ms) — returned with errors to make slow hosts diagnosable. */
export let lastSteps: Record<string, number> = {};

export async function getDataset(opts: { force?: boolean } = {}): Promise<Dataset> {
  if (cache && !opts.force && Date.now() - cache.at < CHECK_EVERY_MS) return cache.data;
  const steps: Record<string, number> = {};
  lastSteps = steps;
  let t = Date.now();
  const mark = (name: string) => {
    steps[name] = Date.now() - t;
    t = Date.now();
  };
  const jobs = await resolveJobs();
  mark("findExports");
  // keep data fresh automatically: request a new export when the latest one is stale (non-blocking)
  try {
    after(() => maybeAutoExport(jobs).catch(() => undefined));
  } catch {
    maybeAutoExport(jobs).catch(() => undefined); // outside a request scope
  }
  const up = await readJson<UploadedTargets>("targets");
  mark("readTargets");
  const key = `${ENGINE_VERSION}|${jobs.key}|${up?.updatedAt ?? ""}`;
  if (cache && cache.key === key) {
    cache.at = Date.now();
    return cache.data;
  }
  if (!opts.force) {
    const stored = await readJson<{ key: string; data: Dataset }>("dataset-cache").catch(() => null);
    mark("readSavedDataset");
    if (stored && stored.key === key && stored.data?.records) {
      cache = { key, data: stored.data, at: Date.now() };
      return stored.data;
    }
  }
  const [raw, supervisorNames] = await Promise.all([
    loadRawExport({ jobs }),
    listSupervisorNames().catch((e) => {
      console.error("[supervisors] could not load names", e);
      return {} as Record<string, string>;
    }),
  ]);
  mark("download");
  const data = processExport(raw, up, supervisorNames);
  mark("process");
  cache = { key, data, at: Date.now() };
  await writeJson("dataset-cache", { key, data }).catch((e) => console.error("[dataset-cache] write failed", e));
  mark("saveDataset");
  return data;
}

export function invalidateDataset() {
  cache = null;
}

/* ------------------------------------------------------------------ */

function buildTargets(raw: RawExport, up: UploadedTargets | null): Targets {
  // current responsible per assignment from the assignment action log
  const cur = new Map<string, { resp: string; active: boolean }>();
  for (const a of raw.assignmentActions) {
    const id = a.assignment__id;
    const act = Number(a.action);
    if (!id) continue;
    if (act === 1) cur.set(id, { resp: a.responsible__name, active: true });
    else if (act === 7 && cur.has(id)) cur.get(id)!.resp = a.responsible__name || cur.get(id)!.resp;
    else if ((act === 2 || act === 3) && cur.has(id)) cur.get(id)!.active = false;
    else if (act === 5 && cur.has(id)) cur.get(id)!.active = true;
  }
  const byInterviewer: Record<string, number> = {};
  const byTeam: Record<string, number> = {};
  let national = 0;
  for (const { resp, active } of cur.values()) {
    if (!active) continue;
    national++;
    const login = (resp || "").toUpperCase();
    byInterviewer[login] = (byInterviewer[login] ?? 0) + 1;
    const code = Number(login.replace(/\D/g, ""));
    const team = TEAM_OF[code] ?? (code >= 1 && code <= 5 ? code : null);
    if (team) byTeam[team] = (byTeam[team] ?? 0) + 1;
  }
  if (!national) national = SURVEY.nationalTargetFallback;
  const hasRegion = up && Object.values(up.byRegion ?? {}).some((x) => x > 0);
  return {
    national, byTeam, byInterviewer,
    byRegion: up?.byRegion ?? {}, bySection: up?.bySection ?? {},
    regionSource: hasRegion ? "uploaded" : "none", updatedAt: up?.updatedAt,
  };
}

function scoreOf(flags: Flag[]): number {
  const byCat = new Map<string, number>();
  for (const f of flags) {
    if (!f.scored) continue;
    byCat.set(f.cat, (byCat.get(f.cat) ?? 0) + SCORE_W[f.sev]);
  }
  let pen = 0;
  for (const [cat, p] of byCat) pen += Math.min(SCORE_CAP[cat] ?? 30, p);
  let s = Math.max(0, 100 - pen);
  if (flags.some((f) => f.scored && f.sev === "critical")) s = Math.min(s, 59);
  return s;
}

/** Enablement conditions for item non-response (spec §3.12) */
function enabledFn(i: I): (v: string) => boolean {
  const n = i.n;
  const cond: Record<string, () => boolean> = {
    m0q00d: () => n("m0q00c") === 1,
    m0q09b: () => n("m0q09a") === 1, m0q10b: () => n("m0q10a") === 1, m0q12b: () => n("m0q12a") === 1,
    m0q13b: () => n("m0q13a") === 1, m0q14b: () => n("m0q14a") === 1,
    m0q16b: () => n("m0q16a") === 1, m0q16c: () => n("m0q16a") === 1,
    m1q01: () => n("m1q01a") === 1, m1q04: () => n("m1q03") === 1, m1q07_oth: () => n("m1q07") === 96,
    m1q10: () => n("m1q09") === 1, m1q11: () => n("m1q09") === 1, m1q13: () => n("m1q12") === 1,
    m1q14a: () => [2, 3, 4].includes(n("m1q14") ?? 0),
    m2q01a: () => n("m2q00") === 2, m2q01b: () => n("m2q00") === 2, m2q01c: () => n("m2q00") === 2,
    m2q01d: () => n("m2q00") === 2, m2q01e: () => n("m2q00") === 2,
    m2q02a: () => n("m2q02") === 1, m2q02b: () => n("m2q02") === 1, m2q02c: () => n("m2q02") === 1,
    m2q02d: () => n("m2q02") === 1, m2q02e: () => n("m2q02") === 1,
    m3q09b: () => n("m3q09a") === 1,
    m4q04: () => n("m4q03") === 1, m4q05: () => n("m4q03") === 1, m5q04: () => n("m5q03") === 1, m5q05: () => n("m5q03") === 1,
    m6q03b: () => n("m6q03a") === 1, m6q03d: () => n("m6q03a") === 1, m6q05_oth: () => n("m6q03c__96") === 1,
    [CALLS_VAR]: () => true, // asked of every completed interview in the versions that have it
  };
  return (v) => (cond[v] ? cond[v]() : i.row[v] !== "");
}

const POSTAL_PLACEHOLDER = /^(0+|null|none|no|nil|n\/?a|not available|-+)$/i;

export function processExport(raw: RawExport, up: UploadedTargets | null, supervisorNames: Record<string, string> = {}): Dataset {
  const exportedAt = raw.jobs.map((j) => j.completed).filter(Boolean).sort().pop() ?? raw.fetchedAt;
  const exportMs = Date.parse(exportedAt!.endsWith("Z") ? exportedAt! : exportedAt + "Z");
  const server = (process.env.SUSO_URL || "").replace(/\/+$/, "");
  const workspace = process.env.SUSO_WORKSPACE || "primary";

  const diag = new Map(raw.diagnostics.map((d) => [d.interview__id, d]));
  const actionsById = new Map<string, { action: number; t: number; role: number }[]>();
  for (const a of raw.actions) {
    let g = actionsById.get(a.interview__id);
    if (!g) actionsById.set(a.interview__id, (g = []));
    g.push({ action: Number(a.action), t: Date.parse(`${a.date}T${a.time}Z`), role: Number(a.role) });
  }
  const commentsById = new Map<string, { role: number; text: string; order: number }[]>();
  for (const c of raw.comments) {
    let g = commentsById.get(c.interview__id);
    if (!g) commentsById.set(c.interview__id, (g = []));
    g.push({ role: Number(c.role), text: c.comment, order: Date.parse(`${c.date}T${c.time}Z`) || g.length });
  }
  const versionCols = new Map(Object.entries(raw.columnsByVersion).map(([v, cols]) => [Number(v), new Set(cols)]));
  const asksCalls = (qv: number) => versionCols.get(qv)?.has(CALLS_VAR) ?? false;
  const para = summariseParadata(raw.paradata);

  const L = raw.labels;
  const setFor = (v: string) => L.valueSets[L.values[v] || v] || {};
  const names = setFor("id11a");
  const contacts = setFor("id11c");
  const interviewerNames: Record<string, string> = {};
  for (const [code, nm] of Object.entries(names)) interviewerNames[loginOf(Number(code))!] = nm;
  const interviewerContacts = new Map<string, string>();
  for (const [code, ph] of Object.entries(contacts)) {
    const p = normPhone(ph);
    if (p) interviewerContacts.set(p, `${loginOf(Number(code))}${names[code] ? ` (${names[code]})` : ""}`);
  }

  // derive
  const all = raw.main
    .filter((r) => r.interview__id && Number(diag.get(r.interview__id)?.interview__status ?? r.interview__status) !== -1)
    .map((r) => derive(r, diag.get(r.interview__id), para.byInterview.get(r.interview__id)));
  const deleted = raw.main.length - all.length;

  // Calls made before completion: the question where the version asks it, otherwise the number a
  // supervisor (or interviewer) wrote in a comment. Reported for completed interviews only.
  for (const i of all) {
    if (!i.complete) continue;
    const q = i.n(CALLS_VAR);
    if (q !== null && Number.isInteger(q) && q >= 1 && q <= CALLS_MAX) {
      i.calls = q;
      i.callsSrc = "question";
    } else if (q === null) {
      const c = callsFromComments(commentsById.get(i.id) ?? []);
      if (c !== null) {
        i.calls = c;
        i.callsSrc = "comment";
      }
    }
  }

  const flags = runChecks(all, {
    exportMs, interviewerContacts, interviewerNames, actionsById, commentsById, asksCalls, tzByUser: para.tzByUser,
  });

  /* -------- exclusions (spec §3.13) -------- */
  const flagsBy = new Map<string, Flag[]>();
  for (const f of flags) {
    if (!f.iid) continue;
    let g = flagsBy.get(f.iid);
    if (!g) flagsBy.set(f.iid, (g = []));
    g.push(f);
  }
  const excluded = new Map<string, string>();
  for (const i of all) {
    const fl = flagsBy.get(i.id) ?? [];
    if (fl.some((f) => f.check === "DQ-ID-06")) excluded.set(i.id, "Test or training record");
    else if (fl.some((f) => f.check === "DQ-ID-05" && f.sev === "critical")) excluded.set(i.id, "Outside the fieldwork window");
  }
  // same establishment more than once (also across questionnaire versions): keep the completed one,
  // then the highest status, then the newest version / latest end time
  const dupGroups = new Map<string, I[]>();
  for (const i of all) {
    if (excluded.has(i.id)) continue;
    const k = i.n("id01a") ?? i.n("assignment__id");
    if (k === null) continue;
    let g = dupGroups.get(String(k));
    if (!g) dupGroups.set(String(k), (g = []));
    g.push(i);
  }
  for (const g of dupGroups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => Number(b.complete) - Number(a.complete) || (b.status ?? 0) - (a.status ?? 0) || b.qv - a.qv || (b.endMs ?? b.startMs ?? 0) - (a.endMs ?? a.startMs ?? 0));
    const keep = sorted[0];
    for (const i of sorted.slice(1)) {
      const reattempt = !i.complete && keep.qv > i.qv;
      excluded.set(i.id, reattempt ? `Earlier attempt in questionnaire v${i.qv}, re-done as ${keep.key} in v${keep.qv}` : `Duplicate of ${keep.key}`);
    }
  }

  /* -------- scores -------- */
  const scoreBy = new Map<string, number | null>();
  for (const i of all) scoreBy.set(i.id, i.complete ? scoreOf(flagsBy.get(i.id) ?? []) : null);

  /* -------- interviewer-level (DQ-IB) & IQI -------- */
  const targets = buildTargets(raw, up);
  const live = all.filter((i) => !excluded.has(i.id));
  const completes = live.filter((i) => i.complete);
  const pooledMedDur = median(completes.map((i) => i.duration).filter((x): x is number => x !== null));
  const totNZ = completes.reduce((a, i) => a + i.nonZeroMoney, 0);
  const pooledHeap = totNZ ? completes.reduce((a, i) => a + i.roundThousands, 0) / totNZ : null;
  const zs = completes.map((i) => i.zeroShare).filter((x): x is number => x !== null);
  const pooledZero = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : null;
  const attemptedAll = live.filter((i) => i.disp !== "NOT_STARTED");
  const pooledYield = attemptedAll.length ? completes.length / attemptedAll.length : null;
  const contacted = (xs: I[]) => xs.filter((i) => ["Complete", "Partial", "Refused", "Pending"].includes(i.dispGroup));
  const pooledRefuse = contacted(attemptedAll).length ? attemptedAll.filter((i) => i.disp === "REFUSED").length / contacted(attemptedAll).length : null;
  const pooledNonContact = attemptedAll.length ? attemptedAll.filter((i) => i.dispGroup === "Non-contact").length / attemptedAll.length : null;

  const workdaysSoFar = workdaysBetween(SURVEY.fieldStart, new Date(exportMs).toISOString().slice(0, 10));
  const recentWorkdays = workdaysSoFar.slice(-T.ibInactiveWorkdays);

  // assignments that reached a tablet, each counted once (an upgrade re-creates and re-sends them)
  const receivedOnTablet = new Map<string, number>();
  const seenOnTablet = new Set<string>();
  for (const a of raw.assignmentActions) if (Number(a.action) === 4 && !seenOnTablet.has(a.assignment__id)) {
    seenOnTablet.add(a.assignment__id);
    const k = (a.responsible__name || a.originator || "").toUpperCase();
    receivedOnTablet.set(k, (receivedOnTablet.get(k) ?? 0) + 1);
  }

  const logins = new Set<string>([
    ...Object.keys(TEAM_OF).map((c) => loginOf(Number(c))!),
    ...live.map((i) => i.login).filter((x): x is string => !!x && !/^GAES0[1-5]$/.test(x)),
  ]);
  const ibFlags: Flag[] = [];
  const addIB = (login: string, team: number | null, check: string, sev: Flag["sev"], msg: string) =>
    ibFlags.push({ iid: "", key: "", check, sev, cat: "Interviewer-behaviour", msg, interviewer: login, team, region: null, scored: false });

  const interviewers: InterviewerRow[] = [];
  for (const login of [...logins].sort()) {
    const code = Number(login.replace(/\D/g, ""));
    const team = TEAM_OF[code] ?? null;
    const mine = live.filter((i) => i.login === login);
    const att = mine.filter((i) => i.disp !== "NOT_STARTED");
    const comp = mine.filter((i) => i.complete);
    const submitted = mine.filter((i) => (i.status ?? 0) >= 100 || i.status === 65).length;
    const rej = mine.reduce((a, i) => a + i.rejSup + i.rejHq, 0);
    const durs = comp.map((i) => i.duration).filter((x): x is number => x !== null);
    const medDur = median(durs);
    const scores = comp.map((i) => scoreBy.get(i.id)).filter((x): x is number => x !== null && x !== undefined);
    const meanScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const nz = comp.reduce((a, i) => a + i.nonZeroMoney, 0);
    const heap = nz ? comp.reduce((a, i) => a + i.roundThousands, 0) / nz : null;
    const zsi = comp.map((i) => i.zeroShare).filter((x): x is number => x !== null);
    const zero = zsi.length ? zsi.reduce((a, b) => a + b, 0) / zsi.length : null;
    const critShare = comp.length ? comp.filter((i) => (flagsBy.get(i.id) ?? []).some((f) => f.scored && f.sev === "critical")).length / comp.length : 0;
    const gaps = comp.map((i) => i.para?.medGapSec).filter((x): x is number => x !== null && x !== undefined);
    const withStart = mine.filter((i) => i.mode === 1 && i.startMs !== null);
    const outside = withStart.length ? withStart.filter((i) => { const h = new Date(i.startMs!).getUTCHours(); return h < T.callHourStart || h >= T.callHourEnd; }).length / withStart.length : null;
    const dates = mine.map((i) => isoDate(i.startMs)).filter((x): x is string => !!x).sort();
    const lastActivity = dates.length ? dates[dates.length - 1] : null;
    const activeDays = new Set(comp.map((i) => isoDate(i.endMs ?? i.startMs)).filter(Boolean)).size;
    const fl: string[] = [];

    if (comp.length >= T.ibMinN) {
      if (medDur !== null && pooledMedDur !== null && medDur < T.ibShortRatio * pooledMedDur) {
        fl.push("DQ-IB-01"); addIB(login, team, "DQ-IB-01", "major", `${login}: median interview ${fmtN(medDur, 1)} min against ${fmtN(pooledMedDur, 1)} min overall.`);
      }
      if (nz >= T.ibHeapMinValues && heap !== null && heap > T.ibHeapShare) {
        fl.push("DQ-IB-02"); addIB(login, team, "DQ-IB-02", "minor", `${login}: ${fmtN(heap * 100)}% of money values are round thousands (overall ${fmtN((pooledHeap ?? 0) * 100)}%).`);
      }
      if (critShare > T.ibCriticalShare) {
        fl.push("DQ-IB-03"); addIB(login, team, "DQ-IB-03", "major", `${login}: ${fmtN(critShare * 100)}% of interviews carry a critical flag.`);
      }
      const cp04 = comp.filter((i) => (flagsBy.get(i.id) ?? []).some((f) => f.check === "DQ-CP-04")).length / comp.length;
      if ((zero !== null && pooledZero !== null && zero > pooledZero + T.ibZeroExcess) || cp04 > T.ibZeroCpShare) {
        fl.push("DQ-IB-05"); addIB(login, team, "DQ-IB-05", "major", `${login}: average ${fmtN((zero ?? 0) * 100)}% of money items are zero (overall ${fmtN((pooledZero ?? 0) * 100)}%).`);
      }
      // IB-08 near-identical
      for (let a = 0; a < comp.length; a++) for (let b = a + 1; b < comp.length; b++) {
        const A = comp[a], B = comp[b];
        if ((A.zeroShare ?? 1) >= T.ibIdenticalMaxZero || (B.zeroShare ?? 1) >= T.ibIdenticalMaxZero) continue;
        let same = 0;
        for (let k = 0; k < FIN_ITEMS.length; k++) if (A.fin[k] !== null && A.fin[k] === B.fin[k]) same++;
        if (same >= T.ibIdenticalPositions) {
          if (!fl.includes("DQ-IB-08")) fl.push("DQ-IB-08");
          addIB(login, team, "DQ-IB-08", "critical", `${login}: interviews ${A.key} and ${B.key} have ${same}/47 identical money values.`);
          for (const X of [A, B]) {
            const f: Flag = { iid: X.id, key: X.key, check: "DQ-IB-08", sev: "critical", cat: "Interviewer-behaviour", msg: `${same}/47 money values identical to interview ${(X === A ? B : A).key}.`, interviewer: login, team, region: X.region, scored: false };
            flags.push(f);
            (flagsBy.get(X.id) ?? flagsBy.set(X.id, []).get(X.id)!).push(f);
          }
        }
      }
    }
    if (submitted >= T.ibMinN && rej / submitted > T.ibRejectRate) {
      fl.push("DQ-IB-04"); addIB(login, team, "DQ-IB-04", "minor", `${login}: ${fmtN((rej / submitted) * 100)}% of submitted interviews were rejected (${rej} of ${submitted}).`);
    }
    if (att.length >= T.ibLowYieldAttempts && pooledYield !== null && comp.length / att.length < 0.5 * pooledYield) {
      fl.push("DQ-IB-06"); addIB(login, team, "DQ-IB-06", "minor", `${login}: ${comp.length} completes from ${att.length} attempts.`);
    }
    if (att.length >= T.ibLowYieldAttempts) {
      const con = contacted(att);
      const refShare = con.length ? att.filter((i) => i.disp === "REFUSED").length / con.length : 0;
      const ncShare = att.filter((i) => i.dispGroup === "Non-contact").length / att.length;
      if ((pooledRefuse && refShare > 2 * pooledRefuse) || (pooledNonContact && ncShare > 2 * pooledNonContact)) {
        fl.push("DQ-IB-07"); addIB(login, team, "DQ-IB-07", "minor", `${login}: refusal ${fmtN(refShare * 100)}% / non-contact ${fmtN(ncShare * 100)}% against ${fmtN((pooledRefuse ?? 0) * 100)}% / ${fmtN((pooledNonContact ?? 0) * 100)}% overall.`);
      }
    }
    const assigned = targets.byInterviewer[login] ?? 0;
    if (assigned > 0 && !mine.some((i) => recentWorkdays.includes(isoDate(i.startMs) ?? ""))) {
      fl.push("DQ-IB-09"); addIB(login, team, "DQ-IB-09", "info", `${login}: no interviews ${lastActivity ? `since ${lastActivity}` : "yet"}.`);
    }

    // IQI
    let iqi: number | null = null;
    let parts: InterviewerRow["iqiParts"] = null;
    if (comp.length >= T.ibMinN && meanScore !== null) {
      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const S = meanScore;
      const Cc = 100 * (1 - critShare);
      const Tt = 100 * clamp(medDur !== null && pooledMedDur ? medDur / pooledMedDur : 1);
      const R = 100 * (1 - Math.min(1, submitted ? rej / submitted : 0));
      const H = 100 * (1 - clamp(heap !== null && pooledHeap !== null && pooledHeap < 1 ? (heap - pooledHeap) / (1 - pooledHeap) : 0));
      const Z = 100 * (1 - clamp(zero !== null && pooledZero !== null && pooledZero < 1 ? (zero - pooledZero) / (1 - pooledZero) : 0));
      iqi = Math.round(0.4 * S + 0.15 * Cc + 0.15 * Tt + 0.1 * R + 0.1 * H + 0.1 * Z);
      parts = { S: Math.round(S), C: Math.round(Cc), T: Math.round(Tt), R: Math.round(R), H: Math.round(H), Z: Math.round(Z) };
    }
    const coopDen = att.filter((i) => ["Complete", "Partial", "Refused"].includes(i.dispGroup)).length;
    interviewers.push({
      login, code, name: interviewerNames[login] ?? null, team, assigned,
      attempted: att.length, complete: comp.length,
      nonContact: att.filter((i) => i.dispGroup === "Non-contact").length,
      refused: att.filter((i) => i.disp === "REFUSED").length,
      pending: att.filter((i) => i.dispGroup === "Pending").length,
      perDay: activeDays ? comp.length / activeDays : null,
      coopRate: coopDen ? comp.length / coopDen : null,
      medDuration: medDur, meanScore, iqi, iqiParts: parts, rejections: rej, submitted, heapShare: heap, zeroShare: zero,
      medGapSec: median(gaps), outsideHours: outside, lastActivity, flags: fl,
      receivedOnTablet: receivedOnTablet.get(login) ?? 0,
    });
  }
  flags.push(...ibFlags);
  // show people, not logins: supervisors are named in device-clock messages
  for (const f of flags) {
    if (f.check === "DQ-PR-07" && f.interviewer && supervisorNames[f.interviewer]) f.msg = f.msg.replace(f.interviewer, `${supervisorNames[f.interviewer]} (${f.interviewer})`);
  }

  /* -------- recompute counts after IB-08 -------- */
  const sevCount = (id: string, sev: string) => (flagsBy.get(id) ?? []).filter((f) => f.sev === sev && (f.scored || f.check === "DQ-IB-08")).length;

  /* -------- teams -------- */
  const teams: TeamRow[] = [1, 2, 3, 4, 5].map((t) => {
    const mine = live.filter((i) => i.team === t);
    const comp = mine.filter((i) => i.complete);
    const sc = comp.map((i) => scoreBy.get(i.id)).filter((x): x is number => typeof x === "number");
    const lags = mine.map((i) => (i.para?.decidedAt && i.para.completedAt ? (i.para.decidedAt - i.para.completedAt) / 3600_000 : null)).filter((x): x is number => x !== null && x >= 0);
    const reviewed = mine.filter((i) => i.para?.decidedAt).length;
    const submitted = mine.filter((i) => (i.status ?? 0) >= 100 || i.status === 65).length;
    const rej = mine.reduce((a, i) => a + i.rejSup, 0);
    const opens = mine.map((i) => i.para?.supOpenMin ?? 0).filter((x) => x > 0);
    const roster = Object.entries(TEAM_OF).filter(([, tt]) => tt === t).map(([c]) => loginOf(Number(c))!);
    return {
      team: t, supervisor: SUPERVISOR_OF_TEAM(t), supervisorName: supervisorNames[SUPERVISOR_OF_TEAM(t)] ?? SUPERVISOR_OF_TEAM(t), interviewers: roster.length,
      activeInterviewers: new Set(mine.filter((i) => i.disp !== "NOT_STARTED").map((i) => i.login)).size,
      target: targets.byTeam[t] ?? 0, attempted: mine.filter((i) => i.disp !== "NOT_STARTED").length, complete: comp.length,
      meanScore: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null,
      awaitingReview: mine.filter((i) => i.status === 100).length,
      medDecisionLagH: median(lags), reviewed, rejectionRate: submitted ? rej / submitted : null, medOpenMin: median(opens),
    };
  });

  /* -------- item non-response -------- */
  const header = raw.columns.length ? raw.columns : raw.main.length ? Object.keys(raw.main[0]) : [];
  const skip = /(qend$|^m7q|__\d+$|^m0q08__|^gpsAccuracy$|^ownership_total$|^m3err|^m[0-9]t|^m5tt$|^m4t\d$|_total$|^timespent$|^endtime$|^m0q0[1-7]a|^m0q03a_oth$)/;
  const finSet = new Set(FIN_ITEMS);
  const itemNR: ItemNR[] = [];
  const compAll = completes;
  const enabledFns = new Map(compAll.map((i) => [i.id, enabledFn(i)]));
  for (const v of header) {
    if (!/^m[0-6]q/.test(v) || skip.test(v)) continue;
    let enabled = 0, missing = 0, zero = 0;
    for (const i of compAll) {
      if (!(v in i.row)) continue; // question does not exist in this interview's questionnaire version
      if (i.mode !== 2 && v.startsWith("m0q08")) continue;
      if (!enabledFns.get(i.id)!(v)) continue;
      enabled++;
      const raw = i.row[v];
      const isMiss = raw === "" || raw === "-999999999" || raw === "##N/A##" || (v === "m0q15" && POSTAL_PLACEHOLDER.test(raw.trim()));
      if (isMiss) missing++;
      else if (finSet.has(v) && Number(raw) === 0) zero++;
    }
    if (!enabled) continue;
    itemNR.push({ variable: v, label: L.variables[v] ?? v, module: moduleOf(v), enabled, missing, zero: finSet.has(v) ? zero : null });
  }

  /* -------- question timing -------- */
  const questions: QuestionTiming[] = [...para.questionGaps.entries()]
    .filter(([, g]) => g.length >= 5)
    .map(([variable, g]) => ({
      variable, label: L.variables[variable] ?? variable, module: moduleOf(variable), n: g.length,
      medianSec: Math.round((median(g) ?? 0) * 10) / 10, p90Sec: Math.round((quantile(g, 0.9) ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.medianSec - a.medianSec);

  /* -------- records -------- */
  const toRec = (i: I): Rec => {
    const n = i.n;
    const fl = flagsBy.get(i.id) ?? [];
    const score = scoreBy.get(i.id) ?? null;
    const hasCrit = fl.some((f) => f.sev === "critical" && (f.scored || f.check === "DQ-IB-08"));
    const startD = i.startMs !== null ? new Date(i.startMs) : null;
    const cb = i.disp === "CALLBACK"
      ? `${i.s("m0q04a")?.slice(0, 10) ?? ""} ${n("m0q05a") ?? ""}:${String(n("m0q06a") ?? 0).padStart(2, "0")} ${n("m0q07a") === 2 ? "PM" : n("m0q07a") === 1 ? "AM" : ""}`.trim()
      : null;
    return {
      id: i.id, key: i.key, assignmentId: n("assignment__id"), estId: i.s("id01a"), estName: i.s("id01b"),
      region: i.region ?? (i.regionCode ? REGIONS[i.regionCode] : null), regionCode: n("id04b"),
      district: i.s("id05a"), districtCode: n("id05b"), team: i.team, interviewer: i.login,
      supervisor: i.team ? SUPERVISOR_OF_TEAM(i.team) : null, mode: i.mode, disp: i.disp, dispGroup: i.dispGroup,
      status: i.status, stage: i.stage, rejections: i.rejSup + i.rejHq,
      date: isoDate(i.startMs), completeDate: i.complete ? isoDate(i.endMs ?? i.para?.completedAt ?? i.startMs) : null,
      startTs: i.startMs !== null ? new Date(i.startMs).toISOString() : null,
      endTs: i.endMs !== null ? new Date(i.endMs).toISOString() : null,
      startHour: startD ? startD.getUTCHours() : null, weekday: startD ? startD.getUTCDay() : null,
      activeMin: i.duration, sessMin: i.sessMin, timespent: i.timespent,
      medGapSec: i.para?.medGapSec ?? null, pctFast: i.para?.pctFast ?? null, finMedGapSec: i.para?.finMedGapSec ?? null,
      nAnswers: i.para?.nAns ?? 0, nChanges: i.para?.nChanges ?? 0, nAfterEnd: i.para?.nAfterEnd ?? 0, nSessions: i.para?.nSessions ?? 0,
      moduleMin: Object.fromEntries(Object.entries(i.para?.moduleSec ?? {}).map(([k, v]) => [k, Math.round((v / 60) * 10) / 10])),
      sessions: (i.para?.sessions ?? []).filter((s) => s.answers > 0).map((s) => [s.start, s.end, s.answers]),
      isic4: i.isic4, isicSection: i.section, sizeClass: i.sizeClass,
      emp24: i.complete ? i.emp24 : null, emp25: i.complete ? i.emp25 : null,
      female: i.complete ? n("m3q02a") : null, ssnit: i.complete ? n("m3q02b") : null,
      occ: i.complete ? ["m3q04a", "m3q04b", "m3q04c", "m3q04d", "m3q04e"].map(n) : [],
      contract: i.complete ? ["m3q05a", "m3q05b", "m3q05c"].map(n) : [],
      paid: i.complete ? i.paid : null, wages: i.complete ? i.wages : null, rev: i.complete ? i.rev : null,
      opex: i.complete ? i.opex : null, opexParts: i.complete ? i.opexParts : [], capex: i.complete ? i.capex : null,
      assets: i.complete ? i.assets : null, liab: i.complete ? i.liab : null, wpw: i.complete ? i.wpw : null,
      rpw: i.complete ? i.rpw : null, margin: i.complete ? i.margin : null,
      zeroShare: i.zeroShare, heapShare: i.heapShare, nonZeroMoney: i.nonZeroMoney, roundThousands: i.roundThousands,
      records: i.complete ? (n("m1q09") === 1 ? true : n("m1q09") === 2 ? false : null) : null,
      legalForm: n("m1q07"), registered: n("m1q03"), opStatus: n("m1q14"), femaleOwn: n("m1q17"), revChange: n("m5q02"),
      capacity: n("m2q04a"), credit: n("m6q03a"),
      creditSources: [1, 2, 3, 4, 5, 96].filter((k) => n(`m6q03c__${k}`) === 1),
      exporter: n("m5q03"), importer: n("m4q03"),
      energy: ["m4q02a", "m4q02b", "m4q02c", "m4q02d"].map(n),
      lat: n("m0q08__Latitude"), lon: n("m0q08__Longitude"), frameLat: n("id13__Latitude"), frameLon: n("id13__Longitude"),
      score, band: bandOf(score, hasCrit), nCritical: sevCount(i.id, "critical"), nMajor: sevCount(i.id, "major"), nMinor: sevCount(i.id, "minor"),
      excluded: excluded.get(i.id) ?? null,
      analysable: i.complete && !excluded.has(i.id) && !hasCrit && ![65, 125].includes(i.status ?? 0),
      callback: cb,
      qv: i.qv, calls: i.calls, callsSrc: i.callsSrc,
      supLagH: i.para?.decidedAt && i.para.completedAt && i.para.decidedAt >= i.para.completedAt ? Math.round(((i.para.decidedAt - i.para.completedAt) / 3600_000) * 10) / 10 : null,
      supOpenMin: i.para?.supOpenMin || null,
      reviewUrl: SURVEY.reviewUrl(server, workspace, i.id),
    };
  };
  const records = all.map(toRec);

  return {
    generatedAt: new Date().toISOString(), exportedAt, server, workspace,
    questionnaires: raw.questionnaires.map((q, k) => {
      const mine = records.filter((r) => r.qv === q.Version && !r.excluded);
      const cols = raw.columnsByVersion[String(q.Version)] ?? [];
      const prev = k > 0 ? raw.columnsByVersion[String(raw.questionnaires[k - 1].Version)] ?? [] : null;
      const dates = mine.map((r) => r.date).filter((x): x is string => !!x).sort();
      return {
        id: q.QuestionnaireIdentity, version: q.Version, title: q.Title,
        records: mine.length, complete: mine.filter((r) => r.disp === "COMPLETE").length,
        added: prev ? cols.filter((c) => !prev.includes(c)).map((c) => ({ variable: c, label: L.variables[c] ?? c })) : [],
        removed: prev ? prev.filter((c) => !cols.includes(c)) : [],
        firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null,
      };
    }),
    calls: {
      variable: CALLS_VAR, label: L.variables[CALLS_VAR] ?? "Calls made before the interview was completed",
      sinceVersion: raw.questionnaires.find((q) => asksCalls(q.Version))?.Version ?? null,
    },
    records, flags, checks: CHECKS, interviewers, teams, targets, itemNR, questions,
    isicSections: Object.fromEntries(ISIC_SECTIONS.map((s) => [s.letter, s.name])),
    interviewerNames, supervisorNames, stages: STAGES.map(({ key, label }) => ({ key, label })),
    totals: { records: records.length, deleted, complete: records.filter((r) => r.disp === "COMPLETE" && !r.excluded).length },
    survey: {
      fieldStart: SURVEY.fieldStart, fieldEnd: SURVEY.fieldEnd, workdays: workdaysBetween(SURVEY.fieldStart, SURVEY.fieldEnd),
      holidays: SURVEY.holidays, weekendsAreWorkdays: SURVEY.weekendsAreWorkdays, interviewersTotal: SURVEY.interviewersTotal,
    },
    pooled: { medDuration: pooledMedDur, heapShare: pooledHeap, zeroShare: pooledZero },
    viewer: { role: "admin", regions: [], pii: true },
  };
}

export { sevRank, isWorkday };
