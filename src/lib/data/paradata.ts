import type { Row } from "../tab";
import { T } from "./config";

/**
 * Paradata → per-interview timing & behaviour (spec §2.9).
 * Roles: 0 system, 1 interviewer, 2 supervisor, 3 HQ.
 */

export interface Session {
  start: number;
  end: number;
  answers: number;
}

export interface ParaSummary {
  tStart: number | null; // ms, first AnswerSet of datetime
  tEnd: number | null; // ms, last AnswerSet of endtime
  firstAnswer: number | null;
  lastAnswer: number | null;
  activeMin: number | null;
  nSessions: number;
  sessions: Session[];
  nAns: number;
  medGapSec: number | null;
  pctFast: number | null;
  finMedGapSec: number | null;
  nChanges: number;
  nRemoved: number;
  nAfterEnd: number;
  nDatetimeSets: number;
  nEndtimeSets: number;
  nModeSets: number;
  firstMode: string | null;
  lastMode: string | null;
  nCompleted: number;
  completedAt: number | null;
  lastCompletedAt: number | null;
  receivedAt: number | null;
  decidedAt: number | null;
  supOpenMin: number;
  ansRole1: number;
  ansAll: number;
  moduleSec: Record<string, number>;
  firstInterviewerLogin: string | null;
  lastRejectAt: number | null;
}

export interface ParaResult {
  byInterview: Map<string, ParaSummary>;
  /** variable -> list of gaps (s) preceding its answers */
  questionGaps: Map<string, number[]>;
  /** user -> set of non-zero tz offsets */
  tzByUser: Map<string, Set<string>>;
}

const SKIP_ANS = /^(id\d|isic|interview_mode$|datetime$)/;
const FIN_VAR = /^(m4q|m5q|m6q0)/;

function ts(v: string): number {
  return Date.parse(v.endsWith("Z") ? v : v + "Z");
}
function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function moduleOf(v: string): string {
  const m = v.match(/^m(\d)/i);
  if (m) return `m${m[1]}`;
  return "cover";
}

