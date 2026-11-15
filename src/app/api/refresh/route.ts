import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { jobStatuses, startFreshExports } from "@/lib/data/raw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST: start new Tabular + Paradata exports in Survey Solutions. */
export async function POST() {
  const s = await getSession();
  if (!s || s.role === "viewer") return NextResponse.json({ error: "Supervisors and admins can refresh data" }, { status: 403 });
  try {
    return NextResponse.json({ jobs: await startFreshExports() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** GET ?jobs=1,2: poll export job status. */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("jobs") || "")
    .split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 20);
  if (!ids.length) return NextResponse.json({ error: "No job ids" }, { status: 400 });
  try {
    const jobs = await jobStatuses(ids);
    return NextResponse.json({ jobs, done: jobs.every((j) => j.done), failed: jobs.some((j) => j.failed) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
