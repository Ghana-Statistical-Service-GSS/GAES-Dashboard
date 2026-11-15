import { NextResponse } from "next/server";
import { resolveJobs, maybeAutoExport } from "@/lib/data/raw";
import { getDataset } from "@/lib/data/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled refresh (Netlify scheduled function, Vercel Cron, or any external scheduler).
 * Requires header `Authorization: Bearer <CRON_SECRET>` (or ?key=<CRON_SECRET>).
 * 1. requests a fresh Survey Solutions export when the latest is stale
 * 2. pre-processes the newest completed export so dashboard visitors get it instantly
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key") ?? "";
  if (given !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const jobs = await resolveJobs();
    const auto = await maybeAutoExport(jobs);
    const data = await getDataset();
    return NextResponse.json({ ok: true, auto, exportedAt: data.exportedAt, interviews: data.records.length, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
