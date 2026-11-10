/*
 * The Junbi Library: ebooks for club owners, managed in HQ on the Junbi admin page (src/data/library.ts).
 * An ebook can be free (a £0 checkout) or paid by card through Junbi's Stripe. Either way the buyer lands in
 * the CRM. A "worth" price can be shown crossed out next to the real one.
 */

export type EbookStatus = "draft" | "preorder" | "live";

export type Ebook = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  /** One line for cards and emails. */
  pitch: string;
  /** Longer description for the product page. Blank lines start new paragraphs. */
  description: string;
  pages: number;
  pricePence: number;
  worthPence: number | null;
  cover: { bg: string; fg: string; accent: string };
  /** A designed cover image, if one has been uploaded; otherwise a cover is drawn. */
  coverUrl: string | null;
  forWho: string[];
  contents: string[];
  /** One practical tip from the book, used in the first follow-up email. */
  tip: { heading: string; body: string };
  status: EbookStatus;
  /** Order in the shop (lower first). */
  sort: number;
  pdf: { name: string; size: number; uploadedAt: Date } | null;
  /** On sale with a file to download. */
  ready: boolean;
};

export const STATUS_LABEL: Record<EbookStatus, string> = { draft: "Draft (hidden)", preorder: "Pre-orders", live: "Live" };

export const formatPrice = (pence: number) => (pence === 0 ? "£0" : `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`);

/** Options for the checkout form. */
export const ROLES = ["Club owner", "Instructor", "Assistant instructor", "Thinking of starting a club", "Association", "Other"] as const;
export const SIZES = ["Not open yet", "Under 50 students", "50 to 150", "150 to 300", "Over 300"] as const;
export const SYSTEMS = ["Spreadsheets or paper", "NEST", "Martialytics", "Class Manager", "ClubRight", "Another system", "Nothing yet"] as const;
/** Which style of taekwondo a lead teaches. (Older leads may hold other arts from before Junbi focused on taekwondo.) */
export const ARTS = ["WT / Kukkiwon", "ITF", "Independent", "Another art"] as const;

/** Files are uploaded in pieces this big so each request stays under the hosting limit. */
export const UPLOAD_CHUNK = 3 * 1024 * 1024;
export const MAX_PDF = 20 * 1024 * 1024;
export const MAX_COVER = 8 * 1024 * 1024;
