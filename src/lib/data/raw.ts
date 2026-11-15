import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  downloadJobFile, getJob, latestCompletedJob, listQuestionnaires, startExport, unzipText,
  type ExportType, type SusoJob, type SusoQuestionnaire,
} from "../suso";
import { parseTab, type Row } from "../tab";
import { parseDoFile, type Labels } from "./labels";

/** Raw, merged export across all questionnaire versions. */
export interface RawExport {
  questionnaires: SusoQuestionnaire[];
  jobs: { qid: string; type: ExportType; jobId: number; completed: string | null }[];
  /** one row per interview from every version; each row carries `qversion` and only the columns its version has */
  main: Row[];
  /** union of the main-file columns across versions, newer questions slotted in after their neighbours */
  columns: string[];
  /** main-file columns of each questionnaire version (key = version number) */
  columnsByVersion: Record<string, string[]>;
  diagnostics: Row[];
  actions: Row[];
  comments: Row[];
  errors: Row[];
  assignmentActions: Row[];
  paradata: Row[];
  labels: Labels;
  fetchedAt: string;
}

const CACHE_DIR = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? "/tmp/gaes-cache"
  : path.join(process.cwd(), "data", "cache");

/**
 * Is this a whole zip archive? A download or cache write that was cut short (for example when the
 * serverless function is stopped at its time limit) leaves a file without the end-of-archive record;
 * unzipping such a file fails with "Array buffer allocation failed".
 */
function isCompleteZip(b: Uint8Array): boolean {
  if (b.length < 22 || b[0] !== 0x50 || b[1] !== 0x4b) return false;
  for (let i = b.length - 22, stop = Math.max(0, b.length - 66000); i >= stop; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) return true;
  }
  return false;
}

const inFlight = new Map<number, Promise<Uint8Array>>();

/** Export archive from the local cache, or downloaded once (concurrent callers share the same download). */
function cachedZip(jobId: number): Promise<Uint8Array> {
  let p = inFlight.get(jobId);
  if (!p) {
    p = fetchZip(jobId).finally(() => inFlight.delete(jobId));
    inFlight.set(jobId, p);
  }
  return p;
}

async function fetchZip(jobId: number): Promise<Uint8Array> {
  const p = path.join(CACHE_DIR, `export-${jobId}.zip`);
  const cached = await fs.readFile(p).then((b) => new Uint8Array(b), () => null);
  if (cached && isCompleteZip(cached)) return cached;
  if (cached) await fs.unlink(p).catch(() => undefined); // half-written file from an interrupted run
  {
    const bytes = await downloadJobFile(jobId);
    if (!isCompleteZip(bytes)) throw new Error(`Survey Solutions sent an incomplete file for export ${jobId} — please try again.`);
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      // write under a temporary name, then rename: readers never see a partial file
      const tmp = `${p}.${process.pid}.${Date.now()}.part`;
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, p);
      // keep the cache small: remove older zips
      const files = (await fs.readdir(CACHE_DIR)).filter((f) => f.startsWith("export-") && f.endsWith(".zip"));
      if (files.length > 8) {
        const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(CACHE_DIR, f))).mtimeMs })));
        stats.sort((a, b) => a.t - b.t);
        for (const s of stats.slice(0, stats.length - 8)) await fs.unlink(path.join(CACHE_DIR, s.f)).catch(() => undefined);
      }
    } catch {
      /* read-only FS: ignore */
    }
    return bytes;
  }
}

async function waitForJob(id: number, timeoutMs: number): Promise<SusoJob> {
  const t0 = Date.now();
  let job = await getJob(id);
  while (!(job.ExportStatus === "Completed" && job.HasExportFile) && Date.now() - t0 < timeoutMs) {
    if (job.ExportStatus === "Fail" || job.ExportStatus === "Canceled") throw new Error(`Export ${id} ${job.ExportStatus}: ${job.Error}`);
    await new Promise((r) => setTimeout(r, 2500));
    job = await getJob(id);
  }
  if (!(job.ExportStatus === "Completed" && job.HasExportFile)) throw new Error(`Export ${id} is still running — try again in a minute.`);
  return job;
}

