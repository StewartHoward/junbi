import type { Ebook } from "@/lib/ebooks";

/** A drawn book cover, so every ebook has one before its design is final. */
export function Cover({ book, size = "md" }: { book: Ebook; size?: "xs" | "sm" | "md" | "lg" }) {
  return (
    <div className={`m-cover ${size}`} style={{ background: book.cover.bg, color: book.cover.fg }} role="img" aria-label={`Cover of ${book.title}`}>
      <span className="m-cover-spine" aria-hidden="true" />
      <span className="m-cover-kicker">Junbi Library</span>
      <span className="m-cover-title">{book.title}</span>
      <span className="m-cover-sub">{book.subtitle}</span>
      <span className="m-cover-belt" style={{ background: book.cover.accent }} aria-hidden="true" />
      <span className="m-cover-mark">junbi</span>
    </div>
  );
}

export const Price = ({ big }: { big?: boolean }) => (
  <span className={`m-price${big ? " big" : ""}`}>
    <span className="now">£0</span>
    <span className="tag">Free</span>
  </span>
);
