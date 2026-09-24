// src/lib/patient-portal.ts
//
// The patient portal: what a patient sees about THEIR OWN care. Everything
// about who may see what lives in this one file. The page and the dashboard
// call getMyCare(); nothing else reads a patient's information for a
// patient.
//
// THE PERMISSION DESIGN (docs/PATIENT_PORTAL.md explains it in plain words)
//
//   portal.read   the new permission. It means: "see my OWN next visits,
//                 my care team and my active care plan". It opens no staff
//                 screen, no other patient, no note, no document, no task.
//
// The PATIENT role holds exactly that key and nothing else. Two things must
// both pass:
//
//   1. PERMISSION  does the account hold portal.read? (a hard stop)
//   2. OWNERSHIP   which patient record is this account's own? That is
//                  the ONE record whose user_id is this account, in this
//                  account's own organization, and still active or on
//                  hold. The link is stored on the patient record. It
//                  never comes from the browser: getMyCare takes no
//                  patient id at all, so there is nothing to forge.
//
// An account that holds the permission but is linked to no record (an
// administrator, or a patient account not connected yet) gets null, and
// the screen says the account is not connected. It never falls back to
// "show everybody".
//
// WHAT IS NEVER SHOWN HERE, on purpose: visit notes and their addenda,
// tasks, documents, referrals, office notes, other people's e-mail
// addresses, the audit log. A care plan is shown only when it is ACTIVE
// (approved), never a draft, a finished plan or a discarded one.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { loadActor } from "@/lib/auth/actor";
import { activeAssignmentFilter } from "@/lib/patients";
import { careTeamRoleLabel } from "@/lib/care-team-constants";

const UPCOMING_LIMIT = 10;
const RECENT_LIMIT = 5;

export interface MyVisit {
  id: string;
  visitType: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  // The staff member's name, as the patient knows them. Never an e-mail.
  clinicianName: string;
}

export interface MyTeamMember {
  name: string;
  roleLabel: string;
}

export interface MyGoal {
  id: string;
  description: string;
  met: boolean;
}

export interface MyCarePlan {
  title: string;
  summary: string;
  approvedAt: Date | null;
  goals: MyGoal[];
}

export interface MyCare {
  firstName: string;
  // Scheduled visits that have not ended, and a visit happening now.
  // Soonest first. Cancelled and missed visits are left out.
  upcoming: MyVisit[];
  // Completed visits, newest first.
  recent: MyVisit[];
  team: MyTeamMember[];
  plan: MyCarePlan | null;
}

// A discharged patient no longer has a portal. An account with no record
// linked has nothing to show.
const PORTAL_STATUSES = ["active", "on_hold"];

export async function getMyCare(
  userId: string,
  now: Date = new Date(),
): Promise<MyCare | null> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "portal.read");

  // 2. Ownership - the organization comes from this person's OWN row.
  const actor = await loadActor(userId);
  const patient = await prisma.patient.findFirst({
    where: {
      userId,
      organizationId: actor.organizationId,
      status: { in: PORTAL_STATUSES },
    },
    select: { id: true, firstName: true },
  });
  if (!patient) return null;

  const visitSelect = {
    id: true,
    visitType: true,
    status: true,
    scheduledStart: true,
    scheduledEnd: true,
    clinician: { select: { name: true } },
  } as const;
  const toVisit = (v: {
    id: string;
    visitType: string;
    status: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    clinician: { name: string };
  }): MyVisit => ({
    id: v.id,
    visitType: v.visitType,
    status: v.status,
    scheduledStart: v.scheduledStart,
    scheduledEnd: v.scheduledEnd,
    clinicianName: v.clinician.name,
  });

  const [upcoming, recent, team, plan] = await Promise.all([
    prisma.visit.findMany({
      where: {
        patientId: patient.id,
        organizationId: actor.organizationId,
        OR: [
          { status: "in_progress" },
          { status: "scheduled", scheduledEnd: { gte: now } },
        ],
      },
      select: visitSelect,
      orderBy: { scheduledStart: "asc" },
      take: UPCOMING_LIMIT,
    }),
    prisma.visit.findMany({
      where: {
        patientId: patient.id,
        organizationId: actor.organizationId,
        status: "completed",
      },
      select: visitSelect,
      orderBy: { scheduledStart: "desc" },
      take: RECENT_LIMIT,
    }),
    prisma.careTeamMember.findMany({
      where: {
        patientId: patient.id,
        ...activeAssignmentFilter(now),
        user: { organizationId: actor.organizationId },
      },
      select: { roleOnCase: true, user: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.carePlan.findFirst({
      where: {
        patientId: patient.id,
        organizationId: actor.organizationId,
        status: "active",
      },
      select: {
        title: true,
        summary: true,
        approvedAt: true,
        goals: {
          select: { id: true, description: true, status: true },
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);

  return {
    firstName: patient.firstName,
    upcoming: upcoming.map(toVisit),
    recent: recent.map(toVisit),
    team: team.map((m) => ({
      name: m.user.name,
      roleLabel: careTeamRoleLabel(m.roleOnCase),
    })),
    plan: plan
      ? {
          title: plan.title,
          summary: plan.summary,
          approvedAt: plan.approvedAt,
          goals: plan.goals.map((g) => ({
            id: g.id,
            description: g.description,
            met: g.status === "met",
          })),
        }
      : null,
  };
}
