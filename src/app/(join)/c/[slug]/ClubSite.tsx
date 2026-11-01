import { TrialForm } from "./TrialForm";
import type { clubWebsite } from "@/data/website";

type Site = NonNullable<Awaited<ReturnType<typeof clubWebsite>>>;

/** Readable text on a colour. */
function onColour(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1d1d1f" : "#ffffff";
}

const img = (id: string) => `/img/${id}`;
const paras = (t: string) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * The club's website, section by section, in the same clean style as junbi.co.uk: big type, plenty of space,
 * alternating white and grey bands, the club's colour for the header and buttons.
 */
export function ClubSite({ w }: { w: Site }) {
  const colour = /^#[0-9a-f]{6}$/i.test(w.colour) ? w.colour : "#0066cc";
  const on = onColour(colour);
  const css = `
    .cw { --club: ${colour}; --on-club: ${on}; }
    .cw-nav { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,.86); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--m-soft-line); }
    .cw-nav-in { max-width: 1080px; margin: 0 auto; padding: 0 22px; height: 52px; display: flex; align-items: center; gap: 18px; }
    .cw-nav b { flex: 1; font-size: 18px; letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cw .cw-nav a { font-size: 14px; color: var(--m-ink); text-decoration: none; }
    .cw .cw-nav a.pill { background: var(--club); color: var(--on-club); padding: 7px 14px; border-radius: 980px; font-weight: 500; white-space: nowrap; }
    @media (max-width: 640px) { .cw .cw-nav a.hide-sm { display: none; } }
    .cw-band { padding: 96px 22px; }
    .cw-band.grey { background: var(--m-alt); }
    .cw-band.dark { background: #000; color: #f5f5f7; }
    .cw-band.colour { background: var(--club); color: var(--on-club); }
    .cw-in { max-width: 1080px; margin: 0 auto; }
    .cw-c { text-align: center; }
    .cw-h1 { font-size: clamp(44px, 7vw, 80px); line-height: 1.04; letter-spacing: -0.035em; font-weight: 600; margin: 0 auto; max-width: 900px; }
    .cw-h2 { font-size: clamp(32px, 5vw, 48px); line-height: 1.08; letter-spacing: -0.03em; font-weight: 600; margin: 0; }
    .cw-sub { font-size: clamp(19px, 2vw, 21px); line-height: 1.45; color: var(--m-muted); margin: 18px auto 0; max-width: 680px; }
    .cw-band.dark .cw-sub { color: #a1a1a6; }
    .cw-band.colour .cw-sub { color: var(--on-club); opacity: .9; }
    .cw-p { font-size: 19px; line-height: 1.6; margin: 16px 0 0; max-width: 720px; }
    .cw-acts { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-top: 32px; align-items: center; }
    .cw .cw-btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 26px; border-radius: 980px; font-weight: 600; font-size: 17px; text-decoration: none; background: var(--club); color: var(--on-club); }
    .cw .cw-band.colour .cw-btn { background: var(--on-club); color: var(--club); }
    .cw .cw-band.dark .cw-btn { background: #f5f5f7; color: #000; }
    .cw .cw-link { color: inherit; font-weight: 600; font-size: 17px; text-decoration: none; }
    .cw .cw-band.light .cw-link, .cw .cw-band.grey .cw-link { color: var(--club); }
    .cw-hero-img { display: block; width: 100%; max-width: 1080px; max-height: 560px; object-fit: cover; border-radius: 22px; margin: 56px auto 0; }
    .cw-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
    .cw-split.left .cw-split-img { order: -1; }
    .cw-split img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 22px; display: block; }
    @media (max-width: 800px) { .cw-split { grid-template-columns: 1fr; gap: 28px; } .cw-split .cw-split-img { order: -1; } .cw-band { padding: 72px 22px; } }
    .cw-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-top: 36px; }
    .cw-gallery img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 16px; display: block; }
    .cw-days { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; margin-top: 36px; align-items: start; text-align: left; }
    .cw-card { background: #fff; color: var(--m-ink); border: 1px solid var(--m-soft-line); border-radius: 18px; padding: 18px 20px; text-align: left; }
    .cw-band.light .cw-card { background: var(--m-alt); border-color: transparent; }
    .cw-card h3 { margin: 0 0 4px; font-size: 17px; }
    .cw-row { padding: 10px 0; border-top: 1px solid var(--m-soft-line); }
    .cw-row:first-of-type { border-top: 0; }
    .cw-row .t { font-size: 13px; color: var(--m-muted); font-variant-numeric: tabular-nums; }
    .cw-row .n { font-weight: 600; margin-top: 2px; }
    .cw-row .s { font-size: 13px; color: var(--m-muted); }
    .cw-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin-top: 36px; }
    .cw-price { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin-top: 8px; }
    .cw-quote { font-size: 19px; line-height: 1.5; margin: 0; }
    .cw-quote-by { margin-top: 14px; font-weight: 600; font-size: 15px; color: var(--m-muted); }
    .cw-trial { background: #fff; color: var(--m-ink); border-radius: 24px; padding: 32px 28px; margin-top: 36px; text-align: left; }
    .cw-band.light .cw-trial { background: var(--m-alt); }
    .cw-trial .m-form { max-width: none; margin: 0; }
    .cw-foot { padding: 40px 22px; border-top: 1px solid var(--m-soft-line); }
    .cw-foot .cw-in { display: flex; gap: 22px; flex-wrap: wrap; align-items: center; font-size: 14px; }
    .cw .cw-foot a { color: var(--m-ink); text-decoration: none; }
    .cw-foot b { flex: 1; }
  `;
  const hasTrial = w.sections.some((x) => x.type === "trial");
  const hasTimetable = w.sections.some((x) => x.type === "timetable");
  const hasPrices = w.sections.some((x) => x.type === "prices");

  return (
    <div className="cw">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {(!w.published || w.draft) && (
        <p style={{ background: "#fff1e0", color: "#8a3d00", padding: "10px 16px", margin: 0, textAlign: "center", fontSize: 14 }}>
          {w.draft ? "Preview of your changes. Only you can see this until you publish." : "Preview: only you can see this until you publish it."}
        </p>
      )}
      <nav className="cw-nav" aria-label={w.clubName}>
        <div className="cw-nav-in">
          <b>{w.clubName}</b>
          {hasTimetable && <a className="hide-sm" href="#classes">Classes</a>}
          {hasPrices && w.prices.length > 0 && <a className="hide-sm" href="#prices">Prices</a>}
          {w.shopUrl && <a className="hide-sm" href={w.shopUrl}>Shop</a>}
          <a className="pill" href={hasTrial ? "#trial" : w.signupUrl}>{hasTrial ? "Free trial" : "Join"}</a>
        </div>
      </nav>

      {w.sections.map((x) => {
        const band = `cw-band ${x.tone}`;
        switch (x.type) {
          case "hero":
            return (
              <header key={x.id} className={band}>
                <div className="cw-in cw-c">
                  {w.arts.length > 0 && <p style={{ margin: "0 0 14px", fontWeight: 600, fontSize: 17, opacity: 0.85 }}>{w.arts.join(" · ")}</p>}
                  <h1 className="cw-h1">{x.heading || w.clubName}</h1>
                  {x.text && <p className="cw-sub">{x.text}</p>}
                  <div className="cw-acts">
                    {hasTrial && <a className="cw-btn" href="#trial">Book a free trial</a>}
                    <a className="cw-link" href={w.signupUrl}>Join now ›</a>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {x.image && <img className="cw-hero-img" src={img(x.image)} alt="" />}
                </div>
              </header>
            );
          case "text":
            return (
              <section key={x.id} className={band}>
                <div className="cw-in" style={{ maxWidth: 760 }}>
                  {x.heading && <h2 className="cw-h2">{x.heading}</h2>}
                  {paras(x.text).map((p, i) => <p key={i} className="cw-p">{p}</p>)}
                </div>
              </section>
            );
          case "imageText":
            return (
              <section key={x.id} className={band}>
                <div className={`cw-in cw-split ${x.side}`}>
                  <div>
                    {x.heading && <h2 className="cw-h2">{x.heading}</h2>}
                    {paras(x.text).map((p, i) => <p key={i} className="cw-p">{p}</p>)}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="cw-split-img">{x.image ? <img src={img(x.image)} alt="" /> : null}</div>
                </div>
              </section>
            );
          case "gallery":
            return x.images.length ? (
              <section key={x.id} className={band}>
                <div className="cw-in">
                  {x.heading && <h2 className="cw-h2 cw-c">{x.heading}</h2>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="cw-gallery">{x.images.map((id) => <img key={id} src={img(id)} alt="" loading="lazy" />)}</div>
                </div>
              </section>
            ) : null;
          case "timetable":
            return w.timetable.length ? (
              <section key={x.id} id="classes" className={band}>
                <div className="cw-in cw-c">
                  <h2 className="cw-h2">{x.heading || "Classes"}</h2>
                  {x.text && <p className="cw-sub">{x.text}</p>}
                  <div className="cw-days">
                    {w.timetable.map((d) => (
                      <div key={d.day} className="cw-card">
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
                </div>
              </section>
            ) : null;
          case "prices":
            return w.prices.length ? (
              <section key={x.id} id="prices" className={band}>
                <div className="cw-in cw-c">
                  <h2 className="cw-h2">{x.heading || "Memberships"}</h2>
                  {x.text && <p className="cw-sub">{x.text}</p>}
                  <div className="cw-cards">
                    {w.prices.map((p) => <div key={p.name} className="cw-card"><div style={{ fontWeight: 600 }}>{p.name}</div><div className="cw-price">{p.price}</div></div>)}
                  </div>
                  {w.signupFee && <p className="cw-sub" style={{ fontSize: 15 }}>One-off sign-up fee of {w.signupFee} per member.</p>}
                  <div className="cw-acts"><a className="cw-btn" href={w.signupUrl}>Join now</a></div>
                </div>
              </section>
            ) : null;
          case "trial":
            return (
              <section key={x.id} id="trial" className={band}>
                <div className="cw-in cw-c" style={{ maxWidth: 760 }}>
                  <h2 className="cw-h2">{x.heading || "Book a free trial"}</h2>
                  {x.text && <p className="cw-sub">{x.text}</p>}
                  <div className="cw-trial"><TrialForm slug={w.slug} classes={w.trialClasses} /></div>
                </div>
              </section>
            );
          case "quotes":
            return x.items.length ? (
              <section key={x.id} className={band}>
                <div className="cw-in cw-c">
                  {x.heading && <h2 className="cw-h2">{x.heading}</h2>}
                  <div className="cw-cards">
                    {x.items.map((q, i) => <figure key={i} className="cw-card" style={{ margin: 0, padding: 24 }}><blockquote className="cw-quote">“{q.quote}”</blockquote>{q.name && <figcaption className="cw-quote-by">{q.name}</figcaption>}</figure>)}
                  </div>
                </div>
              </section>
            ) : null;
          case "join":
            return (
              <section key={x.id} className={band}>
                <div className="cw-in cw-c">
                  <h2 className="cw-h2">{x.heading || "Ready to start?"}</h2>
                  {x.text && <p className="cw-sub">{x.text}</p>}
                  <div className="cw-acts"><a className="cw-btn" href={w.signupUrl}>Join now</a>{hasTrial && <a className="cw-link" href="#trial">Book a free trial ›</a>}</div>
                </div>
              </section>
            );
          case "findUs":
            return (
              <section key={x.id} className={band}>
                <div className="cw-in">
                  <h2 className="cw-h2">{x.heading || "Find us"}</h2>
                  <div className="cw-cards">
                    {w.sites.map((st) => <div key={st.id} className="cw-card"><div style={{ fontWeight: 600 }}>{st.name}</div>{st.address && <div style={{ marginTop: 6, color: "var(--m-muted)", whiteSpace: "pre-line" }}>{st.address}</div>}</div>)}
                    {(w.phone || w.email) && (
                      <div className="cw-card">
                        <div style={{ fontWeight: 600 }}>Get in touch</div>
                        {w.phone && <div style={{ marginTop: 6 }}><a href={`tel:${w.phone.replace(/\s/g, "")}`} style={{ color: "var(--club)" }}>{w.phone}</a></div>}
                        {w.email && <div style={{ marginTop: 4 }}><a href={`mailto:${w.email}`} style={{ color: "var(--club)" }}>{w.email}</a></div>}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
        }
      })}

      <footer className="cw-foot">
        <div className="cw-in">
          <b>{w.clubName}</b>
          {w.shopUrl && <a href={w.shopUrl}>Club shop</a>}
          <a href={w.familyUrl}>Parent and member login</a>
          <a href={w.signupUrl}>Sign up</a>
        </div>
      </footer>
    </div>
  );
}
