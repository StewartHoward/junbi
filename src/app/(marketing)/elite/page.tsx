import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL, jsonLd, pageMeta } from "@/lib/seo";
import { BrochureForm } from "./BrochureForm";
import { EnquiryForm } from "./EnquiryForm";

export const metadata: Metadata = pageMeta({
  ownImage: true,
  title: "Junbi Elite: a club system custom built for you",
  description: "A website, member app, coach portal and payments system custom built for your taekwondo club, around the way you run it. Your brand, no Junbi branding. By enquiry.",
  path: "/elite",
});

/* Everything an Elite club gets. Keep it concrete: each line is something a club owner can picture. */
const GROUPS: Array<{ n: string; title: string; intro: string; items: string[] }> = [
  {
    n: "01",
    title: "A website designed for your club",
    intro: "Not a template. A fast, photo-led site designed around your club, on your own domain.",
    items: [
      "Pages for every class and age group, from little ones to adults",
      "A page for each of your locations, with map and directions",
      "Your team, your story, FAQs and contact",
      "Your Google reviews shown on the site",
      "Live timetable, with a Book now button on every class",
      "Events and gradings with prices and places left",
      "Built for Google: fast, mobile first, local search ready",
      "Change text, photos and prices yourself, any time",
    ],
  },
  {
    n: "02",
    title: "Your own member app",
    intro: "Families log in to an app with your name and logo on it. They never see ours.",
    items: [
      "Your logo, your colours, on your own web address",
      "Adds to the phone's home screen like any other app",
      "Book classes, see belts and grading history",
      "Book and pay for gradings, events and seminars",
      "Update details and request cancellations",
      "More than one parent can log in to the same child",
      "Push notifications for gradings, events and club news",
    ],
  },
  {
    n: "03",
    title: "Payments built in",
    intro: "Memberships, sign-up fees, events and add-ons all collected in one place, straight to your bank.",
    items: [
      "Direct Debit or card through your own Stripe or GoCardless account",
      "Sign-up fees and sibling discounts worked out for you",
      "Add-on fees for squads and extra classes",
      "Grading and event fees paid by card at booking",
      "Failed payments chased automatically",
      "Your existing Direct Debits moved across, no new forms for families",
      "0% of your fees, ever",
    ],
  },
  {
    n: "04",
    title: "Free trials that turn into members",
    intro: "Trial bookings run themselves, from the first click to the sign-up.",
    items: [
      "Families choose a location and age group, then see only classes with space",
      "Set how many trial places each class has",
      "Reminders before the class, so fewer no-shows",
      "Follow-up after the class with a link to join",
      "Sign-up by link or QR code: membership and payment in one go",
    ],
  },
  {
    n: "05",
    title: "A coach portal for your team",
    intro: "Everything your coaches need on their phone, and nothing they shouldn't see.",
    items: [
      "Take the register for every class in seconds",
      "DBS, safeguarding and first aid certificates, with expiry reminders",
      "Digital accident and incident forms",
      "Send grading invitations straight to families",
      "Coaches never see what anyone pays",
    ],
  },
  {
    n: "06",
    title: "Squads, gradings and the extras",
    intro: "The parts of club life that usually live in spreadsheets and group chats.",
    items: [
      "Invite-only squads and classes, hidden from everyone else",
      "Waivers signed online before the first session",
      "Gradings that update belts automatically",
      "Events, seminars and competitions with online booking",
      "Club shop for uniforms, belts and kit",
      "Emails to families sent in your club's name",
    ],
  },
];

const CUSTOM = [
  { t: "Your design", d: "A look made for your club, from your logo, colours and photos. Not a theme with your name swapped in." },
  { t: "Your memberships", d: "Your plans, sibling deals, sign-up fees, add-ons and rules, set up exactly as you charge them now." },
  { t: "Your way of grading", d: "Your syllabus, belt colours, attendance rules and invitations, built the way your club grades." },
  { t: "Your extras", d: "Squads, waivers, kit, seminars or something only your club does. If you need it, we build it." },
];

const STEPS = [
  { t: "Enquire", d: "Tell us about your club below. No obligation." },
  { t: "A short call", d: "We learn how your club runs: your classes, memberships, gradings and the bits that are unique to you." },
  { t: "We build", d: "Your website, app and portal, built around your club. You approve every page." },
  { t: "We move you across", d: "Students, families, belts and Direct Debits. Families don't fill in new forms." },
  { t: "Launch", d: "We train your team and stay on hand. You get a direct line to us." },
];

