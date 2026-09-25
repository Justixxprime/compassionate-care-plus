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
//
// ORGANIZATION SCOPE - fixed this round. Every entry now carries the
// actor's organizationId, and getRecentAuditLog below takes one and
// filters by it. Before this, it returned entries from every
// organization in the database - harmless with the one organization
// that exists today, but the kind of gap that becomes a real
// cross-tenant leak the moment a second one exists. There is no
// retroactive fix for rows written before this column existed; they
// simply have a null organizationId and will not appear in any
// organization's scoped view.
//
// This file stays foundational on purpose: it has no dependency on
// src/lib/auth/authorize.ts, even though authorize.ts depends on IT (to
// write the permission_denied entry). The permission check for the
// standalone audit log PAGE lives one layer up, in src/lib/audit-log.ts,
// specifically to avoid that import cycle.

import "server-only";
import { prisma } from "@/lib/prisma";

interface AuditEntry {
  // Omitted (not just left undefined) on the one entry that can never
  // have one: a failed sign-in against an email matching no user.
  organizationId?: string | null;
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

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string;
  occurredAt: Date;
}

export interface AuditLogFilters {
  action?: string;
  outcome?: "allowed" | "denied";
  // Matched against the actor's email, case-insensitively, substring OK -
  // "j" finds every account with a j in the address. Good enough for a
  // small staff list; a real search box is Milestone F territory.
  actor?: string;
}

const LIST_LIMIT = 200;

// The most recent entries for ONE organization, newest first, with
// optional filters. It is the CALLER's job to pass its own
// organizationId - never anything a caller passes in from the browser -
// which is why this stays untrusted-input-free and unexported outside
// lib/: src/lib/app/dashboard.ts and src/lib/audit-log.ts are the two
// callers, and both already know their own organizationId before they
// call this.
export async function getRecentAuditLog(
  organizationId: string,
  limit = 20,
  filters: AuditLogFilters = {},
  skip = 0,
): Promise<AuditLogEntry[]> {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.outcome ? { outcome: filters.outcome } : {}),
      ...(filters.actor
        ? {
            actorEmail: {
              contains: filters.actor,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: Math.min(limit, LIST_LIMIT),
    skip,
  });
}

// How many entries match these filters, for this organization. Used
// only to draw "page 3 of 9" and to disable a Next button that would
// otherwise land on an empty page - never used to decide what is
// shown, which stays getRecentAuditLog's job alone.
export async function countAuditLog(
  organizationId: string,
  filters: AuditLogFilters = {},
): Promise<number> {
  return prisma.auditLog.count({
    where: {
      organizationId,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.outcome ? { outcome: filters.outcome } : {}),
      ...(filters.actor
        ? {
            actorEmail: {
              contains: filters.actor,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
  });
}
