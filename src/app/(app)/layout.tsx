import { requireActor } from "@/auth/session";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return (
    <div className="shell">
      <Sidebar clubName={actor.clubName} userName={actor.userName} role={actor.role} />
      <main className="main">{children}</main>
    </div>
  );
}
