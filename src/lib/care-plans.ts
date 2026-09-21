// src/lib/care-plans.ts
//
// Everything about who may see, write, approve and change a care plan
// lives in this one file. Pages and server actions call these functions;
// none of them query the care plan tables or decide access on their own.
//
// A care plan is the first table here that holds real clinical CONTENT
// (words a clinician wrote), so it asks THREE questions, not two:
//
//   1. PERMISSION   care_plans.read / .create / .update / .approve
//                   (requirePermission, a hard stop)
//   2. RELATIONSHIP can this person reach the patient at all?
//                   (getPatientScope in src/lib/patients.ts - the same
//                   code patients and visits use, not a copy)
//   3. TEAM         WRITING content also needs the person to be on THIS
//                   patient's care team right now. An administrator can
//                   read every plan and approve or complete them, but
//                   does not write clinical content for a patient they
//                   are not assigned to.
//
// Reading needs 1 and 2. Writing (create, edit, goals) needs 1, 2 and 3.
// Approving and completing needs the approve permission and 2, and one
// more rule: nobody approves a plan they wrote themselves.
//
// Other rules:
//   - a patient has at most one DRAFT and one ACTIVE plan at a time
//   - a plan needs at least one goal before it can be approved
//   - once a plan is active its wording is locked; only goals can be
//     marked met. What was approved is never quietly changed.
//   - completed and discarded plans are final and are never deleted
//
// What a denial does: it is written to the audit log (action
// "access_denied", outcome "denied") and the caller gets a plain
// message. A plan that does not exist and a plan the person may not
// reach produce the SAME answer, so guessing ids reveals nothing.
//
// The audit log records that something happened, never what the plan
// said.

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor, type Actor } from "@/lib/auth/actor";
import {
  activeAssignmentFilter,
  getPatientScope,
  isActiveCareTeamMember,
  scopeAllowsPatient,
  type PatientScope,
} from "@/lib/patients";
import type { Result } from "@/lib/visits";
import {
  GOAL_MAX,
  MAX_GOALS_PER_PLAN,
  PLAN_TRANSITIONS,
  SUMMARY_MAX,
  TITLE_MAX,
  isPlanAction,
} from "@/lib/care-plan-constants";

const NOT_FOUND = "That care plan could not be found.";
const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const NOT_ON_TEAM =
  "Only members of this patient's care team can write or change a care plan.";

// Trim, and drop the one character Postgres refuses to store. Length is
// checked by the caller.
function cleanText(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

function validateTitleAndSummary(
  titleRaw: string,
  summaryRaw: string,
): Result<{ title: string; summary: string }> {
  const title = cleanText(titleRaw);
  const summary = cleanText(summaryRaw);
  if (title.length === 0) return { ok: false, error: "Give the plan a title." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `The title can be at most ${TITLE_MAX} characters.` };
  }
  if (summary.length === 0) {
    return { ok: false, error: "Write a short summary of the plan." };
  }
  if (summary.length > SUMMARY_MAX) {
    return { ok: false, error: `The summary can be at most ${SUMMARY_MAX} characters.` };
  }
  return { ok: true, value: { title, summary } };
}

// Finds a plan AND checks the person may reach its patient. A plan that
// is missing, in another organization, or on a patient outside the
// person's reach all end the same way: audited, and null.
async function loadPlanInScope(actor: Actor, scope: PatientScope, planId: string) {
  const plan = await prisma.carePlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      organizationId: true,
      patientId: true,
      authorId: true,
      status: true,
    },
  });

  const inScope =
    plan !== null &&
    plan.organizationId === actor.organizationId &&
    (await scopeAllowsPatient(scope, plan.patientId));

  if (!plan || !inScope) {
    await auditDenied(actor, "care_plan", planId);
    return null;
  }
  return plan;
}

// ---------- Reading ----------

export interface GoalRow {
  id: string;
  description: string;
  status: string; // open | met
  metAt: Date | null;
}

export interface CarePlanRow {
  id: string;
  patientId: string;
  patientName: string;
  authorId: string;
  authorName: string;
  approvedByName: string | null;
  title: string;
  summary: string;
  status: string;
  approvedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  goals: GoalRow[];
  // What THIS viewer may do with this plan. The page uses them to decide
  // which controls to draw; every action re-checks everything on the
  // server regardless.
  canEditContent: boolean; // edit wording and add/remove goals (draft)
  canMarkGoals: boolean; // mark goals met (active)
  canApprove: boolean;
  canComplete: boolean;
  canDiscard: boolean;
}

export interface CarePlanLists {
  current: CarePlanRow[]; // drafts and active plans
  past: CarePlanRow[]; // completed and discarded
}

