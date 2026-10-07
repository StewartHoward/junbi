import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Actor, Role } from "./permissions";

export const SESSION_COOKIE = "junbi_session";
const SESSION_DAYS = 30;

export type SessionActor = Actor & { clubName: string; userName: string; onboarded: boolean };

type MembershipRow = {
  staff_id: string;
  club_id: string;
  club_name: string;
  role: Role;
  all_sites: boolean;
  site_ids: string[];
  onboarded: boolean;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Starts a session for a user and sets the httpOnly cookie. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db().execute(sql`select auth_session_create(${hashToken(token)}, ${userId}::uuid, ${expires.toISOString()}::timestamptz)`);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().execute(sql`select auth_session_delete(${hashToken(token)})`);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, if any, without needing a club. */
export async function currentUser(): Promise<{ id: string; name: string; email: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const rows = (await db().execute(sql`select * from auth_session_user(${hashToken(token)})`)) as unknown as Array<{
    user_id: string;
    name: string;
    email: string;
  }>;
  const u = rows[0];
  return u ? { id: u.user_id, name: u.name, email: u.email } : null;
}

/** Resolves the signed-in staff member and their club for the current request. */
export async function currentActor(): Promise<SessionActor | null> {
  const user = await currentUser();
  if (!user) return null;
  const rows = (await db().execute(sql`select * from staff_memberships_for(${user.id}::uuid)`)) as unknown as MembershipRow[];
  const m = rows[0];
  if (!m) return null;
  return {
    userId: user.id,
    clubId: m.club_id,
    clubName: m.club_name,
    userName: user.name,
    role: m.role,
    sites: m.all_sites ? "all" : m.site_ids,
    onboarded: m.onboarded,
  };
}

/** For app pages: signed in, and the club has finished set-up. */
export async function requireActor(): Promise<SessionActor> {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!actor.onboarded) redirect("/setup");
  return actor;
}

/** For the set-up page itself: signed in, set-up may be unfinished. */
export async function requireActorForSetup(): Promise<SessionActor> {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return actor;
}
