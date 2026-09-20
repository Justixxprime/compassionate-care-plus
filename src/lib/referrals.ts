// src/lib/referrals.ts
//
// Everything about who may see, record, edit and decide a referral lives
// in this one file. Pages and server actions call these functions; none
// of them query the referrals table or decide access on their own.
//
// A referral is different from every other table so far, because it
// usually arrives BEFORE the person is a patient. Until it is accepted,
// nobody has a relationship to that person, so there is no care team to
// ask about. The rules are built around that:
//
//   1. PERMISSION   referrals.read to see, referrals.manage to record,
//                   edit and decide (requirePermission, a hard stop)
//   2. REACH        can this person reach the referral at all?
//                   - an UNLINKED referral (person not yet a patient)
//                     is reachable by administrative roles only
//                   - a LINKED referral (accepted, patient exists) is
//                     reachable by whoever getPatientScope says can
//                     reach that patient, the same code patients,
//                     visits, care plans and documents use
//   3. FIELDS       WHICH PARTS of a reachable referral they see:
//                   - summary and clinical reason: everyone who can
//                     reach it (a nurse on the linked patient's team
//                     needs the reason)
//                   - office details (outside contact, office notes,
//                     decision note): administrative roles only. For
//                     anyone else these columns are never even read
//                     from the database.
//
// There is no care-team question for referrals. Like documents, this is
// office work rather than clinical content someone writes about a
// patient, so being on the team adds nothing. Recording and deciding
// referrals also needs administrative reach: someone whose reach is only
// "my assigned patients" cannot record a referral, because the person
// being referred is not their patient.
//
// Other rules:
//   - received -> in_review -> accepted, and a referral can be declined
//     or withdrawn from either open state. Accepted, declined and
//     withdrawn are final. Declining or withdrawing needs a written reason.
//   - accepting LINKS the referral to a patient. Either an existing
//     patient whose name and date of birth match the referral exactly,
//     or a brand new patient record (which also needs patients.create).
//     A new record is refused if a patient with that name and date of
//     birth already exists, so one person never becomes two patients.
//   - only ONE open referral per person at a time
//   - an open referral can be edited; a final one is locked
//   - referrals are never deleted
//
// What a denial does: it is written to the audit log (action
// "access_denied", outcome "denied") and the caller gets a plain
// message. A referral that does not exist and a referral the person may
// not reach produce the SAME answer, so guessing ids reveals nothing.
//
// The audit log records that something happened, never what the
// referral said.

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { writeAuditLog } from "@/lib/audit/log";
import {
  getPatientScope,
  scopeAllowsPatient,
  type PatientScope,
} from "@/lib/patients";
import type { Result } from "@/lib/visits";
import { isVisitType } from "@/lib/visit-constants";
import { parseCalendarDate } from "@/lib/time";
import {
  OPEN_REFERRAL_STATUSES,
  REFERRAL_CONTACT_NAME_MAX,
  REFERRAL_EARLIEST_BIRTH_YEAR,
  REFERRAL_NAME_MAX,
  REFERRAL_NOTE_MAX,
  REFERRAL_PHONE_MAX,
  REFERRAL_REASON_MAX,
  REFERRAL_SOURCE_ORG_MAX,
  REFERRAL_TRANSITIONS,
  isOpenReferralStatus,
  isReferralAction,
  isReferralSource,
  isReferralUrgency,
  referralActionsFor,
  type ReferralAction,
  type ReferralStatus,
} from "@/lib/referral-constants";

const NOT_FOUND = "That referral could not be found.";
const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const CANNOT_RECORD = "You cannot record or manage referrals.";

interface Actor {
  id: string;
  email: string;
  organizationId: string;
}

async function loadActor(userId: string): Promise<Actor> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, organizationId: true },
  });
}

async function auditDenied(
  actor: Actor,
  resourceType: string,
  resourceId?: string,
): Promise<void> {
  await writeAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "access_denied",
    resourceType,
    resourceId,
    outcome: "denied",
  });
}

