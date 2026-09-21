// src/lib/care-team.ts
//
// Who is on a patient's care team, and the only code that changes it.
//
// Until now the ONLY way a person got onto a care team was the seed script.
// That left a real gap: a patient made by accepting a referral (Walter
// Brennan, in the demo) has nobody on the team, so nobody could see them,
// schedule them or write a plan for them. This file closes it.
//
// Every operation asks the same questions the other services ask:
//
//   1. PERMISSION   care_team.read to look, care_team.manage to change
//                   (requirePermission, a hard stop)
//   2. RELATIONSHIP the patient must be one this person can reach
//                   (getPatientScope in src/lib/patients.ts)
//
// and, for putting someone on a team, three rules that belong to teams:
//
//   - PATIENT       only an ACTIVE patient can be given a new team member.
//   - STAFF         the person must be in the same organization and must
//                   REALLY hold a role that may fill that place (nurse for
//                   the nurse places, caregiver for the caregiver place).
//                   Checked against the database, not the form.
//   - PLACE         nobody is on the same team twice at once, and a patient
//                   has at most one primary nurse at a time. The primary
//                   nurse check runs inside a serializable transaction so
//                   two coordinators clicking at the same moment cannot
//                   both succeed.
//
// Ending an assignment never deletes anything. It sets an end date, so the
// history of who looked after whom stays on record, and the person loses
// access to that patient the same instant (getPatientScope only counts
// assignments that are still active).
//
// A denial is written to the audit log (action "access_denied") and the
// caller gets the same plain words it would get for something that does
// not exist, so guessing IDs tells nobody which ones are real.

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor } from "@/lib/auth/actor";
import {
  activeAssignmentFilter,
  getPatientScope,
  scopeAllowsPatient,
} from "@/lib/patients";
import {
  ASSIGNABLE_STAFF_ROLE_KEYS,
  CARE_TEAM_ROLES,
  careTeamRoleLabel,
  isCareTeamRole,
  staffMayFill,
  type CareTeamRoleKey,
} from "@/lib/care-team-constants";
import type { Result } from "@/lib/visits";

const NO_PATIENT = "That patient could not be found.";
const NO_ASSIGNMENT = "That assignment could not be found.";
const CANNOT_ASSIGN = "That person cannot be put on this care team in that place.";

// How many times a colliding change is tried before giving up.
const MAX_ATTEMPTS = 3;

// Two changes collided in the database. The normal Prisma engine reports
// this as error code P2034; a driver adapter reports the same thing as a
// "TransactionWriteConflict". Either way nothing was saved and it is safe
// to run the change again.
function isWriteConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    return true;
  }
  const e = err as { message?: string; cause?: { kind?: string } } | null;
  return e?.cause?.kind === "TransactionWriteConflict" || e?.message === "TransactionWriteConflict";
}

// Hard limits so a long history never loads without bound.
const PAST_LIMIT = 30;
const NEEDS_TEAM_LIMIT = 100;

// ---------- Reading ----------

export interface CareTeamRow {
  id: string;
  userId: string;
  name: string;
  roleOnCase: string;
  roleLabel: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface CareTeamView {
  patientId: string;
  patientName: string;
  active: CareTeamRow[];
  // Assignments that have ended, newest first. History, not access.
  past: CareTeamRow[];
  // Whether THIS viewer may change the team. The screen uses it to decide
  // whether to draw the buttons; the change functions re-check regardless.
  canManage: boolean;
}

export async function listCareTeam(
  userId: string,
  patientId: string,
): Promise<Result<CareTeamView>> {
  await requirePermission(userId, "care_team.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  if (!(await scopeAllowsPatient(scope, patientId))) {
    await auditDenied(actor, "patient", patientId);
    return { ok: false, error: NO_PATIENT };
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: actor.organizationId },
    select: { firstName: true, lastName: true },
  });
  if (!patient) return { ok: false, error: NO_PATIENT };

  const now = new Date();
  const [active, past, canManage] = await Promise.all([
    prisma.careTeamMember.findMany({
      where: { patientId, ...activeAssignmentFilter(now) },
      include: { user: { select: { name: true } } },
      orderBy: [{ startsAt: "asc" }],
    }),
    prisma.careTeamMember.findMany({
      where: { patientId, endsAt: { lte: now } },
      include: { user: { select: { name: true } } },
      orderBy: [{ endsAt: "desc" }],
      take: PAST_LIMIT,
    }),
    hasPermission(userId, "care_team.manage"),
  ]);

  const toRow = (m: (typeof active)[number]): CareTeamRow => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    roleOnCase: m.roleOnCase,
    roleLabel: careTeamRoleLabel(m.roleOnCase),
    startsAt: m.startsAt,
    endsAt: m.endsAt,
  });

  return {
    ok: true,
    value: {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      active: active.map(toRow),
      past: past.map(toRow),
      canManage,
    },
  };
}

