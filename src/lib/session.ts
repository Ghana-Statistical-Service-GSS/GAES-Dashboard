import { SignJWT, jwtVerify } from "jose";

/** Edge/Node-safe session helpers (used by proxy.ts and route handlers). */

export const SESSION_COOKIE = "gaes_session";
export const SESSION_HOURS = 12;

export interface Session {
  username: string;
  name: string;
  role: "admin" | "supervisor" | "viewer";
  regions: string[];
}

function secret() {
  const s = process.env.AUTH_SECRET || process.env.SUSO_PASSWORD || "";
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      username: String(payload.username),
      name: String(payload.name ?? payload.username),
      role: (payload.role as Session["role"]) ?? "viewer",
      regions: Array.isArray(payload.regions) ? (payload.regions as string[]) : [],
    };
  } catch {
    return null;
  }
}
