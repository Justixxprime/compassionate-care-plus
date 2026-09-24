// src/lib/tasks.ts
//
// Everything about who may see, create and close a task lives in this
// one file. Pages and server actions call these functions; none of them
// query the tasks table or decide access on their own.
//
// Three questions, in this order:
//
//   1. PERMISSION   tasks.read to see and finish tasks, tasks.manage to
//                   create and cancel them (requirePermission, a hard
//                   stop that writes the permission_denied entry).
//   2. RELATIONSHIP a task that is about a patient is only visible to
//                   someone who can still reach that patient
//                   (getPatientScope). Come off a patient's care team
//                   and that patient's tasks disappear from your list.
//   3. OWNERSHIP    administrative roles see every task in their
//                   organization. Everyone else sees only tasks
//                   assigned to them or created by them.
//
// Creating: an administrative role may give a task to any active person
// in the organization who holds tasks.read; everyone else may only give
// tasks to themselves. A task about a patient may only be given to
// someone who can reach that patient, so a task can never quietly hand
// a patient's name to a person who has no business with it.
//
// Closing: open -> done (the assignee, or an administrative role) and
// open -> cancelled (the creator, or an administrative role). Both are
// final. The audit log records what happened, never the title or details.

import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor, type Actor } from "@/lib/auth/actor";
import { getPatientScope, scopeAllowsPatient, type PatientScope } from "@/lib/patients";
import type { Result } from "@/lib/visits";
import { parseCalendarDate } from "@/lib/time";
import { notifyUser } from "@/lib/notifications";
import {
  TASK_DETAILS_MAX,
  TASK_TITLE_MAX,
  TASK_TRANSITIONS,
  isTaskAction,
} from "@/lib/task-constants";

const NOT_FOUND = "That task could not be found.";
const NO_PATIENT = "That patient could not be found.";
const NO_PERSON = "That person could not be found.";

// Which tasks this scope may see, as a database filter.
function visibleWhere(userId: string, scope: PatientScope) {
  if (scope.kind === "organization") return { organizationId: scope.organizationId };
  return {
    organizationId: scope.organizationId,
    AND: [
      { OR: [{ assigneeId: userId }, { createdById: userId }] },
      { OR: [{ patientId: null }, { patientId: { in: scope.patientIds } }] },
    ],
  };
}

// ---------- Reading ----------

export interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  patientId: string | null;
  patientName: string | null;
  assigneeId: string;
  assigneeName: string;
  createdByName: string;
  dueDate: Date | null;
  status: string;
  overdue: boolean;
  completedAt: Date | null;
  // What THIS viewer may do. The page draws buttons from these; every
  // action re-checks everything on the server regardless.
  canComplete: boolean;
  canCancel: boolean;
}

export interface TaskLists {
  open: TaskRow[];
  closed: TaskRow[];
  canManage: boolean;
}

const LIST_LIMIT = 200;

