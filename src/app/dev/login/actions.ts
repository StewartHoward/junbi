"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/auth/session";
import { devLoginEnabled } from "@/auth/dev-login";

export async function signInAs(formData: FormData) {
  if (!devLoginEnabled()) {
    throw new Error("Development sign-in is disabled");
  }
  const userId = String(formData.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Bad user id");
  (await cookies()).set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/students");
}