// Hard limits so a large organization never loads an unbounded list.
const CURRENT_LIMIT = 100;
const PAST_LIMIT = 50;

export async function listCarePlans(userId: string): Promise<CarePlanLists> {
  await requirePermission(userId, "care_plans.read");

  const scope = await getPatientScope(userId);
  const [canUpdate, canApprove] = await Promise.all([
    hasPermission(userId, "care_plans.update"),
    hasPermission(userId, "care_plans.approve"),
  ]);

  // Which patients this person is actually ON THE TEAM of, right now.
  const teamRows = await prisma.careTeamMember.findMany({
    where: {
      userId,
      ...activeAssignmentFilter(),
      patient: { organizationId: scope.organizationId },
    },
    select: { patientId: true },
  });
  const teamPatientIds = new Set(teamRows.map((m) => m.patientId));

  const scopeWhere =
    scope.kind === "organization"
      ? { organizationId: scope.organizationId }
      : {
          organizationId: scope.organizationId,
          patientId: { in: scope.patientIds },
        };

  const include = {
    patient: { select: { firstName: true, lastName: true } },
    author: { select: { name: true } },
    approvedBy: { select: { name: true } },
    goals: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  } satisfies Prisma.CarePlanInclude;

  const [current, past] = await Promise.all([
    prisma.carePlan.findMany({
      where: { ...scopeWhere, status: { in: ["draft", "active"] } },
      include,
      orderBy: { updatedAt: "desc" },
      take: CURRENT_LIMIT,
    }),
    prisma.carePlan.findMany({
      where: { ...scopeWhere, status: { in: ["completed", "archived"] } },
      include,
      orderBy: { updatedAt: "desc" },
      take: PAST_LIMIT,
    }),
  ]);

  const toRow = (p: (typeof current)[number]): CarePlanRow => {
    const onTeam = teamPatientIds.has(p.patientId);
    const writer = canUpdate && onTeam;
    return {
      id: p.id,
      patientId: p.patientId,
      patientName: `${p.patient.firstName} ${p.patient.lastName}`,
      authorId: p.authorId,
      authorName: p.author.name,
      approvedByName: p.approvedBy?.name ?? null,
      title: p.title,
      summary: p.summary,
      status: p.status,
      approvedAt: p.approvedAt,
      completedAt: p.completedAt,
      updatedAt: p.updatedAt,
      goals: p.goals.map((g) => ({
        id: g.id,
        description: g.description,
        status: g.status,
        metAt: g.metAt,
      })),
      canEditContent: writer && p.status === "draft",
      canMarkGoals: writer && p.status === "active",
      canApprove: canApprove && p.status === "draft" && p.authorId !== userId,
      canComplete: canApprove && p.status === "active",
      canDiscard: p.status === "draft" && (writer || canApprove),
    };
  };

  return { current: current.map(toRow), past: past.map(toRow) };
}

// ---------- Options for the "write a plan" form ----------

export interface PlanCreateOption {
  patientId: string;
  patientName: string;
}

// Which patients THIS person may start a new plan for: active patients
// they are on the care team of, that do not already have a draft.
// Returns null when the person cannot create plans at all, so the page
// can leave the form out. (The form being absent is convenience -
// createCarePlan is what enforces it.)
export async function getPlanCreateOptions(
  userId: string,
): Promise<PlanCreateOption[] | null> {
  if (!(await hasPermission(userId, "care_plans.create"))) return null;

  const actor = await loadActor(userId);

  const patients = await prisma.patient.findMany({
    where: {
      organizationId: actor.organizationId,
      status: "active",
      careTeam: { some: { userId, ...activeAssignmentFilter() } },
      carePlans: { none: { status: "draft" } },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return patients.map((p) => ({
    patientId: p.id,
    patientName: `${p.firstName} ${p.lastName}`,
  }));
}

// ---------- Writing ----------

export interface CreateCarePlanInput {
  patientId: string;
  title: string;
  summary: string;
}

export async function createCarePlan(
  userId: string,
  input: CreateCarePlanInput,
): Promise<Result<{ planId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "care_plans.create");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Relationship to the patient.
  if (!(await scopeAllowsPatient(scope, input.patientId))) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_PATIENT_ACCESS };
  }

  // 3. Team: writing content needs to be on THIS patient's team.
  if (!(await isActiveCareTeamMember(userId, input.patientId, actor.organizationId))) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NOT_ON_TEAM };
  }

  // 4. The details.
  const text = validateTitleAndSummary(input.title, input.summary);
  if (!text.ok) return text;

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: actor.organizationId },
    select: { status: true },
  });
  if (!patient || patient.status !== "active") {
    return {
      ok: false,
      error: "A care plan can only be started for an active patient.",
    };
  }

  const existingDraft = await prisma.carePlan.findFirst({
    where: { patientId: input.patientId, status: "draft" },
    select: { id: true },
  });
  if (existingDraft) {
    return {
      ok: false,
      error:
        "This patient already has a draft care plan. Finish or discard it first.",
    };
  }

  const plan = await prisma.carePlan.create({
    data: {
      organizationId: actor.organizationId,
      patientId: input.patientId,
      authorId: userId,
      title: text.value.title,
      summary: text.value.summary,
    },
    select: { id: true },
  });

  await auditAllowed(actor, "care_plan_created", "care_plan", plan.id);
  return { ok: true, value: { planId: plan.id } };
}

