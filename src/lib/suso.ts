import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Survey Solutions Headquarters API client (export API v2).
 * Docs: https://docs.mysurvey.solutions/headquarters/api/api-for-data-export/
 */

export type ExportType = "Tabular" | "Paradata";

export interface SusoJob {
  JobId: number;
  ExportStatus: "Created" | "Running" | "Completed" | "Fail" | "Canceled" | string;
  StartDate: string | null;
  CompleteDate: string | null;
  CreateDate: string | null;
  Progress: number;
  ETA: string | null;
  Error: string;
  HasExportFile: boolean;
  ExportType: string;
  QuestionnaireId: string;
  InterviewStatus: string;
}

export interface SusoQuestionnaire {
  QuestionnaireIdentity: string;
  QuestionnaireId: string;
  Version: number;
  Title: string;
  Variable: string;
  LastEntryDate: string | null;
}

function cfg() {
  const url = (process.env.SUSO_URL || "").replace(/\/+$/, "");
  const workspace = process.env.SUSO_WORKSPACE || "primary";
  const user = process.env.SUSO_USER || "";
  const password = process.env.SUSO_PASSWORD || "";
  if (!url || !user || !password) {
    throw new Error(
      "Survey Solutions credentials are not configured. Set SUSO_URL, SUSO_WORKSPACE, SUSO_USER and SUSO_PASSWORD."
    );
  }
  return {
    url,
    workspace,
    auth: "Basic " + Buffer.from(`${user}:${password}`).toString("base64"),
    variable: process.env.SUSO_QUESTIONNAIRE_VARIABLE || "",
  };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = cfg();
  const res = await fetch(`${c.url}/${c.workspace}${path}`, {
    ...init,
    headers: {
      Authorization: c.auth,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Survey Solutions API ${res.status} on ${path}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** All versions of the GAES questionnaire in the workspace. */
export async function listQuestionnaires(): Promise<SusoQuestionnaire[]> {
  const c = cfg();
  const out: SusoQuestionnaire[] = [];
  for (let offset = 1; offset < 50; offset++) {
    const page = await api<{ Questionnaires: SusoQuestionnaire[]; TotalCount: number }>(
      `/api/v1/questionnaires?limit=40&offset=${offset}`
    );
    out.push(...page.Questionnaires);
    if (out.length >= page.TotalCount || page.Questionnaires.length === 0) break;
  }
  const filtered = c.variable ? out.filter((q) => q.Variable === c.variable) : out;
  return filtered.sort((a, b) => a.Version - b.Version);
}

export async function startExport(qid: string, type: ExportType): Promise<SusoJob> {
  return api<SusoJob>(`/api/v2/export`, {
    method: "POST",
    body: JSON.stringify({ ExportType: type, QuestionnaireId: qid, InterviewStatus: "All" }),
  });
}

export async function getJob(id: number): Promise<SusoJob> {
  return api<SusoJob>(`/api/v2/export/${id}`);
}

export async function latestCompletedJob(qid: string, type: ExportType): Promise<SusoJob | null> {
  const q = new URLSearchParams({
    exportType: type,
    interviewStatus: "All",
    questionnaireIdentity: qid,
    exportStatus: "Completed",
    hasFile: "true",
  });
  const jobs = await api<SusoJob[]>(`/api/v2/export?${q.toString()}`);
  if (!jobs.length) return null;
  return jobs.sort((a, b) => String(b.CompleteDate).localeCompare(String(a.CompleteDate)))[0];
}

export async function downloadJobFile(id: number): Promise<Uint8Array> {
  const c = cfg();
  const res = await fetch(`${c.url}/${c.workspace}/api/v2/export/${id}/file`, {
    headers: { Authorization: c.auth },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Download of export ${id} failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/* ------------------------------------------------------------------ */
/* Unzip                                                                */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  size: number;
  offset: number;
}

/**
 * Read a zip's table of contents, including the ZIP64 fields Survey Solutions uses.
 * (Its archives store every size as the ZIP64 placeholder 0xFFFFFFFF; a reader that ignores the
 * ZIP64 extra field tries to allocate 4 GB per file and fails on hosts with limited memory.)
 */
function zipEntries(zip: Uint8Array): ZipEntry[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const u64 = (o: number) => Number(dv.getBigUint64(o, true));
  let eocd = -1;
  for (let i = zip.length - 22, stop = Math.max(0, zip.length - 66000); i >= stop; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("The export file from Survey Solutions is not a complete zip archive — please try again.");
  let count = dv.getUint16(eocd + 10, true);
  let cdOffset = dv.getUint32(eocd + 16, true);
  if (eocd >= 20 && dv.getUint32(eocd - 20, true) === 0x07064b50) {
    const z64 = u64(eocd - 20 + 8);
    if (z64 + 56 <= zip.length && dv.getUint32(z64, true) === 0x06064b50) {
      count = u64(z64 + 32);
      cdOffset = u64(z64 + 48);
    }
  }
  const dec = new TextDecoder("utf-8");
  const out: ZipEntry[] = [];
  let p = cdOffset;
  for (let k = 0; k < count && p + 46 <= zip.length && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true);
    let compSize = dv.getUint32(p + 20, true);
    let size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    let offset = dv.getUint32(p + 42, true);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    // ZIP64 extended information (id 0x0001): only the fields whose 32-bit value is the placeholder, in this order
    for (let e = p + 46 + nameLen, end = e + extraLen; e + 4 <= end; ) {
      const id = dv.getUint16(e, true);
      const len = dv.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff && q + 8 <= e + 4 + len) { size = u64(q); q += 8; }
        if (compSize === 0xffffffff && q + 8 <= e + 4 + len) { compSize = u64(q); q += 8; }
        if (offset === 0xffffffff && q + 8 <= e + 4 + len) { offset = u64(q); q += 8; }
      }
      e += 4 + len;
    }
    out.push({ name, method, compSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function zipRead(zip: Uint8Array, e: ZipEntry): Uint8Array {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  if (e.offset + 30 > zip.length || dv.getUint32(e.offset, true) !== 0x04034b50) throw new Error(`Export archive is damaged at ${e.name}`);
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  if (start + e.compSize > zip.length) throw new Error(`Export archive is cut short at ${e.name} — please try again.`);
  const data = zip.subarray(start, start + e.compSize);
  if (e.method === 0) return data;
  if (e.method !== 8) throw new Error(`Unsupported compression in export archive (${e.name})`);
  return new Uint8Array(inflateRawSync(data));
}

/** Unzip an export archive and return text files (tab / json / do / txt) keyed by file name. */
export function unzipText(zip: Uint8Array, keep: (name: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const dec = new TextDecoder("utf-8");
  for (const e of zipEntries(zip)) {
    if (!keep(e.name)) continue;
    out[e.name] = dec.decode(zipRead(zip, e)).replace(/^\uFEFF/, "");
  }
  return out;
}

export function unzipBinary(zip: Uint8Array, name: string): Uint8Array | null {
  const e = zipEntries(zip).find((x) => x.name === name);
  return e ? zipRead(zip, e) : null;
}

/** Supervisor login -> full name, from the Survey Solutions users API (no phone numbers are kept). */
export async function listSupervisorNames(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const users: { UserId: string; UserName: string }[] = [];
  for (let offset = 1; offset < 20; offset++) {
    const page = await api<{ Users: { UserId: string; UserName: string }[]; TotalCount: number }>(`/api/v1/supervisors?limit=40&offset=${offset}`);
    users.push(...page.Users);
    if (users.length >= page.TotalCount || page.Users.length === 0) break;
  }
  await Promise.all(
    users.map(async (u) => {
      try {
        const d = await api<{ UserName: string; FullName?: string | null }>(`/api/v1/supervisors/${u.UserId}`);
        const name = (d.FullName || "").trim();
        if (name) out[u.UserName.toUpperCase()] = name;
      } catch {
        /* keep the login as fallback */
      }
    })
  );
  return out;
}
