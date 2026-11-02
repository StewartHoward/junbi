import { featureFlags, requireFeature } from "@/data/features";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clubWebsite, slugForDomain } from "@/data/website";
import { ClubSite } from "../../c/[slug]/ClubSite";
import { clubMetadata, clubStructuredData } from "../../c/[slug]/clubMeta";
import { jsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const slug = await slugForDomain((await params).host);
  const w = slug ? await clubWebsite(slug).catch(() => null) : null;
  return w ? clubMetadata(w) : { title: "Club", robots: { index: false, follow: false } };
}

/** A club's website on its own domain (see src/middleware.ts). */
export default async function DomainHome({ params }: { params: Promise<{ host: string }> }) {
  await requireFeature("website");
  const slug = await slugForDomain((await params).host);
  const w = slug ? await clubWebsite(slug) : null;
  if (!w) notFound();
  const on = await featureFlags();
  const site = { ...w, shopUrl: on.shop ? w.shopUrl : null, familyUrl: on.family ? w.familyUrl : null };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(clubStructuredData(w))} />
      <ClubSite w={site} />
    </>
  );
}
