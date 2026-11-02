import { canSeeEvents } from "@/data/events";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { Sidebar } from "@/components/Sidebar";
import { visibleSiteList } from "@/data/club";
import { billingGate } from "@/data/billing";
import { redirect } from "next/navigation";
import { featureFlags } from "@/data/features";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  // Club owners add a card for Junbi before using it (nothing is taken until the trial ends).
  if (await billingGate(actor)) redirect("/billing");
  const on = await featureFlags();
  const links = [
    { href: "/today", label: "Dashboard" },
    ...(can(actor, "students.view") ? [{ href: "/students", label: "Students" }, { href: "/leads", label: "Leads" }] : []),
    { href: "/classes", label: "Classes" },
    ...(on.events && canSeeEvents(actor) ? [{ href: "/events", label: "Gradings" }] : []),
    ...(can(actor, "messages.send") ? [{ href: "/messages", label: "Messages" }] : []),
    ...(can(actor, "payments.view") ? [{ href: "/payments", label: "Payments" }] : []),
    ...(on.shop && can(actor, "payments.manage") ? [{ href: "/shop", label: "Shop" }] : []),
    ...(on.website && can(actor, "club.manage") ? [{ href: "/website", label: "Website" }] : []),
    ...(can(actor, "club.manage") || can(actor, "classes.manage") ? [{ href: "/settings", label: "Settings" }] : []),
  ];
  const sites = await visibleSiteList(actor);
  return (
    <div className="shell">
      <Sidebar clubName={actor.clubName} clubId={actor.clubId} clubs={actor.clubs} sites={sites.map((x) => x.name)} userName={actor.userName} role={actor.role} links={links} />
      <main className="main">{children}</main>
    </div>
  );
}
