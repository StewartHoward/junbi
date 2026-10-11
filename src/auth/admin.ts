import "server-only";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "./session";

/**
 * Junbi admins (just Stewart for now). Set SUPER_ADMIN_EMAILS in Netlify, comma separated.
 * Nobody is an admin when it's empty.
 */
export function isSuperAdmin(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** For admin pages: not signed in goes to the admin sign-in; signed in but not an admin sees a 404. */
export async function requireSuperAdmin() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (!isSuperAdmin(user.email)) notFound();
  return user;
}