/** Find (or create) the latest completed export of a type for a questionnaire. */
async function resolveJob(qid: string, type: ExportType): Promise<SusoJob> {
  const latest = await latestCompletedJob(qid, type);
  if (latest) return latest;
  const started = await startExport(qid, type);
  return waitForJob(started.JobId, 45000);
}

/** Column names of a tab file (works for a version that has no interviews yet). */
function headerOf(text: string): string[] {
  const nl = text.indexOf("\n");
  return (nl < 0 ? text : text.slice(0, nl)).replace(/\r$/, "").split("\t").filter(Boolean);
}

/** Union of two column lists that keeps questionnaire order: a new column goes right after its predecessor. */
export function mergeColumns(base: string[], next: string[]): string[] {
  const out = [...base];
  const have = new Set(out);
  let at = -1; // position in `out` of the last column of `next` we have seen
  for (const c of next) {
    if (have.has(c)) {
      at = out.indexOf(c);
    } else {
      out.splice(++at, 0, c);
      have.add(c);
    }
  }
  return out;
}

let memo: { key: string; data: RawExport; at: number } | null = null;
const MEMO_TTL = 60_000; // re-check Survey Solutions for newer exports at most once a minute

export interface ResolvedJobs {
  questionnaires: SusoQuestionnaire[];
  resolved: { q: SusoQuestionnaire; type: ExportType; job: SusoJob }[];
  jobs: RawExport["jobs"];
  key: string;
}

/** Cheap: find the latest completed export job for every questionnaire version (creates one if none exist). */
export async function resolveJobs(): Promise<ResolvedJobs> {
  const questionnaires = await listQuestionnaires();
  if (!questionnaires.length) throw new Error("No GAES questionnaire found in the Survey Solutions workspace.");
  const includeParadata = process.env.GAES_SKIP_PARADATA !== "1";
  const resolved = await Promise.all(
    questionnaires.flatMap((q) =>
      (["Tabular", ...(includeParadata ? ["Paradata"] : [])] as ExportType[]).map(async (type) => {
        const job = await resolveJob(q.QuestionnaireIdentity, type);
        return { q, type, job };
      })
    )
  );
  const jobs = resolved.map((r) => ({ qid: r.q.QuestionnaireIdentity, type: r.type, jobId: r.job.JobId, completed: r.job.CompleteDate }));
  const key = jobs.map((j) => `${j.type}:${j.jobId}`).sort().join(",");
  return { questionnaires, resolved, jobs, key };
}

export async function loadRawExport(opts: { force?: boolean; jobs?: ResolvedJobs } = {}): Promise<RawExport> {
  if (memo && !opts.force && !opts.jobs && Date.now() - memo.at < MEMO_TTL) return memo.data;
  const { questionnaires, resolved, jobs, key } = opts.jobs ?? (await resolveJobs());
  if (memo && memo.key === key) {
    memo.at = Date.now();
    return memo.data;
  }

  const out: RawExport = {
    questionnaires, jobs, main: [], columns: [], columnsByVersion: {}, diagnostics: [], actions: [], comments: [], errors: [], assignmentActions: [], paradata: [],
    labels: { variables: {}, values: {}, valueSets: {} }, fetchedAt: new Date().toISOString(),
  };

  // download every archive at the same time; they are then merged in version order
  const zips = await Promise.all(resolved.map((r) => cachedZip(r.job.JobId)));
  for (const [k, r] of resolved.entries()) {
    const zip = zips[k];
    const version = String(r.q.Version);
    const tag = (rows: Row[]) => rows.map((x) => ({ ...x, qversion: version }));
    if (r.type === "Tabular") {
      const mainName = `${r.q.Variable}.tab`;
      const files = unzipText(zip, (n) => n.endsWith(".tab") || n.endsWith(".do"));
      if (files[mainName]) {
        const cols = headerOf(files[mainName]);
        out.columnsByVersion[version] = cols;
        out.columns = mergeColumns(out.columns, cols);
        out.main.push(...tag(parseTab(files[mainName])));
      }
      if (files["interview__diagnostics.tab"]) out.diagnostics.push(...tag(parseTab(files["interview__diagnostics.tab"])));
      if (files["interview__actions.tab"]) out.actions.push(...tag(parseTab(files["interview__actions.tab"])));
      if (files["interview__comments.tab"]) out.comments.push(...tag(parseTab(files["interview__comments.tab"])));
      if (files["interview__errors.tab"]) out.errors.push(...tag(parseTab(files["interview__errors.tab"])));
      if (files["assignment__actions.tab"]) out.assignmentActions.push(...parseTab(files["assignment__actions.tab"]));
      const doName = `${r.q.Variable}.do`;
      if (files[doName]) {
        const l = parseDoFile(files[doName]);
        // later versions override earlier ones
        Object.assign(out.labels.variables, l.variables);
        Object.assign(out.labels.values, l.values);
        Object.assign(out.labels.valueSets, l.valueSets);
      }
    } else {
      const files = unzipText(zip, (n) => n === "paradata.tab");
      if (files["paradata.tab"]) out.paradata.push(...parseTab(files["paradata.tab"]));
    }
  }

  memo = { key, data: out, at: Date.now() };
  return out;
}

