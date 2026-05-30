/**
 * Authentication abstraction.
 *
 * AUTH_MODE=dev (default): a cookie-based role switcher resolves the current
 *   user from the seeded `users` table. No Supabase project required — the MVP
 *   is fully demoable. Switch users at /login.
 *
 * AUTH_MODE=supabase: reads the Supabase session via @supabase/ssr cookies and
 *   maps the auth user to our `users`/`user_roles` rows. (Wiring point — the
 *   Supabase client factory lives in ./supabase.ts.)
 *
 * Either way, the rest of the app depends only on `getSession()` returning a
 * normalized Session, so swapping providers never touches feature code.
 */
import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations,
  tenantUserLinks,
  userRoles,
  users,
  type Role,
} from "@/db/schema";

export const DEV_AUTH_COOKIE = "pm_dev_user";
const AUTH_MODE = process.env.AUTH_MODE ?? "dev";

export interface Session {
  userId: string;
  email: string;
  fullName: string | null;
  role: Role;
  organizationId: string;
  organizationName: string;
  /** Set when the logged-in user is linked to a tenant record. */
  tenantId: string | null;
}

async function resolveSessionForEmail(
  email: string,
): Promise<Session | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return null;

  const [membership] = await db
    .select({
      role: userRoles.role,
      organizationId: userRoles.organizationId,
      organizationName: organizations.name,
    })
    .from(userRoles)
    .innerJoin(organizations, eq(organizations.id, userRoles.organizationId))
    .where(eq(userRoles.userId, user.id))
    .limit(1);
  if (!membership) return null;

  let tenantId: string | null = null;
  if (membership.role === "tenant") {
    const [link] = await db
      .select({ tenantId: tenantUserLinks.tenantId })
      .from(tenantUserLinks)
      .where(
        and(
          eq(tenantUserLinks.userId, user.id),
          eq(tenantUserLinks.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    tenantId = link?.tenantId ?? null;
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: membership.role,
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    tenantId,
  };
}

/** Resolve the current session, or null if not signed in. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  if (AUTH_MODE === "supabase") {
    const { getSupabaseServerClient } = await import("./supabase");
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return resolveSessionForEmail(user.email);
  }

  // Dev mode: cookie holds the email; default to the owner for convenience.
  const email = cookieStore.get(DEV_AUTH_COOKIE)?.value;
  if (!email) return null;
  return resolveSessionForEmail(email);
}

/** Like getSession but throws if unauthenticated (use in protected routes). */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session!;
}

export function isSupabaseMode() {
  return AUTH_MODE === "supabase";
}
