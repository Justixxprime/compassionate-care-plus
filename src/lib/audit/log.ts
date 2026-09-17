// src/lib/audit/log.ts
//
// One function, called from wherever a security-relevant event happens
// (sign-in, sign-out, a denied permission check). Never logs the
// CONTENT of what was viewed or changed - only that the event happened.

import "server-only";
import { prisma } from "@/lib/prisma";

interface AuditEntry {
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: "allowed" | "denied";
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    console.error("Failed to write audit log entry:", entry.action, err);
  }
}

interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  occurredAt: Date;
}

export async function getRecentAuditLog(limit = 20): Promise<AuditLogEntry[]> {
  return prisma.auditLog.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}