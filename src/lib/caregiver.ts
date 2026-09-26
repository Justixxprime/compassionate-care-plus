// src/lib/caregiver.ts
//
// The caregiver portal: what a home health aide sees on a phone, and the
// two things an aide may do to a visit. Everything about who may do what
// lives in this one file. The page and the server actions call these
// functions; none of them query the visits table or decide access alone.
//
// THE PERMISSION DESIGN (docs/CAREGIVER_PORTAL.md explains it in plain words)
//
//   visits.checkin   the new permission. It means: "see MY OWN visits for
//                    today and check in and out of them". It does NOT mean
//                    seeing anybody else's visits, scheduling, cancelling,
//                    marking a visit missed, reading a patient chart, or
//                    writing a note.
//   visits.caregiver_document a separate, limited factual visit update.
//   tasks.read       already existed. The checklist is the ordinary task
//                    list, so finishing a task uses the ordinary task rules
//                    (src/lib/tasks.ts), unchanged.
//
// The caregiver role holds exactly those two and nothing else. Every
// operation here applies THREE things, all of which must pass:
//
//   1. PERMISSION   does the account hold visits.checkin? (a hard stop)
//   2. REACH        is the visit's patient one this person still reaches,
//                   meaning an active care team assignment right now?
//   3. OWNERSHIP    is the visit assigned to THIS person? Even an
//                   administrator who holds the permission can only see
//                   and act on visits assigned to themselves here.
//
// Something that does not exist, something out of reach and something that
// belongs to a colleague all get the same words, and the refusal is written
// to the audit log. The audit log never holds a patient's name.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { writeAuditLog } from "@/lib/audit/log";
import { auditDenied, loadActor } from "@/lib/auth/actor";
import {
  getPatientScope,
  scopeAllowsPatient,
  type PatientScope,
} from "@/lib/patients";
import { orgDateKey } from "@/lib/time";
import { VISIT_TRANSITIONS } from "@/lib/visit-constants";
import type { Result } from "@/lib/visits";

const NOT_FOUND = "That visit could not be found.";
const OFFICE_ONLY =
  "Caregivers check in and check out. To cancel a visit or mark it missed, ask the office.";
const NOT_TODAY = "You can check in on the day of the visit.";
const OTHER_OPEN =
  "You are still checked in to another visit. Check out of it first.";

const HOUR_MS = 60 * 60 * 1000;
// A window wide enough to hold any office day in any season, however the
// clock sits against UTC. The office day itself is decided afterwards.
const WINDOW_HOURS = 36;
const LIST_LIMIT = 60;

export interface CaregiverVisit {
  id: string;
  patientName: string;
  visitType: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  // Still "scheduled" after its window ended: it was never checked in.
  overdue: boolean;
  // What THIS person may do right now. The page draws buttons from these.
  // caregiverVisitAction re-checks everything on every tap.
  canCheckIn: boolean;
  canCheckOut: boolean;
  caregiverUpdate: { content: string; status: string } | null;
  canWriteCaregiverUpdate: boolean;
}

export interface CaregiverDay {
  // Visits on today's office day, cancelled ones left out, soonest first.
  today: CaregiverVisit[];
  // Visits still checked in from an earlier day: the person forgot to
  // check out. Shown so they can be closed, never hidden.
  carriedOver: CaregiverVisit[];
}

// A person who is not administrative reaches only patients on whose care
// team they are now. An administrative role that holds the permission
// still only ever gets visits assigned to itself (see the where below).
function reachWhere(scope: PatientScope) {
  return scope.kind === "organization"
    ? {}
    : { patientId: { in: scope.patientIds } };
}

