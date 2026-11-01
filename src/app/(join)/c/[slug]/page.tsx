import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentActor } from "@/auth/session";
import { clubWebsite } from "@/data/website";
import { ClubSite } from "./ClubSite";
import { clubMetadata, clubStructuredData } from "./clubMeta";
import { jsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const w = await clubWebsite((await params).slug).catch(() => null);
  return w ? clubMetadata(w) : { title: "Club", robots: { index: false, follow: false } };
}

/** The club's public page. ?draft=1 shows the owner their unpublished changes. */
export default async function ClubPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ draft?: string }> }) {
  const [{ slug }, { draft }] = await Promise.all([params, searchParams]);
  const w = await clubWebsite(slug, { preview: (await currentActor()) ?? undefined, draft: draft === "1" });
  if (!w) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(clubStructuredData(w))} />
      <ClubSite w={w} />
    </>
  );
}
