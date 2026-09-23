// src/lib/visits.ts
//
// Everything about who may see, schedule and change a visit lives in this
// one file. Pages and server actions call these functions; none of them
// query the visits table or decide access on their own - see
// PHASE_0_ARCHITECTURE.md section 8, one path to the data, and it is
// guarded.
//
// Every operation here applies the same two-part rule patients use:
//
//   1. PERMISSION   does this person's role hold visits.read / .create /
//                   .update at all?  (requirePermission, a hard stop)
//   2. RELATIONSHIP is this visit's patient one this person is allowed to
//                   reach?  (getPatientScope in src/lib/patients.ts)
//
// Both must pass. On top of that, two rules specific to visits:
//
//   - An administrative role can schedule a visit for any care team
//     member of any patient. Everyone else can only schedule visits for
//     THEMSELVES, and only for patients they are on the care team of.
//   - Only the assigned clinician or an administrative role can move a
//     visit through its statuses (check in, check out, cancel, missed).
//     A nurse on the same patient's team can SEE a colleague's visit,
//     but cannot change it.
//
// What a denial does: it is written to the audit log (action
// "access_denied", outcome "denied") and the caller gets a plain message
// that does not reveal whether the thing they asked about exists. "That
// visit does not exist" and "that visit is not yours" look identical from
// outside - otherwise guessing IDs would tell someone which ones are real.
//
// Nothing here logs what was found at a visit, because nothing here
// stores it. A visit row only says a visit is happening.

import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { writeAuditLog } from "@/lib/audit/log";
import { auditDenied, loadActor } from "@/lib/auth/actor";
import {
  activeAssignmentFilter,
  getPatientScope,
  scopeAllowsPatient,
} from "@/lib/patients";
import { orgLocalToUtc } from "@/lib/time";
import {
  MAX_DAYS_AHEAD,
  MAX_DAYS_IN_PAST,
  VISIT_TRANSITIONS,
  isVisitAction,
  isVisitDuration,
  isVisitType,
} from "@/lib/visit-constants";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// A deliberately vague message reused wherever the honest answer would
// reveal whether something exists. See the note at the top of this file.
const NOT_FOUND = "That visit could not be found.";
const NO_PATIENT_ACCESS = "You do not have access to that patient.";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- Reading ----------

export interface VisitRow {
  id: string;
  patientId: string;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
  visitType: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  // Still "scheduled" after its window has already ended - it was never
  // checked in. Worth flagging so someone marks it missed or follows up.
  overdue: boolean;
  // Whether THIS viewer may move this visit through its statuses. The
  // page uses it to decide which buttons to draw; changeVisitStatus
  // re-checks everything regardless.
  canChange: boolean;
}

export interface VisitLists {
  upcoming: VisitRow[]; // scheduled or in progress, soonest first
  recent: VisitRow[]; // completed, cancelled or missed, newest first
}

// Hard limits so a large organization never loads an unbounded list -
// PHASE_0_ARCHITECTURE.md section 16, never an unbounded findMany.
const UPCOMING_LIMIT = 100;
const RECENT_LIMIT = 50;

export async function listVisits(userId: string): Promise<VisitLists> {
  await requirePermission(userId, "visits.read");

  const scope = await getPatientScope(userId);
  const canUpdate = await hasPermission(userId, "visits.update");

  // Administrative roles: every visit in their organization. Everyone
  // else: visits of patients they are actively assigned to.
  const scopeWhere =
    scope.kind === "organization"
      ? { organizationId: scope.organizationId }
      : {
          organizationId: scope.organizationId,
          patientId: { in: scope.patientIds },
        };

  const include = {
    patient: { select: { firstName: true, lastName: true } },
    clinician: { select: { name: true } },
  } as const;

  const [upcoming, recent] = await Promise.all([
    prisma.visit.findMany({
      where: { ...scopeWhere, status: { in: ["scheduled", "in_progress"] } },
      include,
      orderBy: { scheduledStart: "asc" },
      take: UPCOMING_LIMIT,
    }),
    prisma.visit.findMany({
      where: {
        ...scopeWhere,
        status: { in: ["completed", "cancelled", "missed"] },
      },
      include,
      orderBy: { scheduledStart: "desc" },
      take: RECENT_LIMIT,
    }),
  ]);

  const now = new Date();

  const toRow = (v: (typeof upcoming)[number]): VisitRow => ({
    id: v.id,
    patientId: v.patientId,
    patientName: `${v.patient.firstName} ${v.patient.lastName}`,
    clinicianId: v.clinicianId,
    clinicianName: v.clinician.name,
    visitType: v.visitType,
    status: v.status,
    scheduledStart: v.scheduledStart,
    scheduledEnd: v.scheduledEnd,
    checkedInAt: v.checkedInAt,
    checkedOutAt: v.checkedOutAt,
    overdue: v.status === "scheduled" && v.scheduledEnd < now,
    canChange:
      canUpdate && (scope.kind === "organization" || v.clinicianId === userId),
  });

  return { upcoming: upcoming.map(toRow), recent: recent.map(toRow) };
}

// ---------- Options for the scheduling form ----------

export interface SchedulingOption {
  patientId: string;
  patientName: string;
  clinicians: { id: string; name: string; roleOnCase: string }[];
}

