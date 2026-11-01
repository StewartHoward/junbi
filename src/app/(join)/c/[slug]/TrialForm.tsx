"use client";

import { useActionState, useMemo, useState } from "react";
import { trialAction, type TrialState } from "./actions";
import { FieldError, errProps } from "@/components/FormBits";

type Cls = { id: string; weekday: number; label: string };

/** The next few dates a class runs, so families pick a real one. */
function nextDates(weekday: number, n = 4) {
  const out: Array<{ iso: string; label: string }> = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 28 && out.length < n; i++) {
    const day = ((d.getDay() + 6) % 7) + 1;
    if (day === weekday) out.push({ iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function TrialForm({ slug, classes }: { slug: string; classes: Cls[] }) {
  const [state, action, pending] = useActionState<TrialState, FormData>(trialAction.bind(null, slug), {});
  const v = state.values ?? {};
  const e = state.errors;
  const [who, setWho] = useState(v.who === "me" ? "me" : "child");
  const [classId, setClassId] = useState(v.classId ?? "");
  const dates = useMemo(() => {
    const c = classes.find((x) => x.id === classId);
    return c ? nextDates(c.weekday) : [];
  }, [classId, classes]);

  if (state.done) {
    return (
      <div style={{ marginTop: 20 }}>
        <h3 className="m-h2" style={{ fontSize: 28, textAlign: "left" }}>Thanks, we&apos;ve got it.</h3>
        <p className="m-sub" style={{ fontSize: 18, textAlign: "left" }}>We&apos;ve emailed you the details. The club will be in touch to welcome you.</p>
      </div>
    );
  }
  return (
    <form action={action} className="m-form" noValidate style={{ marginTop: 20 }}>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div className="m-who">
        <label><input type="radio" name="who" value="child" checked={who === "child"} onChange={() => setWho("child")} /> For my child</label>
        <label><input type="radio" name="who" value="me" checked={who === "me"} onChange={() => setWho("me")} /> For me</label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div><label htmlFor="t-first">Your first name</label><input id="t-first" name="firstName" autoComplete="given-name" defaultValue={v.firstName} {...errProps("firstName", e)} /><FieldError id="firstName-err" msg={e?.firstName} /></div>
        <div><label htmlFor="t-last">Last name</label><input id="t-last" name="lastName" autoComplete="family-name" defaultValue={v.lastName} /></div>
        <div><label htmlFor="t-email">Email</label><input id="t-email" name="email" type="email" autoComplete="email" defaultValue={v.email} {...errProps("email", e)} /><FieldError id="email-err" msg={e?.email} /></div>
        <div><label htmlFor="t-phone">Phone</label><input id="t-phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} /></div>
        {who === "child" && (
          <>
            <div><label htmlFor="t-sname">Child&apos;s name</label><input id="t-sname" name="studentName" defaultValue={v.studentName} /></div>
            <div><label htmlFor="t-sage">Their age</label><input id="t-sage" name="studentAge" type="number" min={2} max={99} defaultValue={v.studentAge} {...errProps("studentAge", e)} /><FieldError id="studentAge-err" msg={e?.studentAge} /></div>
          </>
        )}
      </div>
      {classes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label htmlFor="t-class">Which class? (optional)</label>
            <select id="t-class" name="classId" value={classId} onChange={(ev) => setClassId(ev.target.value)} {...errProps("classId", e)}>
              <option value="">Not sure yet</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <FieldError id="classId-err" msg={e?.classId} />
          </div>
          {classId && (
            <div>
              <label htmlFor="t-date">Date</label>
              <select id="t-date" name="sessionDate" defaultValue={v.sessionDate ?? dates[0]?.iso} {...errProps("sessionDate", e)}>
                {dates.map((d) => <option key={d.iso} value={d.iso}>{d.label}</option>)}
              </select>
              <FieldError id="sessionDate-err" msg={e?.sessionDate} />
            </div>
          )}
        </div>
      )}
      <div className="hp" aria-hidden="true"><label htmlFor="website">Leave this empty</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <button type="submit" className="m-btn primary" disabled={pending} style={{ alignSelf: "flex-start", background: "var(--club)" }}>{pending ? "Sending…" : "Book my free trial"}</button>
    </form>
  );
}
