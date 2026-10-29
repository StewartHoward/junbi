import type { Metadata } from "next";
import { publicTimetable } from "@/data/timetable";
import { WEEKDAYS, isoWeekday, todayISO } from "@/data/classes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class timetable", robots: { index: false, follow: false } };

type Params = { site?: string; theme?: string; accent?: string; card?: string; text?: string; bg?: string; signup?: string; frame?: string };

/** Only plain hex colours are accepted, so nothing else can be slipped into the page's styles. */
const hex = (v?: string) => (v && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null);
/** White or near-black, whichever reads better on the given colour. */
function onColour(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#1d1d1f" : "#ffffff";
}

/**
 * The club's live timetable, shown inside its own website (see public/embed.js for the code clubs paste).
 * Plain and light so it sits well on any site; ?theme=dark and ?accent=RRGGBB to match the club's colours.
 */
export default async function EmbedTimetable({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Params> }) {
  const [{ token }, q] = await Promise.all([params, searchParams]);
  const t = await publicTimetable(token, { signup: q.signup === "1" });
  const dark = q.theme === "dark";
  const accent = hex(q.accent) ?? (dark ? "#2997ff" : "#0066cc");
  const card = hex(q.card) ?? (dark ? "#1c1c1e" : "#ffffff");
  const ink = hex(q.text) ?? (dark ? "#f5f5f7" : "#1d1d1f");
  const bg = hex(q.bg);
  const darkish = onColour(card) === "#ffffff";
  const frame = q.frame && /^[a-z0-9-]{1,40}$/i.test(q.frame) ? q.frame : "";
  const keep = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ theme: q.theme, accent: q.accent, card: q.card, text: q.text, bg: q.bg, signup: q.signup, frame, ...extra })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : "?";
  };

  const css = `
    :root { color-scheme: ${darkish ? "dark" : "light"}; }
    html, body { background: ${bg ?? "transparent"} !important; margin: 0; }
    .jt { --ink: ${ink}; --muted: color-mix(in srgb, ${ink} 62%, ${card}); --line: color-mix(in srgb, ${ink} 14%, ${card});
      --card: ${card}; --accent: ${accent}; --on-accent: ${onColour(accent)};
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: var(--ink); padding: 4px; }
    .jt-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .jt-tab { background: var(--card); padding: 8px 14px; min-height: 36px; box-sizing: border-box; border-radius: 980px; border: 1px solid var(--line); color: var(--ink); text-decoration: none; font-size: 14px; display: inline-flex; align-items: center; }
    .jt-tab[aria-current="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
    .jt-days { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; align-items: start; }
    .jt-day { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
    .jt-day h2 { font-size: 15px; font-weight: 600; margin: 0 0 6px; display: flex; justify-content: space-between; align-items: baseline; }
    .jt-today { font-size: 12px; font-weight: 600; color: var(--accent); }
    .jt-row { padding: 9px 0; border-top: 1px solid var(--line); }
    .jt-row:first-of-type { border-top: 0; }
    .jt-time { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--muted); }
    .jt-name { font-weight: 600; font-size: 15px; margin-top: 1px; }
    .jt-sub { font-size: 13px; color: var(--muted); }
    .jt-foot { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-top: 14px; }
    .jt-btn { background: var(--accent); color: var(--on-accent); text-decoration: none; border-radius: 980px; padding: 11px 20px; font-weight: 600; font-size: 15px; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; }
    .jt-by { font-size: 12px; color: ${bg ? `color-mix(in srgb, ${onColour(bg)} 60%, ${bg})` : "var(--muted)"}; text-decoration: none; }
    .jt-empty { color: ${bg ? onColour(bg) : "var(--muted)"}; font-size: 15px; padding: 12px 0; }
  `;
  // Tells the club's page how tall the timetable is, so the frame grows to fit with no scroll bar.
  const resize = frame
    ? `(function(){var f=${JSON.stringify(frame)};var el=document.querySelector(".jt");
       function send(){parent.postMessage({junbiTimetable:f,height:Math.ceil(el.getBoundingClientRect().height)+2},"*")}
       send();window.addEventListener("load",send);if(window.ResizeObserver){new ResizeObserver(send).observe(el)}})();`
    : "";

  if (!t) {
    return (
      <div className="jt">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <p className="jt-empty">This timetable link isn&apos;t working. Ask the club to copy the code from Junbi again.</p>
      </div>
    );
  }

  const site = q.site && t.sites.some((s) => s.id === q.site) ? q.site : null;
  const classes = site ? t.classes.filter((c) => c.siteId === site) : t.classes;
  const today = isoWeekday(todayISO());
  const days = WEEKDAYS.map((name, i) => ({ name, n: i + 1, list: classes.filter((c) => c.weekday === i + 1) })).filter((d) => d.list.length);

  return (
    <div className="jt">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {t.sites.length > 1 && (
        <nav className="jt-tabs" aria-label="Choose a site">
          <a className="jt-tab" href={keep({})} aria-current={!site ? "true" : undefined}>All sites</a>
          {t.sites.map((s) => (
            <a key={s.id} className="jt-tab" href={keep({ site: s.id })} aria-current={site === s.id ? "true" : undefined}>{s.name}</a>
          ))}
        </nav>
      )}
      {days.length === 0 ? (
        <p className="jt-empty">No classes on the timetable yet.</p>
      ) : (
        <div className="jt-days">
          {days.map((d) => (
            <section key={d.n} className="jt-day" aria-label={d.name}>
              <h2>{d.name}{d.n === today && <span className="jt-today">Today</span>}</h2>
              {d.list.map((c) => (
                <div key={c.id} className="jt-row">
                  <div className="jt-time">{c.start} to {c.end}</div>
                  <div className="jt-name">{c.name}</div>
                  {(t.multiArt || (t.sites.length > 1 && !site)) && (
                    <div className="jt-sub">{[t.multiArt ? c.art : null, t.sites.length > 1 && !site ? c.site : null].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      <div className="jt-foot">
        {t.signupUrl ? <a className="jt-btn" href={t.signupUrl} target="_blank" rel="noopener">Sign up</a> : <span />}
        <a className="jt-by" href="https://junbi.co.uk" target="_blank" rel="noopener">Timetable by junbi</a>
      </div>
      {resize && <script dangerouslySetInnerHTML={{ __html: resize }} />}
    </div>
  );
}