const FAQ = [
  { q: "Who is Elite for?", a: "Established clubs that want their own brand everywhere, usually with 100 or more students or more than one location. If you'd rather keep it simple, our standard plans have everything you need to run the club, from £19 a month." },
  { q: "Is it just Junbi with our logo on?", a: "No. Each Elite system is custom built for one club. We design the website and app around your brand, and build the features around how you run things: your memberships, your grading process, your squads, your rules. If you need something no other club has, we build it." },
  { q: "Will families see Junbi anywhere?", a: "No. Your website, member app, emails and receipts all carry your club's name and logo, on your own web address." },
  { q: "Is the member app in the App Store?", a: "It's a web app that families add to their home screen in a couple of taps. It opens full screen like any other app and sends notifications, with no app store downloads or updates to manage." },
  { q: "Do we own our domain and content?", a: "Yes. Your domain, photos, words and student records are yours. If you ever leave, we'll hand everything over." },
  { q: "Can we keep our current Direct Debits?", a: "If you collect through Stripe now, we can move your existing Direct Debits across without families signing up again. For other providers, we'll talk you through the simplest route on the call." },
  { q: "How long does it take?", a: "Usually four to six weeks from the go-ahead to launch, depending on how many pages and locations you have." },
  { q: "Can we ask for changes later?", a: "Yes. Your system keeps growing with your club. Small changes are part of your monthly plan, and we'll quote for bigger new features before we start." },
  { q: "Why do I have to enquire?", a: "Every Elite system is custom built, so we take on a small number of clubs at a time to do it properly, and we quote the build after we've talked." },
];

