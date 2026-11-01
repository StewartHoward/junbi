import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentActor } from "@/auth/session";
import { clubWebsite } from "@/data/website";
import { TrialForm } from "./TrialForm";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const w = await clubWebsite((await params).slug).catch(() => null);
  if (!w) return { title: "Club" };
  return { title: { absolute: w.clubName }, description: w.tagline ?? `${w.arts.join(", ")} classes. Book a free trial.` };
}

/** Readable text on the club's colour. */
function onColour(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1d1d1f" : "#ffffff";
}

/** The club's public page, built from its Junbi details. */
export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await clubWebsite(slug, { preview: (await currentActor()) ?? undefined });
  if (!w) notFound();
  const colour = /^#[0-9a-f]{6}$/i.test(w.colour) ? w.colour : "#0066cc";
  const on = onColour(colour);
  const css = `
    .cw { --club: ${colour}; --on-club: ${on}; }
    .cw-hero { background: var(--club); color: var(--on-club); padding: 88px 22px 72px; text-align: center; }
    .cw-hero .cw-eyebrow { font-size: 15px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--on-club); opacity: 0.85; margin: 0; }
    .cw-hero h1 { font-size: clamp(40px, 7vw, 72px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 700; margin: 12px auto 0; max-width: 900px; }
    .cw-hero p.tag { font-size: clamp(19px, 2.4vw, 24px); margin: 18px auto 0; max-width: 680px; opacity: 0.92; }
    .cw-hero .acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 32px; }
    .cw-btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 24px; border-radius: 980px; font-weight: 600; font-size: 17px; text-decoration: none; }
    .cw-btn.solid { background: var(--on-club); color: var(--club); }
    .cw-btn.line { border: 1.5px solid var(--on-club); color: var(--on-club); }
    .cw-sec { max-width: 1000px; margin: 0 auto; padding: 64px 22px 0; }
    .cw-sec h2 { font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.025em; font-weight: 700; margin: 0; }
    .cw-sec p.lead { font-size: 18px; color: var(--m-muted, #6e6e73); margin: 10px 0 0; max-width: 680px; white-space: pre-line; }
    .cw-days { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 24px; align-items: start; }
    .cw-day { border: 1px solid var(--m-line, #e5e5ea); border-radius: 18px; padding: 16px 18px; }
    .cw-day h3 { margin: 0 0 4px; font-size: 16px; }
    .cw-row { padding: 10px 0; border-top: 1px solid var(--m-line, #e5e5ea); }
    .cw-row:first-of-type { border-top: 0; }
    .cw-row .t { font-size: 13px; color: var(--m-muted, #6e6e73); font-variant-numeric: tabular-nums; }
    .cw-row .n { font-weight: 600; margin-top: 2px; }
    .cw-row .s { font-size: 13px; color: var(--m-muted, #6e6e73); }
    .cw-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 24px; }
    .cw-card { border: 1px solid var(--m-line, #e5e5ea); border-radius: 18px; padding: 20px; }
    .cw-card .p { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin-top: 6px; }
    .cw-trial .m-form { max-width: none; margin-left: 0; }
    .cw-trial { background: var(--m-surface-alt, #f5f5f7); border-radius: 24px; padding: 32px 24px; margin-top: 24px; }
    .cw-links { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 18px; }
    .cw-links a { color: var(--club); font-weight: 600; text-decoration: none; }
  `;
  return (
    <div className="cw">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {!w.published && (
        <p style={{ background: "#fff1e0", color: "#8a3d00", padding: "10px 16px", margin: 0, textAlign: "center", fontSize: 14 }}>
          Preview: only you can see this until you publish it in Settings.
        </p>
      )}
      <header className="cw-hero">
        {w.arts.length > 0 && <p className="cw-eyebrow">{w.arts.join(" · ")}</p>}
        <h1>{w.clubName}</h1>
        {w.tagline && <p className="tag">{w.tagline}</p>}
        <div className="acts">
          <a className="cw-btn solid" href="#trial">Book a free trial</a>
          <a className="cw-btn line" href={w.signupUrl}>Join now</a>
        </div>
      </header>

      {w.about && (
        <section className="cw-sec">
          <h2>About us</h2>
          <p className="lead">{w.about}</p>
        </section>
      )}

      {w.timetable.length > 0 && (
        <section className="cw-sec" id="timetable">
          <h2>Classes</h2>
          <div className="cw-days">
            {w.timetable.map((d) => (
              <div key={d.day} className="cw-day">
                <h3>{d.day}</h3>
                {d.classes.map((c) => (
                  <div key={c.id} className="cw-row">
                    <div className="t">{c.time}</div>
                    <div className="n">{c.name}</div>
                    {(c.site || c.art) && <div className="s">{[c.art, c.site].filter(Boolean).join(" · ")}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {w.prices.length > 0 && (
        <section className="cw-sec">
          <h2>Memberships</h2>
          <div className="cw-cards">
            {w.prices.map((p) => (
              <div key={p.name} className="cw-card"><div style={{ fontWeight: 600 }}>{p.name}</div><div className="p">{p.price}</div></div>
            ))}
          </div>
          {w.signupFee && <p className="lead" style={{ fontSize: 15 }}>One-off sign-up fee of {w.signupFee} per member.</p>}
          <p style={{ marginTop: 20 }}><a className="cw-btn" style={{ background: "var(--club)", color: "var(--on-club)" }} href={w.signupUrl}>Join now</a></p>
        </section>
      )}

      <section className="cw-sec" id="trial">
        <h2>Book a free trial</h2>
        <p className="lead">Come and try a class. Tell us who&apos;s training and we&apos;ll get you booked in.</p>
        <div className="cw-trial">
          <TrialForm slug={w.slug} classes={w.trialClasses} />
        </div>
      </section>

      <section className="cw-sec" style={{ paddingBottom: 72 }}>
        <h2>Find us</h2>
        <div className="cw-cards">
          {w.sites.map((s) => (
            <div key={s.id} className="cw-card"><div style={{ fontWeight: 600 }}>{s.name}</div>{s.address && <div style={{ marginTop: 6, color: "var(--m-muted, #6e6e73)", whiteSpace: "pre-line" }}>{s.address}</div>}</div>
          ))}
          {(w.phone || w.email) && (
            <div className="cw-card">
              <div style={{ fontWeight: 600 }}>Get in touch</div>
              {w.phone && <div style={{ marginTop: 6 }}><a href={`tel:${w.phone.replace(/\s/g, "")}`} style={{ color: "var(--club)" }}>{w.phone}</a></div>}
              {w.email && <div style={{ marginTop: 4 }}><a href={`mailto:${w.email}`} style={{ color: "var(--club)" }}>{w.email}</a></div>}
            </div>
          )}
        </div>
        <div className="cw-links">
          {w.shopUrl && <a href={w.shopUrl}>Club shop</a>}
          <a href={w.familyUrl}>Parent and member login</a>
          <a href={w.signupUrl}>Sign up</a>
        </div>
      </section>
    </div>
  );
}