/** Kick off fresh exports (used by the Refresh button). */
export async function startFreshExports() {
  const qs = await listQuestionnaires();
  const types: ExportType[] = process.env.GAES_SKIP_PARADATA === "1" ? ["Tabular"] : ["Tabular", "Paradata"];
  const jobs = await Promise.all(qs.flatMap((q) => types.map((t) => startExport(q.QuestionnaireIdentity, t))));
  memo = null;
  return jobs.map((j) => ({ jobId: j.JobId, type: j.ExportType, status: j.ExportStatus, progress: j.Progress }));
}

export async function jobStatuses(ids: number[]) {
  const jobs = await Promise.all(ids.map((id) => getJob(id)));
  return jobs.map((j) => ({
    jobId: j.JobId, type: j.ExportType, status: j.ExportStatus, progress: j.Progress,
    done: j.ExportStatus === "Completed" && j.HasExportFile, failed: j.ExportStatus === "Fail" || j.ExportStatus === "Canceled",
    error: j.Error,
  }));
}

export function clearMemo() {
  memo = null;
}

/* ------------------------------------------------------------------ */
/* Automatic exports                                                    */
/* ------------------------------------------------------------------ */

/** Minutes after which the newest export is considered stale (env GAES_AUTO_EXPORT_MINUTES, 0 = off). */
export function autoExportMinutes(): number {
  const v = Number(process.env.GAES_AUTO_EXPORT_MINUTES ?? 30);
  return Number.isFinite(v) && v >= 0 ? v : 30;
}

const parseSusoDate = (s: string | null) => (s ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z") : NaN);

/**
 * If the newest completed export is older than the threshold, ask Survey Solutions for a fresh one
 * (without waiting for it). The next data load picks it up once it completes.
 * Rate-limited through the shared JSON store so many serverless instances don't all trigger.
 */
export async function maybeAutoExport(jobs: ResolvedJobs): Promise<{ started: boolean; ageMin: number | null; reason: string }> {
  const limit = autoExportMinutes();
  if (!limit) return { started: false, ageMin: null, reason: "disabled" };
  const newest = Math.min(...jobs.jobs.map((j) => {
    const t = parseSusoDate(j.completed);
    return Number.isFinite(t) ? (Date.now() - t) / 60000 : Infinity;
  }));
  const ageMin = Number.isFinite(newest) ? Math.round(newest) : null;
  // the oldest of the latest jobs decides (tabular and paradata must both be fresh)
  const oldest = Math.max(...jobs.jobs.map((j) => {
    const t = parseSusoDate(j.completed);
    return Number.isFinite(t) ? (Date.now() - t) / 60000 : Infinity;
  }));
  if (oldest < limit) return { started: false, ageMin, reason: "fresh" };

  const { readJson, writeJson } = await import("../store");
  const last = await readJson<{ at: string }>("auto-export").catch(() => null);
  if (last && (Date.now() - Date.parse(last.at)) / 60000 < limit) return { started: false, ageMin, reason: "recently requested" };
  await writeJson("auto-export", { at: new Date().toISOString() }).catch(() => undefined);
  try {
    await startFreshExports();
    return { started: true, ageMin, reason: "stale" };
  } catch (e) {
    console.error("[auto-export] failed", e);
    return { started: false, ageMin, reason: "error" };
  }
}
