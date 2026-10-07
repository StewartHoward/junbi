import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db, withClub } from "@/db/client";
import type { Actor, Role } from "./permissions";

export const SESSION_COOKIE = "junbi_session";

export type SessionActor = Actor & { clubName: string; userName: string };

type MembershipRow = {
  staff_id: string;
  club_id: string;
  club_name: string;
  role: Role;
  all_sites: boolean;
  site_ids: string[];
};

/**
 * Resolves the signed-in staff member for the current request.
 *
 * TEMPORARY: the cookie currently holds a user id set by the development
 * sign-in page. Real authentication (email + password, magic link, Apple and
 * Google, 2FA for owners and admins) replaces this before any real club uses Junbi.
 */
export async function currentActor(): Promise<SessionActor | null> {
  const userId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const rows = (await db().execute(
    sql`select * from staff_memberships_for(${userId}::uuid)`,
  )) as unknown as MembershipRow[];
  const m = rows[0];
  if (!m) return null;

  const user = (await withClub({ clubId: m.club_id, userId }, (tx) =>
    tx.execute(sql`select name from users where id = ${userId}::uuid`),
  )) as unknown as Array<{ name: string }>;

  return {
    userId,
    clubId: m.club_id,
    clubName: m.club_name,
    userName: user[0]?.name ?? "Staff",
    role: m.role,
    sites: m.all_sites ? "all" : m.site_ids,
  };
}

export async function requireActor(): Promise<SessionActor> {
  const actor = await currentActor();
  if (!actor) redirect("/dev/login");
  return actor;
}
