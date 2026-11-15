import type { Row } from "../tab";
import { num as rawNum, str, timespanSeconds } from "../tab";
import type { ParaSummary } from "./paradata";
import { DISP_GROUP, TEAM_OF, loginOf, sectionOfDivision, sizeClassOf, stageOf } from "./config";

/** Everything the checks and outputs need about one interview (server side). */
export interface I {
  id: string;
  key: string;
  row: Row;
  diag: Row | undefined;
  para: ParaSummary | undefined;
  n: (v: string) => number | null;
  s: (v: string) => string | null;
  status: number | null;
  mode: number | null;
  disp: string;
  dispGroup: string;
  complete: boolean;
  started: boolean;
  stage: string;
  login: string | null;
  code: number | null;
  team: number | null;
  regionCode: number | null;
  region: string | null;
  startMs: number | null;
  endMs: number | null;
  duration: number | null;
  sessMin: number | null;
  timespent: number | null;
  rejSup: number;
  rejHq: number;
  // economics
  emp24: number | null;
  emp25: number | null;
  paid: number | null;
  wages: number | null;
  rev: number | null;
  opex: number | null;
  opexParts: (number | null)[];
  capex: number | null;
  assets: number | null;
  liab: number | null;
  margin: number | null;
  wpw: number | null;
  rpw: number | null;
  isic4: string | null;
  section: string | null;
  sizeClass: string | null;
  fin: (number | null)[];
  zeroShare: number | null;
  heapShare: number | null;
  nonZeroMoney: number;
  roundThousands: number;
  /** questionnaire version this interview was collected with */
  qv: number;
  /** calls made before completion, and where the number comes from (set in process.ts) */
  calls: number | null;
  callsSrc: "question" | "comment" | null;
}

/** The 47 typed money items (spec §2.7 FIN_ITEMS) */
export const FIN_ITEMS = [
  ..."abcdefghijklmnopqrstuvwx".split("").map((c) => (c === "c" ? "m4q01c_oth" : `m4q01${c}`)),
  "m4q02a", "m4q02b", "m4q02c", "m4q02d",
  "m5q01a", "m5q01b", "m5q01c", "m5q01d_oth", "m5q01e", "m5q01f", "m5q01g", "m5q01h", "m5q01i_oth",
  "m6q01a", "m6q01b", "m6q01c", "m6q01d", "m6q01e_oth",
  "m6q02a", "m6q02b", "m6q02c_oth", "m6q02d", "m6q02e_oth",
];

export function isMissing(v: string | undefined | null) {
  return rawNum(v) === null && str(v) === null;
}
export function parseLocal(v: string | null): number | null {
  if (!v) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : v + "Z"); // Ghana = UTC+0
  return Number.isFinite(t) ? t : null;
}

