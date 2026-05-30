/**
 * Client-side RBAC helpers. These mirror the database RLS policies in
 * supabase/migrations/0002_rls.sql and drive UI affordances (hiding buttons,
 * gating routes). The database remains the real security boundary.
 */
import type { Role } from '@/constants';

export type Permission =
  | 'manage_org' // org settings, users, roles
  | 'manage_ops' // properties, units, tenants, leases, docs, notes, maintenance
  | 'manage_finance' // rent charges, payments, deposits, expenses, vendors
  | 'view_all' // read all staff data
  | 'tenant_self'; // tenant viewing own data

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner_admin: ['manage_org', 'manage_ops', 'manage_finance', 'view_all'],
  manager: ['manage_ops', 'manage_finance', 'view_all'],
  bookkeeper: ['manage_finance', 'view_all'],
  tenant: ['tenant_self'],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isStaff(role: Role | null | undefined): boolean {
  return role === 'owner_admin' || role === 'manager' || role === 'bookkeeper';
}

export function isTenant(role: Role | null | undefined): boolean {
  return role === 'tenant';
}
