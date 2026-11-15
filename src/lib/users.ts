import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, storageKind, writeJson, type StorageKind } from "./store";

/**
 * User store persisted as a single JSON document (no database).
 *  - Netlify:  Netlify Blobs (automatic, no setup)          -> key "users.json"
 *  - Vercel:   Vercel Blob (set BLOB_READ_WRITE_TOKEN)      -> "gaes/users.json" (private)
 *  - Local / self-hosted: ./data/users.json
 * The bootstrap admin from ADMIN_USERNAME / ADMIN_PASSWORD can always sign in (recovery account).
 */

export type Role = "admin" | "supervisor" | "viewer";

export interface StoredUser {
  username: string;
  name: string;
  email?: string;
  role: Role;
  /** Region names the user may see. Empty = all regions. */
  regions: string[];
  salt: string;
  hash: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export type PublicUser = Omit<StoredUser, "salt" | "hash">;

export interface UsersDoc {
  version: 1;
  updatedAt: string;
  users: StoredUser[];
}

export type { StorageKind } from "./store";

function emptyDoc(): UsersDoc {
  return { version: 1, updatedAt: new Date().toISOString(), users: [] };
}

async function readSeed(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "users.seed.json"), "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function readUsers(): Promise<UsersDoc> {
  let doc = await readJson<UsersDoc>("users");
  if (!doc || !Array.isArray(doc.users)) {
    doc = emptyDoc();
    doc.users = await readSeed();
  }
  return doc;
}

export async function writeUsers(doc: UsersDoc): Promise<void> {
  doc.updatedAt = new Date().toISOString();
  await writeJson("users", doc);
}

export function storageInfo(): { kind: StorageKind; persistent: boolean; note: string } {
  const kind = storageKind();
  const notes: Record<StorageKind, string> = {
    "netlify-blobs": "Users are saved as users.json in Netlify Blobs (persistent).",
    "vercel-blob": "Users are saved as users.json in Vercel Blob storage (persistent, private).",
    file: "Users are saved to data/users.json on this server.",
    "tmp-file":
      "This serverless host has a read-only disk, so users are held in temporary storage and may reset. On Vercel, add a Blob store (BLOB_READ_WRITE_TOKEN) — or export users.json and commit it as data/users.seed.json.",
  };
  return { kind, persistent: kind !== "tmp-file", note: notes[kind] };
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const a = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function toPublic(u: StoredUser): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { salt, hash, ...rest } = u;
  return rest;
}

export function bootstrapAdmin(): PublicUser | null {
  const username = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (!username || !process.env.ADMIN_PASSWORD) return null;
  return {
    username,
    name: "System Administrator",
    role: "admin",
    regions: [],
    active: true,
    createdAt: "env",
    createdBy: "env",
  };
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Validate credentials. Returns the user (without secrets) or null. */
export async function authenticate(usernameRaw: string, password: string): Promise<PublicUser | null> {
  const username = usernameRaw.trim().toLowerCase();
  const doc = await readUsers();
  const u = doc.users.find((x) => x.username === username);
  if (u) {
    if (!u.active || !verifyPassword(password, u.salt, u.hash)) return null;
    u.lastLoginAt = new Date().toISOString();
    await writeUsers(doc).catch(() => undefined);
    return toPublic(u);
  }
  const boot = bootstrapAdmin();
  if (boot && username === boot.username && safeEqual(password, process.env.ADMIN_PASSWORD || "")) return boot;
  return null;
}

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
