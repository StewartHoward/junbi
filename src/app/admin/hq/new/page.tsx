import Link from "next/link";
import type { Metadata } from "next";
import { EbookForm } from "../EbookForm";

export const metadata: Metadata = { title: "New ebook · Junbi admin" };

export default function NewEbookPage() {
  return (
    <>
      <p style={{ margin: 0, fontSize: 14 }}><Link href="/admin/hq">‹ HQ</Link></p>
      <div className="phead" style={{ marginTop: 8 }}><div><p className="eyebrow">Junbi HQ</p><h1 className="ptitle">New ebook</h1></div></div>
      <p className="muted" style={{ marginTop: 8 }}>Fill in the details and save. You can upload the PDF and a cover on the next page. It stays hidden as a Draft until you change its status.</p>
      <section className="card" style={{ marginTop: 20 }}><EbookForm book={null} /></section>
    </>
  );
}
