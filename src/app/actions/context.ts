"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEV_AUTH_COOKIE } from "@/lib/auth";
import { SERIES_COOKIE } from "@/lib/series-context";

/** Set the active child series filter (cookie). "all" clears the filter. */
export async function setActiveSeries(seriesId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SERIES_COOKIE, seriesId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

/** Dev-auth: switch the logged-in user by email. */
export async function devSwitchUser(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(DEV_AUTH_COOKIE, email, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_AUTH_COOKIE);
  redirect("/login");
}
