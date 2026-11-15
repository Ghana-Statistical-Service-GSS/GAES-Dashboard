import "server-only";
import { unzipSync, strFromU8 } from "fflate";

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
  });
  if (!res.ok) throw new Error(`Download of export ${id} failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Unzip an export archive and return text files (tab / json / do / txt) keyed by file name. */
export function unzipText(zip: Uint8Array, keep: (name: string) => boolean): Record<string, string> {
  const files = unzipSync(zip, { filter: (f) => keep(f.name) });
  const out: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    out[name] = strFromU8(data).replace(/^﻿/, "");
  }
  return out;
}

export function unzipBinary(zip: Uint8Array, name: string): Uint8Array | null {
  const files = unzipSync(zip, { filter: (f) => f.name === name });
  return files[name] ?? null;
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
