"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, SIZE_BANDS, annualPence, formatPounds, type SizeBandId } from "@/lib/plans";

export function PricingPlans() {
  const [annual, setAnnual] = useState(false);
  const [band, setBand] = useState<SizeBandId>("m");
  return (
    <>
      <div className="m-center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div>
          <p className="m-toggle-label" id="band-label">How many active students?</p>
          <div className="m-toggle" role="group" aria-labelledby="band-label" style={{ marginTop: 10 }}>
            {SIZE_BANDS.map((b) => (
              <button key={b.id} type="button" aria-pressed={band === b.id} onClick={() => setBand(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="m-toggle" role="group" aria-label="Billing period" style={{ marginTop: 0 }}>
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Annual · 2 months free</button>
        </div>
      </div>

      <div className="m-plans three" style={{ marginTop: 48 }} aria-live="polite">
        {PLANS.map((p) => {
          const featured = p.id === "pro";
          const dark = p.id === "association";
          const monthly = p.monthlyPence[band];
          return (
            <div key={p.id} className={`m-plan${featured ? " featured" : ""}${dark ? " dark" : ""}`}>
              {featured && <span className="badge">Most popular</span>}
              <h2>{p.name}</h2>
              <p className="for">{p.for}</p>
              <p className="price">
                {dark && <span>From </span>}
                <strong>{formatPounds(annual ? annualPence(monthly) : monthly)}</strong>
                <span> {annual ? "/year" : "/month"}</span>
              </p>
              <p className="limits">
                {dark ? p.limits : `${SIZE_BANDS.find((b) => b.id === band)!.label} active students · ${p.limits}`}
              </p>
              <Link href={dark ? "/founding-clubs" : `/signup?plan=${p.id}`} className={`m-btn ${featured ? "primary" : dark ? "white" : "soft"}`}>
                {dark ? "Talk to us" : `Start free with ${p.name}`}
              </Link>
              <ul>
                {p.intro && <li className="muted" style={{ color: dark ? "#a1a1a6" : "#6e6e73" }}>{p.intro}</li>}
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
