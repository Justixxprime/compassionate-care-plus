// src/lib/staff.ts
//
// The staff directory (Milestone E2). Unlike patients, staff.manage is
// held only by SUPER_ADMIN and ADMIN (see prisma/seed.ts), and both of
// those roles already reach every patient in the organization - so
// there is no second, relationship-shaped question to ask here the way
// there is for patients, visits, care plans and documents. One
// permission, one organization-wide list.
//
// This file itself stays READ-ONLY: who exists, what roles they hold,
// how many active patients they are on the team for. Creating an
// account - staff, family, or linking a patient - is real user
// provisioning and lives in its own file, src/lib/accounts.ts, shown on
// this same /staff page. See docs/ACCOUNTS.md.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { loadActor } from "@/lib/auth/actor";
import { activeAssignmentFilter } from "@/lib/patients";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  roleLabels: string[];
  activePatientCount: number;
}

const LIST_LIMIT = 200;

export async function listStaff(userId: string): Promise<StaffRow[]> {
  await requirePermission(userId, "staff.manage");

  const actor = await loadActor(userId);

  const users = await prisma.user.findMany({
    where: { organizationId: actor.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      userRoles: { select: { role: { select: { name: true } } } },
      careTeamMemberships: {
        where: activeAssignmentFilter(),
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
    take: LIST_LIMIT,
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleLabels: u.userRoles.map((ur) => ur.role.name),
    activePatientCount: u.careTeamMemberships.length,
  }));
}