export interface PatientNeedingTeam {
  id: string;
  name: string;
  // True when somebody is on the team but nobody is the primary nurse.
  hasAnyTeam: boolean;
}

// The coordinator's worklist: active patients nobody is the primary nurse
// for. Priya Raman in the demo, and every patient made by accepting a
// referral. Only patients this person can reach are ever listed.
export async function listPatientsNeedingTeam(
  userId: string,
): Promise<PatientNeedingTeam[]> {
  await requirePermission(userId, "care_team.read");

  const scope = await getPatientScope(userId);
  const now = new Date();

  const patients = await prisma.patient.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "active",
      ...(scope.kind === "assigned" ? { id: { in: scope.patientIds } } : {}),
      careTeam: {
        none: { roleOnCase: "primary_nurse", ...activeAssignmentFilter(now) },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      careTeam: {
        where: activeAssignmentFilter(now),
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: NEEDS_TEAM_LIMIT,
  });

  return patients.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    hasAnyTeam: p.careTeam.length > 0,
  }));
}

// ---------- What the "add to team" form may offer ----------

export interface AssignmentOptions {
  patientId: string;
  patientName: string;
  places: { key: CareTeamRoleKey; label: string }[];
  staff: {
    id: string;
    name: string;
    // Which places on this team this person could fill.
    canFill: CareTeamRoleKey[];
  }[];
}

