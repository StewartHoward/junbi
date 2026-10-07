"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createClassAction, type ActionState } from "../../actions";
import { FieldError, errProps } from "@/components/FormBits";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ClassForm({ sites, arts }: { sites: Array<{ id: string; name: string }>; arts: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createClassAction, {});
  const e = state.errors;
  const v = state.values ?? {};
  return (
    <form action={action} className="form" noValidate>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div>
        <label htmlFor="name">Class name</label>
        <input id="name" name="name" placeholder="e.g. Juniors, kup grades" defaultValue={v.name} {...errProps("name", e)} />
        <FieldError id="name-err" msg={e?.name} />
      </div>
      <div className="grid2">
        <div>
          <label htmlFor="weekday">Day</label>
          <select id="weekday" name="weekday" defaultValue={v.weekday || "1"}>
            {DAYS.map((d, i) => (
              <option key={d} value={i + 1}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="startsAt">Start time</label>
          <input id="startsAt" name="startsAt" type="time" defaultValue={v.startsAt || "17:30"} {...errProps("startsAt", e)} />
          <FieldError id="startsAt-err" msg={e?.startsAt} />
        </div>
        <div>
          <label htmlFor="durationMinutes">Length (minutes)</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min={15} max={300} step={5} defaultValue={v.durationMinutes || "60"} {...errProps("durationMinutes", e)} />
          <FieldError id="durationMinutes-err" msg={e?.durationMinutes} />
        </div>
        <div>
          <label htmlFor="capacity">Capacity (optional)</label>
          <input id="capacity" name="capacity" type="number" min={1} max={500} defaultValue={v.capacity} />
        </div>
        <div>
          <label htmlFor="siteId">Site</label>
          <select id="siteId" name="siteId" defaultValue={v.siteId || sites[0]?.id} {...errProps("siteId", e)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <FieldError id="siteId-err" msg={e?.siteId} />
        </div>
        {arts.length > 1 ? (
          <div>
            <label htmlFor="discipline">Art</label>
            <select id="discipline" name="discipline" defaultValue={v.discipline || arts[0].id}>
              {arts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <FieldError id="discipline-err" msg={e?.discipline} />
          </div>
        ) : (
          <input type="hidden" name="discipline" value={arts[0]?.id ?? "taekwondo"} />
        )}
      </div>
      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : "Add class"}</button>
        <Link href="/classes" className="btn ghost">Cancel</Link>
      </div>
    </form>
  );
}
