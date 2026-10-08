const BELT: Record<string, { bg: string; fg: string; outline?: boolean }> = {
  white: { bg: "var(--belt-white)", fg: "#1d1d1f", outline: true },
  yellow: { bg: "var(--belt-yellow)", fg: "#1d1d1f" },
  green: { bg: "var(--belt-green)", fg: "#ffffff" },
  blue: { bg: "var(--belt-blue)", fg: "#ffffff" },
  red: { bg: "var(--belt-red)", fg: "#ffffff" },
  black: { bg: "var(--belt-black)", fg: "#ffffff", outline: true },
  orange: { bg: "var(--belt-orange)", fg: "#1d1d1f" },
  purple: { bg: "var(--belt-purple)", fg: "#ffffff" },
  brown: { bg: "var(--belt-brown)", fg: "#ffffff" },
  grey: { bg: "var(--belt-grey)", fg: "#ffffff" },
  // Level-based systems (e.g. Krav Maga P1 to G5, Muay Thai Khan grades) have no belt colour.
  none: { bg: "var(--surface-alt)", fg: "var(--ink)", outline: true },
};

export function RankChip({ grade }: { grade: { name: string; beltColour: string } | null }) {
  if (!grade) return <span className="chip" style={{ background: "var(--belt-white)", color: "#1d1d1f", border: "1px solid var(--line)" }}>New starter</span>;
  const b = BELT[grade.beltColour] ?? BELT.white;
  return (
    <span className="chip" style={{ background: b.bg, color: b.fg, border: b.outline ? "1px solid var(--line)" : undefined }}>
      {grade.name}
    </span>
  );
}

export function BeltSwatch({ colour, state }: { colour: string; state: "done" | "current" | "todo" }) {
  const b = BELT[colour] ?? BELT.white;
  return (
    <span
      style={{
        flex: 1,
        height: 12,
        borderRadius: 6,
        background: state === "todo" ? "var(--line-soft)" : b.bg,
        border: state !== "todo" && b.outline ? "1px solid var(--line)" : undefined,
        outline: state === "current" ? "2px solid var(--ink)" : undefined,
        outlineOffset: 2,
      }}
    />
  );
}

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  active: { label: "✓ Active", tone: "ok" },
  trial: { label: "Trial", tone: "neutral" },
  paused: { label: "Paused", tone: "warn" },
  frozen: { label: "Frozen", tone: "warn" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <span className={`pill ${s.tone}`}>{s.label}</span>;
}

const PAYMENT: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  pending: { label: "Pending", tone: "neutral" },
  submitted: { label: "Submitted", tone: "neutral" },
  confirmed: { label: "✓ Paid", tone: "ok" },
  paid_out: { label: "✓ Paid", tone: "ok" },
  retrying: { label: "↻ Retrying", tone: "warn" },
  failed: { label: "! Failed", tone: "bad" },
  charged_back: { label: "! Charged back", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function PaymentPill({ status }: { status: string }) {
  const p = PAYMENT[status] ?? { label: status, tone: "neutral" as const };
  return <span className={`pill ${p.tone}`}>{p.label}</span>;
}
