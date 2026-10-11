import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { Sidebar } from "@/components/Sidebar";
import { visibleSiteList } from "@/data/club";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const links = [
    { href: "/today", label: "Dashboard" },
    ...(can(actor, "students.view") ? [{ href: "/students", label: "Students" }, { href: "/leads", label: "Leads" }] : []),
    { href: "/classes", label: "Classes" },
    ...(can(actor, "messages.send") ? [{ href: "/messages", label: "Messages" }] : []),
    ...(can(actor, "payments.view") ? [{ href: "/payments", label: "Payments" }] : []),
    ...(can(actor, "club.manage") || can(actor, "classes.manage") ? [{ href: "/settings", label: "Settings" }] : []),
  ];
  const sites = await visibleSiteList(actor);
  return (
    <div className="shell">
      <Sidebar clubName={actor.clubName} sites={sites.map((x) => x.name)} userName={actor.userName} role={actor.role} links={links} />
      <main className="main">{children}</main>
    </div>
  );
}