async function auditAllowed(
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await writeAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    resourceType,
    resourceId,
    outcome: "allowed",
  });
}

// Trim, and drop the one character Postgres refuses to store. Length is
// checked by the caller.
function cleanText(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

// ---------- Validation ----------

// What the forms send. Every field is a plain string, because that is
// what a form gives us; validateDetails turns it into real values or an
// error message.
export interface ReferralDetailsInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // "YYYY-MM-DD"
  sourceType: string;
  sourceOrganization: string;
  sourceContactName: string;
  sourceContactPhone: string;
  requestedService: string;
  urgency: string;
  reason: string;
  officeNotes: string;
}

interface CleanDetails {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  sourceType: string;
  sourceOrganization: string | null;
  sourceContactName: string | null;
  sourceContactPhone: string | null;
  requestedService: string;
  urgency: string;
  reason: string;
  officeNotes: string | null;
}

function validateDetails(input: ReferralDetailsInput): Result<CleanDetails> {
  const firstName = cleanText(input.firstName);
  const lastName = cleanText(input.lastName);
  if (firstName.length === 0) {
    return { ok: false, error: "Enter the person's first name." };
  }
  if (lastName.length === 0) {
    return { ok: false, error: "Enter the person's last name." };
  }
  if (
    firstName.length > REFERRAL_NAME_MAX ||
    lastName.length > REFERRAL_NAME_MAX
  ) {
    return {
      ok: false,
      error: `Names can be at most ${REFERRAL_NAME_MAX} characters.`,
    };
  }

  const dateOfBirth = parseCalendarDate(input.dateOfBirth);
  if (!dateOfBirth) {
    return { ok: false, error: "Enter a real date of birth." };
  }
  if (dateOfBirth.getUTCFullYear() < REFERRAL_EARLIEST_BIRTH_YEAR) {
    return {
      ok: false,
      error: `The date of birth cannot be before ${REFERRAL_EARLIEST_BIRTH_YEAR}.`,
    };
  }
  if (dateOfBirth.getTime() > Date.now()) {
    return { ok: false, error: "The date of birth cannot be in the future." };
  }

  if (!isReferralSource(input.sourceType)) {
    return { ok: false, error: "Choose who sent the referral." };
  }
  if (!isVisitType(input.requestedService)) {
    return { ok: false, error: "Choose the kind of care that is requested." };
  }
  if (!isReferralUrgency(input.urgency)) {
    return { ok: false, error: "Choose how urgent the referral is." };
  }

  const reason = cleanText(input.reason);
  if (reason.length === 0) {
    return { ok: false, error: "Write why care is being requested." };
  }
  if (reason.length > REFERRAL_REASON_MAX) {
    return {
      ok: false,
      error: `The reason can be at most ${REFERRAL_REASON_MAX} characters.`,
    };
  }

  const sourceOrganization = cleanText(input.sourceOrganization);
  if (sourceOrganization.length > REFERRAL_SOURCE_ORG_MAX) {
    return {
      ok: false,
      error: `The sending organization can be at most ${REFERRAL_SOURCE_ORG_MAX} characters.`,
    };
  }

  const sourceContactName = cleanText(input.sourceContactName);
  if (sourceContactName.length > REFERRAL_CONTACT_NAME_MAX) {
    return {
      ok: false,
      error: `The contact name can be at most ${REFERRAL_CONTACT_NAME_MAX} characters.`,
    };
  }

  const sourceContactPhone = cleanText(input.sourceContactPhone);
  if (sourceContactPhone.length > 0) {
    const digits = sourceContactPhone.replace(/\D/g, "").length;
    const looksLikePhone = /^[0-9+()\-.\sxX]+$/.test(sourceContactPhone);
    if (
      sourceContactPhone.length > REFERRAL_PHONE_MAX ||
      !looksLikePhone ||
      digits < 7
    ) {
      return { ok: false, error: "Enter a real phone number, or leave it empty." };
    }
  }

  const officeNotes = cleanText(input.officeNotes);
  if (officeNotes.length > REFERRAL_NOTE_MAX) {
    return {
      ok: false,
      error: `Office notes can be at most ${REFERRAL_NOTE_MAX} characters.`,
    };
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      dateOfBirth,
      sourceType: input.sourceType,
      sourceOrganization: sourceOrganization || null,
      sourceContactName: sourceContactName || null,
      sourceContactPhone: sourceContactPhone || null,
      requestedService: input.requestedService,
      urgency: input.urgency,
      reason,
      officeNotes: officeNotes || null,
    },
  };
}

