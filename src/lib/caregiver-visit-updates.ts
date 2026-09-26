// src/lib/caregiver-visit-updates.ts
//
// Limited factual updates from caregivers, deliberately separate from
// clinical VisitNotes. Every write checks permission, current care-team
// reach, ownership of the visit, and the update state again on the server.

import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor, type Actor } from "@/lib/auth/actor";
import { getPatientScope, scopeAllowsPatient, type PatientScope } from "@/lib/patients";
import type { Result } from "@/lib/visits";

const NOT_FOUND = "That visit could not be found.";
const NOT_ASSIGNED = "Only the caregiver assigned to this visit can write its update.";
const MAX_CONTENT = 1000;
const DOCUMENTABLE_STATUSES = ["in_progress", "completed"] as const;

function validateContent(raw: string): Result<{ content: string }> {
  const content = raw.replace(/\u0000/g, "").trim();
  if (!content) return { ok: false, error: "Write a short factual update for this visit." };
  if (content.length > MAX_CONTENT) {
    return { ok: false, error: `The visit update can be at most ${MAX_CONTENT} characters.` };
  }
  return { ok: true, value: { content } };
}

async function loadVisitInScope(actor: Actor, scope: PatientScope, visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, organizationId: true, patientId: true, clinicianId: true, status: true },
  });
  const allowed =
    visit !== null &&
    visit.organizationId === actor.organizationId &&
    (await scopeAllowsPatient(scope, visit.patientId));
  if (!visit || !allowed) {
    await auditDenied(actor, "visit", visitId);
    return null;
  }
  return visit;
}

export interface CaregiverVisitUpdateRow {
  content: string;
  status: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  authorName: string;
  reviewedByName: string | null;
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
}

export async function getCaregiverVisitUpdate(
  userId: string,
  visitId: string,
): Promise<Result<{ update: CaregiverVisitUpdateRow | null; canWrite: boolean }>> {
  await requirePermission(userId, "visits.read");
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };

  const canReviewPermission = await hasPermission(userId, "visits.review");
  const row = await prisma.caregiverVisitUpdate.findUnique({
    where: { visitId },
    include: { author: { select: { name: true } }, reviewedBy: { select: { name: true } } },
  });
  if (!row) return { ok: true, value: { update: null, canWrite: false } };
  return {
    ok: true,
    value: {
      update: {
        content: row.content,
        status: row.status,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        authorName: row.author.name,
        reviewedByName: row.reviewedBy?.name ?? null,
        canEdit: false,
        canSubmit: false,
        canReview: canReviewPermission && row.status === "submitted" && row.authorId !== userId,
      },
      canWrite: false,
    },
  };
}

async function loadOwnedDocumentableVisit(userId: string, visitId: string) {
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { actor, visit: null };
  if (visit.clinicianId !== userId) {
    await auditDenied(actor, "visit", visitId);
    return { actor, visit: null };
  }
  return { actor, visit };
}

export async function saveCaregiverVisitUpdate(
  userId: string,
  visitId: string,
  contentRaw: string,
): Promise<Result<{ visitId: string }>> {
  await requirePermission(userId, "visits.caregiver_document");
  const { actor, visit } = await loadOwnedDocumentableVisit(userId, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };
  if (!(DOCUMENTABLE_STATUSES as readonly string[]).includes(visit.status)) {
    return { ok: false, error: "An update can only be written while a visit is in progress or after it is completed." };
  }
  const text = validateContent(contentRaw);
  if (!text.ok) return text;

  const existing = await prisma.caregiverVisitUpdate.findUnique({
    where: { visitId }, select: { id: true, authorId: true, status: true },
  });
  if (existing && (existing.authorId !== userId || existing.status !== "draft")) {
    await auditDenied(actor, "visit", visitId);
    return { ok: false, error: existing.status === "draft" ? NOT_ASSIGNED : "A submitted update is locked." };
  }
  if (existing) {
    await prisma.caregiverVisitUpdate.update({ where: { id: existing.id }, data: { content: text.value.content } });
    await auditAllowed(actor, "caregiver_visit_update_updated", "visit", visitId);
  } else {
    await prisma.caregiverVisitUpdate.create({
      data: { organizationId: actor.organizationId, visitId, authorId: userId, content: text.value.content },
    });
    await auditAllowed(actor, "caregiver_visit_update_created", "visit", visitId);
  }
  return { ok: true, value: { visitId } };
}

export async function submitCaregiverVisitUpdate(
  userId: string,
  visitId: string,
): Promise<Result<{ status: string }>> {
  await requirePermission(userId, "visits.caregiver_document");
  const { actor, visit } = await loadOwnedDocumentableVisit(userId, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };
  const row = await prisma.caregiverVisitUpdate.findUnique({
    where: { visitId }, select: { id: true, authorId: true, status: true },
  });
  if (!row || row.authorId !== userId) {
    await auditDenied(actor, "visit", visitId);
    return { ok: false, error: NOT_FOUND };
  }
  if (row.status !== "draft") return { ok: false, error: "This update has already been submitted." };
  const result = await prisma.caregiverVisitUpdate.updateMany({
    where: { id: row.id, authorId: userId, status: "draft" },
    data: { status: "submitted", submittedAt: new Date() },
  });
  if (!result.count) return { ok: false, error: "This update was just changed. Refresh and try again." };
  await auditAllowed(actor, "caregiver_visit_update_submitted", "visit", visitId);
  return { ok: true, value: { status: "submitted" } };
}

export async function reviewCaregiverVisitUpdate(
  userId: string,
  visitId: string,
): Promise<Result<{ status: string }>> {
  await requirePermission(userId, "visits.review");
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };
  const row = await prisma.caregiverVisitUpdate.findUnique({
    where: { visitId }, select: { id: true, authorId: true, status: true },
  });
  if (!row) {
    await auditDenied(actor, "visit", visitId);
    return { ok: false, error: NOT_FOUND };
  }
  if (row.authorId === userId) {
    await auditDenied(actor, "visit", visitId);
    return { ok: false, error: "You cannot review an update you wrote. Another reviewer must do it." };
  }
  if (row.status !== "submitted") return { ok: false, error: "This update is not waiting for review." };
  const result = await prisma.caregiverVisitUpdate.updateMany({
    where: { id: row.id, status: "submitted" },
    data: { status: "reviewed", reviewedById: userId, reviewedAt: new Date() },
  });
  if (!result.count) return { ok: false, error: "This update was just changed. Refresh and try again." };
  await auditAllowed(actor, "caregiver_visit_update_reviewed", "visit", visitId);
  return { ok: true, value: { status: "reviewed" } };
}

export { DOCUMENTABLE_STATUSES, MAX_CONTENT };
