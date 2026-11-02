/*
 * The Junbi Library: free ebooks for club owners, "sold" for £0 through a checkout that adds the buyer to the
 * CRM. Put the PDF in content/ebooks/<slug>.pdf and set ready: true. Until then the book takes pre-orders and
 * everyone waiting gets it from the CRM page in one go.
 */

export type Ebook = {
  slug: string;
  title: string;
  subtitle: string;
  /** One line for cards and emails. */
  pitch: string;
  pages: number;
  /** Cover colours. */
  cover: { bg: string; fg: string; accent: string };
  forWho: string[];
  contents: string[];
  /** One practical tip from the book, used in the first follow-up email. */
  tip: { heading: string; body: string };
  ready: boolean;
};

export const EBOOKS: Ebook[] = [
  {
    slug: "club-starter-kit",
    title: "The Club Starter Kit",
    subtitle: "Everything to sort before your first class, in the order you'll need it",
    pitch: "Qualifications, insurance, checks, a venue, prices and your first 20 students.",
    pages: 32,
    cover: { bg: "#1d1d1f", fg: "#ffffff", accent: "#c8102e" },
    forWho: ["Instructors about to open their own club", "Assistant instructors thinking about it", "Anyone who's just started and wants a checklist"],
    contents: [
      "Associations, qualifications and what you actually need",
      "DBS, PVG and AccessNI checks, first aid and safeguarding",
      "Insurance in plain English",
      "Finding a venue and agreeing the hire",
      "Setting prices that cover your costs",
      "The admin to have ready from day one",
      "Finding your first 20 students",
      "A 30-day launch checklist",
    ],
    tip: { heading: "Start with two classes, not six", body: "New clubs that open with a full timetable spread a small number of students thinly and every class feels empty. Start with one junior and one adult class at times that suit families, fill them, then add more." },
    ready: false,
  },
  {
    slug: "full-classes",
    title: "Full Classes",
    subtitle: "How martial arts clubs find students, turn trials into members and keep them",
    pitch: "Your Google listing, trial classes that convert, and why members leave.",
    pages: 40,
    cover: { bg: "#c8102e", fg: "#ffffff", accent: "#f5c400" },
    forWho: ["Club owners who want more students", "Clubs with plenty of enquiries but too few joining", "Anyone losing members after a few months"],
    contents: [
      "Getting found on Google first",
      "The trial class booking that turns maybe into yes",
      "The day-before reminder and the first class",
      "Asking them to join on the night",
      "School tasters, holiday camps and referrals",
      "Why members leave, and the warning signs",
      "Simple numbers to track every month",
    ],
    tip: { heading: "Give every trial a real date", body: "\"Come along whenever\" loses people. Book every enquiry onto a real class and date there and then, and send a short reminder the day before. It's the biggest single change most clubs can make to how many trials turn up." },
    ready: false,
  },
  {
    slug: "paid-on-time",
    title: "Paid on Time",
    subtitle: "Pricing, Direct Debit and membership terms for martial arts clubs",
    pitch: "Set prices with confidence, collect them without chasing, and raise them without losing members.",
    pages: 28,
    cover: { bg: "#1f4fbf", fg: "#ffffff", accent: "#f5c400" },
    forWho: ["Clubs still collecting cash or bank transfers", "Owners who haven't raised prices in years", "Anyone writing membership terms"],
    contents: [
      "Working out what your classes really cost to run",
      "Memberships families understand",
      "Sign-up fees that feel like good value",
      "Moving everyone to Direct Debit",
      "Raising prices without losing members",
      "Membership terms: what to include",
      "Failed payments and how to handle them kindly",
    ],
    tip: { heading: "Raise a little every year", body: "Small yearly rises with a month's notice and a plain reason upset far fewer families than a big jump every few years. Many clubs keep existing members on their old price for a few months as a thank-you." },
    ready: false,
  },
];

export const ebookBySlug = (slug: string) => EBOOKS.find((b) => b.slug === slug) ?? null;

/** Options for the checkout form. */
export const ROLES = ["Club owner", "Instructor", "Assistant instructor", "Thinking of starting a club", "Association", "Other"] as const;
export const SIZES = ["Not open yet", "Under 50 students", "50 to 150", "150 to 300", "Over 300"] as const;
export const SYSTEMS = ["Spreadsheets or paper", "NEST", "Martialytics", "Class Manager", "ClubRight", "Another system", "Nothing yet"] as const;
export const ARTS = ["Taekwondo", "Karate", "Kickboxing", "Judo", "Brazilian Jiu-Jitsu", "Krav Maga", "Muay Thai", "MMA", "Other"] as const;
