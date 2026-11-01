import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActor } from "@/auth/session";
import { certificates } from "@/data/events";
import { PrintButton } from "../../signup-poster/PrintButton";

export const metadata: Metadata = { title: "Certificates" };

const BELT: Record<string, string> = {
  white: "#f2f2f2", yellow: "#f5c400", green: "#2e8b3d", blue: "#1f4fbf", red: "#c8102e", black: "#111111",
  orange: "#f28c28", purple: "#6b3fa0", brown: "#7a4a21", grey: "#8e8e93",
};
/** Belt colour names can be compound ("yellow-tag", "red-black"); the stripe shows each part. */
const stripes = (c: string) => c.split(/[-\s/]+/).map((x) => BELT[x.toLowerCase()]).filter(Boolean);
const WORD: Record<string, string> = { pass: "", merit: "with merit", distinction: "with distinction" };

/** One A4 landscape certificate per student who passed. */
export default async function Certificates({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const c = await certificates(actor, (await params).id).catch(() => null);
  if (!c) notFound();
  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        body { background: #f5f5f7; margin: 0; }
        .bar { max-width: 297mm; margin: 24px auto 0; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; font-family: var(--font-sans); }
        .cert { width: 297mm; height: 210mm; margin: 24px auto; background: #fff; color: #1d1d1f; box-sizing: border-box; padding: 16mm; box-shadow: 0 2px 24px rgba(0,0,0,.08); page-break-after: always; break-after: page; font-family: var(--font-sans); }
        .frame { height: 100%; box-sizing: border-box; border: 1.2mm solid #1d1d1f; outline: 0.4mm solid #1d1d1f; outline-offset: -3.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 12mm 20mm; }
        .club { font-size: 16pt; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6e6e73; margin: 0; }
        .title { font-size: 40pt; font-weight: 700; letter-spacing: -0.02em; margin: 8mm 0 0; }
        .lead { font-size: 15pt; color: #424245; margin: 8mm 0 0; }
        .name { font-size: 44pt; font-weight: 700; letter-spacing: -0.03em; margin: 3mm 0 0; line-height: 1.05; }
        .grade { font-size: 22pt; font-weight: 600; margin: 6mm 0 0; }
        .belt { display: flex; width: 120mm; height: 7mm; margin: 6mm auto 0; border-radius: 1.5mm; overflow: hidden; border: 0.3mm solid #d2d2d7; }
        .belt span { flex: 1; }
        .foot { display: flex; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 10mm; font-size: 11pt; color: #424245; }
        .sign { border-top: 0.3mm solid #1d1d1f; padding-top: 2mm; min-width: 70mm; text-align: center; }
        @media print { .bar { display: none; } body { background: #fff; } .cert { margin: 0; box-shadow: none; } }
        @media screen and (max-width: 1150px) { .cert { width: 100%; height: auto; aspect-ratio: 297 / 210; } }
      `}</style>
      <div className="bar">
        <span>{c.people.length} {c.people.length === 1 ? "certificate" : "certificates"} · print on A4, landscape</span>
        <PrintButton />
      </div>
      {c.people.map((p) => {
        const cols = stripes(p.beltColour);
        return (
          <section key={p.name} className="cert">
            <div className="frame">
              <p className="club">{c.clubName}</p>
              <p className="title">Certificate of Grading</p>
              <p className="lead">This is to certify that</p>
              <p className="name">{p.name}</p>
              <p className="lead">has been awarded the grade of</p>
              <p className="grade">{p.grade}{c.art ? ` in ${c.art}` : ""}{WORD[p.outcome] ? `, ${WORD[p.outcome]}` : ""}</p>
              {cols.length > 0 && <div className="belt" aria-hidden="true">{cols.map((col, i) => <span key={i} style={{ background: col }} />)}</div>}
              <div className="foot">
                <span className="sign">{c.date}<br />Date</span>
                <span className="sign">{c.examiner ?? " "}<br />Examiner</span>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