export function summariseParadata(rows: Row[]): ParaResult {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const id = r.interview__id;
    if (!id || id === "interview__id") continue;
    let g = groups.get(id);
    if (!g) groups.set(id, (g = []));
    g.push(r);
  }
  const byInterview = new Map<string, ParaSummary>();
  const questionGaps = new Map<string, number[]>();
  const tzByUser = new Map<string, Set<string>>();

  for (const [id, evs] of groups) {
    evs.sort((a, b) => Number(a.order) - Number(b.order));
    const createdTs = evs.find((e) => e.event === "InterviewCreated")?.timestamp_utc ?? null;

    const s: ParaSummary = {
      tStart: null, tEnd: null, firstAnswer: null, lastAnswer: null, activeMin: null, nSessions: 0, sessions: [],
      nAns: 0, medGapSec: null, pctFast: null, finMedGapSec: null, nChanges: 0, nRemoved: 0, nAfterEnd: 0,
      nDatetimeSets: 0, nEndtimeSets: 0, nModeSets: 0, firstMode: null, lastMode: null, nCompleted: 0, completedAt: null,
      lastCompletedAt: null, receivedAt: null, decidedAt: null, supOpenMin: 0, ansRole1: 0, ansAll: 0, moduleSec: {},
      firstInterviewerLogin: null, lastRejectAt: null,
    };

    // events by interviewer, excluding preload burst
    const E: { t: number; ev: string; v: string; val: string }[] = [];
    const setCounts = new Map<string, number>();
    let openSup: number | null = null;
    let curSession: Session | null = null;

    for (const e of evs) {
      const t = ts(e.timestamp_utc);
      if (!Number.isFinite(t)) continue;
      if (e.tz_offset && e.tz_offset !== "00:00:00" && e.responsible) {
        let set = tzByUser.get(e.responsible);
        if (!set) tzByUser.set(e.responsible, (set = new Set()));
        set.add(e.tz_offset);
      }
      const ev = e.event;
      switch (ev) {
        case "Completed":
          s.nCompleted++;
          s.completedAt ??= t;
          s.lastCompletedAt = t;
          break;
        case "ReceivedBySupervisor":
          if (s.completedAt !== null && s.receivedAt === null && t >= s.completedAt) s.receivedAt = t;
          break;
        case "ApproveBySupervisor":
        case "RejectedBySupervisor":
          if (s.completedAt !== null && s.decidedAt === null) s.decidedAt = t;
          if (ev === "RejectedBySupervisor") s.lastRejectAt = t;
          break;
        case "RejectedByHeadquarter":
        case "RejectedByHeadquarters":
          s.lastRejectAt = t;
          break;
        case "OpenedBySupervisor":
          openSup = t;
          break;
        case "ClosedBySupervisor":
          if (openSup !== null) s.supOpenMin += (t - openSup) / 60000;
          openSup = null;
          break;
      }
      if (ev === "AnswerSet") s.ansAll++;
      if (e.role !== "1") continue;
      if (createdTs && e.timestamp_utc === createdTs) continue; // preload burst

      if (ev === "Resumed") {
        curSession = { start: t, end: t, answers: 0 };
        s.sessions.push(curSession);
      } else if (ev === "Paused") {
        if (curSession) curSession.end = t;
        curSession = null;
      }

      if (ev === "AnswerSet" || ev === "AnswerRemoved") {
        const parts = (e.parameters || "").split("||");
        const v = parts[0] || "";
        const val = parts[1] || "";
        if (ev === "AnswerSet") {
          s.ansRole1++;
          s.firstInterviewerLogin ??= e.responsible || null;
          setCounts.set(v, (setCounts.get(v) || 0) + 1);
          if (v === "datetime") {
            s.nDatetimeSets++;
            s.tStart ??= t;
          }
          if (v === "endtime") {
            s.nEndtimeSets++;
            s.tEnd = t;
          }
          if (v === "interview_mode") {
            s.nModeSets++;
            s.firstMode ??= val;
            s.lastMode = val;
          }
          if (curSession) {
            curSession.answers++;
            curSession.end = t;
          }
        } else s.nRemoved++;
        E.push({ t, ev, v, val });
      } else if (["CommentSet", "Completed", "Restarted", "Resumed", "Paused"].includes(ev)) {
        E.push({ t, ev, v: "", val: "" });
      }
    }
    if (curSession) {
      /* open session: end at last answer */
    }

    // active time between tStart and tEnd (fallback: first/last answer)
    const ans = E.filter((x) => x.ev === "AnswerSet");
    s.firstAnswer = ans[0]?.t ?? null;
    s.lastAnswer = ans.length ? ans[ans.length - 1].t : null;
    const lo = s.tStart ?? s.firstAnswer;
    const hi = s.tEnd ?? s.lastAnswer;
    if (lo !== null && hi !== null && hi > lo) {
      // spec §2.9: sum of consecutive gaps within [tStart, tEnd], each capped at 300 s
      let active = 0;
      let prev: number | null = null;
      for (const x of E) {
        if (x.t < lo || x.t > hi) continue;
        if (prev !== null) active += Math.min(Math.max(0, (x.t - prev) / 1000), T.idleCapSec);
        prev = x.t;
      }
      s.activeMin = Math.round((active / 60) * 10) / 10;
    }

    // answer pacing (ANS excludes cover/preload variables)
    const ANS = ans.filter((x) => !SKIP_ANS.test(x.v));
    s.nAns = ANS.length;
    const gaps: number[] = [];
    const finGaps: number[] = [];
    for (let i = 1; i < ANS.length; i++) {
      const g = (ANS[i].t - ANS[i - 1].t) / 1000;
      if (g < 0 || g > T.idleCapSec) continue;
      gaps.push(g);
      if (FIN_VAR.test(ANS[i].v)) finGaps.push(g);
      const mod = moduleOf(ANS[i].v);
      s.moduleSec[mod] = (s.moduleSec[mod] || 0) + g;
      let q = questionGaps.get(ANS[i].v);
      if (!q) questionGaps.set(ANS[i].v, (q = []));
      q.push(g);
    }
    s.medGapSec = gaps.length ? Math.round((median(gaps) ?? 0) * 10) / 10 : null;
    s.pctFast = gaps.length ? gaps.filter((g) => g < 2).length / gaps.length : null;
    s.finMedGapSec = finGaps.length >= 5 ? Math.round((median(finGaps) ?? 0) * 10) / 10 : null;
    for (const c of setCounts.values()) s.nChanges += c - 1;
    s.nAfterEnd = s.tEnd !== null ? ANS.filter((x) => x.t > s.tEnd!).length : 0;
    s.nSessions = s.sessions.length;
    s.supOpenMin = Math.round(s.supOpenMin * 10) / 10;
    for (const k of Object.keys(s.moduleSec)) s.moduleSec[k] = Math.round(s.moduleSec[k]);
    byInterview.set(id, s);
  }
  return { byInterview, questionGaps, tzByUser };
}
