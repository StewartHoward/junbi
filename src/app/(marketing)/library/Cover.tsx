import { formatPrice, type Ebook } from "@/lib/ebooks";

/** The ebook's uploaded cover, or a drawn one in its colours. */
export function Cover({ book, size = "md" }: { book: Ebook; size?: "xs" | "sm" | "md" | "lg" }) {
  if (book.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`m-cover img ${size}`} src={book.coverUrl} alt={`Cover of ${book.title}`} loading={size === "lg" ? "eager" : "lazy"} />;
  }
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

/** The price, with the "worth" price crossed out when there is one. */
export const Price = ({ book, big }: { book: Ebook; big?: boolean }) => (
  <span className={`m-price${big ? " big" : ""}`}>
    {book.worthPence ? <s className="was" aria-label={`Worth ${formatPrice(book.worthPence)}`}>{formatPrice(book.worthPence)}</s> : null}
    <span className="now">{formatPrice(book.pricePence)}</span>
    {book.pricePence === 0 && <span className="tag">Free</span>}
  </span>
);