export function dispOf(n: (v: string) => number | null, s: (v: string) => string | null): string {
  const mode = n("interview_mode");
  if (mode === null) return "NOT_STARTED";
  if (mode === 1) {
    const a = n("m0q01a");
    const b = n("m0q02a");
    if (a === null) return "NOT_STARTED";
    if (a === 2) return "NO_ANSWER";
    if (a === 3) return "UNREACHABLE";
    if (a === 4) return "SWITCHED_OFF";
    if (b === null) return "PARTIAL";
    if (b === 2) return "LANGUAGE";
    if (b === 3) return "CALLBACK";
    if (b === 4) return "CALL_DROPPED";
    if (b === 5) return "REFUSED";
  }
  if (s("endtime") && n("m6q03a") !== null) return "COMPLETE";
  return "PARTIAL";
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function derive(row: Row, diag: Row | undefined, para: ParaSummary | undefined): I {
  const n = (v: string) => rawNum(row[v]);
  const s = (v: string) => {
    const x = str(row[v]);
    return x === null || x === "-999999999" ? null : x;
  };
  const status = rawNum(diag?.interview__status ?? row.interview__status);
  const mode = n("interview_mode");
  const disp = dispOf(n, s);
  const complete = disp === "COMPLETE";

  const codeRaw = n("id11b");
  const code = codeRaw !== null && TEAM_OF[codeRaw] !== undefined ? codeRaw : null;
  let login = para?.firstInterviewerLogin ?? null;
  if (!login && code !== null) login = loginOf(code);
  if (!login && diag?.responsible && /^GAES\d+$/i.test(diag.responsible)) login = diag.responsible.toUpperCase();
  const loginCode = login ? Number(login.replace(/\D/g, "")) : null;
  const team = n("id10") ?? (loginCode !== null ? TEAM_OF[loginCode] ?? null : null);

  const regionCode = n("m0q16a") === 1 && n("m0q16b") !== null ? n("m0q16b") : n("id04b");
  const region = s("id04a")?.toUpperCase() ?? null;

  const startMs = parseLocal(s("datetime")) ?? para?.tStart ?? para?.firstAnswer ?? null;
  const endMs = parseLocal(s("endtime")) ?? null;
  const sessSec = timespanSeconds(diag?.interview__duration);
  const sessMin = sessSec !== null ? Math.round((sessSec / 60) * 10) / 10 : null;
  const duration = para?.activeMin ?? sessMin;

  // economics (meaningful for COMPLETE)
  const emp25 = n("m3q02");
  const emp24 = n("m3q01");
  const paid = n("m3q05a") !== null || n("m3q05b") !== null ? (n("m3q05a") ?? 0) + (n("m3q05b") ?? 0) : null;
  const wages = n("m4q01a");
  const rev = n("m5q01j");
  const parts = [n("m4t1"), n("m4q01f"), n("m4t3"), n("m4t4"), n("m4t5"), n("m4t6")];
  const opex = parts.every((x) => x === null) ? null : sum(parts);
  const capex = n("m4t7");
  const assets = n("m6q01_total");
  const liab = n("m6q02_total");
  const margin = rev !== null && opex !== null && rev > 0 ? (rev - opex) / rev : null;
  const wpw = paid !== null && paid > 0 && wages !== null ? wages / paid : null;
  const rpw = emp25 !== null && emp25 > 0 && rev !== null ? rev / emp25 : null;

  const isicFinal = n("m2q00") === 2 && n("m2q01b") !== null ? n("m2q01b") : n("isic_code");
  const isic4 = isicFinal !== null ? String(Math.trunc(isicFinal)).padStart(4, "0") : null;
  const section = isic4 ? sectionOfDivision(Number(isic4.slice(0, 2))) : null;

  const fin = FIN_ITEMS.map(n);
  const answeredFin = fin.filter((x): x is number => x !== null);
  const zeroShare = complete ? fin.filter((x) => x === 0).length / FIN_ITEMS.length : null;
  const pos = answeredFin.filter((x) => x > 0);
  const roundThousands = pos.filter((x) => x % 1000 === 0).length;
  const heapShare = complete && pos.length ? roundThousands / pos.length : null;

  const started = (para?.ansRole1 ?? 0) > 0 || disp !== "NOT_STARTED";

  return {
    id: row.interview__id, key: row.interview__key, row, diag, para, n, s,
    status, mode, disp, dispGroup: DISP_GROUP[disp] ?? disp, complete, started, stage: stageOf(status),
    login, code: loginCode, team, regionCode, region, startMs, endMs, duration, sessMin,
    timespent: n("timespent"),
    rejSup: rawNum(diag?.rejections__sup) ?? 0, rejHq: rawNum(diag?.rejections__hq) ?? 0,
    emp24, emp25, paid, wages, rev, opex, opexParts: parts, capex, assets, liab, margin, wpw, rpw,
    isic4, section, sizeClass: complete ? sizeClassOf(emp25) : null,
    fin, zeroShare, heapShare, nonZeroMoney: complete ? pos.length : 0, roundThousands: complete ? roundThousands : 0,
    qv: rawNum(row.qversion) ?? 1, calls: null, callsSrc: null,
  };
}

export function normPhone(v: string | null): string | null {
  if (!v) return null;
  let d = v.replace(/\D/g, "");
  if (d.startsWith("233")) d = d.slice(3);
  if (!d) return null;
  d = d.padStart(10, "0");
  if (/^0+$/.test(d)) return null;
  return d;
}

const NAME_STOP = /\b(LTD|LIMITED|ENT|ENTERPRISES?|CO|COMPANY|VENTURES)\b/g;
export function normName(v: string | null): string | null {
  if (!v) return null;
  const x = v.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(NAME_STOP, " ").replace(/\s+/g, " ").trim();
  return x || null;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function quantile(a: number[], q: number): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export const fmtN = (x: number | null | undefined, d = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? "–" : x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);
export const isoDate = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString().slice(0, 10));
