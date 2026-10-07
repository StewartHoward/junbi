import { notFound } from "next/navigation";
import postgres from "postgres";
import { signInAs } from "./actions";

export const dynamic = "force-dynamic";

/**
 * DEVELOPMENT ONLY. Pick a seeded staff user to see the app as that role.
 * Disabled unless JUNBI_DEV_LOGIN=1 and not in production.
 */
export default async function DevLogin() {
  if (process.env.NODE_ENV === "production" || process.env.JUNBI_DEV_LOGIN !== "1") notFound();

  const admin = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 });
  const staff = await admin<Array<{ id: string; name: string; email: string; role: string; club: string }>>`
    select u.id, u.name, u.email, s.role, c.name as club
    from users u join club_staff s on s.user_id = u.id join clubs c on c.id = s.club_id
    order by array_position(array['owner','admin','instructor','assistant']::staff_role[], s.role)`;
  await admin.end();

  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 16px" }}>
      <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>junbi</p>
      <h1 style={{ marginTop: 24, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>Sign in (development)</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Pick a demo user to see what each role can do. Real sign-in replaces this page before launch.
      </p>
      <div className="card" style={{ marginTop: 24, padding: "4px 20px" }}>
        <div className="list">
          {staff.map((u) => (
            <form key={u.id} action={signInAs}>
              <input type="hidden" name="userId" value={u.id} />
              <span>
                <strong>{u.name}</strong>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>{u.role} · {u.email}</span>
              </span>
              <button type="submit" className="btn secondary">Sign in</button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
