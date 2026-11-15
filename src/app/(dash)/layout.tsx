import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-session";
import Shell from "@/components/shell/Shell";
import { DataProvider } from "@/components/data/DataProvider";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <DataProvider session={session}>
      <Shell session={session}>{children}</Shell>
    </DataProvider>
  );
}
