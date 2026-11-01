import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentActor } from "@/auth/session";
import { clubWebsite } from "@/data/website";
import { ClubSite } from "./ClubSite";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const w = await clubWebsite((await params).slug).catch(() => null);
  if (!w) return { title: "Club" };
  const hero = w.sections.find((x) => x.type === "hero");
  return { title: { absolute: w.clubName }, description: (hero && "text" in hero && hero.text) || `${w.arts.join(", ")} classes. Book a free trial.` };
}

/** The club's public page. ?draft=1 shows the owner their unpublished changes. */
export default async function ClubPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ draft?: string }> }) {
  const [{ slug }, { draft }] = await Promise.all([params, searchParams]);
  const w = await clubWebsite(slug, { preview: (await currentActor()) ?? undefined, draft: draft === "1" });
  if (!w) notFound();
  return <ClubSite w={w} />;
}