export async function getCaregiverDay(
  userId: string,
  now: Date = new Date(),
): Promise<CaregiverDay> {
  await requirePermission(userId, "visits.checkin");

  const scope = await getPatientScope(userId);

  const rows = await prisma.visit.findMany({
    where: {
      organizationId: scope.organizationId,
      clinicianId: userId,
      ...reachWhere(scope),
      OR: [
        { status: "in_progress" },
        {
          scheduledStart: {
            gte: new Date(now.getTime() - WINDOW_HOURS * HOUR_MS),
            lte: new Date(now.getTime() + WINDOW_HOURS * HOUR_MS),
          },
        },
      ],
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      caregiverVisitUpdate: { select: { content: true, status: true } },
    },
    orderBy: { scheduledStart: "asc" },
    take: LIST_LIMIT,
  });

  const todayKey = orgDateKey(now);
  const openElsewhere = new Set(
    rows.filter((v) => v.status === "in_progress").map((v) => v.id),
  );

  const toVisit = (v: (typeof rows)[number]): CaregiverVisit => {
    const isToday = orgDateKey(v.scheduledStart) === todayKey;
    const anotherOpen = [...openElsewhere].some((id) => id !== v.id);
    return {
      id: v.id,
      patientName: `${v.patient.firstName} ${v.patient.lastName}`,
      visitType: v.visitType,
      status: v.status,
      scheduledStart: v.scheduledStart,
      scheduledEnd: v.scheduledEnd,
      checkedInAt: v.checkedInAt,
      checkedOutAt: v.checkedOutAt,
      overdue: v.status === "scheduled" && v.scheduledEnd < now,
      canCheckIn: v.status === "scheduled" && isToday && !anotherOpen,
      canCheckOut: v.status === "in_progress",
      caregiverUpdate: v.caregiverVisitUpdate,
      canWriteCaregiverUpdate: ["in_progress", "completed"].includes(v.status),
    };
  };

  return {
    today: rows
      .filter(
        (v) =>
          v.status !== "cancelled" &&
          orgDateKey(v.scheduledStart) === todayKey,
      )
      .map(toVisit),
    carriedOver: rows
      .filter(
        (v) =>
          v.status === "in_progress" &&
          orgDateKey(v.scheduledStart) !== todayKey,
      )
      .map(toVisit),
  };
}

export type CaregiverAction = "check_in" | "check_out";

function isCaregiverAction(value: string): value is CaregiverAction {
  return value === "check_in" || value === "check_out";
}

export async function caregiverVisitAction(
  userId: string,
  visitId: string,
  action: string,
  now: Date = new Date(),
): Promise<Result<{ status: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "visits.checkin");

  // Cancelling and marking missed are known visit actions that a caregiver
  // never gets. Anything else that is not check in or out is nonsense.
  if (action === "cancel" || action === "mark_missed") {
    return { ok: false, error: OFFICE_ONLY };
  }
  if (!isCaregiverAction(action)) {
    return { ok: false, error: "That action is not recognised." };
  }

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const transition = VISIT_TRANSITIONS[action];

  const outcome = await prisma.$transaction(async (tx) => {
    // Lock this person's own row so two taps at the same moment (two
    // check-ins on two visits) are handled one after the other, and the
    // second one sees what the first did.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const visit = await tx.visit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        organizationId: true,
        patientId: true,
        clinicianId: true,
        status: true,
        scheduledStart: true,
      },
    });

    // 2. Reach and 3. ownership. A visit that does not exist, one out of
    //    reach and one that belongs to a colleague look exactly alike.
    const allowed =
      visit !== null &&
      visit.organizationId === actor.organizationId &&
      visit.clinicianId === userId &&
      (await scopeAllowsPatient(scope, visit.patientId));
    if (!visit || !allowed) return { kind: "denied" as const };

    // 4. The status machine.
    if (visit.status !== transition.from) {
      return {
        kind: "error" as const,
        error: `This visit is already ${visit.status.replace("_", " ")}, so it cannot be changed that way.`,
      };
    }

    if (action === "check_in") {
      if (orgDateKey(visit.scheduledStart) !== orgDateKey(now)) {
        return { kind: "error" as const, error: NOT_TODAY };
      }
      // One place at a time.
      const other = await tx.visit.findFirst({
        where: { clinicianId: userId, status: "in_progress", id: { not: visit.id } },
        select: { id: true },
      });
      if (other) return { kind: "error" as const, error: OTHER_OPEN };
    }

    const result = await tx.visit.updateMany({
      where: { id: visit.id, status: transition.from },
      data: {
        status: transition.to,
        ...(action === "check_in" ? { checkedInAt: now } : {}),
        ...(action === "check_out" ? { checkedOutAt: now } : {}),
      },
    });
    if (result.count === 0) {
      return {
        kind: "error" as const,
        error: "This visit was just changed by someone else. Refresh and try again.",
      };
    }
    return { kind: "done" as const, visitId: visit.id };
  });

  if (outcome.kind === "denied") {
    await auditDenied(actor, "visit", visitId);
    return { ok: false, error: NOT_FOUND };
  }
  if (outcome.kind === "error") return { ok: false, error: outcome.error };

  await writeAuditLog({
    organizationId: actor.organizationId,
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: transition.auditAction,
    resourceType: "visit",
    resourceId: outcome.visitId,
    outcome: "allowed",
  });

  return { ok: true, value: { status: transition.to } };
}
