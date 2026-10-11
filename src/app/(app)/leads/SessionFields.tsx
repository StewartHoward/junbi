"use client";

import { useState } from "react";
import { FieldError, errProps } from "@/components/FormBits";

type Cls = { id: string; name: string; siteId: string; weekday: number; startsAt: string };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Trial session picker: one of the club's classes (or another time) and a date. */
export function SessionFields({ classes, siteId, values, errors, sites }: { classes: Cls[]; siteId?: string; values?: Record<string, string>; errors?: Partial<Record<string, string>>; sites?: Array<{ id: string; name: string }> }) {
  const [cls, setCls] = useState(values?.classId ?? "");
  const shown = classes.filter((c) => !siteId || c.siteId === siteId);
  const siteName = (id: string) => (sites && sites.length > 1 ? ` · ${sites.find((x) => x.id === id)?.name ?? ""}` : "");
  return (
    <>
      <div>
        <label htmlFor="classId">Trial class (optional)</label>
        <select id="classId" name="classId" value={cls} onChange={(e) => setCls(e.target.value)} {...errProps("classId", errors)}>
          <option value="">Not booked yet</option>
          {shown.map((c) => (
            <option key={c.id} value={c.id}>{DAYS[c.weekday - 1]} {c.startsAt.slice(0, 5)} · {c.name}{siteName(c.siteId)}</option>
          ))}
          <option value="other">Another time</option>
        </select>
        <FieldError id="classId-err" msg={errors?.classId} />
      </div>
      {cls && (
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: "1 1 160px" }}>
            <label htmlFor="sessionDate">Date</label>
            <input id="sessionDate" name="sessionDate" type="date" defaultValue={values?.sessionDate} {...errProps("sessionDate", errors)} />
            <FieldError id="sessionDate-err" msg={errors?.sessionDate} />
          </div>
          {cls === "other" && (
            <div style={{ flex: "1 1 120px" }}>
              <label htmlFor="sessionTime">Time</label>
              <input id="sessionTime" name="sessionTime" type="time" defaultValue={values?.sessionTime} {...errProps("sessionTime", errors)} />
              <FieldError id="sessionTime-err" msg={errors?.sessionTime} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
