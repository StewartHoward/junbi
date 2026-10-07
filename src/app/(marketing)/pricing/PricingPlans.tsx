"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, formatPounds } from "@/lib/plans";

export function PricingPlans() {
  const [annual, setAnnual] = useState(false);
  return (
    <>
      <div className="m-center">
        <div className="m-toggle" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Annual · 2 months free</button>
        </div>
      </div>

      <div className="m-plans" style={{ marginTop: 48 }}>
        {PLANS.map((p) => {
          const featured = p.id === "club";
          const dark = p.id === "association";
          return (
            <div key={p.id} className={`m-plan${featured ? " featured" : ""}${dark ? " dark" : ""}`}>
              {featured && <span className="badge">Most popular</span>}
              <h2>{p.name}</h2>
              <p className="for">{p.for}</p>
              <p className="price">
                {dark && <span>From </span>}
                <strong>{formatPounds(annual ? p.annualPence : p.monthlyPence)}</strong>
                <span> {annual ? "/year" : "/month"}</span>
              </p>
              <p className="limits">{p.limits}</p>
              <Link
                href={dark ? "/founding-clubs" : `/signup?plan=${p.id}`}
                className={`m-btn ${featured ? "primary" : dark ? "white" : "soft"}`}
              >
                {dark ? "Talk to us" : `Choose ${p.name}`}
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
