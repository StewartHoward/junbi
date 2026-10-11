export const STATUS_LABEL: Record<string, string> = { new: "New", booked: "Trial booked", attended: "Came to trial", converted: "Joined", lost: "Not joining" };
const STATUS_TONE: Record<string, string> = { new: "neutral", booked: "ready", attended: "warn", converted: "ok", lost: "neutral" };

export function LeadStatusPill({ status }: { status: string }) {
  return <span className={`pill ${STATUS_TONE[status] ?? "neutral"}`}>{status === "converted" ? "✓ " : ""}{STATUS_LABEL[status] ?? status}</span>;
}

export const sessionText = (d: Date | null) =>
  d
    ? d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" }).replace(/ (am|pm)/, "$1")
    : null;
