// src/lib/patients.ts
//
// This is where the "relationship-based access" rule from
// PHASE_0_ARCHITECTURE.md section 3 actually becomes real code, not
// just a diagram. A permission alone ("patients.read") is not enough in
// a healthcare system - a nurse holding patients.read should still only
// see the patients they're actually assigned to. Only administrative
// roles get to see every patient in the organization.
//
// The check is: role permission (requirePermission, a hard stop) AND
// THEN relationship (are they actually on this patient's care team, or
// do they hold a role that legitimately sees everyone). Both parts
// matter - this file is deliberately the only place that logic lives.
//
// Visits (src/lib/visits.ts) and every clinical slice after them reuse
// the relationship half through getPatientScope() and canAccessPatient()
// below, instead of writing their own copy. One rule, one place: two
// copies of an access rule is how they slowly drift apart, and one of
// them ends up quietly more permissive than the other.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditDenied, loadActor } from "@/lib/auth/actor";

// Roles that legitimately need to see every patient in the
// organization, not just their own assigned cases - office-side roles,
// not direct-care roles.
const ADMINISTRATIVE_ROLE_KEYS = [
  "SUPER_ADMIN",
  "ADMIN",
  "CLINICAL_SUPERVISOR",
  "CARE_COORDINATOR",
] as const;

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  status: string;
}

// What a person is allowed to reach, by relationship. This is the answer
// to "which patients?" - separate from "may they do this KIND of thing?",
// which is a permission (requirePermission) and is checked by the caller.
//
//   organization - an administrative role: every patient in their own
//                  organization
//   assigned     - everyone else: only the listed patients, each one a
//                  care team assignment that is still active
export type PatientScope =
  | { kind: "organization"; organizationId: string }
  | { kind: "assigned"; organizationId: string; patientIds: string[] };

// A care team assignment counts while it has no end date, or its end
// date is still in the future. Exported so anything that asks "is this
// person on this patient's care team right now?" uses the same test.
export function activeAssignmentFilter(now: Date = new Date()) {
  return { OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

export async function getPatientScope(userId: string): Promise<PatientScope> {
  // The organization comes from the user's own row, never from anything
  // passed in - a caller cannot ask for someone else's organization.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });

  const isAdministrative = user.userRoles.some((ur) =>
    (ADMINISTRATIVE_ROLE_KEYS as readonly string[]).includes(ur.role.key),
  );

  if (isAdministrative) {
    return { kind: "organization", organizationId: user.organizationId };
  }

  // Everyone else: only patients they're actually on the care team for,
  // and only while that assignment is still active. The patient must
  // also belong to their own organization - defense in depth, since a
  // care team row pointing across organizations should never exist.
  const memberships = await prisma.careTeamMember.findMany({
    where: {
      userId,
      ...activeAssignmentFilter(),
      patient: { organizationId: user.organizationId },
    },
    select: { patientId: true },
  });

  return {
    kind: "assigned",
    organizationId: user.organizationId,
    patientIds: Array.from(new Set(memberships.map((m) => m.patientId))),
  };
}

// Does an already-computed scope include this ONE patient? Split out from
// canAccessPatient so code that needs the scope for other reasons too
// (like visits, which also branch on scope.kind) can ask without a
// second round trip to work out the same scope again.
export async function scopeAllowsPatient(
  scope: PatientScope,
  patientId: string,
): Promise<boolean> {
  if (scope.kind === "assigned") {
    return scope.patientIds.includes(patientId);
  }

  const count = await prisma.patient.count({
    where: { id: patientId, organizationId: scope.organizationId },
  });
  return count > 0;
}

// Is this person on this patient's care team RIGHT NOW? Stricter than
// getPatientScope: an administrative role can REACH every patient, but
// only the people actually assigned to a patient are "on the team".
// Writing clinical content (care plans, later notes) asks this question
// in addition to the scope question. Uses the same activeAssignmentFilter
// as everything else, so "active" means the same thing everywhere.
export async function isActiveCareTeamMember(
  userId: string,
  patientId: string,
  organizationId: string,
): Promise<boolean> {
  const count = await prisma.careTeamMember.count({
    where: {
      userId,
      patientId,
      ...activeAssignmentFilter(),
      patient: { organizationId },
    },
  });
  return count > 0;
}

// Can this person reach this ONE patient, by relationship? Used before
// creating or changing anything that hangs off a patient (a visit, later
// a care plan). Says nothing about permissions - callers check those
// with requirePermission first.
export async function canAccessPatient(
  userId: string,
  patientId: string,
): Promise<boolean> {
  const scope = await getPatientScope(userId);
  return scopeAllowsPatient(scope, patientId);
}

export async function getAccessiblePatients(
  userId: string,
): Promise<PatientSummary[]> {
  // Hard stop first - no permission, no query even runs.
  await requirePermission(userId, "patients.read");

  const scope = await getPatientScope(userId);

  return prisma.patient.findMany({
    where:
      scope.kind === "organization"
        ? { organizationId: scope.organizationId }
        : { organizationId: scope.organizationId, id: { in: scope.patientIds } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

// One patient, for the patient profile screen (Milestone E2). Same two
// questions as every other read here - permission, then relationship -
// and the same vague answer (null) whether the patient does not exist
// or simply is not reachable by this viewer, so guessing an id from the
// URL bar tells nobody which case they hit.
export async function getPatientDetail(
  userId: string,
  patientId: string,
): Promise<PatientSummary | null> {
  await requirePermission(userId, "patients.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  if (!(await scopeAllowsPatient(scope, patientId))) {
    await auditDenied(actor, "patient", patientId);
    return null;
  }

  return prisma.patient.findFirst({
    where: { id: patientId, organizationId: actor.organizationId },
  });
}