export default function ElitePage() {
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Junbi Elite",
      serviceType: "Custom built taekwondo club website, member app and management system",
      provider: { "@type": "Organization", name: "Junbi", url: SITE_URL },
      areaServed: "GB",
      url: `${SITE_URL}/elite`,
      offers: { "@type": "Offer", priceCurrency: "GBP", price: "199", priceSpecification: { "@type": "UnitPriceSpecification", price: "199", priceCurrency: "GBP", unitText: "MONTH" } },
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];

  return (
    <div className="m-elite">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />

      <section className="m-section dark m-center elite-hero">
        <p className="m-eyebrow">Junbi Elite</p>
        <h1 className="m-hero-title" style={{ fontSize: "clamp(42px, 6.4vw, 76px)", maxWidth: 940 }}>
          Your club&apos;s own system.
          <br />
          Built just for you.
        </h1>
        <p className="m-sub" style={{ maxWidth: 680 }}>
          A website, member app, coach portal and payments, custom built for your club around the way you run it. Not a template, not a rebrand. Your families only ever see your club.
        </p>
        <div className="m-actions">
          <a href="#enquire" className="m-btn on-dark">Enquire about Elite</a>
          <a href="#brochure" className="m-link">Download the brochure</a>
        </div>
        <p className="m-fine" style={{ color: "#a1a1a6" }}>By enquiry only. A small number of clubs each quarter.</p>

        <div className="elite-surfaces" aria-hidden="true">
          <div className="surface">
            <span className="tag">Website</span>
            <div className="site">
              <i className="bar" />
              <b>Find your class</b>
              <span className="row"><em>Kids 7 to 11</em><em className="go">Book now</em></span>
              <span className="row"><em>Teens 12 to 17</em><em className="go">Book now</em></span>
              <span className="row"><em>Adults</em><em className="go">Book now</em></span>
            </div>
          </div>
          <div className="surface phone">
            <span className="tag">Member app</span>
            <div className="app">
              <b>Hi Sarah</b>
              <span className="card"><em>Next class</em>Thursday 5:30pm</span>
              <span className="card"><em>Belt</em><i className="belt" />Green, 6th kup</span>
              <span className="card hl"><em>Grading invite</em>Saturday 22nd. Book your place</span>
            </div>
          </div>
          <div className="surface">
            <span className="tag">Coach portal</span>
            <div className="site">
              <i className="bar" />
              <b>Register: Kids 5:30pm</b>
              <span className="row"><em>Ava M.</em><em className="tick">✓</em></span>
              <span className="row"><em>Leo T.</em><em className="tick">✓</em></span>
              <span className="row"><em>Noah K.</em><em className="tick">✓</em></span>
            </div>
          </div>
        </div>
      </section>

      <section className="m-section" id="included">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="m-center">
            <p className="m-eyebrow">What you get</p>
            <h2 className="m-h2">Everything your club runs on.</h2>
            <p className="m-sub">Every Elite system is built from scratch for one club. This is where most clubs start, then we shape it around yours.</p>
          </div>
          <div className="elite-groups">
            {GROUPS.map((g) => (
              <section key={g.n} className="elite-group">
                <p className="n">{g.n}</p>
                <h3>{g.title}</h3>
                <p className="intro">{g.intro}</p>
                <ul className="m-ticks">
                  {g.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section dark">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="m-center">
            <p className="m-eyebrow">Custom built</p>
            <h2 className="m-h2">Built around how you run your club.</h2>
            <p className="m-sub">Off-the-shelf software makes you work its way. Your Elite system works yours.</p>
          </div>
          <div className="elite-custom">
            {CUSTOM.map((c) => (
              <div key={c.t}>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section alt">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="m-center">
            <p className="m-eyebrow">Done for you</p>
            <h2 className="m-h2">We do the heavy lifting.</h2>
            <p className="m-sub">You keep teaching. We build your system, move everything across and train your team.</p>
          </div>
          <ol className="elite-steps">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <span className="num">{i + 1}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="m-section">
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="m-center">
            <p className="m-eyebrow">Price</p>
            <h2 className="m-h2">One flat price. However big you grow.</h2>
          </div>
          <div className="elite-price">
            <div className="m-plan dark">
              <h2>Elite</h2>
              <p className="for">A system custom built for your club</p>
              <p className="price"><span>From </span><strong>£199</strong><span> /month</span></p>
              <p className="limits">Plus a one-off build fee from £1,950, quoted after your call. It covers designing and building your system and moving you across.</p>
              <a href="#enquire" className="m-btn white">Enquire about Elite</a>
              <ul>
                <li>✓ Unlimited students and locations</li>
                <li>✓ Custom built website on your own domain</li>
                <li>✓ Your own member app, built for your club</li>
                <li>✓ Coach portal for your whole team</li>
                <li>✓ Features built around how you run things</li>
                <li>✓ Hosting, updates and priority support</li>
                <li>✓ 0% of your fees, ever</li>
              </ul>
            </div>
            <div className="elite-compare">
              <h3>What it replaces</h3>
              <p>Most clubs pay for this in pieces: a web designer, a booking tool, an app and management software that takes a cut of every membership.</p>
              <div className="m-stat">
                <p className="k">A club collecting £8,000 a month in fees</p>
                <p className="v">£160 to £480</p>
                <p className="n">a month to software that takes 2% to 6% of fees, and it rises every time you grow.</p>
              </div>
              <div className="m-stat" style={{ marginTop: 16 }}>
                <p className="k">The same club on Elite</p>
                <p className="v">£199</p>
                <p className="n">a month, flat. Payment fees go to Stripe or GoCardless directly, never to us.</p>
              </div>
            </div>
          </div>
          <p className="m-fine m-center" style={{ marginTop: 24 }}>
            Want to keep it simple? Our <Link href="/pricing" className="m-link">standard plans</Link> start at £19 a month, with every core feature.
          </p>
        </div>
      </section>

      <section className="m-section alt" id="brochure" style={{ scrollMarginTop: 60 }}>
        <div className="m-center">
          <p className="m-eyebrow">Brochure</p>
          <h2 className="m-h2">Take it away with you.</h2>
          <p className="m-sub" style={{ maxWidth: 560 }}>Everything on this page in a 6-page PDF: what&apos;s included, how we build it and what it costs. Handy for sharing with your team.</p>
        </div>
        <BrochureForm />
      </section>

      <section className="m-section">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 className="m-h2 m-center" style={{ fontSize: "clamp(32px, 4.5vw, 44px)" }}>Questions.</h2>
          <div className="m-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section alt" id="enquire" style={{ scrollMarginTop: 60 }}>
        <div className="m-center">
          <p className="m-eyebrow">Enquire</p>
          <h2 className="m-h2">Let&apos;s talk about your club.</h2>
          <p className="m-sub" style={{ maxWidth: 560 }}>Tell us a little about your club and what you&apos;d want your system to do. We&apos;ll reply within one working day to book a short call.</p>
        </div>
        <EnquiryForm />
      </section>
    </div>
  );
}
