import Link from "next/link";
import { disciplineName } from "@/lib/disciplines";

/** Only shown for clubs that teach more than one art. */
export function ArtFilter({ arts, current, basePath, extra = "" }: { arts: string[]; current?: string; basePath: string; extra?: string }) {
  if (arts.length < 2) return null;
  const href = (art?: string) => `${basePath}?${new URLSearchParams({ ...(art ? { art } : {}) }).toString()}${extra}`;
  return (
    <nav className="segmented" aria-label="Filter by art" style={{ marginTop: 16 }}>
      <Link href={href()} aria-current={!current ? "true" : undefined}>All</Link>
      {arts.map((a) => (
        <Link key={a} href={href(a)} aria-current={current === a ? "true" : undefined}>
          {disciplineName(a)}
        </Link>
      ))}
    </nav>
  );
}
