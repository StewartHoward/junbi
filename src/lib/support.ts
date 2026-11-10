/** Quick answers in the support button. Keep them short, true and in plain UK English. */
export const SUPPORT_FAQ: Array<{ q: string; a: string; tags?: string }> = [
  { q: "How much does Junbi cost?", a: "One flat monthly price from £19, depending on the size of your club. Every plan has every feature, and we never take a percentage of your membership fees.", tags: "price pricing plans cost fee" },
  { q: "How does the free trial work?", a: "You get 7 days free with every feature. You add your card when you sign up, and you're not charged until the trial ends. Cancel before then and you pay nothing.", tags: "trial free card charge" },
  { q: "Do you take a cut of our fees?", a: "No. Membership money goes from the parent's bank straight to yours through your own Stripe or GoCardless account. Junbi never holds it.", tags: "percentage fees commission money" },
  { q: "Stripe or GoCardless?", a: "Either works for UK Direct Debit. If you already use one, connect that. Stripe can also take card payments for one-off things.", tags: "stripe gocardless direct debit payments" },
  { q: "Can we move from our current system?", a: "Yes. Import your students, families and belts from a spreadsheet or your current system's export. If your Direct Debits are already in your own Stripe account, Junbi can take them over without families signing up again.", tags: "switch move import migrate nest martialytics spreadsheet" },
  { q: "Does it work for WT and ITF clubs?", a: "Yes. WT (Kukkiwon) and ITF grades are ready to go, from 10th kup to black belt. You can change the grades and colours to match your association's syllabus.", tags: "taekwondo wt itf kukkiwon belts grades syllabus kup dan art arts" },
  { q: "How do parents sign up?", a: "Share your club's sign-up link or QR code. Parents choose a membership, fill in their details and set up Direct Debit on their phone in one go.", tags: "parents families join signup qr" },
  { q: "Can instructors use it?", a: "Yes. Give each instructor their own login. They see their classes and registers, but never payment amounts.", tags: "staff instructors coaches logins permissions" },
  { q: "Can I change plan or cancel?", a: "Any time, up or down, from Settings. There's no contract.", tags: "cancel change plan contract" },
  { q: "Is our data safe?", a: "Your data is stored in the UK, every club's records are kept separate, and only staff with the right role can see sensitive details like medical notes.", tags: "security data privacy gdpr safe" },
  { q: "Where are the free ebooks?", a: "In the Junbi Library at junbi.co.uk/library. Many are free, and you can order as many as you like.", tags: "ebooks library books free" },
];