// What the form may offer THIS person for THIS patient. Returns null when
// they cannot change the team at all, or the patient is not reachable or
// not active, so the screen simply leaves the form out. (The form being
// absent is convenience - assignToCareTeam below is what enforces it.)
export async function getAssignmentOptions(
  userId: string,
  patientId: string,
): Promise<AssignmentOptions | null> {
  if (!(await hasPermission(userId, "care_team.manage"))) return null;

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  if (!(await scopeAllowsPatient(scope, patientId))) return null;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: actor.organizationId, status: "active" },
    select: { firstName: true, lastName: true },
  });
  if (!patient) return null;

  const now = new Date();
  const [activeMembers, candidates] = await Promise.all([
    prisma.careTeamMember.findMany({
      where: { patientId, ...activeAssignmentFilter(now) },
      select: { userId: true, roleOnCase: true },
    }),
    prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        userRoles: { some: { role: { key: { in: [...ASSIGNABLE_STAFF_ROLE_KEYS] } } } },
      },
      select: {
        id: true,
        name: true,
        userRoles: { select: { role: { select: { key: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const onTeam = new Set(activeMembers.map((m) => m.userId));
  const hasPrimary = activeMembers.some((m) => m.roleOnCase === "primary_nurse");

  const places = CARE_TEAM_ROLES.filter(
    (r) => !(r.onePerPatient && hasPrimary),
  ).map((r) => ({ key: r.key, label: r.label }));

  const staff = candidates
    .filter((c) => !onTeam.has(c.id))
    .map((c) => {
      const keys = c.userRoles.map((ur) => ur.role.key);
      return {
        id: c.id,
        name: c.name,
        canFill: places.filter((p) => staffMayFill(keys, p.key)).map((p) => p.key),
      };
    })
    .filter((c) => c.canFill.length > 0);

  return {
    patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    places,
    staff,
  };
}

// ---------- Putting someone on a team ----------

export interface AssignInput {
  patientId: string;
  staffId: string;
  roleOnCase: string;
}

export async function assignToCareTeam(
  userId: string,
  input: AssignInput,
): Promise<Result<{ assignmentId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "care_team.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Relationship to the patient. Missing and off-limits sound the same.
  if (!(await scopeAllowsPatient(scope, input.patientId))) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_PATIENT };
  }

  // 3. The place must be one that exists.
  if (!isCareTeamRole(input.roleOnCase)) {
    return { ok: false, error: "Choose a place on the team from the list." };
  }
  const place = input.roleOnCase;

  // 4. Only an active patient can be given a new team member.
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: actor.organizationId },
    select: { status: true },
  });
  if (!patient) return { ok: false, error: NO_PATIENT };
  if (patient.status !== "active") {
    return {
      ok: false,
      error: "People can only be added to the care team of an active patient.",
    };
  }

  // 5. The person: same organization, and really holds a role that may
  //    fill this place. A person from another organization looks exactly
  //    like a person who does not exist.
  const staff = await prisma.user.findFirst({
    where: { id: input.staffId, organizationId: actor.organizationId },
    select: {
      id: true,
      userRoles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!staff) {
    await auditDenied(actor, "user", input.staffId);
    return { ok: false, error: CANNOT_ASSIGN };
  }
  const staffRoleKeys = staff.userRoles.map((ur) => ur.role.key);
  if (!staffMayFill(staffRoleKeys, place)) {
    await auditDenied(actor, "user", staff.id);
    return { ok: false, error: CANNOT_ASSIGN };
  }

  // 6. The place itself. Re-checked inside a serializable transaction so
  //    two people acting at once cannot both get past it.
  const onePerPatient = CARE_TEAM_ROLES.find((r) => r.key === place)?.onePerPatient ?? false;

  // A serializable transaction can be refused by the database when two
  // changes collide (that is its job). The right response is to run it
  // again: the second time it sees what the first one did, and gives the
  // honest answer ("this patient already has a primary nurse").
  let assignmentId = "";
  for (let attempt = 1; ; attempt++) {
    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          const now = new Date();

          const already = await tx.careTeamMember.count({
            where: {
              patientId: input.patientId,
              userId: staff.id,
              ...activeAssignmentFilter(now),
            },
          });
          if (already > 0) {
            return { ok: false as const, error: "That person is already on this care team." };
          }

          if (onePerPatient) {
            const taken = await tx.careTeamMember.count({
              where: {
                patientId: input.patientId,
                roleOnCase: place,
                ...activeAssignmentFilter(now),
              },
            });
            if (taken > 0) {
              return {
                ok: false as const,
                error: `This patient already has a ${careTeamRoleLabel(place).toLowerCase()}. End that assignment first.`,
              };
            }
          }

          const created = await tx.careTeamMember.create({
            data: {
              patientId: input.patientId,
              userId: staff.id,
              roleOnCase: place,
              startsAt: now,
            },
            select: { id: true },
          });
          return { ok: true as const, id: created.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!outcome.ok) return { ok: false, error: outcome.error };
      assignmentId = outcome.id;
      break;
    } catch (err) {
      if (!isWriteConflict(err)) throw err;
      if (attempt >= MAX_ATTEMPTS) {
        return {
          ok: false,
          error: "The care team changed at the same moment. Please look at it again and retry.",
        };
      }
    }
  }

  await auditAllowed(actor, "care_team_assigned", "care_team_member", assignmentId);
  return { ok: true, value: { assignmentId } };
}

// ---------- Taking someone off a team ----------

export async function endCareTeamAssignment(
  userId: string,
  assignmentId: string,
): Promise<Result<{ futureVisitsToReassign: number }>> {
  // 1. Permission - a hard stop.
  await requirePermission(userId, "care_team.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Reach. An assignment in another organization, one for a patient
  //    this person cannot reach, and one that never existed all get the
  //    same answer.
  const membership = await prisma.careTeamMember.findFirst({
    where: { id: assignmentId, patient: { organizationId: actor.organizationId } },
    select: { id: true, patientId: true, userId: true },
  });
  if (!membership || !(await scopeAllowsPatient(scope, membership.patientId))) {
    await auditDenied(actor, "care_team_member", assignmentId);
    return { ok: false, error: NO_ASSIGNMENT };
  }

  // 3. End it. The guard in the WHERE clause means an assignment that was
  //    already ended (even a moment ago, by someone else) changes nothing.
  const now = new Date();
  const ended = await prisma.careTeamMember.updateMany({
    where: { id: membership.id, ...activeAssignmentFilter(now) },
    data: { endsAt: now },
  });
  if (ended.count === 0) {
    return { ok: false, error: "That assignment has already ended." };
  }

  // Visits already on the calendar for this person on this patient are
  // NOT cancelled here. That is a decision for a human, so the caller is
  // told how many there are.
  const futureVisitsToReassign = await prisma.visit.count({
    where: {
      patientId: membership.patientId,
      clinicianId: membership.userId,
      status: "scheduled",
      scheduledStart: { gt: now },
    },
  });

  await auditAllowed(actor, "care_team_ended", "care_team_member", membership.id);
  return { ok: true, value: { futureVisitsToReassign } };
}
