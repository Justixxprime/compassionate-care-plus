// src/lib/auth/authorize.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export class AuthorizationError extends Error {
  constructor(permissionKey: string) {
    super(`Missing permission: ${permissionKey}`);
    this.name = "AuthorizationError";
  }
}

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

export async function requirePermission(
  userId: string,
  permissionKey: string,
): Promise<void> {
  const allowed = await hasPermission(userId, permissionKey);
  if (!allowed) {
    await writeAuditLog({
      actorUserId: userId,
      action: "permission_denied",
      resourceType: "permission",
      resourceId: permissionKey,
      outcome: "denied",
    });
    throw new AuthorizationError(permissionKey);
  }
}

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