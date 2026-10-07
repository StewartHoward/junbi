import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const links = [
    { href: "/today", label: "Today" },
    ...(can(actor, "students.view") ? [{ href: "/students", label: "Students" }] : []),
    { href: "/classes", label: "Classes" },
    ...(can(actor, "club.manage") || can(actor, "classes.manage") ? [{ href: "/settings", label: "Settings" }] : []),
  ];
  return (
    <div className="shell">
      <Sidebar clubName={actor.clubName} userName={actor.userName} role={actor.role} links={links} />
      <main className="main">{children}</main>
    </div>
  );
}
