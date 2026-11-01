import { joinForm } from "@/data/join";
import { OG_SIZE, OG_TYPE, shareImage } from "@/lib/og";

export const alt = "Sign up to the club";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** Clubs share their sign-up link on WhatsApp and Facebook, so it gets a card with the club's name. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const f = await joinForm((await params).token).catch(() => null);
  return shareImage({ eyebrow: "Sign up online", title: f ? `Join ${f.clubName}` : "Join the club", subtitle: "Takes about two minutes. Your details go straight to the club.", footer: f?.clubName ?? "junbi.co.uk" });
}
