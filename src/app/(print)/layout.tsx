export const dynamic = "force-dynamic";

/** Bare pages meant for printing (no sidebar). */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
