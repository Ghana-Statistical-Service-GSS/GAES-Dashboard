import { NextResponse } from "next/server";
import { authenticate } from "@/lib/users";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const username = String(body.username || "");
  const password = String(body.password || "");
  if (!username || !password) return NextResponse.json({ error: "Enter your username and password" }, { status: 400 });

  const user = await authenticate(username, password);
  if (!user) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }
  const token = await signSession({ username: user.username, name: user.name, role: user.role, regions: user.regions });
  const res = NextResponse.json({ ok: true, user: { username: user.username, name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}
