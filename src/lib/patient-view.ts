// src/lib/patient-view.ts
//
// The four things a patient, or a family member the patient chose to share
// with, may see about one patient: upcoming visits, recent visits, the care
// team as it is today, and the ACTIVE care plan. Written once so the patient
// portal (src/lib/patient-portal.ts) and the family portal
// (src/lib/family-portal.ts) can never drift apart in what they show.
//
// THIS FILE DECIDES NO ACCESS. It does not know who is asking. The two
// callers decide that (permission, then ownership or consent) and only then
// call these loaders with a patient id they have already proved is theirs to
// show. The organization is passed in from the caller's own row and is part
// of every query, as defense in depth.
//
// WHAT IS NEVER SELECTED HERE, on purpose: visit notes and addenda, tasks,
// documents, referrals, office notes, e-mail addresses, date of birth. A
// staff member is shown by name only. A care plan is shown only when it is
// ACTIVE (approved), never a draft, a finished plan or a discarded one.

import "server-only";
import { prisma } from "@/lib/prisma";
import { activeAssignmentFilter } from "@/lib/patients";
import { careTeamRoleLabel } from "@/lib/care-team-constants";

export const UPCOMING_LIMIT = 10;
export const RECENT_LIMIT = 5;

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

const visitSelect = {
  id: true,
  visitType: true,
  status: true,
  scheduledStart: true,
  scheduledEnd: true,
  clinician: { select: { name: true } },
} as const;

function toVisit(v: {
  id: string;
  visitType: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  clinician: { name: string };
}): MyVisit {
  return {
    id: v.id,
    visitType: v.visitType,
    status: v.status,
    scheduledStart: v.scheduledStart,
    scheduledEnd: v.scheduledEnd,
    clinicianName: v.clinician.name,
  };
}

// Scheduled visits that have not ended, and a visit happening now.
// Soonest first. Cancelled and missed visits are left out.
export async function loadUpcomingVisits(
  patientId: string,
  organizationId: string,
  now: Date,
): Promise<MyVisit[]> {
  const rows = await prisma.visit.findMany({
    where: {
      patientId,
      organizationId,
      OR: [
        { status: "in_progress" },
        { status: "scheduled", scheduledEnd: { gte: now } },
      ],
    },
    select: visitSelect,
    orderBy: { scheduledStart: "asc" },
    take: UPCOMING_LIMIT,
  });
  return rows.map(toVisit);
}

// Completed visits, newest first.
export async function loadRecentVisits(
  patientId: string,
  organizationId: string,
): Promise<MyVisit[]> {
  const rows = await prisma.visit.findMany({
    where: { patientId, organizationId, status: "completed" },
    select: visitSelect,
    orderBy: { scheduledStart: "desc" },
    take: RECENT_LIMIT,
  });
  return rows.map(toVisit);
}

// The people on the care team right now (an assignment with an end date in
// the past is history, not the team).
export async function loadCareTeam(
  patientId: string,
  organizationId: string,
  now: Date,
): Promise<MyTeamMember[]> {
  const rows = await prisma.careTeamMember.findMany({
    where: {
      patientId,
      ...activeAssignmentFilter(now),
      user: { organizationId },
    },
    select: { roleOnCase: true, user: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });
  return rows.map((m) => ({
    name: m.user.name,
    roleLabel: careTeamRoleLabel(m.roleOnCase),
  }));
}

// The one ACTIVE care plan, or null.
export async function loadActivePlan(
  patientId: string,
  organizationId: string,
): Promise<MyCarePlan | null> {
  const plan = await prisma.carePlan.findFirst({
    where: { patientId, organizationId, status: "active" },
    select: {
      title: true,
      summary: true,
      approvedAt: true,
      goals: {
        select: { id: true, description: true, status: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!plan) return null;
  return {
    title: plan.title,
    summary: plan.summary,
    approvedAt: plan.approvedAt,
    goals: plan.goals.map((g) => ({
      id: g.id,
      description: g.description,
      met: g.status === "met",
    })),
  };
}