// What the scheduling form may offer THIS person: only patients they can
// reach, and for each one only the clinicians they are allowed to assign.
// Returns null when the person cannot schedule at all, so the page can
// simply leave the form out. (The form being absent is convenience -
// scheduleVisit below is what actually enforces it.)
export async function getSchedulingOptions(
  userId: string,
): Promise<SchedulingOption[] | null> {
  if (!(await hasPermission(userId, "visits.create"))) return null;

  const scope = await getPatientScope(userId);

  const patients = await prisma.patient.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "active",
      ...(scope.kind === "assigned" ? { id: { in: scope.patientIds } } : {}),
    },
    include: {
      careTeam: {
        where: {
          ...activeAssignmentFilter(),
          // A non-administrative person can only assign themselves.
          ...(scope.kind === "assigned" ? { userId } : {}),
        },
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return patients
    .filter((p) => p.careTeam.length > 0)
    .map((p) => ({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      clinicians: p.careTeam.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        roleOnCase: m.roleOnCase,
      })),
    }));
}

// ---------- Scheduling ----------

export interface ScheduleVisitInput {
  patientId: string;
  clinicianId: string;
  visitType: string;
  // "2026-09-21T10:00", exactly what a datetime-local input produces, in
  // the organization's timezone (see src/lib/time.ts).
  startLocal: string;
  durationMinutes: number;
}

export async function scheduleVisit(
  userId: string,
  input: ScheduleVisitInput,
): Promise<Result<{ visitId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "visits.create");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Relationship to the patient.
  if (!(await scopeAllowsPatient(scope, input.patientId))) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_PATIENT_ACCESS };
  }

  // 3. Everyone who is not administrative can only schedule for
  //    themselves.
  if (scope.kind === "assigned" && input.clinicianId !== userId) {
    await auditDenied(actor, "patient", input.patientId);
    return {
      ok: false,
      error: "You can only schedule visits assigned to yourself.",
    };
  }

  // 4. Now that access is settled, check the details.
  if (!isVisitType(input.visitType)) {
    return { ok: false, error: "Choose a visit type from the list." };
  }
  if (!isVisitDuration(input.durationMinutes)) {
    return { ok: false, error: "Choose a length from the list." };
  }

  const start = orgLocalToUtc(input.startLocal);
  if (!start) {
    return { ok: false, error: "Enter a valid date and time." };
  }
  const now = Date.now();
  if (start.getTime() < now - MAX_DAYS_IN_PAST * DAY_MS) {
    return { ok: false, error: "That date is too far in the past." };
  }
  if (start.getTime() > now + MAX_DAYS_AHEAD * DAY_MS) {
    return { ok: false, error: "That date is too far ahead." };
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60000);

  // 5. Only active patients can have new visits scheduled.
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: actor.organizationId },
    select: { status: true },
  });
  if (!patient || patient.status !== "active") {
    return {
      ok: false,
      error: "New visits can only be scheduled for active patients.",
    };
  }

  // 6. The clinician must be on THIS patient's care team right now. This
  //    is what stops a visit being assigned to someone with no business
  //    near the patient's record.
  const onTeam = await prisma.careTeamMember.findFirst({
    where: {
      patientId: input.patientId,
      userId: input.clinicianId,
      ...activeAssignmentFilter(),
      user: { organizationId: actor.organizationId },
    },
    select: { id: true },
  });
  if (!onTeam) {
    return {
      ok: false,
      error: "That clinician is not on this patient's care team.",
    };
  }

  // 7. A clinician cannot be in two places at once.
  const clash = await prisma.visit.findFirst({
    where: {
      clinicianId: input.clinicianId,
      status: { in: ["scheduled", "in_progress"] },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
    },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      error: "That clinician already has a visit at that time.",
    };
  }

  const visit = await prisma.visit.create({
    data: {
      organizationId: actor.organizationId,
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      scheduledById: userId,
      visitType: input.visitType,
      scheduledStart: start,
      scheduledEnd: end,
    },
    select: { id: true },
  });

  await writeAuditLog({
    organizationId: actor.organizationId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "visit_created",
    resourceType: "visit",
    resourceId: visit.id,
    outcome: "allowed",
  });

  return { ok: true, value: { visitId: visit.id } };
}

// ---------- Changing a visit's status ----------

export async function changeVisitStatus(
  userId: string,
  visitId: string,
  action: string,
): Promise<Result<{ status: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "visits.update");

  if (!isVisitAction(action)) {
    return { ok: false, error: "That action is not recognised." };
  }

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

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

  // 2. Relationship. A visit that does not exist and a visit the person
  //    may not touch produce the same answer.
  const inScope =
    visit !== null &&
    visit.organizationId === actor.organizationId &&
    (await scopeAllowsPatient(scope, visit.patientId));
  if (!visit || !inScope) {
    await auditDenied(actor, "visit", visitId);
    return { ok: false, error: NOT_FOUND };
  }

  // 3. Only the assigned clinician or an administrative role may act.
  if (scope.kind === "assigned" && visit.clinicianId !== userId) {
    await auditDenied(actor, "visit", visit.id);
    return {
      ok: false,
      error: "Only the assigned clinician or an administrator can change this visit.",
    };
  }

  // 4. The status machine: is this action allowed from where the visit is?
  const transition = VISIT_TRANSITIONS[action];
  if (visit.status !== transition.from) {
    return {
      ok: false,
      error: `This visit is already ${visit.status.replace("_", " ")}, so it cannot be changed that way.`,
    };
  }

  const now = new Date();

  // updateMany with the expected current status in the WHERE clause makes
  // this safe against two people acting on the same visit at the same
  // moment: only one of them can find it still in the expected status.
  const result = await prisma.visit.updateMany({
    where: { id: visit.id, status: transition.from },
    data: {
      status: transition.to,
      ...(action === "check_in" ? { checkedInAt: now } : {}),
      ...(action === "check_out" ? { checkedOutAt: now } : {}),
    },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This visit was just changed by someone else. Refresh and try again.",
    };
  }

  await writeAuditLog({
    organizationId: actor.organizationId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: transition.auditAction,
    resourceType: "visit",
    resourceId: visit.id,
    outcome: "allowed",
  });

  return { ok: true, value: { status: transition.to } };
}
