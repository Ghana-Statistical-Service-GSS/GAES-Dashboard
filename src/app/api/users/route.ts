import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";
import {
  USERNAME_RE, bootstrapAdmin, hashPassword, readUsers, storageInfo, toPublic, writeUsers,
  type Role, type StoredUser,
} from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["admin", "supervisor", "viewer"];

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return s;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function cleanRegions(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 32) : [];
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return bad("Admins only", 403);
  const doc = await readUsers();
  const url = new URL(req.url);
  if (url.searchParams.get("export") === "1") {
    // Full backup including password hashes (never plain passwords)
    return new Response(JSON.stringify(doc.users, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="users.json"`,
      },
    });
  }
  return NextResponse.json({
    users: doc.users.map(toPublic),
    bootstrap: bootstrapAdmin(),
    storage: storageInfo(),
    updatedAt: doc.updatedAt,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return bad("Admins only", 403);
  const b = await req.json().catch(() => ({}));

  // Import a backup: { import: StoredUser[] }
  if (Array.isArray(b.import)) {
    const valid = (b.import as StoredUser[]).filter(
      (u) => u && USERNAME_RE.test(u.username) && u.salt && u.hash && ROLES.includes(u.role)
    );
    const doc = await readUsers();
    const map = new Map(doc.users.map((u) => [u.username, u]));
    for (const u of valid) map.set(u.username, { ...u, regions: cleanRegions(u.regions) });
    doc.users = [...map.values()];
    await writeUsers(doc);
    return NextResponse.json({ ok: true, imported: valid.length });
  }

  const username = String(b.username || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  const password = String(b.password || "");
  const role = String(b.role || "viewer") as Role;
  if (!USERNAME_RE.test(username)) return bad("Username must be 3–32 characters: letters, numbers, dot, dash or underscore");
  if (!name) return bad("Enter the person's full name");
  if (password.length < 8) return bad("Password must be at least 8 characters");
  if (!ROLES.includes(role)) return bad("Unknown role");
  if (bootstrapAdmin()?.username === username) return bad("That username is reserved for the system administrator");

  const doc = await readUsers();
  if (doc.users.some((u) => u.username === username)) return bad("That username already exists", 409);
  const { salt, hash } = hashPassword(password);
  const user: StoredUser = {
    username, name, role,
    email: b.email ? String(b.email).trim() : undefined,
    regions: cleanRegions(b.regions),
    salt, hash, active: true,
    createdAt: new Date().toISOString(),
    createdBy: admin.username,
  };
  doc.users.push(user);
  await writeUsers(doc);
  return NextResponse.json({ ok: true, user: toPublic(user) });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return bad("Admins only", 403);
  const b = await req.json().catch(() => ({}));
  const username = String(b.username || "").trim().toLowerCase();
  const doc = await readUsers();
  const u = doc.users.find((x) => x.username === username);
  if (!u) return bad("User not found", 404);
  if (b.name !== undefined) u.name = String(b.name).trim() || u.name;
  if (b.email !== undefined) u.email = String(b.email).trim() || undefined;
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return bad("Unknown role");
    u.role = b.role;
  }
  if (b.regions !== undefined) u.regions = cleanRegions(b.regions);
  if (b.active !== undefined) u.active = Boolean(b.active);
  if (b.password) {
    if (String(b.password).length < 8) return bad("Password must be at least 8 characters");
    Object.assign(u, hashPassword(String(b.password)));
  }
  if (u.username === admin.username && (u.role !== "admin" || !u.active)) {
    return bad("You cannot remove your own admin access");
  }
  u.updatedAt = new Date().toISOString();
  await writeUsers(doc);
  return NextResponse.json({ ok: true, user: toPublic(u) });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return bad("Admins only", 403);
  const username = new URL(req.url).searchParams.get("username")?.toLowerCase() || "";
  if (username === admin.username) return bad("You cannot delete your own account");
  const doc = await readUsers();
  const before = doc.users.length;
  doc.users = doc.users.filter((u) => u.username !== username);
  if (doc.users.length === before) return bad("User not found", 404);
  await writeUsers(doc);
  return NextResponse.json({ ok: true });
}
