/*
 * Junbi's own marketing emails (Admin → Marketing). Pure functions with no server imports, so the
 * email creator can show a live preview in the browser with exactly the HTML that gets sent.
 *
 * Body format, kept deliberately small so it's easy to write in a text box:
 *   - A blank line starts a new paragraph.
 *   - Lines starting with "- " become a bulleted list.
 *   - Lines starting with "|" become a table. The first row is the heading row.
 *   - **bold** and *italic* work anywhere.
 *   - Merge fields: {{first_name}}, {{club_name}}, {{town}}. Missing values fall back to friendly words.
 */

export type MarketingContent = {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
};

export type MergeVars = { firstName?: string | null; clubName?: string | null; town?: string | null };

/** Every marketing email ends with this, as Stewart asked for on all Junbi marketing. */
export const RESULTS_DISCLAIMER =
  "Results vary from club to club and aren't guaranteed. Junbi isn't responsible for the success or failure of any club's marketing or growth.";

export const MERGE_FIELDS = [
  { tag: "{{first_name}}", label: "First name", fallback: "there" },
  { tag: "{{club_name}}", label: "Club name", fallback: "your club" },
  { tag: "{{town}}", label: "Town", fallback: "your area" },
] as const;

export function merge(text: string, v: MergeVars): string {
  const first = (v.firstName ?? "").trim().split(/\s+/)[0] || "there";
  const club = tidyClubName(v.clubName ?? "") || "your club";
  const town = (v.town ?? "").trim() || "your area";
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, first).replace(/\{\{\s*club_name\s*\}\}/gi, club).replace(/\{\{\s*town\s*\}\}/gi, town);
}

/**
 * Directory names often carry venue codes and suffixes ("Spartans Taekwondo 218.005", "LTA Falcons (Regular)").
 * For a friendly email we want "Spartans Taekwondo".
 */
export function tidyClubName(name: string): string {
  return name
    .replace(/\s+\d{1,4}\.\d{1,4}\b/g, "")
    .replace(/\s*\((regular|tots|cadets|\d+\.\d+)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const bold = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(\S(?:.*?\S)?)\*/g, "<em>$1</em>");
const unbold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(\S(?:.*?\S)?)\*/g, "$1");

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "table"; rows: string[][] };

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => l.trim().startsWith("|"))) {
      const rows = lines
        .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()))
        .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c))); // skip "|---|---|" divider rows
      if (rows.length) blocks.push({ kind: "table", rows });
    } else if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      blocks.push({ kind: "ul", items: lines.map((l) => l.replace(/^\s*[-•]\s+/, "")) });
    } else {
      blocks.push({ kind: "p", lines });
    }
  }
  return blocks;
}

const P = "margin:0 0 16px;font-size:16px;line-height:1.55;color:#1d1d1f";

function blockHtml(b: Block): string {
  if (b.kind === "p") return `<p style="${P}">${b.lines.map(bold).join("<br>")}</p>`;
  if (b.kind === "ul") return `<ul style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.55;color:#1d1d1f">${b.items.map((i) => `<li style="margin:0 0 6px">${bold(i)}</li>`).join("")}</ul>`;
  const [head, ...rows] = b.rows;
  const th = head.map((c, i) => `<th align="left" style="padding:10px 12px;font-size:13px;font-weight:600;color:#6e6e73;border-bottom:1px solid #d2d2d7;${i === 1 ? "color:#0066cc;" : ""}">${bold(c)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c, i) => `<td style="padding:10px 12px;font-size:15px;color:#1d1d1f;border-bottom:1px solid #e8e8ed;${i === 1 ? "font-weight:600;" : ""}">${bold(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse;background:#f5f5f7;border-radius:12px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function blockText(b: Block): string {
  if (b.kind === "p") return b.lines.map(unbold).join("\n");
  if (b.kind === "ul") return b.items.map((i) => `- ${unbold(i)}`).join("\n");
  return b.rows.map((r) => r.map(unbold).join("  |  ")).join("\n");
}

export type RenderOptions = {
  /** Personal unsubscribe link. Previews use "#". */
  unsubscribeUrl: string;
  /** Why they're getting it, e.g. "Your club is listed on the British Taekwondo club locator." */
  reason: string;
  /** Who sent it, shown in the footer. */
  sender?: string;
};

export function renderMarketingEmail(c: MarketingContent, v: MergeVars, o: RenderOptions): { subject: string; html: string; text: string } {
  const subject = merge(c.subject, v).trim() || "A note from Junbi";
  const preheader = merge(c.preheader, v).trim();
  const heading = merge(c.heading, v).trim();
  const blocks = parseBody(merge(c.body, v));
  const button = c.buttonLabel.trim() && /^https:\/\//.test(c.buttonUrl.trim()) ? { label: merge(c.buttonLabel, v).trim(), url: c.buttonUrl.trim() } : null;
  const sender = o.sender ?? "Stewart Howard, Junbi · hello@junbi.co.uk · junbi.co.uk";

  const btn = button
    ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#0066cc;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 26px;border-radius:980px">${esc(button.label)}</a></p>`
    : "";
  const hidden = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(30)}</div>`
    : "";
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">${hidden}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:36px 32px">
<tr><td>
<p style="margin:0 0 28px;font-size:22px;font-weight:600;letter-spacing:-0.025em;color:#1d1d1f">junbi</p>
${heading ? `<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f">${bold(heading)}</h1>` : ""}
${blocks.map(blockHtml).join("\n")}
${btn}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.55;color:#86868b">
<p style="margin:0 0 8px">${esc(o.reason)} Not for you? <a href="${esc(o.unsubscribeUrl)}" style="color:#86868b">Unsubscribe</a> and we won't email you again.</p>
<p style="margin:0 0 8px">${esc(RESULTS_DISCLAIMER)}</p>
<p style="margin:0">${esc(sender)}</p>
</td></tr></table>
</td></tr></table></body></html>`;

  const text = [
    ...(heading ? [unbold(heading), ""] : []),
    blocks.map(blockText).join("\n\n"),
    ...(button ? ["", `${button.label}: ${button.url}`] : []),
    "",
    "--",
    `${o.reason} Not for you? Unsubscribe: ${o.unsubscribeUrl}`,
    RESULTS_DISCLAIMER,
    sender,
  ].join("\n");

  return { subject, html, text };
}

/** Sources a prospect can come from, and the footer line that tells them why they got the email. */
export const SOURCES = [
  { key: "british-taekwondo", label: "British Taekwondo club locator", reason: "We're writing because your club is listed publicly on the British Taekwondo club locator." },
  { key: "btc", label: "British Taekwondo Council club listing", reason: "We're writing because your club is listed publicly on the British Taekwondo Council website." },
  { key: "club-website", label: "Club's own website", reason: "We're writing because your club publishes this address on its website for enquiries." },
  { key: "manual", label: "Added by hand", reason: "We're writing because we thought Junbi might be useful to your club." },
] as const;
export type SourceKey = (typeof SOURCES)[number]["key"];
export const reasonFor = (source: string) => SOURCES.find((s) => s.key === source)?.reason ?? SOURCES[SOURCES.length - 1].reason;
export const sourceLabel = (source: string) => SOURCES.find((s) => s.key === source)?.label ?? source;
