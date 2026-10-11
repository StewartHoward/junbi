import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Junbi collects, uses and protects personal information for martial arts clubs, their staff, members and families.",
};

const UPDATED = "11 October 2026";

export default function PrivacyPage() {
  return (
    <section className="m-section" style={{ paddingTop: 72 }}>
      <article className="m-legal">
        <h1>Privacy policy</h1>
        <p className="m-legal-meta">Last updated {UPDATED}</p>

        <p>
          This policy explains what personal information Junbi handles, why, who we share it with and the choices you have. We&apos;ve written it in
          plain English. If anything is unclear, email <a href="mailto:hello@junbi.co.uk">hello@junbi.co.uk</a>.
        </p>

        <h2>1. Who we are</h2>
        <p>
          Junbi is club management software for martial arts clubs, available at junbi.co.uk. Junbi is run by Stewart Howard as a sole trader in
          England (&ldquo;Junbi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). You can contact us about anything in this policy at{" "}
          <a href="mailto:hello@junbi.co.uk">hello@junbi.co.uk</a>.
        </p>

        <h2>2. Our two roles</h2>
        <p>We handle personal information in two different ways, and the rules are slightly different for each.</p>
        <ul>
          <li>
            <strong>Club accounts (we are the controller).</strong> When a club owner or staff member signs up and uses Junbi, we decide how their
            account information is used. We are responsible for it.
          </li>
          <li>
            <strong>Club records (the club is the controller, we are its processor).</strong> Clubs use Junbi to keep records about their members,
            families, enquiries and payments. The club decides what to collect and why, and is responsible for that information. We only use it to
            provide Junbi to the club, following the club&apos;s instructions. If you train at, or are a parent at, a club that uses Junbi, the club
            is your first point of contact for questions about your information.
          </li>
        </ul>

        <h2>3. What we collect</h2>
        <h3>About club owners and staff</h3>
        <ul>
          <li>Name, email address and a securely hashed password (we never store your password itself).</li>
          <li>Your club&apos;s details: club name, sites and addresses, classes, plan and any discount code used.</li>
          <li>Which staff have access, their role and which sites they cover.</li>
          <li>A record of important actions in the account (for example who changed a belt or removed a site) to keep the account secure.</li>
          <li>Emails we send you, such as password resets, invitations and trial reminders, and whether they were delivered.</li>
        </ul>
        <h3>Club records, held on the club&apos;s behalf</h3>
        <ul>
          <li>
            Members: name, date of birth, site, belt and grading history, attendance, membership and status. Where the club or family provides it,
            medical or additional needs notes, and consent for first aid and photos.
          </li>
          <li>Parents, guardians and adult members: name, relationship, email address and phone number.</li>
          <li>
            Payments: which membership a family is on, the status of their Direct Debit and their payment history. Bank details are entered directly
            with Stripe or GoCardless and are not stored by Junbi.
          </li>
          <li>Enquiries (leads): contact details, who would be training and their age, trial session details and how they heard about the club.</li>
          <li>Messages the club sends to families through Junbi, and who they went to.</li>
          <li>Information families give when they sign up through a club&apos;s sign-up link or QR code.</li>
        </ul>
        <p>
          Medical information is a special category of personal information. Clubs collect it so instructors can keep members safe, and in Junbi only
          staff with the right role can see it.
        </p>

        <h2>4. How we use it</h2>
        <ul>
          <li>To provide Junbi: running club accounts, registers, belts, sign-ups, messages and payments.</li>
          <li>To send emails Junbi needs to send: sign-in and password emails, staff invitations, sign-up confirmations, trial reminders, lead welcome and reminder emails, and messages a club chooses to send.</li>
          <li>To keep Junbi secure, prevent misuse and fix problems.</li>
          <li>To provide support when you contact us.</li>
          <li>To meet our legal obligations, for example keeping business and tax records.</li>
        </ul>
        <p>We don&apos;t sell personal information, we don&apos;t use it for advertising, and we don&apos;t make automated decisions about people that have legal or similarly significant effects.</p>

        <h2>5. Our legal reasons (lawful bases)</h2>
        <ul>
          <li><strong>Contract:</strong> to provide the service a club has signed up for.</li>
          <li><strong>Legitimate interests:</strong> to keep Junbi secure, improve it and send essential service emails, in ways people would reasonably expect.</li>
          <li><strong>Legal obligation:</strong> to keep records the law requires.</li>
        </ul>
        <p>
          For club records, the club chooses its own lawful bases (for example contract for memberships and, for medical notes, the conditions that
          allow processing health information to keep people safe, or explicit consent). We process those records on the club&apos;s instructions.
        </p>

        <h2>6. Who we share it with</h2>
        <p>We use a small number of trusted companies to run Junbi. They only use personal information to provide their service to us.</p>
        <ul>
          <li><strong>Supabase</strong>: our database, hosted in London, UK.</li>
          <li><strong>Netlify</strong>: hosts the Junbi website and app. The app&apos;s servers run in London; Netlify is a US company.</li>
          <li><strong>Resend</strong>: sends Junbi&apos;s emails. Resend is a US company and sends our email from the EU.</li>
          <li>
            <strong>Stripe and GoCardless</strong>: each club connects its own Stripe or GoCardless account to collect Direct Debits. When a family
            sets up a Direct Debit, their details go to that provider, which handles them under its own privacy policy. Junbi receives the payment
            status and history so the club can see who has paid.
          </li>
        </ul>
        <p>We may also share information if the law requires it, or to protect the rights and safety of Junbi, our customers or others.</p>

        <h2>7. International transfers</h2>
        <p>
          Our database is in the UK. Where a provider is based outside the UK, such as in the United States, we rely on the safeguards UK law
          provides, such as the UK Extension to the EU-US Data Privacy Framework or the UK&apos;s International Data Transfer Agreement or Addendum.
        </p>

        <h2>8. How long we keep it</h2>
        <ul>
          <li>Club account information: for as long as the club has a Junbi account.</li>
          <li>
            Club records: for as long as the club keeps them in Junbi. A club owner can ask us to delete the club&apos;s account and records at any
            time, and we will do so within 30 days, apart from anything we must keep by law.
          </li>
          <li>Business and billing records: for six years, as UK tax law requires.</li>
          <li>Backups are kept for a short period and then overwritten.</li>
        </ul>

        <h2>9. Keeping it safe</h2>
        <ul>
          <li>All connections to Junbi are encrypted (HTTPS).</li>
          <li>Each club&apos;s records are kept separate at database level, so one club can never see another&apos;s.</li>
          <li>Passwords are hashed, and the links between Junbi and a club&apos;s payment account are encrypted.</li>
          <li>Staff only see what their role allows. For example, only staff with the right role can see medical notes or payment amounts.</li>
        </ul>

        <h2>10. Children</h2>
        <p>
          Many clubs teach children. Children&apos;s information in Junbi is provided by their parent or guardian, or by the club, and is held on
          the club&apos;s behalf. Junbi accounts are for adults running clubs. We don&apos;t market to children.
        </p>

        <h2>11. Cookies</h2>
        <p>
          Junbi uses one essential cookie to keep you signed in. We don&apos;t use advertising or tracking cookies, so there&apos;s nothing to accept
          or decline.
        </p>

        <h2>12. Your rights</h2>
        <p>
          You have the right to ask for a copy of your information, to have it corrected, deleted or restricted, to object to how it&apos;s used, and to
          receive it in a portable format. Some rights depend on the reason we hold the information.
        </p>
        <ul>
          <li>For a club account, email us at <a href="mailto:hello@junbi.co.uk">hello@junbi.co.uk</a>.</li>
          <li>For club records (for example as a member or parent), contact your club first. We&apos;ll help the club respond.</li>
        </ul>
        <p>We&apos;ll reply within one month.</p>

        <h2>13. Complaints</h2>
        <p>
          If you&apos;re unhappy with how we&apos;ve handled your information, please tell us first so we can put it right. You can also complain to
          the Information Commissioner&apos;s Office (ICO) at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a> or on
          0303 123 1113.
        </p>

        <h2>14. Changes to this policy</h2>
        <p>
          We&apos;ll update this policy when Junbi changes. The date at the top shows when it last changed. If a change matters to club owners,
          we&apos;ll tell them by email.
        </p>

        <p style={{ marginTop: 40 }}>
          <Link href="/">Back to Junbi</Link>
        </p>
      </article>
    </section>
  );
}
