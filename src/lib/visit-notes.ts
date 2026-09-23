// src/lib/visit-notes.ts
//
// Everything about who may see, write, submit and review a visit note
// lives in this one file. Pages and server actions call these functions;
// none of them query the visit_notes table or decide access on their
// own - see PHASE_0_ARCHITECTURE.md section 8, one path to the data,
// and it is guarded.
//
// A visit note is real clinical CONTENT (what the clinician found and
// did), so - like care plans - it asks THREE questions, not two:
//
//   1. PERMISSION   visits.document to write, visits.review to review
//                   (requirePermission, a hard stop). Reading a note
//                   needs visits.read, the same as the visit itself.
//   2. RELATIONSHIP can this person reach the visit's patient at all?
//                   (getPatientScope in src/lib/patients.ts - the same
//                   code visits.ts and care-plans.ts use, not a copy)
//   3. AUTHOR       writing is further restricted to the visit's own
//                   assigned clinician, not just anyone on the patient's
//                   care team - this note is a first-person record of
//                   what THEY did at THIS visit. An administrative role
//                   can read every note but never writes one for a visit
//                   that is not theirs.
//
// One note per visit. draft -> submitted -> reviewed. A draft can be
// edited by its author; once submitted the wording is locked, the same
// way an active care plan is locked. Reviewing needs visits.review and
// one more rule: nobody reviews a note they wrote themselves - four
// eyes, exactly like care plan approval.
//
// What a denial does: it is written to the audit log (action
// "access_denied", outcome "denied") and the caller gets a plain
// message that does not reveal whether the thing they asked about
// exists. The audit log records that a note was created, submitted or
// reviewed - never what it said.

import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor, type Actor } from "@/lib/auth/actor";
import { getPatientScope, scopeAllowsPatient, type PatientScope } from "@/lib/patients";
import type { Result } from "@/lib/visits";
import {
  NOTE_CONTENT_MAX,
  VISIT_NOTE_TRANSITIONS,
  VISIT_STATUSES_ALLOWING_NOTE,
  isVisitNoteAction,
} from "@/lib/visit-note-constants";

const NOT_FOUND = "That visit could not be found.";
const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const NOT_THE_CLINICIAN = "Only the visit's assigned clinician can write this note.";

function validateContent(raw: string): Result<{ content: string }> {
  const content = raw.replace(/\u0000/g, "").trim();
  if (content.length === 0) {
    return { ok: false, error: "Write what happened at this visit." };
  }
  if (content.length > NOTE_CONTENT_MAX) {
    return {
      ok: false,
      error: `The note can be at most ${NOTE_CONTENT_MAX} characters.`,
    };
  }
  return { ok: true, value: { content } };
}

// Loads the visit AND checks the person may reach its patient. A visit
// that is missing, in another organization, or outside the person's
// reach all end the same way: audited, and null.
async function loadVisitInScope(actor: Actor, scope: PatientScope, visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      organizationId: true,
      patientId: true,
      clinicianId: true,
      status: true,
    },
  });

  const inScope =
    visit !== null &&
    visit.organizationId === actor.organizationId &&
    (await scopeAllowsPatient(scope, visit.patientId));

  if (!visit || !inScope) {
    await auditDenied(actor, "visit", visitId);
    return null;
  }
  return visit;
}

// ---------- Reading ----------

export interface VisitNoteRow {
  id: string;
  visitId: string;
  authorId: string;
  authorName: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  content: string;
  status: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  updatedAt: Date;
  // What THIS viewer may do with this note. The page uses these to
  // decide which controls to draw; every action re-checks everything on
  // the server regardless.
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
}

