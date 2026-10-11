import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when a martial arts club uses Junbi.",
};

const UPDATED = "11 October 2026";

export default function TermsPage() {
  return (
    <section className="m-section" style={{ paddingTop: 72 }}>
      <article className="m-legal">
        <h1>Terms of service</h1>
        <p className="m-legal-meta">Last updated {UPDATED}</p>

        <p>
          These terms apply when a club signs up for and uses Junbi. Please read them with our <Link href="/privacy">privacy policy</Link>. If you
          have any questions, email <a href="mailto:hello@junbi.co.uk">hello@junbi.co.uk</a>.
        </p>

        <h2>1. Who we are</h2>
        <p>
          Junbi is club management software for martial arts clubs, provided at junbi.co.uk by Stewart Howard, a sole trader in England, trading as
          Junbi (&ldquo;Junbi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). &ldquo;You&rdquo; and &ldquo;the club&rdquo; mean the club or business
          that signs up, and the person signing up on its behalf.
        </p>

        <h2>2. Signing up</h2>
        <ul>
          <li>You must be 18 or over and allowed to agree to these terms for your club.</li>
          <li>Junbi is for businesses and clubs, not for personal or household use.</li>
          <li>Keep your login details safe. You&apos;re responsible for what happens in your club&apos;s account, including what your staff do.</li>
          <li>Only invite staff who need access, and remove them when they leave.</li>
        </ul>

        <h2>3. Free trial</h2>
        <p>
          New clubs get a free 7-day trial. You add a card when you sign up, but nothing is taken until the trial ends. Your first monthly payment
          is taken on the day your trial ends, unless you cancel before then. If a payment fails, your account may be paused, and nothing you&apos;ve
          added is lost straight away.
        </p>

        <h2>4. Plans and fees</h2>
        <ul>
          <li>Our plans and prices are shown on our <Link href="/pricing">pricing page</Link>. Every plan has every feature; plans differ by club size.</li>
          <li>Fees are charged monthly in advance. Prices include any VAT that applies.</li>
          <li>Discount codes and Founding Club offers apply as described when you sign up. A Founding Club&apos;s price is locked for two years.</li>
          <li>We may change our prices. We&apos;ll give you at least 30 days&apos; notice by email, and you can cancel before the change takes effect.</li>
          <li>If a payment to us fails, we&apos;ll let you know. If it isn&apos;t sorted within 14 days, we may pause your account until it is.</li>
        </ul>

        <h2>5. Collecting money from your members</h2>
        <ul>
          <li>
            Junbi is not a payment provider and never holds your money. You connect your own Stripe or GoCardless account, and payments go straight
            from your members to you. Junbi takes 0% of them.
          </li>
          <li>
            Your agreement with Stripe or GoCardless is between you and them. Their fees, payout times, checks and decisions are theirs, and we
            aren&apos;t responsible for them.
          </li>
          <li>
            You&apos;re responsible for the prices and sign-up fees you set, for your own terms with your members, and for handling refunds, disputes,
            cancellations and the Direct Debit Guarantee.
          </li>
        </ul>

        <h2>6. Your club&apos;s information</h2>
        <p>
          Everything your club puts into Junbi (members, families, belts, attendance, enquiries, messages and so on) belongs to your club. You can
          ask us for a copy at any time.
        </p>
        <p>For personal information in your club&apos;s records, your club is the controller and Junbi is your processor. You agree that:</p>
        <ul>
          <li>you have a lawful reason to collect and use it, and you&apos;ve told your members and families how you use it;</li>
          <li>you have the consents you need, for example for photos, and you treat medical information with extra care;</li>
          <li>you keep it accurate, and you only give staff the access they need.</li>
        </ul>
        <p>As your processor, we will:</p>
        <ul>
          <li>only use your club&apos;s records to provide Junbi to you, following your instructions;</li>
          <li>make sure anyone who works on Junbi keeps them confidential;</li>
          <li>keep them secure, as described in our privacy policy;</li>
          <li>only use the sub-processors listed in our privacy policy, tell you before adding new ones, and hold them to the same standards;</li>
          <li>help you respond to people exercising their data rights, and help with security and data protection checks where reasonable;</li>
          <li>tell you without undue delay if we become aware of a breach affecting your club&apos;s records;</li>
          <li>delete or return your club&apos;s records when you leave, as set out in section 10;</li>
          <li>give you the information you reasonably need to show we&apos;re meeting these commitments.</li>
        </ul>

        <h2>7. Fair use</h2>
        <p>Please don&apos;t use Junbi to:</p>
        <ul>
          <li>break the law, or store anything you don&apos;t have the right to store;</li>
          <li>send spam, or message people who haven&apos;t given you their details for your club;</li>
          <li>try to access another club&apos;s information, disrupt Junbi, or get around its security or limits;</li>
          <li>copy, resell or reverse engineer Junbi.</li>
        </ul>
        <p>If you do, we may suspend or close your account. Where we can, we&apos;ll warn you first.</p>

        <h2>8. Keeping Junbi running</h2>
        <ul>
          <li>We work hard to keep Junbi available and working well, but we can&apos;t promise it will never be interrupted or have mistakes.</li>
          <li>We sometimes need to carry out maintenance. We&apos;ll try to do it at quiet times and give notice for anything major.</li>
          <li>We improve Junbi over time. We may change or remove features, but we won&apos;t make changes that take away the core of what you pay for without telling you first.</li>
          <li>Support is by email at <a href="mailto:hello@junbi.co.uk">hello@junbi.co.uk</a>. We aim to reply within one working day.</li>
        </ul>

        <h2>9. Our software</h2>
        <p>
          Junbi, including its design, code and content, belongs to us. While you have an account, you may use it for your club. These terms
          don&apos;t give you any other rights to it. If you send us ideas or feedback, we&apos;re free to use them.
        </p>

        <h2>10. Leaving Junbi</h2>
        <ul>
          <li>You can cancel at any time. Your plan runs until the end of the month you&apos;ve paid for, and we don&apos;t refund part months.</li>
          <li>Before you go, you can ask us for a copy of your club&apos;s information.</li>
          <li>
            We delete your club&apos;s records within 30 days of your account closing, apart from anything we must keep by law, such as billing
            records.
          </li>
          <li>We may close your account if you seriously or repeatedly break these terms, or with 30 days&apos; notice if we stop providing Junbi.</li>
          <li>If you cancel, remember to cancel or move your members&apos; Direct Debits in your own Stripe or GoCardless account if you need to.</li>
        </ul>

        <h2>11. Liability</h2>
        <ul>
          <li>Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law doesn&apos;t allow us to limit.</li>
          <li>We aren&apos;t liable for loss of profit, revenue, business or goodwill, or for any indirect or consequential loss.</li>
          <li>We aren&apos;t responsible for the actions of Stripe, GoCardless or your members, or for decisions you make using information in Junbi.</li>
          <li>Otherwise, our total liability to you in any 12 months is limited to the fees you paid us in those 12 months.</li>
        </ul>

        <h2>12. Changes to these terms</h2>
        <p>
          We may update these terms. If a change matters, we&apos;ll email the club owner at least 30 days before it takes effect. If you keep using
          Junbi after that, the new terms apply. If you don&apos;t agree, you can cancel before they start.
        </p>

        <h2>13. The legal bits</h2>
        <ul>
          <li>These terms, together with our privacy policy and anything you agree to when you sign up, are the whole agreement between us.</li>
          <li>If part of these terms can&apos;t be enforced, the rest still applies.</li>
          <li>If we don&apos;t enforce something straight away, we can still enforce it later.</li>
          <li>We may transfer these terms to another business that takes over Junbi, for example a limited company we set up. We&apos;ll tell you if we do.</li>
          <li>These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction.</li>
        </ul>

        <h2>14. Contact</h2>
        <p>
          Email <a href="mailto:hello@junbi.co.uk">hello@junbi.co.uk</a> with any questions about these terms.
        </p>

        <p style={{ marginTop: 40 }}>
          <Link href="/">Back to Junbi</Link>
        </p>
      </article>
    </section>
  );
}