// ---------- Reach ----------

// Can this person reach this referral? The two shapes of referral have
// two different answers, and that difference is the heart of this file.
//   - unlinked: the person is not a patient yet. Only administrative
//     reach (scope.kind "organization") covers that.
//   - linked: the same question every other patient record asks.
async function canReach(
  actor: Actor,
  scope: PatientScope,
  referral: { organizationId: string; patientId: string | null },
): Promise<boolean> {
  if (referral.organizationId !== actor.organizationId) return false;
  if (referral.patientId === null) return scope.kind === "organization";
  return scopeAllowsPatient(scope, referral.patientId);
}

// Finds a referral AND checks the person may reach it. A referral that
// is missing, in another organization, or out of the person's reach all
// end the same way: audited, and null.
async function loadReferralInScope(
  actor: Actor,
  scope: PatientScope,
  referralId: string,
) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    select: {
      id: true,
      organizationId: true,
      patientId: true,
      status: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
    },
  });

  if (!referral || !(await canReach(actor, scope, referral))) {
    await auditDenied(actor, "referral", referralId);
    return null;
  }
  return referral;
}

// Is there already an OPEN referral for this person? Names are compared
// without regard to capital letters.
async function findOpenReferralFor(
  organizationId: string,
  firstName: string,
  lastName: string,
  dateOfBirth: Date,
  excludeId?: string,
) {
  return prisma.referral.findFirst({
    where: {
      organizationId,
      status: { in: [...OPEN_REFERRAL_STATUSES] },
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
      dateOfBirth,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

// The patient record, if any, that has this exact name and date of
// birth. Used to keep one person from becoming two patients.
async function findMatchingPatient(
  organizationId: string,
  firstName: string,
  lastName: string,
  dateOfBirth: Date,
) {
  return prisma.patient.findFirst({
    where: {
      organizationId,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
      dateOfBirth,
    },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
}

const DUPLICATE_OPEN =
  "There is already an open referral for this person. Finish or close that one first.";

// ---------- Reading ----------

// Office details. Present only for administrative reach; for everyone
// else the whole object is null and the columns were never read.
export interface ReferralOfficeDetails {
  sourceContactName: string | null;
  sourceContactPhone: string | null;
  officeNotes: string | null;
  decisionNote: string | null;
}

export interface ReferralRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  status: string;
  sourceType: string;
  sourceOrganization: string | null;
  requestedService: string;
  urgency: string;
  reason: string; // clinical
  patientId: string | null;
  patientName: string | null; // set when linked
  createdByName: string;
  decidedByName: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  office: ReferralOfficeDetails | null;
  // Set only for someone who can manage the referral: the existing
  // patient this person already is, so "accept" can link instead of
  // creating a duplicate.
  matchingPatient: { id: string; name: string } | null;
  canEdit: boolean;
  actions: ReferralAction[];
}

export interface ReferralLists {
  open: ReferralRow[];
  closed: ReferralRow[];
  canManage: boolean;
}

const baseSelect = {
  id: true,
  patientId: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sourceType: true,
  sourceOrganization: true,
  requestedService: true,
  urgency: true,
  reason: true,
  status: true,
  decidedAt: true,
  createdAt: true,
  patient: { select: { firstName: true, lastName: true } },
  createdBy: { select: { name: true } },
  decidedBy: { select: { name: true } },
} satisfies Prisma.ReferralSelect;

// The columns only administrative reach may see.
const officeSelect = {
  sourceContactName: true,
  sourceContactPhone: true,
  officeNotes: true,
  decisionNote: true,
} satisfies Prisma.ReferralSelect;

type BaseRecord = Prisma.ReferralGetPayload<{ select: typeof baseSelect }>;
type OfficeRecord = Prisma.ReferralGetPayload<{ select: typeof officeSelect }>;
type ReferralRecord = BaseRecord & Partial<OfficeRecord>;

// One query, and the ONLY place the office columns are ever selected.
// When withOffice is false the database is never asked for them.
async function fetchRecords(
  where: Prisma.ReferralWhereInput,
  orderBy: Prisma.ReferralOrderByWithRelationInput[],
  take: number,
  withOffice: boolean,
): Promise<ReferralRecord[]> {
  if (withOffice) {
    return prisma.referral.findMany({
      where,
      select: { ...baseSelect, ...officeSelect },
      orderBy,
      take,
    });
  }
  return prisma.referral.findMany({
    where,
    select: baseSelect,
    orderBy,
    take,
  });
}

export async function listReferrals(userId: string): Promise<ReferralLists> {
  await requirePermission(userId, "referrals.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const canManage =
    scope.kind === "organization" &&
    (await hasPermission(userId, "referrals.manage"));
  const withOffice = scope.kind === "organization";

  // Reach, written as a database filter. An assigned scope can only ever
  // match rows whose patientId is in its list, and `in` never matches a
  // null - so an unlinked referral is invisible to it by construction.
  const reach: Prisma.ReferralWhereInput =
    scope.kind === "organization"
      ? { organizationId: actor.organizationId }
      : {
          organizationId: actor.organizationId,
          patientId: { in: scope.patientIds },
        };

  const [openRecords, closedRecords] = await Promise.all([
    // "urgent" sorts after "routine" alphabetically, so descending puts
    // urgent first; then whoever has waited longest.
    fetchRecords(
      { ...reach, status: { in: [...OPEN_REFERRAL_STATUSES] } },
      [{ urgency: "desc" }, { createdAt: "asc" }],
      200,
      withOffice,
    ),
    fetchRecords(
      { ...reach, status: { notIn: [...OPEN_REFERRAL_STATUSES] } },
      [{ updatedAt: "desc" }],
      50,
      withOffice,
    ),
  ]);

  async function toRow(r: ReferralRecord): Promise<ReferralRow> {
    let matchingPatient: ReferralRow["matchingPatient"] = null;
    if (canManage && r.status === "in_review") {
      const match = await findMatchingPatient(
        actor.organizationId,
        r.firstName,
        r.lastName,
        r.dateOfBirth,
      );
      if (match) {
        matchingPatient = {
          id: match.id,
          name: `${match.firstName} ${match.lastName}`,
        };
      }
    }

    return {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      dateOfBirth: r.dateOfBirth,
      status: r.status,
      sourceType: r.sourceType,
      sourceOrganization: r.sourceOrganization,
      requestedService: r.requestedService,
      urgency: r.urgency,
      reason: r.reason,
      patientId: r.patientId,
      patientName: r.patient
        ? `${r.patient.firstName} ${r.patient.lastName}`
        : null,
      createdByName: r.createdBy.name,
      decidedByName: r.decidedBy?.name ?? null,
      decidedAt: r.decidedAt,
      createdAt: r.createdAt,
      office: withOffice
        ? {
            sourceContactName: r.sourceContactName ?? null,
            sourceContactPhone: r.sourceContactPhone ?? null,
            officeNotes: r.officeNotes ?? null,
            decisionNote: r.decisionNote ?? null,
          }
        : null,
      matchingPatient,
      canEdit: canManage && isOpenReferralStatus(r.status),
      actions: canManage ? referralActionsFor(r.status) : [],
    };
  }

  return {
    open: await Promise.all(openRecords.map(toRow)),
    closed: await Promise.all(closedRecords.map(toRow)),
    canManage,
  };
}

// Should the page show the "record a referral" form? Convenience only:
// createReferral re-checks everything itself.
export async function canRecordReferrals(userId: string): Promise<boolean> {
  if (!(await hasPermission(userId, "referrals.manage"))) return false;
  const scope = await getPatientScope(userId);
  return scope.kind === "organization";
}

// ---------- Recording and editing ----------

export async function createReferral(
  userId: string,
  input: ReferralDetailsInput,
): Promise<Result<{ referralId: string }>> {
  // 1. Permission - a hard stop.
  await requirePermission(userId, "referrals.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Reach. A new referral is about someone who is not a patient yet,
  //    so only administrative reach can record one.
  if (scope.kind !== "organization") {
    await auditDenied(actor, "referral");
    return { ok: false, error: CANNOT_RECORD };
  }

  const checked = validateDetails(input);
  if (!checked.ok) return checked;
  const d = checked.value;

  if (
    await findOpenReferralFor(
      actor.organizationId,
      d.firstName,
      d.lastName,
      d.dateOfBirth,
    )
  ) {
    return { ok: false, error: DUPLICATE_OPEN };
  }

  const referral = await prisma.referral.create({
    data: {
      organizationId: actor.organizationId,
      createdById: userId,
      ...d,
    },
    select: { id: true },
  });

  await auditAllowed(actor, "referral_created", "referral", referral.id);
  return { ok: true, value: { referralId: referral.id } };
}

export async function updateReferral(
  userId: string,
  referralId: string,
  input: ReferralDetailsInput,
): Promise<Result<{ referralId: string }>> {
  await requirePermission(userId, "referrals.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const referral = await loadReferralInScope(actor, scope, referralId);
  if (!referral) return { ok: false, error: NOT_FOUND };

  if (!isOpenReferralStatus(referral.status)) {
    return {
      ok: false,
      error:
        "A referral that has been accepted, declined or withdrawn can no longer be edited.",
    };
  }

  const checked = validateDetails(input);
  if (!checked.ok) return checked;
  const d = checked.value;

  if (
    await findOpenReferralFor(
      actor.organizationId,
      d.firstName,
      d.lastName,
      d.dateOfBirth,
      referral.id,
    )
  ) {
    return { ok: false, error: DUPLICATE_OPEN };
  }

  // The status guard makes the edit and a concurrent decision safe: if
  // someone decided the referral a moment ago, nothing is written.
  const result = await prisma.referral.updateMany({
    where: { id: referral.id, status: { in: [...OPEN_REFERRAL_STATUSES] } },
    data: d,
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This referral was just changed by someone else. Refresh and try again.",
    };
  }

  await auditAllowed(actor, "referral_updated", "referral", referral.id);
  return { ok: true, value: { referralId: referral.id } };
}

// ---------- Deciding ----------

export interface ReferralStatusInput {
  // Required for decline and withdraw: the written reason.
  note?: string;
  // For accept: link to this existing patient instead of creating one.
  existingPatientId?: string | null;
}

class LostRace extends Error {}

export async function changeReferralStatus(
  userId: string,
  referralId: string,
  action: string,
  input: ReferralStatusInput = {},
): Promise<Result<{ status: ReferralStatus; patientId: string | null }>> {
  // 1. Permission - a hard stop.
  await requirePermission(userId, "referrals.manage");

  if (!isReferralAction(action)) {
    return { ok: false, error: "That action is not recognised." };
  }

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Reach. Missing and off-limits give the same answer.
  const referral = await loadReferralInScope(actor, scope, referralId);
  if (!referral) return { ok: false, error: NOT_FOUND };

  // 3. The status machine.
  const transition = REFERRAL_TRANSITIONS[action];
  if (!transition.from.some((s) => s === referral.status)) {
    return {
      ok: false,
      error: `This referral is already ${referral.status.replace("_", " ")}, so it cannot be changed that way.`,
    };
  }

  // 4. Rules that belong to one action.
  let note: string | null = null;
  if (transition.needsNote) {
    note = cleanText(input.note ?? "");
    if (note.length === 0) {
      return { ok: false, error: "Write the reason first." };
    }
    if (note.length > REFERRAL_NOTE_MAX) {
      return {
        ok: false,
        error: `The reason can be at most ${REFERRAL_NOTE_MAX} characters.`,
      };
    }
  }

  const now = new Date();
  const decides = action !== "start_review";

  // ----- Accepting: link the person to a patient record. -----
  if (action === "accept") {
    const existingId = input.existingPatientId ?? null;

    if (existingId !== null) {
      // Linking to an existing patient. The patient must be reachable,
      // in this organization, active, and be the same person.
      if (
        !(await scopeAllowsPatient(scope, existingId)) ||
        !(await prisma.patient.count({
          where: { id: existingId, organizationId: actor.organizationId },
        }))
      ) {
        await auditDenied(actor, "patient", existingId);
        return { ok: false, error: NO_PATIENT_ACCESS };
      }

      const patient = await prisma.patient.findUniqueOrThrow({
        where: { id: existingId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          status: true,
        },
      });

      const sameName =
        patient.firstName.toLowerCase() === referral.firstName.toLowerCase() &&
        patient.lastName.toLowerCase() === referral.lastName.toLowerCase();
      const sameBirthday =
        patient.dateOfBirth.getTime() === referral.dateOfBirth.getTime();
      if (!sameName || !sameBirthday) {
        return {
          ok: false,
          error:
            "That patient's name and date of birth do not match this referral.",
        };
      }
      if (patient.status !== "active") {
        return {
          ok: false,
          error: "A referral can only be linked to an active patient.",
        };
      }

      const moved = await prisma.referral.updateMany({
        where: { id: referral.id, status: "in_review" },
        data: {
          status: transition.to,
          patientId: patient.id,
          decidedById: userId,
          decidedAt: now,
        },
      });
      if (moved.count === 0) {
        return {
          ok: false,
          error:
            "This referral was just changed by someone else. Refresh and try again.",
        };
      }

      await auditAllowed(actor, transition.auditAction, "referral", referral.id);
      return {
        ok: true,
        value: { status: transition.to, patientId: patient.id },
      };
    }

    // Creating a new patient record needs its own permission.
    await requirePermission(userId, "patients.create");

    const duplicate = await findMatchingPatient(
      actor.organizationId,
      referral.firstName,
      referral.lastName,
      referral.dateOfBirth,
    );
    if (duplicate) {
      return {
        ok: false,
        error:
          "A patient with this name and date of birth already exists. Link the referral to that record instead of creating a new one.",
      };
    }

    let newPatientId: string;
    try {
      newPatientId = await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({
          data: {
            organizationId: actor.organizationId,
            firstName: referral.firstName,
            lastName: referral.lastName,
            dateOfBirth: referral.dateOfBirth,
          },
          select: { id: true },
        });
        const moved = await tx.referral.updateMany({
          where: { id: referral.id, status: "in_review" },
          data: {
            status: transition.to,
            patientId: patient.id,
            decidedById: userId,
            decidedAt: now,
          },
        });
        // Someone decided it first: undo the patient we just made.
        if (moved.count === 0) throw new LostRace();
        return patient.id;
      });
    } catch (err) {
      if (err instanceof LostRace) {
        return {
          ok: false,
          error:
            "This referral was just changed by someone else. Refresh and try again.",
        };
      }
      throw err;
    }

    await auditAllowed(actor, "patient_created", "patient", newPatientId);
    await auditAllowed(actor, transition.auditAction, "referral", referral.id);
    return {
      ok: true,
      value: { status: transition.to, patientId: newPatientId },
    };
  }

  // ----- Every other action: start review, decline, withdraw. -----
  const result = await prisma.referral.updateMany({
    where: { id: referral.id, status: { in: [...transition.from] } },
    data: {
      status: transition.to,
      ...(decides ? { decidedById: userId, decidedAt: now } : {}),
      ...(note !== null ? { decisionNote: note } : {}),
    },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This referral was just changed by someone else. Refresh and try again.",
    };
  }

  await auditAllowed(actor, transition.auditAction, "referral", referral.id);
  return { ok: true, value: { status: transition.to, patientId: null } };
}
