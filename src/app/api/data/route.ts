import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { getDataset } from "@/lib/data/process";
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
    return NextResponse.json({ error: (e as Error).message || "Could not load data from Survey Solutions" }, { status: 502 });
  }
}
