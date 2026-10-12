import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Actor, Role } from "./permissions";

export const SESSION_COOKIE = "junbi_session";
/** Which club to open for people on the staff of more than one. Only ever picks among their own clubs. */
export const CLUB_COOKIE = "junbi_club";
const SESSION_DAYS = 30;

export type SessionActor = Actor & { clubName: string; userName: string; onboarded: boolean; clubs: Array<{ id: string; name: string }> };

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
  return userForToken(token);
}

// Cached for the length of one request: the layout and the page both ask, but the database is asked once.
const userForToken = cache(async (token: string): Promise<{ id: string; name: string; email: string } | null> => {
  const rows = (await db().execute(sql`select * from auth_session_user(${hashToken(token)})`)) as unknown as Array<{
    user_id: string;
    name: string;
    email: string;
  }>;
  const u = rows[0];
  return u ? { id: u.user_id, name: u.name, email: u.email } : null;
});

/** Resolves the signed-in staff member and their club for the current request. */
export async function currentActor(): Promise<SessionActor | null> {
  const user = await currentUser();
  return user ? actorForUser(user.id, user.name) : null;
}

const actorForUser = cache(async (userId: string, userName: string): Promise<SessionActor | null> => {
  const user = { id: userId, name: userName };
  const rows = (await db().execute(sql`select * from staff_memberships_for(${user.id}::uuid)`)) as unknown as MembershipRow[];
  const chosen = (await cookies()).get(CLUB_COOKIE)?.value;
  const m = rows.find((r) => r.club_id === chosen) ?? rows[0];
  if (!m) return null;
  return {
    userId: user.id,
    clubId: m.club_id,
    clubName: m.club_name,
    userName: user.name,
    role: m.role,
    sites: m.all_sites ? "all" : m.site_ids,
    onboarded: m.onboarded,
    clubs: rows.map((r) => ({ id: r.club_id, name: r.club_name })),
  };
});

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

/** Switch to another club this person is staff at. Ignored for clubs they don't belong to. */
export async function chooseClub(clubId: string, justSignedIn?: string) {
  const userId = justSignedIn ?? (await currentUser())?.id;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(clubId)) return false;
  const rows = (await db().execute(sql`select club_id from staff_memberships_for(${userId}::uuid)`)) as unknown as Array<{ club_id: string }>;
  if (!rows.some((r) => r.club_id === clubId)) return false;
  (await cookies()).set(CLUB_COOKIE, clubId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 400 * 86_400 });
  return true;
}
