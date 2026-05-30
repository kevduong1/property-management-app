/**
 * Server-action authorization guards. Every mutating action calls
 * `requirePermission` first so RBAC is enforced in one place.
 */
import "server-only";
import { getSession, type Session } from "@/lib/auth";
import { can, type Action, type Resource } from "@/lib/rbac";

export async function requirePermission(
  resource: Resource,
  action: Action,
): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");
  if (!can(session.role, resource, action)) {
    throw new Error("You don't have permission to do that.");
  }
  return session;
}
