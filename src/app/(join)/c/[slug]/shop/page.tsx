import type { Metadata } from "next";
import { shopPage } from "@/data/shop";
import { ShopForm } from "./ShopForm";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await shopPage((await params).slug);
  if (!p) return { title: "Shop", robots: { index: false, follow: false } };
  const description = `Uniforms, kit and more from ${p.clubName}. Order online${p.card ? " and pay by card" : ""}.`;
  return { title: { absolute: `${p.clubName} shop` }, description, alternates: { canonical: `/c/${(await params).slug}/shop` }, openGraph: { title: `${p.clubName} shop`, description, siteName: p.clubName, type: "website", locale: "en_GB" } };
}

export default async function ClubShop({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await shopPage(slug);
  if (!page) {
    return (
      <div className="m-auth">
        <h1>The shop isn&apos;t open.</h1>
        <p className="m-sub" style={{ fontSize: 19 }}>Ask the club what&apos;s available.</p>
      </div>
    );
  }
  return (
    <div className="m-auth" style={{ maxWidth: 640 }}>
      <p className="m-eyebrow">{page.clubName}</p>
      <h1>Club shop.</h1>
      <p className="m-sub" style={{ fontSize: 19 }}>Uniforms, kit and more. {page.card ? "Pay by card and pick it up at the club." : "Order here and pay at the club."}</p>
      <ShopForm slug={slug} page={page} />
    </div>
  );
}