export async function updateCarePlan(
  userId: string,
  planId: string,
  input: { title: string; summary: string },
): Promise<Result<{ planId: string }>> {
  await requirePermission(userId, "care_plans.update");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const plan = await loadPlanInScope(actor, scope, planId);
  if (!plan) return { ok: false, error: NOT_FOUND };

  if (!(await isActiveCareTeamMember(userId, plan.patientId, actor.organizationId))) {
    await auditDenied(actor, "care_plan", plan.id);
    return { ok: false, error: NOT_ON_TEAM };
  }

  if (plan.status !== "draft") {
    return {
      ok: false,
      error: "Only a draft can be edited. An approved plan is locked.",
    };
  }

  const text = validateTitleAndSummary(input.title, input.summary);
  if (!text.ok) return text;

  const result = await prisma.carePlan.updateMany({
    where: { id: plan.id, status: "draft" },
    data: { title: text.value.title, summary: text.value.summary },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This plan was just changed by someone else. Refresh and try again.",
    };
  }

  await auditAllowed(actor, "care_plan_updated", "care_plan", plan.id);
  return { ok: true, value: { planId: plan.id } };
}

// ---------- Goals ----------

export async function addGoal(
  userId: string,
  planId: string,
  descriptionRaw: string,
): Promise<Result<{ goalId: string }>> {
  await requirePermission(userId, "care_plans.update");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const plan = await loadPlanInScope(actor, scope, planId);
  if (!plan) return { ok: false, error: NOT_FOUND };

  if (!(await isActiveCareTeamMember(userId, plan.patientId, actor.organizationId))) {
    await auditDenied(actor, "care_plan", plan.id);
    return { ok: false, error: NOT_ON_TEAM };
  }

  if (plan.status !== "draft") {
    return {
      ok: false,
      error: "Goals can only be added while the plan is a draft.",
    };
  }

  const description = cleanText(descriptionRaw);
  if (description.length === 0) {
    return { ok: false, error: "Write the goal." };
  }
  if (description.length > GOAL_MAX) {
    return { ok: false, error: `A goal can be at most ${GOAL_MAX} characters.` };
  }

  const existing = await prisma.carePlanGoal.aggregate({
    where: { carePlanId: plan.id },
    _count: { _all: true },
    _max: { position: true },
  });
  if (existing._count._all >= MAX_GOALS_PER_PLAN) {
    return {
      ok: false,
      error: `A plan can have at most ${MAX_GOALS_PER_PLAN} goals.`,
    };
  }

  const goal = await prisma.carePlanGoal.create({
    data: {
      carePlanId: plan.id,
      description,
      position: (existing._max.position ?? -1) + 1,
    },
    select: { id: true },
  });

  await auditAllowed(actor, "care_plan_goal_added", "care_plan", plan.id);
  return { ok: true, value: { goalId: goal.id } };
}

// A goal is reached through its plan, so a goal id gets exactly the same
// checks as the plan it belongs to.
async function loadGoalInScope(actor: Actor, scope: PatientScope, goalId: string) {
  const goal = await prisma.carePlanGoal.findUnique({
    where: { id: goalId },
    select: { id: true, carePlanId: true, status: true },
  });
  if (!goal) {
    await auditDenied(actor, "care_plan_goal", goalId);
    return null;
  }
  const plan = await loadPlanInScope(actor, scope, goal.carePlanId);
  if (!plan) return null;
  return { goal, plan };
}

export async function removeGoal(
  userId: string,
  goalId: string,
): Promise<Result<{ goalId: string }>> {
  await requirePermission(userId, "care_plans.update");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const found = await loadGoalInScope(actor, scope, goalId);
  if (!found) return { ok: false, error: NOT_FOUND };
  const { goal, plan } = found;

  if (!(await isActiveCareTeamMember(userId, plan.patientId, actor.organizationId))) {
    await auditDenied(actor, "care_plan", plan.id);
    return { ok: false, error: NOT_ON_TEAM };
  }

  if (plan.status !== "draft") {
    return {
      ok: false,
      error: "Goals can only be removed while the plan is a draft.",
    };
  }

  await prisma.carePlanGoal.delete({ where: { id: goal.id } });
  await auditAllowed(actor, "care_plan_goal_removed", "care_plan", plan.id);
  return { ok: true, value: { goalId: goal.id } };
}