// One visit's note, if there is one and this viewer can reach it. Never
// throws for "no note yet" - that is a normal, expected state, not a
// denial - but a visit outside this viewer's reach still throws/denies
// through loadVisitInScope, same as everywhere else.
export async function getVisitNote(
  userId: string,
  visitId: string,
): Promise<Result<{ note: VisitNoteRow | null; canWrite: boolean }>> {
  await requirePermission(userId, "visits.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };

  const [canDocument, canReviewPermission] = await Promise.all([
    hasPermission(userId, "visits.document"),
    hasPermission(userId, "visits.review"),
  ]);

  const isClinician = visit.clinicianId === userId;
  const canWrite =
    canDocument &&
    isClinician &&
    (VISIT_STATUSES_ALLOWING_NOTE as readonly string[]).includes(visit.status);

  const row = await prisma.visitNote.findUnique({
    where: { visitId },
    include: {
      author: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  // canWrite here means "may start a NEW note" - once one exists, there
  // is nothing new to start; canEdit/canSubmit on the row below cover
  // changing the one that is already there.
  if (!row) return { ok: true, value: { note: null, canWrite } };

  const note: VisitNoteRow = {
    id: row.id,
    visitId: row.visitId,
    authorId: row.authorId,
    authorName: row.author.name,
    reviewedById: row.reviewedById,
    reviewedByName: row.reviewedBy?.name ?? null,
    content: row.content,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    updatedAt: row.updatedAt,
    canEdit: canWrite && row.authorId === userId && row.status === "draft",
    canSubmit: canWrite && row.authorId === userId && row.status === "draft",
    canReview: canReviewPermission && row.status === "submitted" && row.authorId !== userId,
  };

  return { ok: true, value: { note, canWrite: false } };
}

// ---------- Worklists ----------

export interface NoteWorklistRow {
  visitId: string;
  patientName: string;
  visitType: string;
  scheduledStart: Date;
  status: string; // the note's status, or "not_started"
}

const WORKLIST_LIMIT = 100;

// Visits THIS clinician has finished but not yet documented. Reads
// visits.read the same as every visit list; canDocument tells the page
// whether to show this worklist at all.
export async function listVisitsNeedingDocumentation(
  userId: string,
): Promise<NoteWorklistRow[]> {
  await requirePermission(userId, "visits.read");
  if (!(await hasPermission(userId, "visits.document"))) return [];

  const actor = await loadActor(userId);

  const visits = await prisma.visit.findMany({
    where: {
      organizationId: actor.organizationId,
      clinicianId: userId,
      status: { in: [...VISIT_STATUSES_ALLOWING_NOTE] },
      visitNote: { is: null },
    },
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { scheduledStart: "desc" },
    take: WORKLIST_LIMIT,
  });

  return visits.map((v) => ({
    visitId: v.id,
    patientName: `${v.patient.firstName} ${v.patient.lastName}`,
    visitType: v.visitType,
    scheduledStart: v.scheduledStart,
    status: "not_started",
  }));
}

// Notes waiting on a reviewer, within this person's reach. Empty (not
// denied) for anyone without visits.review, so the page can simply skip
// the section.
export async function listNotesPendingReview(userId: string): Promise<NoteWorklistRow[]> {
  await requirePermission(userId, "visits.read");
  if (!(await hasPermission(userId, "visits.review"))) return [];

  const scope = await getPatientScope(userId);
  const scopeWhere =
    scope.kind === "organization"
      ? { organizationId: scope.organizationId }
      : { organizationId: scope.organizationId, patientId: { in: scope.patientIds } };

  const notes = await prisma.visitNote.findMany({
    where: {
      status: "submitted",
      authorId: { not: userId },
      visit: { is: scopeWhere },
    },
    include: {
      visit: {
        select: {
          id: true,
          visitType: true,
          scheduledStart: true,
          patient: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
    take: WORKLIST_LIMIT,
  });

  return notes.map((n) => ({
    visitId: n.visit.id,
    patientName: `${n.visit.patient.firstName} ${n.visit.patient.lastName}`,
    visitType: n.visit.visitType,
    scheduledStart: n.visit.scheduledStart,
    status: n.status,
  }));
}

// ---------- Writing ----------

export async function createVisitNote(
  userId: string,
  visitId: string,
  contentRaw: string,
): Promise<Result<{ visitId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "visits.document");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Relationship to the patient.
  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };
  if (!(await scopeAllowsPatient(scope, visit.patientId))) {
    await auditDenied(actor, "patient", visit.patientId);
    return { ok: false, error: NO_PATIENT_ACCESS };
  }

  // 3. Author: only the visit's own assigned clinician.
  if (visit.clinicianId !== userId) {
    await auditDenied(actor, "visit", visit.id);
    return { ok: false, error: NOT_THE_CLINICIAN };
  }

  if (!(VISIT_STATUSES_ALLOWING_NOTE as readonly string[]).includes(visit.status)) {
    return {
      ok: false,
      error: "A note can only be written once a visit is in progress or completed.",
    };
  }

  const text = validateContent(contentRaw);
  if (!text.ok) return text;

  const existing = await prisma.visitNote.findUnique({
    where: { visitId },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "This visit already has a note. Edit it instead." };
  }

  await prisma.visitNote.create({
    data: {
      organizationId: actor.organizationId,
      visitId: visit.id,
      authorId: userId,
      content: text.value.content,
    },
  });

  await auditAllowed(actor, "visit_note_created", "visit", visit.id);
  return { ok: true, value: { visitId: visit.id } };
}

export async function updateVisitNote(
  userId: string,
  visitId: string,
  contentRaw: string,
): Promise<Result<{ visitId: string }>> {
  await requirePermission(userId, "visits.document");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };

  if (visit.clinicianId !== userId) {
    await auditDenied(actor, "visit", visit.id);
    return { ok: false, error: NOT_THE_CLINICIAN };
  }

  const note = await prisma.visitNote.findUnique({
    where: { visitId },
    select: { id: true, authorId: true, status: true },
  });
  if (!note || note.authorId !== userId) {
    await auditDenied(actor, "visit", visit.id);
    return { ok: false, error: NOT_FOUND };
  }
  if (note.status !== "draft") {
    return {
      ok: false,
      error: "Only a draft note can be edited. A submitted note is locked.",
    };
  }

  const text = validateContent(contentRaw);
  if (!text.ok) return text;

  const result = await prisma.visitNote.updateMany({
    where: { id: note.id, status: "draft" },
    data: { content: text.value.content },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This note was just changed. Refresh and try again.",
    };
  }

  await auditAllowed(actor, "visit_note_updated", "visit", visit.id);
  return { ok: true, value: { visitId: visit.id } };
}

// ---------- Changing a note's status ----------

export async function changeVisitNoteStatus(
  userId: string,
  visitId: string,
  action: string,
): Promise<Result<{ status: string }>> {
  if (!isVisitNoteAction(action)) {
    return { ok: false, error: "That action is not recognised." };
  }

  // 1. Permission - a hard stop. Submitting needs visits.document,
  //    reviewing needs visits.review.
  await requirePermission(
    userId,
    action === "submit" ? "visits.document" : "visits.review",
  );

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const visit = await loadVisitInScope(actor, scope, visitId);
  if (!visit) return { ok: false, error: NOT_FOUND };

  const note = await prisma.visitNote.findUnique({
    where: { visitId },
    select: { id: true, authorId: true, status: true },
  });
  if (!note) {
    await auditDenied(actor, "visit", visit.id);
    return { ok: false, error: NOT_FOUND };
  }

  // 2. Author-only for submitting; four-eyes for reviewing.
  if (action === "submit" && note.authorId !== userId) {
    await auditDenied(actor, "visit", visit.id);
    return { ok: false, error: NOT_THE_CLINICIAN };
  }
  if (action === "review" && note.authorId === userId) {
    await auditDenied(actor, "visit", visit.id);
    return {
      ok: false,
      error: "You cannot review a note you wrote. Another reviewer must do it.",
    };
  }

  // 3. The status machine.
  const transition = VISIT_NOTE_TRANSITIONS[action];
  if (note.status !== transition.from) {
    return {
      ok: false,
      error: `This note is already ${note.status}, so it cannot be changed that way.`,
    };
  }

  const now = new Date();
  const result = await prisma.visitNote.updateMany({
    where: { id: note.id, status: transition.from },
    data: {
      status: transition.to,
      ...(action === "submit" ? { submittedAt: now } : {}),
      ...(action === "review" ? { reviewedById: userId, reviewedAt: now } : {}),
    },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This note was just changed by someone else. Refresh and try again.",
    };
  }

  await auditAllowed(actor, transition.auditAction, "visit", visit.id);
  return { ok: true, value: { status: transition.to } };
}
