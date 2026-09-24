// src/lib/family-consents.ts
//
// Recording and withdrawing a patient's permission for a family member to
// see parts of their care. This is the office side. What the family member
// then sees is decided in src/lib/family-portal.ts.
//
// THE RULES
//   1. To record, withdraw or list consents you need the permission
//      consents.manage (ADMIN and SUPER_ADMIN hold it) AND you must reach
//      the patient. Reach is the same test every other screen uses.
//   2. Recording a consent means the office HOLDS the patient's permission
//      (a signed form). The form makes the person say so, and the server
//      refuses without it.
//   3. A consent names ONE patient, ONE family account, how they are
//      related, WHICH parts are shared (visit schedule, care team, care
//      plan: a non-empty list, each chosen on its own) and how long it
//      lasts.
//   4. The family account must be a real account of this organization
//      holding the family role, and must not be the patient's own account.
//   5. A patient must be active or on hold. A discharged patient, a made-up
//      patient, an unreachable patient and another organization's patient
//      all get the same words.
//   6. A person cannot have two consents in force for the same patient, and
//      a patient has at most MAX_CONSENTS_PER_PATIENT in force. Both are
//      checked inside a transaction that locks the patient's row, so two
//      people clicking at the same moment cannot both get in.
//   7. A consent is written once and never edited. To change what is
//      shared, withdraw it and record a new one. Withdrawing ends access at
//      once. Nothing is deleted: who could see what, and until when, stays
//      on record.
//   8. Every refusal for a reason that could reveal something (an unreachable
//      patient, an ineligible person, a made-up consent) is audited as denied
//      and answered in the same plain words. The audit log records THAT a
//      consent was recorded or withdrawn, never a name, never what was shared.

import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor } from "@/lib/auth/actor";
import { getPatientScope, scopeAllowsPatient } from "@/lib/patients";
import type { Result } from "@/lib/visits";
import {
  FAMILY_ROLE_KEY,
  MAX_CONSENTS_PER_PATIENT,
  cleanScopes,
  consentExpiry,
  consentScopeLabel,
  isConsentDuration,
  isFamilyRelationship,
  relationshipLabel,
} from "@/lib/family-constants";

const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const NOT_FOUND_CONSENT = "That consent could not be found.";
const NOT_ALLOWED_PERSON =
  "That account cannot be given access to this patient's care.";

// A consent can be recorded only for someone who is being looked after now.
const CONSENT_PATIENT_STATUSES = ["active", "on_hold"];

// ---------- Reading ----------

export interface ConsentRow {
  id: string;
  patientName: string;
  familyName: string;
  relationshipLabel: string;
  scopeLabels: string[];
  recordedByName: string;
  createdAt: Date;
  expiresAt: Date | null;
}

