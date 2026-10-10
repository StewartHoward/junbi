import { currentActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { joinLink } from "@/data/join";
import { qrPng, qrSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** The signed-in club's sign-up QR code. ?format=png|svg, ?download=1 to save it. */
export async function GET(req: Request) {
  const actor = await currentActor();
  if (!actor || !actor.onboarded || !can(actor, "students.edit")) return new Response("Not allowed", { status: 401 });
  const q = new URL(req.url).searchParams;
  const url = await joinLink(actor);
  const slug = actor.clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "club";
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (q.get("format") === "png") {
    headers["Content-Type"] = "image/png";
    if (q.get("download")) headers["Content-Disposition"] = `attachment; filename="${slug}-sign-up-qr.png"`;
    return new Response(new Uint8Array(await qrPng(url)), { headers });
  }
  headers["Content-Type"] = "image/svg+xml";
  if (q.get("download")) headers["Content-Disposition"] = `attachment; filename="${slug}-sign-up-qr.svg"`;
  return new Response(await qrSvg(url), { headers });
}
