// src/lib/audit-log.ts
//
// The one door onto the standalone Audit log page (Milestone E2). Checks
// audit.read itself - the page never queries the database directly -
// then scopes to the caller's OWN organization via loadActor, closing
// the gap named in src/lib/audit/log.ts: before this round,
// getRecentAuditLog had no organization filter at all.
//
// Kept apart from src/lib/audit/log.ts (which authorize.ts and actor.ts
// depend on to WRITE entries) so that this file's dependency on
// requirePermission never becomes an import cycle.

import "server-only";
import { requirePermission } from "@/lib/auth/authorize";
import { loadActor } from "@/lib/auth/actor";
import {
  countAuditLog,
  getRecentAuditLog,
  type AuditLogEntry,
  type AuditLogFilters,
} from "@/lib/audit/log";

export type { AuditLogEntry, AuditLogFilters };

const PAGE_SIZE = 200;

export interface AuditLogPage {
  entries: AuditLogEntry[];
  page: number;
  pageCount: number;
  total: number;
}

// page is 1-based, same as every other page number in this project's
// URLs. A page past the end just comes back empty rather than erroring -
// the same "same words either way" instinct the rest of this project
// uses for a made-up id, applied here to a made-up page number.
export async function listAuditLog(
  userId: string,
  filters: AuditLogFilters = {},
  page = 1,
): Promise<AuditLogPage> {
  await requirePermission(userId, "audit.read");
  const actor = await loadActor(userId);
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const [entries, total] = await Promise.all([
    getRecentAuditLog(actor.organizationId, PAGE_SIZE, filters, (safePage - 1) * PAGE_SIZE),
    countAuditLog(actor.organizationId, filters),
  ]);

  return {
    entries,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}

// The fixed vocabulary of actions written anywhere in the app, for the
// filter dropdown on the audit log page. Kept here (not derived from the
// database) so the list is stable even on a quiet day with few rows -
// and because scanning distinct values out of audit_logs would mean the
// dropdown itself becomes a query someone has to think about scoping.
export const AUDIT_ACTIONS: { key: string; label: string }[] = [
  { key: "sign_in", label: "Signed in" },
  { key: "sign_in_failed", label: "Sign-in failed" },
  { key: "sign_out", label: "Signed out" },
  { key: "permission_denied", label: "Permission denied" },
  { key: "access_denied", label: "Access denied" },
  { key: "visit_created", label: "Visit scheduled" },
  { key: "visit_checked_in", label: "Visit checked in" },
  { key: "visit_checked_out", label: "Visit checked out" },
  { key: "visit_cancelled", label: "Visit cancelled" },
  { key: "visit_marked_missed", label: "Visit marked missed" },
  { key: "care_plan_created", label: "Care plan created" },
  { key: "care_plan_updated", label: "Care plan updated" },
  { key: "care_plan_goal_added", label: "Care plan goal added" },
  { key: "care_plan_goal_removed", label: "Care plan goal removed" },
  { key: "care_plan_goal_met", label: "Care plan goal marked met" },
  { key: "care_plan_approved", label: "Care plan approved" },
  { key: "care_plan_completed", label: "Care plan completed" },
  { key: "care_plan_discarded", label: "Care plan discarded" },
  { key: "document_uploaded", label: "Document filed" },
  { key: "document_downloaded", label: "Document downloaded" },
  { key: "document_archived", label: "Document archived" },
  { key: "referral_created", label: "Referral created" },
  { key: "referral_updated", label: "Referral updated" },
  { key: "referral_review_started", label: "Referral moved to review" },
  { key: "referral_accepted", label: "Referral accepted" },
  { key: "referral_declined", label: "Referral declined" },
  { key: "referral_withdrawn", label: "Referral withdrawn" },
  { key: "patient_created", label: "Patient created" },
  { key: "care_team_assigned", label: "Care team member assigned" },
  { key: "care_team_ended", label: "Care team assignment ended" },
  { key: "care_request_received", label: "Care request received" },
  { key: "care_request_contacted", label: "Care request marked contacted" },
  { key: "care_request_closed", label: "Care request closed" },
];

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS.find((a) => a.key === action)?.label ?? action;
}
