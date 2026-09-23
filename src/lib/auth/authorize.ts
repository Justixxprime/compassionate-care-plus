// src/lib/auth/authorize.ts
//
// This is the single function every protected page, server action, and
// future API route should go through to check permissions. Having ONE
// place this logic lives means there's exactly one path to "can this
// person do this?" - see PHASE_0_ARCHITECTURE.md section 8: no page
// should query the database directly to decide who can see what, and no
// permission check should be duplicated across multiple files where one
// of the copies could quietly drift out of sync with the others.
//
// "server-only" makes it a build error to accidentally import this into
// a Client Component - permission checks must never run in the browser,
// only ever on the server, since the browser can't be trusted.

import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export class AuthorizationError extends Error {
  constructor(permissionKey: string) {
    super(`Missing permission: ${permissionKey}`);
    this.name = "AuthorizationError";
  }
}

// True/false check - use this wherever the UI needs to decide whether to
// show something (a nav link, a button), where "no" just means "don't
// render it" rather than a hard failure.
export async function hasPermission(
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  const count = await prisma.userRole.count({
    where: {
      userId,
      role: {
        rolePermissions: {
          some: { permission: { key: permissionKey } },
        },
      },
    },
  });

  return count > 0;
}

// Throws if the permission is missing - use this at the START of any
// server action or data-fetching function that performs a sensitive
// operation, so a missing permission is a hard stop, not a UI nicety
// that a determined user could route around by hitting the underlying
// action directly.
export async function requirePermission(
  userId: string,
  permissionKey: string,
): Promise<void> {
  const allowed = await hasPermission(userId, permissionKey);
  if (!allowed) {
    // A denied permission check is exactly the kind of event the audit
    // log exists for - it's what a real security review looks at first.
    // One extra query for the organization: this only runs on the
    // exceptional (denied) path, never on an allowed check, so it does
    // not add a query to the common case.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    await writeAuditLog({
      organizationId: user?.organizationId,
      actorUserId: userId,
      action: "permission_denied",
      resourceType: "permission",
      resourceId: permissionKey,
      outcome: "denied",
    });
    throw new AuthorizationError(permissionKey);
  }
}

// Every permission key the current user holds, across every role they
// have - used to render a permission list (like on the dashboard) or to
// check several permissions at once without a separate database round
// trip for each one.
export async function getUserPermissions(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  });

  const keys = new Set<string>();
  for (const userRole of userRoles) {
    for (const rp of userRole.role.rolePermissions) {
      keys.add(rp.permission.key);
    }
  }

  return Array.from(keys).sort();
}