export async function listTasks(userId: string): Promise<TaskLists> {
  await requirePermission(userId, "tasks.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const canManage = await hasPermission(userId, "tasks.manage");
  const isOrgWide = scope.kind === "organization";

  const rows = await prisma.task.findMany({
    where: visibleWhere(userId, scope),
    include: {
      patient: { select: { firstName: true, lastName: true } },
      assignee: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: LIST_LIMIT,
  });

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const mapped: TaskRow[] = rows.map((t) => {
    const open = t.status === "open";
    return {
      id: t.id,
      title: t.title,
      details: t.details,
      patientId: t.patientId,
      patientName: t.patient ? `${t.patient.firstName} ${t.patient.lastName}` : null,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee.name,
      createdByName: t.createdBy.name,
      dueDate: t.dueDate,
      status: t.status,
      overdue: open && t.dueDate !== null && t.dueDate < todayStart,
      completedAt: t.completedAt,
      canComplete: open && (t.assigneeId === actor.id || isOrgWide),
      canCancel: open && canManage && (t.createdById === actor.id || isOrgWide),
    };
  });

  return {
    open: mapped.filter((t) => t.status === "open"),
    closed: mapped.filter((t) => t.status !== "open").slice(0, 50),
    canManage,
  };
}

export interface TaskCreateOptions {
  patients: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
  canAssignToOthers: boolean;
}

// What the create form may offer THIS person. Built on the server so the
// browser never receives a patient or a colleague it may not use.
export async function getTaskCreateOptions(userId: string): Promise<TaskCreateOptions> {
  await requirePermission(userId, "tasks.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const orgWide = scope.kind === "organization";

  const patients = await prisma.patient.findMany({
    where:
      scope.kind === "organization"
        ? { organizationId: scope.organizationId, status: "active" }
        : { organizationId: scope.organizationId, status: "active", id: { in: scope.patientIds } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const assignees = orgWide
    ? await prisma.user.findMany({
        where: {
          organizationId: actor.organizationId,
          userRoles: { some: { role: { rolePermissions: { some: { permission: { key: "tasks.read" } } } } } },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : await prisma.user.findMany({
        where: { id: actor.id },
        select: { id: true, name: true },
      });

  return {
    patients: patients.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })),
    assignees,
    canAssignToOthers: orgWide,
  };
}

// ---------- Creating ----------

export interface CreateTaskInput {
  title: string;
  details: string;
  assigneeId: string;
  patientId: string; // "" for a task about nobody in particular
  dueDate: string; // "" for no due date, otherwise YYYY-MM-DD
}

export async function createTask(
  userId: string,
  input: CreateTaskInput,
): Promise<Result<{ id: string }>> {
  // 1. Permission - a hard stop.
  await requirePermission(userId, "tasks.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const title = input.title.replace(/\u0000/g, "").trim();
  const details = input.details.replace(/\u0000/g, "").trim();
  if (title.length === 0) return { ok: false, error: "Give the task a short title." };
  if (title.length > TASK_TITLE_MAX) {
    return { ok: false, error: `The title can be at most ${TASK_TITLE_MAX} characters.` };
  }
  if (details.length > TASK_DETAILS_MAX) {
    return { ok: false, error: `The details can be at most ${TASK_DETAILS_MAX} characters.` };
  }

  let dueDate: Date | null = null;
  if (input.dueDate.trim() !== "") {
    dueDate = parseCalendarDate(input.dueDate);
    if (!dueDate) return { ok: false, error: "That due date is not a real date." };
  }

  // 2. Who it goes to. Non-administrative roles may only assign to
  //    themselves. The assignee must be a real person in this
  //    organization who can hold tasks at all.
  if (input.assigneeId !== actor.id && scope.kind !== "organization") {
    await auditDenied(actor, "task");
    return { ok: false, error: "You can only create tasks for yourself." };
  }
  const assignee = await prisma.user.findFirst({
    where: {
      id: input.assigneeId,
      organizationId: actor.organizationId,
      userRoles: { some: { role: { rolePermissions: { some: { permission: { key: "tasks.read" } } } } } },
    },
    select: { id: true },
  });
  if (!assignee) {
    await auditDenied(actor, "task");
    return { ok: false, error: NO_PERSON };
  }

  // 3. The patient, if any: the creator must reach them, AND so must the
  //    person the task goes to.
  let patientId: string | null = null;
  if (input.patientId !== "") {
    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, organizationId: actor.organizationId, status: "active" },
      select: { id: true },
    });
    const creatorReaches = patient !== null && (await scopeAllowsPatient(scope, patient.id));
    if (!patient || !creatorReaches) {
      await auditDenied(actor, "patient", input.patientId);
      return { ok: false, error: NO_PATIENT };
    }
    if (assignee.id !== actor.id) {
      const assigneeScope = await getPatientScope(assignee.id);
      if (!(await scopeAllowsPatient(assigneeScope, patient.id))) {
        return { ok: false, error: "That person is not on this patient's care team." };
      }
    }
    patientId = patient.id;
  }

  const task = await prisma.task.create({
    data: {
      organizationId: actor.organizationId,
      patientId,
      assigneeId: assignee.id,
      createdById: actor.id,
      title,
      details: details === "" ? null : details,
      dueDate,
    },
    select: { id: true },
  });

  await auditAllowed(actor, "task_created", "task", task.id);

  // A task given to somebody else tells them so. A task you give yourself
  // needs no notice. The notice holds no title and no patient (see
  // src/lib/notification-constants.ts).
  if (assignee.id !== actor.id) {
    await notifyUser({
      organizationId: actor.organizationId,
      userId: assignee.id,
      kind: "task_assigned",
      resourceType: "task",
      resourceId: task.id,
    });
  }
  return { ok: true, value: { id: task.id } };
}

// ---------- Closing ----------

async function loadTaskInReach(actor: Actor, scope: PatientScope, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...visibleWhere(actor.id, scope) },
    select: { id: true, assigneeId: true, createdById: true, status: true },
  });
  if (!task) {
    await auditDenied(actor, "task", taskId);
    return null;
  }
  return task;
}

export async function changeTaskStatus(
  userId: string,
  taskId: string,
  action: string,
): Promise<Result<{ status: string }>> {
  if (!isTaskAction(action)) return { ok: false, error: "That action is not recognised." };

  // 1. Permission - finishing needs tasks.read, cancelling tasks.manage.
  await requirePermission(userId, action === "complete" ? "tasks.read" : "tasks.manage");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  // 2. Reach: a task outside this person's view looks like no task.
  const task = await loadTaskInReach(actor, scope, taskId);
  if (!task) return { ok: false, error: NOT_FOUND };

  // 3. Ownership.
  const orgWide = scope.kind === "organization";
  if (action === "complete" && !(task.assigneeId === actor.id || orgWide)) {
    await auditDenied(actor, "task", task.id);
    return { ok: false, error: "Only the person responsible can finish this task." };
  }
  if (action === "cancel" && !(task.createdById === actor.id || orgWide)) {
    await auditDenied(actor, "task", task.id);
    return { ok: false, error: "Only the person who created this task can cancel it." };
  }

  // 4. The status machine, guarded again in the write itself.
  const transition = TASK_TRANSITIONS[action];
  if (task.status !== transition.from) {
    return { ok: false, error: `This task is already ${task.status}, so it cannot be changed.` };
  }
  const result = await prisma.task.updateMany({
    where: { id: task.id, status: transition.from },
    data: {
      status: transition.to,
      ...(action === "complete" ? { completedById: actor.id, completedAt: new Date() } : {}),
    },
  });
  if (result.count === 0) {
    return { ok: false, error: "This task was just changed by someone else. Refresh and try again." };
  }

  await auditAllowed(actor, transition.auditAction, "task", task.id);

  // Tell the other person, never yourself: the one who asked hears that it
  // was finished; the one responsible hears that it was cancelled.
  if (action === "complete" && task.createdById !== actor.id) {
    await notifyUser({
      organizationId: actor.organizationId,
      userId: task.createdById,
      kind: "task_completed",
      resourceType: "task",
      resourceId: task.id,
    });
  }
  if (action === "cancel" && task.assigneeId !== actor.id) {
    await notifyUser({
      organizationId: actor.organizationId,
      userId: task.assigneeId,
      kind: "task_cancelled",
      resourceType: "task",
      resourceId: task.id,
    });
  }
  return { ok: true, value: { status: transition.to } };
}
