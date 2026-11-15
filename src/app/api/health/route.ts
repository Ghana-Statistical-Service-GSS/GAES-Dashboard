import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import { storeDiagnostics } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness check. Signed-in admins can add ?store=1 to see how the JSON store is answering. */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("store") === "1") {
    const s = await getSession();
    if (s?.role === "admin") return NextResponse.json({ ok: true, store: await storeDiagnostics() }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true });
}
