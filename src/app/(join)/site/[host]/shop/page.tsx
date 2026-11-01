import { notFound, redirect } from "next/navigation";
import { slugForDomain } from "@/data/website";
import { appUrl } from "@/lib/email";

/** The shop on a club's own domain goes to its Junbi shop page, where card payments are set up. */
export default async function DomainShop({ params }: { params: Promise<{ host: string }> }) {
  const slug = await slugForDomain((await params).host);
  if (!slug) notFound();
  redirect(`${await appUrl()}/c/${slug}/shop`);
}
