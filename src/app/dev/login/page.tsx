import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { signInAs } from "./actions";
import { devLoginEnabled } from "@/auth/dev-login";

export const dynamic = "force-dynamic";

type DemoStaff = { id: string; name: string; email: string; role: string; club: string };

/**
 * DEVELOPMENT AND DEMO ONLY. Pick a seeded staff user to see the app as that role.
 * Disabled unless devLoginEnabled() (local dev, or a demo on fake data).
 * Uses demo_staff_list(), which only exists in demo databases (scripts/demo-login.sql).
 */
export default async function DevLogin() {
  if (!devLoginEnabled()) notFound();

  const staff = (await db().execute(sql`select * from demo_staff_list()`)) as unknown as DemoStaff[];

  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 16px" }}>
      <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>junbi</p>
      <h1 style={{ marginTop: 24, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>Try the demo</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Pick a role to see what each person at a club can do. Everything here is made-up demo data.
      </p>
      <div className="card" style={{ marginTop: 24, padding: "4px 20px" }}>
        <div className="list">
          {staff.map((u) => (
            <form key={u.id} action={signInAs}>
              <input type="hidden" name="userId" value={u.id} />
              <span>
                <strong>{u.name}</strong>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>{u.role} · {u.club}</span>
              </span>
              <button type="submit" className="btn secondary">Sign in</button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
