// src/lib/audit/log.ts
//
// One function, called from wherever a security-relevant event happens
// (sign-in, sign-out, a denied permission check). Never logs the
// CONTENT of what was viewed or changed - only that the event happened.
// See PHASE_0_ARCHITECTURE.md section 56.
//
// Deliberately swallows its own errors rather than throwing - a failure
// to WRITE an audit log entry should never be the reason a real sign-in
// or sign-out fails for the person using the app. It logs the failure
// to the server console instead, so it's visible to a developer without
// becoming the user's problem.

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

// The most recent entries, newest first - used by the dashboard's
// activity list right now, and by the real security center/audit page
// later (Milestone F).
export async function getRecentAuditLog(limit = 20): Promise<AuditLogEntry[]> {
  return prisma.auditLog.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
