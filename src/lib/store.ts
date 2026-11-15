import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Tiny JSON document store — no database.
 *  - Netlify:  Netlify Blobs (automatic)                 key "<name>.json"
 *  - Vercel:   Vercel Blob when BLOB_READ_WRITE_TOKEN set  "gaes/<name>.json" (private)
 *  - Local:    ./data/<name>.json
 *  - Read-only serverless without blob storage: /tmp (not persistent)
 */

export type StorageKind = "netlify-blobs" | "vercel-blob" | "file" | "tmp-file";

export function storageKind(): StorageKind {
  const forced = process.env.GAES_STORAGE as StorageKind | undefined;
  if (forced && ["netlify-blobs", "vercel-blob", "file", "tmp-file"].includes(forced)) return forced;
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_LOCAL || (process.env.SITE_ID && process.env.DEPLOY_ID)) return "netlify-blobs";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return "tmp-file";
  return "file";
}

function filePath(kind: StorageKind, name: string) {
  return kind === "tmp-file" ? path.join("/tmp", `gaes-${name}.json`) : path.join(process.cwd(), "data", `${name}.json`);
}

/** Reject when storage does not answer in time, so a stalled store never hangs a request until the platform kills it. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
const STORE_TIMEOUT_MS = 8000;
/** Keys known to exist in Netlify Blobs (per server instance). */
const knownKeys = new Set<string>();

export async function readJson<T>(name: string): Promise<T | null> {
  const kind = storageKind();
  const t0 = Date.now();
  try {
    if (kind === "netlify-blobs") {
      const { getStore } = await import("@netlify/blobs");
      const key = `${name}.json`;
      // Reading a key that does not exist never returns on this platform (it hangs until the function
      // is stopped), so look the key up in the store's listing first. Listing is fast and reliable.
      if (!knownKeys.has(key)) {
        const { blobs } = await withTimeout(getStore({ name: "gaes-dashboard" }).list(), 5000, "Netlify Blobs list");
        for (const b of blobs) knownKeys.add(b.key);
        if (!knownKeys.has(key)) return null;
      }
      const get = (mode: "strong" | "eventual", ms: number) =>
        withTimeout(getStore({ name: "gaes-dashboard", consistency: mode }).get(key, { type: "json" }), ms, `Netlify Blobs ${mode} read ${name}`) as Promise<T | null>;
      let v: T | null;
      try {
        v = await get("strong", 5000); // always the latest write
      } catch (e) {
        console.warn(`[store] strong read of ${name} failed (${(e as Error).message}); trying the edge-cached copy`);
        v = await get("eventual", 5000);
      }
      if (Date.now() - t0 > 2000) console.warn(`[store] read ${name} took ${Date.now() - t0} ms`);
      return v ?? null;
    }
    if (kind === "vercel-blob") {
      const { get } = await import("@vercel/blob");
      const res = await get(`gaes/${name}.json`, { access: "private" }).catch(() => null);
      if (res && res.statusCode === 200) return JSON.parse(await new Response(res.stream).text()) as T;
      return null;
    }
    const raw = await fs.readFile(filePath(kind, name), "utf8").catch(() => null);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`[store] read ${name} failed after ${Date.now() - t0} ms (storage: ${kind})`, e);
    return null;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  const kind = storageKind();
  const body = JSON.stringify(value, null, 2);
  if (kind === "netlify-blobs") {
    const { getStore } = await import("@netlify/blobs");
    await withTimeout(getStore({ name: "gaes-dashboard" }).set(`${name}.json`, body), STORE_TIMEOUT_MS, `Netlify Blobs write ${name}`);
    knownKeys.add(`${name}.json`);
    return;
  }
  if (kind === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    await put(`gaes/${name}.json`, body, {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
    return;
  }
  const p = filePath(kind, name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body, "utf8");
}

/** Admin diagnostics: how the store answers right now (timings and errors only, no content). */
export async function storeDiagnostics(): Promise<Record<string, unknown>> {
  const kind = storageKind();
  const out: Record<string, unknown> = { kind, knownKeys: [...knownKeys] };
  if (kind !== "netlify-blobs") return out;
  const { getStore } = await import("@netlify/blobs");
  const probe = async (label: string, f: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const v = await withTimeout(f(), 6000, label);
      out[label] = { ms: Date.now() - t0, result: v === null || v === undefined ? "empty" : typeof v === "string" ? `${v.length} chars` : "ok" };
    } catch (e) {
      out[label] = { ms: Date.now() - t0, error: (e as Error).message };
    }
  };
  await Promise.all([
    ...(["strong", "eventual"] as const).flatMap((mode) => ["users", "targets", "dataset-cache"].map((n) =>
      probe(`${mode} read ${n}`, () => getStore({ name: "gaes-dashboard", consistency: mode }).get(`${n}.json`, { type: "text" })))),
    probe("list keys", async () => (await getStore({ name: "gaes-dashboard" }).list()).blobs.map((b) => b.key).join(",") || null),
    probe("remove old probe key", async () => { await getStore({ name: "gaes-dashboard" }).delete("probe.json"); return "ok"; }),
  ]);
  return out;
}
