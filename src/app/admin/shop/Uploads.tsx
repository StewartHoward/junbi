"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_COVER, MAX_PDF, UPLOAD_CHUNK } from "@/lib/ebooks";
import { removeCoverAction } from "./actions";

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

async function send(ebookId: string, kind: "pdf" | "cover", file: File, onProgress: (p: number) => void) {
  const total = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK));
  for (let i = 0; i < total; i++) {
    const res = await fetch("/api/hq/upload", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "x-ebook": ebookId, "x-kind": kind, "x-index": String(i), "x-total": String(total), "x-size": String(file.size), "x-name": encodeURIComponent(file.name) },
      body: file.slice(i * UPLOAD_CHUNK, (i + 1) * UPLOAD_CHUNK),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Upload failed. Try again.");
    onProgress((i + 1) / total);
  }
}

/** The ebook's PDF and cover image. Big PDFs go up in pieces with a progress bar. */
export function Uploads({ ebookId, pdf, coverUrl }: { ebookId: string; pdf: { name: string; size: number; uploadedAt: string } | null; coverUrl: string | null }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ kind: string; p: number } | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [, start] = useTransition();
  const pdfInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const upload = async (kind: "pdf" | "cover", file: File | undefined) => {
    if (!file) return;
    const max = kind === "pdf" ? MAX_PDF : Math.min(MAX_COVER, UPLOAD_CHUNK);
    if (file.size > max) return setMsg({ error: `That file is ${mb(file.size)}. The limit is ${mb(max)}.` });
    setMsg({});
    setProgress({ kind, p: 0 });
    try {
      await send(ebookId, kind, file, (p) => setProgress({ kind, p }));
      setMsg({ ok: kind === "pdf" ? "PDF uploaded. Set the status to Live when you're ready." : "Cover uploaded." });
      router.refresh();
    } catch (err) {
      setMsg({ error: (err as Error).message });
    } finally {
      setProgress(null);
      if (pdfInput.current) pdfInput.current.value = "";
      if (coverInput.current) coverInput.current.value = "";
    }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>The ebook (PDF)</p>
        <p className="muted" style={{ margin: "2px 0 8px", fontSize: 14 }}>
          {pdf ? <>Current file: <b>{pdf.name}</b>, {mb(pdf.size)}, uploaded {new Date(pdf.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Uploading a new one replaces it for everyone, including past buyers.</> : `No PDF yet. Up to ${mb(MAX_PDF)}.`}
        </p>
        <label className="btn secondary sm" style={{ cursor: progress ? "default" : "pointer" }}>
          {pdf ? "Replace PDF" : "Upload PDF"}
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden disabled={Boolean(progress)} onChange={(ev) => upload("pdf", ev.target.files?.[0])} />
        </label>
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>Cover image</p>
        <p className="muted" style={{ margin: "2px 0 8px", fontSize: 14 }}>Optional. A portrait JPEG or PNG (3:4 works best), up to 3MB. Without one, a cover is drawn in the colours below.</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {coverUrl && <img src={coverUrl} alt="Current cover" style={{ width: 60, borderRadius: 4, boxShadow: "0 4px 12px -4px rgba(0,0,0,.3)" }} />}
          <label className="btn secondary sm" style={{ cursor: progress ? "default" : "pointer" }}>
            {coverUrl ? "Replace cover" : "Upload cover"}
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={Boolean(progress)} onChange={(ev) => upload("cover", ev.target.files?.[0])} />
          </label>
          {coverUrl && <button type="button" className="btn ghost sm" onClick={() => start(async () => { await removeCoverAction(ebookId); router.refresh(); })}>Use the drawn cover</button>}
        </div>
      </div>
      {progress && (
        <div role="progressbar" aria-valuenow={Math.round(progress.p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading">
          <div style={{ height: 8, borderRadius: 4, background: "#e8e8ed", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(4, progress.p * 100)}%`, background: "var(--action, #0071e3)", transition: "width .2s" }} /></div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>Uploading {progress.kind === "pdf" ? "PDF" : "cover"}… {Math.round(progress.p * 100)}%</p>
        </div>
      )}
      {msg.error && <p className="bad-t" role="alert" style={{ margin: 0 }}>{msg.error}</p>}
      {msg.ok && <p className="ok-t" role="status" style={{ margin: 0 }}>{msg.ok}</p>}
    </div>
  );
}
