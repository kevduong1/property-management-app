/** Centralized access to public env vars (EXPO_PUBLIC_*). */

export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /**
   * Demo mode runs the app against an in-memory data store so the UI is fully
   * explorable without a configured Supabase backend. Defaults to ON unless a
   * Supabase URL is provided and demo mode is explicitly disabled.
   */
  demoMode:
    process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.EXPO_PUBLIC_SUPABASE_URL,
};

export const isSupabaseConfigured = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