// Every consent still in force for patients this person reaches. Throws
// AuthorizationError for anyone without consents.manage.
export async function listConsents(userId: string): Promise<ConsentRow[]> {
  await requirePermission(userId, "consents.manage");
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const rows = await prisma.familyConsent.findMany({
    where: {
      organizationId: actor.organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(scope.kind === "assigned" ? { patientId: { in: scope.patientIds } } : {}),
    },
    select: {
      id: true,
      relationship: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
      patient: { select: { firstName: true, lastName: true } },
      familyUser: { select: { name: true } },
      grantedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((c) => ({
    id: c.id,
    patientName: `${c.patient.firstName} ${c.patient.lastName}`,
    familyName: c.familyUser.name,
    relationshipLabel: relationshipLabel(c.relationship),
    scopeLabels: cleanScopes(c.scopes)?.map(consentScopeLabel) ?? [],
    recordedByName: c.grantedBy.name,
    createdAt: c.createdAt,
    expiresAt: c.expiresAt,
  }));
}

export interface ConsentOptions {
  patients: { patientId: string; patientName: string }[];
  people: { id: string; label: string }[];
}

// What the form may offer. null for anyone who may not record consents, so
// the page leaves the form out. (The form being absent is a convenience;
// createConsent is what enforces it.)
export async function getConsentOptions(userId: string): Promise<ConsentOptions | null> {
  if (!(await hasPermission(userId, "consents.manage"))) return null;
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const [patients, people] = await Promise.all([
    prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { in: CONSENT_PATIENT_STATUSES },
        ...(scope.kind === "assigned" ? { id: { in: scope.patientIds } } : {}),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        userRoles: { some: { role: { key: FAMILY_ROLE_KEY } } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  return {
    patients: patients.map((p) => ({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
    })),
    people: people.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` })),
  };
}

// ---------- Recording ----------

export interface CreateConsentInput {
  patientId: string;
  familyUserId: string;
  relationship: string;
  scopes: string[];
  duration: string;
  // The office holds the patient's signed permission. Must be exactly "yes".
  confirmed: string;
}

export async function createConsent(
  userId: string,
  input: CreateConsentInput,
): Promise<Result<{ consentId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "consents.manage");
  const actor = await loadActor(userId);

  // 2. The office must hold the patient's permission.
  if (input.confirmed !== "yes") {
    return {
      ok: false,
      error: "Confirm that the patient has given their permission (a signed form is on file).",
    };
  }

  // 3. The patient: reachable, in this organization, and being looked
  //    after. Anything else looks like "no access".
  const scope = await getPatientScope(userId);
  const patient = (await scopeAllowsPatient(scope, input.patientId))
    ? await prisma.patient.findFirst({
        where: {
          id: input.patientId,
          organizationId: actor.organizationId,
          status: { in: CONSENT_PATIENT_STATUSES },
        },
        select: { id: true, userId: true },
      })
    : null;
  if (!patient) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_PATIENT_ACCESS };
  }

  // 4. What is being shared, how they are related, for how long.
  if (!isFamilyRelationship(input.relationship)) {
    return { ok: false, error: "Choose how this person is related to the patient." };
  }
  const scopes = cleanScopes(input.scopes);
  if (scopes === null) {
    return { ok: false, error: "Choose at least one thing to share, from the list." };
  }
  const duration = input.duration;
  if (!isConsentDuration(duration)) {
    return { ok: false, error: "Choose how long the permission lasts." };
  }

  // 5. The person: made-up, from another organization, not a family
  //    account, or the patient's own account: all the same words.
  const family = await prisma.user.findFirst({
    where: {
      id: input.familyUserId,
      organizationId: actor.organizationId,
      userRoles: { some: { role: { key: FAMILY_ROLE_KEY } } },
    },
    select: { id: true },
  });
  if (!family || family.id === patient.userId) {
    await auditDenied(actor, "family_consent", input.familyUserId);
    return { ok: false, error: NOT_ALLOWED_PERSON };
  }

  // 6. One consent per person and patient, and a limit per patient, checked
  //    while the patient's row is locked.
  const now = new Date();
  const inForce = {
    organizationId: actor.organizationId,
    patientId: patient.id,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM patients WHERE id = ${patient.id} FOR UPDATE`;
    const already = await tx.familyConsent.count({
      where: { ...inForce, familyUserId: family.id },
    });
    if (already > 0) return { kind: "duplicate" as const };
    const total = await tx.familyConsent.count({ where: inForce });
    if (total >= MAX_CONSENTS_PER_PATIENT) return { kind: "full" as const };
    const created = await tx.familyConsent.create({
      data: {
        organizationId: actor.organizationId,
        patientId: patient.id,
        familyUserId: family.id,
        relationship: input.relationship,
        scopes,
        grantedById: userId,
        expiresAt: consentExpiry(duration, now),
      },
      select: { id: true },
    });
    return { kind: "created" as const, id: created.id };
  });

  if (outcome.kind === "duplicate") {
    return {
      ok: false,
      error: "That person already has a permission for this patient. Withdraw it first to record a new one.",
    };
  }
  if (outcome.kind === "full") {
    return {
      ok: false,
      error: `A patient can have at most ${MAX_CONSENTS_PER_PATIENT} people with access. Withdraw one first.`,
    };
  }

  await auditAllowed(actor, "family_consent_recorded", "family_consent", outcome.id);
  return { ok: true, value: { consentId: outcome.id } };
}

// ---------- Withdrawing ----------

export async function revokeConsent(
  userId: string,
  consentId: string,
): Promise<Result<{ consentId: string }>> {
  await requirePermission(userId, "consents.manage");
  const actor = await loadActor(userId);

  const consent = await prisma.familyConsent.findUnique({
    where: { id: consentId },
    select: { id: true, organizationId: true, patientId: true },
  });
  const scope = await getPatientScope(userId);
  const reachable =
    consent !== null &&
    consent.organizationId === actor.organizationId &&
    (await scopeAllowsPatient(scope, consent.patientId));
  if (!consent || !reachable) {
    await auditDenied(actor, "family_consent", consentId);
    return { ok: false, error: NOT_FOUND_CONSENT };
  }

  // The expected state in the WHERE clause makes this safe if two people
  // click at the same moment.
  const result = await prisma.familyConsent.updateMany({
    where: { id: consent.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: userId },
  });
  if (result.count === 0) {
    return { ok: false, error: "That permission was already withdrawn." };
  }

  await auditAllowed(actor, "family_consent_withdrawn", "family_consent", consent.id);
  return { ok: true, value: { consentId: consent.id } };
}
