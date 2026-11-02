"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supportAction, type SupportState } from "@/app/support-actions";
import { SUPPORT_FAQ } from "@/lib/support";

type View = "home" | "answer" | "human" | "sent";

/** The help button in the bottom right: quick answers first, then a message to a real person. */
export function SupportWidget({ name = "", email = "", club = "" }: { name?: string; email?: string; club?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [pick, setPick] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [state, action, pending] = useActionState<SupportState, FormData>(supportAction, {});
  const path = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => { if (state.ok) setView("sent"); }, [state.ok]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("input, button, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, view]);

  const found = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return SUPPORT_FAQ.map((f, i) => ({ f, i }));
    return SUPPORT_FAQ.map((f, i) => ({ f, i, score: words.filter((w) => `${f.q} ${f.a} ${f.tags ?? ""}`.toLowerCase().includes(w)).length })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  }, [q]);

  const e = state.errors;
  return (
    <div className="sw">
      {open && (
        <div ref={panel} className="sw-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <div className="sw-head">
            {view !== "home" && view !== "sent" ? <button type="button" className="sw-back" onClick={() => setView("home")} aria-label="Back">‹</button> : <span />}
            <h2 id={titleId}>{view === "human" ? "Speak to a human" : view === "sent" ? "Message sent" : "How can we help?"}</h2>
            <button type="button" className="sw-x" onClick={() => { setOpen(false); button.current?.focus(); }} aria-label="Close help">×</button>
          </div>

          {view === "home" && (
            <div className="sw-body">
              <label htmlFor="sw-q" className="sr-only">Search help</label>
              <input id="sw-q" type="search" placeholder="Search, e.g. trial, Direct Debit" value={q} onChange={(ev) => setQ(ev.target.value)} className="sw-search" />
              <ul className="sw-list">
                {found.map(({ f, i }) => (
                  <li key={f.q}><button type="button" onClick={() => { setPick(i); setView("answer"); }}>{f.q}<span aria-hidden="true">›</span></button></li>
                ))}
                {found.length === 0 && <li className="sw-none">No quick answer for that. Ask us below.</li>}
              </ul>
              <button type="button" className="sw-human" onClick={() => setView("human")}>Speak to a human</button>
            </div>
          )}

          {view === "answer" && pick !== null && (
            <div className="sw-body">
              <p className="sw-q">{SUPPORT_FAQ[pick].q}</p>
              <p className="sw-a">{SUPPORT_FAQ[pick].a}</p>
              <p className="sw-small">Didn&apos;t answer it?</p>
              <button type="button" className="sw-human" onClick={() => setView("human")}>Speak to a human</button>
            </div>
          )}

          {view === "human" && (
            <form action={action} className="sw-body sw-form" noValidate>
              <p className="sw-small" style={{ marginTop: 0 }}>Send us a message and a real person will reply by email, usually within one working day.</p>
              {e?.form && <p className="sw-err" role="alert">{e.form}</p>}
              <label htmlFor="sw-name">Your name</label>
              <input id="sw-name" name="name" autoComplete="name" defaultValue={name} required aria-invalid={e?.name ? true : undefined} />
              {e?.name && <p className="sw-err" role="alert">{e.name}</p>}
              <label htmlFor="sw-email">Email</label>
              <input id="sw-email" name="email" type="email" autoComplete="email" defaultValue={email} required aria-invalid={e?.email ? true : undefined} />
              {e?.email && <p className="sw-err" role="alert">{e.email}</p>}
              <label htmlFor="sw-msg">Message</label>
              <textarea id="sw-msg" name="message" rows={4} required aria-invalid={e?.message ? true : undefined} />
              {e?.message && <p className="sw-err" role="alert">{e.message}</p>}
              <input type="hidden" name="page" value={path ?? ""} />
              <input type="hidden" name="club" value={club} />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
              <button type="submit" className="sw-send" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
            </form>
          )}

          {view === "sent" && (
            <div className="sw-body">
              <p className="sw-a" role="status">Thanks. We&apos;ve got your message and emailed you a copy. A real person will reply soon.</p>
              <button type="button" className="sw-human" onClick={() => setView("home")}>Back to help</button>
            </div>
          )}
        </div>
      )}
      <button ref={button} type="button" className="sw-btn" aria-expanded={open} aria-label={open ? "Close help" : "Help and support"} onClick={() => setOpen((o) => !o)}>
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg><span>Help</span></>
        )}
      </button>
    </div>
  );
}
