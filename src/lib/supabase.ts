/**
 * Supabase server client factory (used only when AUTH_MODE=supabase).
 *
 * This is the single wiring point for real Supabase Auth. Set the env vars in
 * .env.example and AUTH_MODE=supabase to activate it. We keep imports dynamic
 * so the dev-mode demo doesn't require @supabase/* to be configured.
 */
import "server-only";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const { createServerClient } = await import("@supabase/ssr");
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // refreshes the session cookie instead.
          }
        },
      },
    },
  );
}
