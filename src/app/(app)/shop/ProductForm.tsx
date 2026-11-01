"use client";

import { useActionState, useState } from "react";
import { FieldError, errProps } from "@/components/FormBits";
import type { ProductState } from "./actions";

type Product = { name: string; description: string | null; price: string; options: string };

/** Add a product, or change one. Sizes go in as a list separated by commas. */
export function ProductForm({ action, product, label }: { action: (s: ProductState, f: FormData) => Promise<ProductState>; product?: Product; label: string }) {
  const [state, run, pending] = useActionState<ProductState, FormData>(action, {});
  const [open, setOpen] = useState(false);
  const e = state.errors;
  const v = state.values;
  if (!open) {
    return (
      <div>
        {state.saved ? <p role="status" className="muted" style={{ fontSize: 14, marginBottom: 6 }}>✓ Saved</p> : null}
        <button type="button" className={product ? "btn ghost sm" : "btn primary"} onClick={() => setOpen(true)}>{label}</button>
      </div>
    );
  }
  return (
    <form key={state.saved ?? 0} action={async (f) => { await run(f); }} className="form" noValidate style={{ maxWidth: "none", marginTop: 8, width: "100%" }}>
      {e?.form && <p className="error" role="alert">{e.form}</p>}
      <div className="grid2">
        <div>
          <label htmlFor="p-name">Name</label>
          <input id="p-name" name="name" placeholder="e.g. Club dobok" defaultValue={v?.name ?? product?.name} {...errProps("name", e)} />
          <FieldError id="name-err" msg={e?.name} />
        </div>
        <div>
          <label htmlFor="p-price">Price</label>
          <input id="p-price" name="price" inputMode="decimal" placeholder="e.g. 35" defaultValue={v?.price ?? product?.price} {...errProps("price", e)} />
          <FieldError id="price-err" msg={e?.price} />
        </div>
      </div>
      <div>
        <label htmlFor="p-options">Sizes or options (optional)</label>
        <input id="p-options" name="options" placeholder="e.g. 110cm, 120cm, 130cm, 140cm" defaultValue={v?.options ?? product?.options} />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Separate them with commas. Families must pick one.</p>
      </div>
      <div>
        <label htmlFor="p-description">Description (optional)</label>
        <input id="p-description" name="description" placeholder="e.g. Lightweight student uniform with club badge" defaultValue={v?.description ?? product?.description ?? ""} />
      </div>
      <div className="actions">
        <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
    </form>
  );
}
