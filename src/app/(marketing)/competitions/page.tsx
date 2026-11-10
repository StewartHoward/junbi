import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Reveal } from "../Motion";
import { InterestForm } from "./InterestForm";

export const metadata: Metadata = pageMeta({
  title: "Junbi Competitions: Coming Soon",
  description: "Competition entries for martial arts clubs, coming soon. Clubs enter in minutes, every athlete lands in the right category, and hosts get live entries, waiting lists and lists for the scoring table.",
  path: "/competitions",
  ownImage: true,
});

function Icon({ d }: { d: React.ReactNode }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const FEATURES = [
  { title: "Categories, picked for you", text: "Individuals, pairs, teams, freestyle and para. Each athlete is placed by grade, gender and competition age, and wrong entries are stopped.", icon: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></> },
  { title: "Link your Junbi club", text: "Already run your club on Junbi? Link it once and your students come across with belts and dates of birth filled in.", icon: <><circle cx="9" cy="7" r="4" /><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75M23 21v-2a4 4 0 0 0-3-3.87" /></> },
  { title: "A waiting list that runs itself", text: "Set your entry limit. Once it's full, new entries wait in line and you accept them with one tap.", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  { title: "Entry fees, paid to you", text: "Clubs pay when they enter. The money goes straight to your own account, and Junbi never takes a cut.", icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></> },
  { title: "Ready for the scoring table", text: "Download category lists, athlete lists and licence checks, laid out for your scoring software.", icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></> },
  { title: "Designated poomsae, drawn", text: "Draw the poomsae for each round and publish them to every club in one go.", icon: <><path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" /></> },
];

export default function CompetitionsPage() {
  return (
    <>
      <section className="m-section m-center" style={{ paddingTop: 96 }}>
        <p className="m-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Junbi Competitions <span className="m-soon">Coming soon</span>
        </p>
        <h1 className="m-hero-title">Competitions, ready.</h1>
        <p className="m-sub">Clubs enter in minutes and every athlete lands in the right category. Hosts get live entries, payments and everything the scoring table needs.</p>
        <div className="m-actions">
          <a href="#notify" className="m-btn primary">Tell me when it&apos;s live</a>
        </div>
        <p className="m-fine">Free for every club to enter. 0% of your entry fees.</p>
      </section>

      <section className="m-section dark m-center">
        <h2 className="m-h2 xl">Free for every club to enter.</h2>
        <p className="m-sub" style={{ maxWidth: 620 }}>Any club can sign up and enter, whether it uses Junbi or not. The more clubs that can reach your event, the fuller it gets.</p>
        <p className="m-zero">£0</p>
        <p style={{ margin: "8px 0 0", fontSize: 21, color: "#a1a1a6" }}>to enter. Every competition.</p>
      </section>

      <section className="m-section alt">
        <div className="m-wrap">
          <h2 className="m-h2 m-center">The right category. Every time.</h2>
          <p className="m-sub m-center">Junbi reads each athlete&apos;s grade, gender and competition age, then puts them in the right division.</p>
          <Reveal className="m-tiles">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="m-tile" data-anim="up" style={{ "--i": i } as React.CSSProperties}>
                <Icon d={f.icon} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="m-section">
        <div className="m-wrap m-split" style={{ alignItems: "stretch" }}>
          <div className="panel m-panel-alt" style={{ padding: 44 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--m-muted)" }}>For clubs entering</p>
            <h2 className="m-h2" style={{ fontSize: 40, marginTop: 6 }}>Tick, check, pay.</h2>
            <ol className="m-steps">
              <li><b>1</b><span>Tick the athletes you&apos;re taking. Pairs and teams are a tick away too.</span></li>
              <li><b>2</b><span>Check the categories Junbi has chosen for each one.</span></li>
              <li><b>3</b><span>Pay the entry fees. You&apos;re done.</span></li>
            </ol>
          </div>
          <div className="panel m-panel-alt" style={{ padding: 44 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--m-muted)" }}>For hosts</p>
            <h2 className="m-h2" style={{ fontSize: 40, marginTop: 6 }}>Open, fill, run.</h2>
            <ol className="m-steps">
              <li><b>1</b><span>Set the date, venue, entry limit and fees. Categories are set up for you.</span></li>
              <li><b>2</b><span>Share your event page. Watch entries come in live.</span></li>
              <li><b>3</b><span>Download your lists for the scoring table on the morning.</span></li>
            </ol>
          </div>
        </div>
      </section>

      <section id="notify" className="m-section alt m-center">
        <h2 className="m-h2">Be first to know.</h2>
        <p className="m-sub" style={{ maxWidth: 560 }}>Leave your details and we&apos;ll email you the day Junbi Competitions opens.</p>
        <InterestForm />
      </section>
    </>
  );
}
