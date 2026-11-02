"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setFeatureAction } from "./actions";

type Item = { key: string; label: string; hint: string; on: boolean; changed: string | null };

/** On/off switches for features that are still being built. Off means hidden from every club. */
export function FeatureSwitches({ items, ready }: { items: Item[]; ready: boolean }) {
  const [state, setState] = useOptimistic(Object.fromEntries(items.map((i) => [i.key, i.on])) as Record<string, boolean>);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const flip = (key: string) => {
    const next = !state[key];
    start(async () => {
      setState({ ...state, [key]: next });
      setMsg(await setFeatureAction(key, next));
    });
  };

  return (
    <div>
      {!ready && <p className="warn-t" style={{ margin: "8px 0 0", fontSize: 14 }}>Run the feature switches SQL in Supabase first. Until then everything below stays off.</p>}
      <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
        {items.map((i) => (
          <li key={i.key} style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--line, #e5e5ea)" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{i.label}</p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>{i.hint}</p>
              {i.changed && <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>{i.changed}</p>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state[i.key]}
              aria-label={`${i.label}: ${state[i.key] ? "on" : "off"}`}
              disabled={!ready || pending}
              onClick={() => flip(i.key)}
              className="fswitch"
            >
              <span aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p role="status" style={{ margin: "8px 0 0", fontSize: 14, minHeight: 20 }} className={msg.error ? "bad-t" : "ok-t"}>{msg.error ?? msg.ok ?? ""}</p>
    </div>
  );
}
