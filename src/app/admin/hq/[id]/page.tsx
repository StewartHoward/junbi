import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allEbooks, ebookStats } from "@/data/library";
import { STATUS_LABEL } from "@/lib/ebooks";
import { DeliverButton } from "../../crm/Forms";
import { EbookForm } from "../EbookForm";
import { Uploads } from "../Uploads";
import { DeleteEbook } from "../DeleteEbook";

export const metadata: Metadata = { title: "Edit ebook · Junbi admin" };

export default async function EditEbookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string }> }) {
  const [{ id }, { created, saved }] = await Promise.all([params, searchParams]);
  const book = (await allEbooks()).find((b) => b.id === id);
  if (!book) notFound();
  const s = (await ebookStats()).find((x) => x.slug === book.slug) ?? { people: 0, waiting: 0, revenue: 0, downloads: 0 };
  return (
    <>
      <p style={{ margin: 0, fontSize: 14 }}><Link href="/admin/hq">‹ HQ</Link></p>
      <div className="phead" style={{ marginTop: 8 }}>
        <div><p className="eyebrow">{STATUS_LABEL[book.status]}</p><h1 className="ptitle">{book.title}</h1></div>
        <div className="acts">{book.status !== "draft" && <Link href={`/library/${book.slug}`} className="btn ghost sm" target="_blank">View in shop</Link>}</div>
      </div>
      {saved && <p className="ok-t" role="status" style={{ marginTop: 8 }}>Saved. The shop is updated.</p>}
      {created && <p className="ok-t" role="status" style={{ marginTop: 8 }}>Created. Now upload the PDF and a cover, then set the status when you&apos;re ready.</p>}

      <div className="g2" style={{ marginTop: 20, alignItems: "start" }}>
        <section className="card">
          <div className="ch"><h2>Files</h2></div>
          <div style={{ marginTop: 12 }}><Uploads ebookId={book.id} pdf={book.pdf ? { ...book.pdf, uploadedAt: book.pdf.uploadedAt.toISOString() } : null} coverUrl={book.coverUrl} /></div>
        </section>
        <section className="card">
          <div className="ch"><h2>Orders</h2><span className="m"><Link href={`/admin/crm?book=${book.slug}`}>See the people</Link></span></div>
          <div className="tiles compact" style={{ marginTop: 12 }}>
            <div className="tile"><p className="l">Ordered</p><p className="v">{s.people}</p></div>
            <div className="tile"><p className="l">Downloads</p><p className="v">{s.downloads}</p></div>
            <div className="tile"><p className="l">Waiting</p><p className="v">{s.waiting}</p></div>
          </div>
          <p className="muted" style={{ margin: "14px 0 8px", fontSize: 14 }}>When it goes live, send it to everyone who pre-ordered. Each person only gets it once.</p>
          <DeliverButton slug={book.slug} waiting={s.waiting} ready={book.ready} />
        </section>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Shop details</h2></div>
        <div style={{ marginTop: 12 }}><EbookForm book={book} key={JSON.stringify([book.slug, book.status, book.pricePence, book.worthPence, book.sort, book.title])} /></div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="ch"><h2>Delete</h2></div>
        <p className="muted" style={{ margin: "8px 0 12px", fontSize: 14 }}>Only ebooks nobody has ordered can be deleted. To take one off sale, set it to Draft.</p>
        <DeleteEbook id={book.id} title={book.title} />
      </section>
    </>
  );
}
