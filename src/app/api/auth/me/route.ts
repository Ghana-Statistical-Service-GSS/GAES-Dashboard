import { getSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export async function GET() {
  const s = await getSession();
  return s ? Response.json(s) : Response.json({ error: "Not signed in" }, { status: 401 });
}
