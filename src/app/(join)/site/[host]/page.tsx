import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clubWebsite, slugForDomain } from "@/data/website";
import { ClubSite } from "../../c/[slug]/ClubSite";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const slug = await slugForDomain((await params).host);
  const w = slug ? await clubWebsite(slug).catch(() => null) : null;
  return w ? { title: { absolute: w.clubName } } : { title: "Club" };
}

/** A club's website on its own domain (see src/middleware.ts). */
export default async function DomainHome({ params }: { params: Promise<{ host: string }> }) {
  const slug = await slugForDomain((await params).host);
  const w = slug ? await clubWebsite(slug) : null;
  if (!w) notFound();
  return <ClubSite w={w} />;
}
