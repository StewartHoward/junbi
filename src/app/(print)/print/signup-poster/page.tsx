import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth/session";
import { can } from "@/auth/permissions";
import { joinLink } from "@/data/join";
import { qrSvg } from "@/lib/qr";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Sign-up poster" };

export default async function SignupPoster() {
  const actor = await requireActor();
  if (!can(actor, "students.edit")) redirect("/students");
  const url = await joinLink(actor);
  const svg = await qrSvg(url);
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        body { background: var(--surface, #f5f5f7); }
        .poster { width: 210mm; min-height: 297mm; margin: 24px auto; background: #fff; color: #1d1d1f; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24mm 20mm; box-sizing: border-box; box-shadow: 0 2px 24px rgba(0,0,0,.08); }
        .poster .club { font-size: 22pt; font-weight: 600; letter-spacing: -0.01em; color: #6e6e73; margin: 0; }
        .poster h1 { font-size: 54pt; line-height: 1.02; letter-spacing: -0.035em; margin: 10mm 0 0; font-weight: 700; }
        .poster .sub { font-size: 18pt; color: #424245; margin: 6mm 0 0; max-width: 150mm; }
        .poster .qr { width: 120mm; height: 120mm; margin: 14mm 0 0; }
        .poster .qr svg { width: 100%; height: 100%; display: block; }
        .poster .steps { font-size: 14pt; color: #424245; margin: 10mm 0 0; }
        .poster .foot { font-size: 10pt; color: #86868b; margin-top: auto; padding-top: 12mm; }
        .bar { max-width: 210mm; margin: 24px auto 0; display: flex; gap: 12px; justify-content: space-between; align-items: center; padding: 0 8px; }
        @media print { .bar { display: none; } body { background: #fff; } .poster { margin: 0; box-shadow: none; } }
        @media screen and (max-width: 760px) { .poster { width: 100%; min-height: auto; margin: 16px 0; padding: 32px 20px; } .poster h1 { font-size: 40px; } .poster .sub, .poster .club { font-size: 18px; } .poster .qr { width: 80vw; height: 80vw; } }
      `}</style>
      <div className="bar">
        <a href="/students">← Back to students</a>
        <PrintButton />
      </div>
      <main className="poster">
        <p className="club">{actor.clubName}</p>
        <h1>Scan to sign up.</h1>
        <p className="sub">Register your child, or yourself, in about two minutes.</p>
        <div className="qr" role="img" aria-label="QR code for the sign-up form" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="steps">Open your phone camera and point it at the code.</p>
        <p className="foot">Club sign-up by junbi</p>
      </main>
    </>
  );
}
