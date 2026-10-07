"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/auth/session";

export async function signInAs(formData: FormData) {
  if (process.env.NODE_ENV === "production" || process.env.JUNBI_DEV_LOGIN !== "1") {
    throw new Error("Development sign-in is disabled");
  }
  const userId = String(formData.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Bad user id");
  (await cookies()).set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/students");
}
