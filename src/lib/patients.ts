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

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";

// Roles that legitimately need to see every patient in the
// organization, not just their own assigned cases - office-side roles,
// not direct-care roles.
const ADMINISTRATIVE_ROLE_KEYS = [
  "SUPER_ADMIN",
  "ADMIN",
  "CLINICAL_SUPERVISOR",
  "CARE_COORDINATOR",
] as const;

interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  status: string;
}

export async function getAccessiblePatients(
  userId: string,
): Promise<PatientSummary[]> {
  // Hard stop first - no permission, no query even runs.
  await requirePermission(userId, "patients.read");

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });

  const isAdministrative = userRoles.some((ur: { role: { key: string } }) =>
    (ADMINISTRATIVE_ROLE_KEYS as readonly string[]).includes(ur.role.key),
  );

  if (isAdministrative) {
    // Sees every patient in their organization - found via their own
    // user row rather than trusting an organizationId passed in from
    // anywhere else.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return prisma.patient.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { lastName: "asc" },
    });
  }

  // Everyone else: only patients they're actually on the care team for,
  // and only while that assignment is still active (endsAt is null or
  // in the future).
  const memberships = await prisma.careTeamMember.findMany({
    where: {
      userId,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    include: { patient: true },
  });

  return memberships
    .map((m: { patient: PatientSummary }) => m.patient)
    .sort((a: PatientSummary, b: PatientSummary) => a.lastName.localeCompare(b.lastName));
}
