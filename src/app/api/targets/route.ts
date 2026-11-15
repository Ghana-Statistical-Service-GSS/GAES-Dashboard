import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { readJson, writeJson } from "@/lib/store";
import { invalidateDataset, type UploadedTargets } from "@/lib/data/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (o: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const n = Math.round(Number(v));
    if (k && Number.isFinite(n) && n > 0 && n < 1e6) out[k.trim().toUpperCase()] = n;
  }
  return out;
};

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json((await readJson<UploadedTargets>("targets")) ?? { byRegion: {}, bySection: {} });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const doc: UploadedTargets = { byRegion: clean(b.byRegion), bySection: clean(b.bySection), updatedAt: new Date().toISOString(), updatedBy: s.username };
  await writeJson("targets", doc);
  invalidateDataset();
  return NextResponse.json({ ok: true, targets: doc });
}
