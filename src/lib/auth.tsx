/**
 * Authentication + role context.
 *
 * Demo mode: pick one of the seeded demo accounts (one per role) to explore the
 * app with that role's permissions. No backend required.
 *
 * Live mode: backed by Supabase Auth. The user's role is read from the
 * `user_roles` table and tenant linkage from `tenant_user_links`.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ENV } from './env';
import { supabase } from './supabase';
import type { Role } from '@/constants';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Linked tenant record id when role === 'tenant'. */
  tenantId?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  demoMode: boolean;
  signInDemo: (role: Role) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

/** Seeded demo accounts — one per role. */
export const DEMO_ACCOUNTS: Record<Role, AuthUser> = {
  owner_admin: {
    id: 'demo-admin',
    email: 'owner@evergreen.test',
    fullName: 'Dana Owner',
    role: 'owner_admin',
  },
  manager: {
    id: 'demo-manager',
    email: 'manager@evergreen.test',
    fullName: 'Morgan Manager',
    role: 'manager',
  },
  bookkeeper: {
    id: 'demo-bookkeeper',
    email: 'books@evergreen.test',
    fullName: 'Blake Bookkeeper',
    role: 'bookkeeper',
  },
  tenant: {
    id: 'demo-tenant',
    email: 'sarah.tenant@example.com',
    fullName: 'Sarah Johnson',
    role: 'tenant',
    tenantId: 'ten-1', // matches store.portalTenantId
  },
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Live mode: hydrate from an existing Supabase session.
  useEffect(() => {
    if (ENV.demoMode || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (active && data.session) await hydrateFromSession(data.session.user.id, data.session.user.email ?? '');
      if (active) setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) await hydrateFromSession(session.user.id, session.user.email ?? '');
      else setUser(null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function hydrateFromSession(userId: string, email: string) {
    if (!supabase) return;
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .single();
    const { data: link } = await supabase
      .from('tenant_user_links')
      .select('tenant_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    setUser({
      id: userId,
      email,
      fullName: profile?.full_name ?? email,
      role: (roleRow?.role as Role) ?? 'tenant',
      tenantId: link?.tenant_id ?? null,
    });
  }

  const signInDemo = useCallback((role: Role) => {
    setUser(DEMO_ACCOUNTS[role]);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase is not configured. Use demo sign-in.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) return { error: 'Supabase is not configured. Use demo sign-in.' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, demoMode: ENV.demoMode, signInDemo, signIn, signUp, signOut }),
    [user, loading, signInDemo, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
