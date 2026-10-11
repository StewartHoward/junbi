import "../(marketing)/marketing.css";

export const dynamic = "force-dynamic";

/** Public pages a club shares with its families. Kept plain: the club's name leads, Junbi stays in the footer. */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1 }}>{children}</main>
      <footer className="m-fine" style={{ textAlign: "center", padding: "32px 16px" }}>
        Club sign-up by junbi · <a href="/privacy" style={{ color: "inherit" }}>Privacy</a>
      </footer>
    </div>
  );
}
