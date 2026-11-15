import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { getDataset, lastSteps } from "@/lib/data/process";
import { viewFor } from "@/lib/data/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1" && s.role !== "viewer";
  try {
    const data = await getDataset({ force });
    return NextResponse.json(viewFor(data, s), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/data]", e);
    const err = e as Error;
    return NextResponse.json({
      error: err.message || "Could not load data from Survey Solutions",
      // where the time went and where it failed (no data, no credentials) — admins only
      ...(s.role === "admin" ? { steps: lastSteps, where: (err.stack || "").split("\n").slice(1, 5).map((l) => l.trim().replace(/\(.*[\\/]/, "(")) } : {}),
    }, { status: 502 });
  }
}
