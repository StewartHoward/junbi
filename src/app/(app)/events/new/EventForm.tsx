"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createEventAction, type EventFormState } from "../actions";
import { FieldError, errProps } from "@/components/FormBits";

export function EventForm({ kind, sites, arts, allSites, today }: { kind: "grading" | "event"; sites: Array<{ id: string; name: string }>; arts: Array<{ id: string; name: string }>; allSites: boolean; today: string }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(createEventAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  const grading = kind === "grading";
  return (
    <form key={JSON.stringify(state.values ?? null)} action={action} className="form" noValidate>
      <input type="hidden" name="kind" value={kind} />
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="title">Name</label>
        <input id="title" name="title" placeholder={grading ? "e.g. Kup grading" : "e.g. Summer seminar"} defaultValue={v.title ?? (grading ? "Grading" : "")} {...errProps("title", e)} />
        <FieldError id="title-err" msg={e?.title} />
      </div>
      <div className="grid2">
        <div>
          <label htmlFor="date">Date</label>
          <input id="date" name="date" type="date" min={today} defaultValue={v.date} {...errProps("date", e)} />
          <FieldError id="date-err" msg={e?.date} />
        </div>
        <div>
          <label htmlFor="time">Start time</label>
          <input id="time" name="time" type="time" defaultValue={v.time || "10:00"} {...errProps("time", e)} />
          <FieldError id="time-err" msg={e?.time} />
        </div>
        {grading && (arts.length > 1 ? (
          <div>
            <label htmlFor="discipline">Art</label>
            <select id="discipline" name="discipline" defaultValue={v.discipline || arts[0]?.id} {...errProps("discipline", e)}>
              {arts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <FieldError id="discipline-err" msg={e?.discipline} />
          </div>
        ) : (
          <input type="hidden" name="discipline" value={arts[0]?.id ?? ""} />
        ))}
        <div>
          <label htmlFor="siteId">{grading ? "Who can grade" : "Who's it for"}</label>
          <select id="siteId" name="siteId" defaultValue={v.siteId ?? (allSites ? "" : sites[0]?.id)} {...errProps("siteId", e)}>
            {allSites && <option value="">Students from every site</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>Students at {s.name}</option>)}
          </select>
          <FieldError id="siteId-err" msg={e?.siteId} />
        </div>
        <div>
          <label htmlFor="fee">Fee per person (optional)</label>
          <input id="fee" name="fee" inputMode="decimal" placeholder="e.g. 25" defaultValue={v.fee} {...errProps("fee", e)} />
          <FieldError id="fee-err" msg={e?.fee} />
        </div>
        <div>
          <label htmlFor="capacity">Places (optional)</label>
          <input id="capacity" name="capacity" type="number" min={1} max={2000} placeholder="No limit" defaultValue={v.capacity} {...errProps("capacity", e)} />
          <FieldError id="capacity-err" msg={e?.capacity} />
        </div>
        {grading && (
          <div>
            <label htmlFor="examiner">Examiner (optional)</label>
            <input id="examiner" name="examiner" placeholder="Shown with the results" defaultValue={v.examiner} />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="location">Where (optional)</label>
        <input id="location" name="location" placeholder="If it's not at your usual venue" defaultValue={v.location} />
      </div>
      <div>
        <label htmlFor="notes">Notes for families (optional)</label>
        <textarea id="notes" name="notes" placeholder={grading ? "e.g. Arrive 15 minutes early in a clean dobok with your belt." : "Anything families should know"} defaultValue={v.notes} />
      </div>
      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : grading ? "Set up grading" : "Set up event"}</button>
        <Link href="/events" className="btn ghost">Cancel</Link>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Next you&apos;ll choose who to invite. Families pay by card when they book if you take payments through Stripe; otherwise they pay at the club.</p>
    </form>
  );
}
