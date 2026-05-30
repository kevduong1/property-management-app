/**
 * Supabase client configured for React Native (AsyncStorage session
 * persistence, no URL session detection). When Supabase is not configured the
 * client is null and the app falls back to the in-memory demo data layer.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, isSupabaseConfigured } from './env';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