export async function markGoalMet(
  userId: string,
  goalId: string,
): Promise<Result<{ goalId: string }>> {
  await requirePermission(userId, "care_plans.update");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const found = await loadGoalInScope(actor, scope, goalId);
  if (!found) return { ok: false, error: NOT_FOUND };
  const { goal, plan } = found;

  if (!(await isActiveCareTeamMember(userId, plan.patientId, actor.organizationId))) {
    await auditDenied(actor, "care_plan", plan.id);
    return { ok: false, error: NOT_ON_TEAM };
  }

  if (plan.status !== "active") {
    return {
      ok: false,
      error: "A goal can only be marked met while the plan is active.",
    };
  }

  // The expected status in the WHERE clause makes this safe if two
  // people click at the same moment: only one finds the goal still open.
  const result = await prisma.carePlanGoal.updateMany({
    where: { id: goal.id, status: "open" },
    data: { status: "met", metAt: new Date() },
  });
  if (result.count === 0) {
    return { ok: false, error: "That goal is already marked as met." };
  }

  await auditAllowed(actor, "care_plan_goal_met", "care_plan", plan.id);
  return { ok: true, value: { goalId: goal.id } };
}

// ---------- Changing a plan's status ----------

export async function changePlanStatus(
  userId: string,
  planId: string,
  action: string,
): Promise<Result<{ status: string }>> {
  // 1. Permission - a hard stop. Approving and completing need
  //    care_plans.approve. Discarding a draft is allowed to the care team
  //    (care_plans.update) or to an approver, so either permission opens
  //    the door; the exact rule is applied below once the plan is known.
  const canApprove = await hasPermission(userId, "care_plans.approve");
  const canUpdate = await hasPermission(userId, "care_plans.update");
  if (action === "discard") {
    if (!canApprove && !canUpdate) {
      await requirePermission(userId, "care_plans.update"); // throws + audits
    }
  } else {
    await requirePermission(userId, "care_plans.approve"); // throws + audits
  }

  if (!isPlanAction(action)) {
    return { ok: false, error: "That action is not recognised." };
  }

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Relationship. Missing and off-limits give the same answer.
  const plan = await loadPlanInScope(actor, scope, planId);
  if (!plan) return { ok: false, error: NOT_FOUND };

  // 3. Who may discard: the care team, or an approver.
  if (action === "discard") {
    const onTeam = await isActiveCareTeamMember(
      userId,
      plan.patientId,
      actor.organizationId,
    );
    if (!(canApprove || (canUpdate && onTeam))) {
      await auditDenied(actor, "care_plan", plan.id);
      return { ok: false, error: NOT_ON_TEAM };
    }
  }

  // 4. The status machine.
  const transition = PLAN_TRANSITIONS[action];
  if (plan.status !== transition.from) {
    return {
      ok: false,
      error: `This plan is already ${plan.status}, so it cannot be changed that way.`,
    };
  }

  // 5. Rules only approving has.
  if (action === "approve") {
    // Four eyes: the person who wrote a plan cannot be the one who
    // approves it. The attempt goes on the record.
    if (plan.authorId === userId) {
      await auditDenied(actor, "care_plan", plan.id);
      return {
        ok: false,
        error: "You cannot approve a plan you wrote. Another approver must review it.",
      };
    }

    const goalCount = await prisma.carePlanGoal.count({
      where: { carePlanId: plan.id },
    });
    if (goalCount === 0) {
      return { ok: false, error: "Add at least one goal before approving." };
    }

    const alreadyActive = await prisma.carePlan.findFirst({
      where: { patientId: plan.patientId, status: "active" },
      select: { id: true },
    });
    if (alreadyActive) {
      return {
        ok: false,
        error:
          "This patient already has an active care plan. Complete it before approving a new one.",
      };
    }
  }

  const now = new Date();
  const result = await prisma.carePlan.updateMany({
    where: { id: plan.id, status: transition.from },
    data: {
      status: transition.to,
      ...(action === "approve" ? { approvedById: userId, approvedAt: now } : {}),
      ...(action === "complete" ? { completedAt: now } : {}),
    },
  });
  if (result.count === 0) {
    return {
      ok: false,
      error: "This plan was just changed by someone else. Refresh and try again.",
    };
  }

  await auditAllowed(actor, transition.auditAction, "care_plan", plan.id);
  return { ok: true, value: { status: transition.to } };
}
