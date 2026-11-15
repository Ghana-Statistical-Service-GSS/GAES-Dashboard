import { getSession } from "@/lib/server-session";
import UsersClient from "./UsersClient";

export const metadata = { title: "Users · GAES 2026 Dashboard" };

export default async function UsersPage() {
  const s = await getSession();
  return <UsersClient me={s?.username ?? ""} />;
}
