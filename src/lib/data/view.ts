import "server-only";
import type { Session } from "../session";
import type { Dataset } from "./types";

const PHONE_RE = /\b0?\d{9,12}\b/g;

/** Apply a user's region restriction and PII rules on the server (spec §4.8, §3.13). */
export function viewFor(data: Dataset, s: Session): Dataset & { excludedRecords: Dataset["records"] } {
  const regions = (s.regions || []).map((r) => r.toUpperCase());
  const pii = s.role !== "viewer";
  const inScope = (region: string | null) => !regions.length || (!!region && regions.includes(region.toUpperCase()));

  const scoped = data.records.filter((r) => inScope(r.region));
  const ids = new Set(scoped.map((r) => r.id));
  const strip = <T extends { estName: string | null; estId: string | null }>(r: T): T => (pii ? r : { ...r, estName: null, estId: null });

  const records = scoped.filter((r) => !r.excluded).map(strip);
  const excludedRecords = scoped.filter((r) => r.excluded).map(strip);
  const visibleInterviewers = new Set(scoped.map((r) => r.interviewer));
  const flags = data.flags
    .filter((f) => (f.iid ? ids.has(f.iid) : !regions.length || visibleInterviewers.has(f.interviewer)))
    .map((f) => (pii ? f : { ...f, msg: f.msg.replace(PHONE_RE, "•••") }));

  return {
    ...data,
    records,
    excludedRecords,
    flags,
    interviewers: regions.length ? data.interviewers.filter((i) => visibleInterviewers.has(i.login)) : data.interviewers,
    // version counts follow the user's region scope
    questionnaires: data.questionnaires.map((q) => {
      const mine = records.filter((r) => r.qv === q.version);
      return { ...q, records: mine.length, complete: mine.filter((r) => r.disp === "COMPLETE").length };
    }),
    totals: { ...data.totals, records: records.length, complete: records.filter((r) => r.disp === "COMPLETE").length },
    viewer: { role: s.role, regions, pii },
  };
}
