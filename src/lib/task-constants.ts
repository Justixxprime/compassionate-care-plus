// src/lib/task-constants.ts
//
// The fixed vocabulary for tasks, in one place. Pure data - no database,
// no "server-only" - so the task form (a Client Component) and the
// server-side rules in src/lib/tasks.ts read the SAME numbers. If they
// ever disagreed, the server's answer would win: the browser is never
// trusted.

export const TASK_STATUSES = ["open", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  done: "Done",
  cancelled: "Cancelled",
};

// complete: the person responsible (or an administrative role) says it is
//           finished. Needs tasks.read.
// cancel:   the person who asked for it (or an administrative role) says
//           it is no longer needed. Needs tasks.manage.
// Both only work on an open task, and both are final.
export type TaskAction = "complete" | "cancel";

export const TASK_TRANSITIONS: Record<
  TaskAction,
  { from: TaskStatus; to: TaskStatus; auditAction: string; label: string }
> = {
  complete: { from: "open", to: "done", auditAction: "task_completed", label: "Mark done" },
  cancel: { from: "open", to: "cancelled", auditAction: "task_cancelled", label: "Cancel" },
};

export function isTaskAction(value: string): value is TaskAction {
  return Object.prototype.hasOwnProperty.call(TASK_TRANSITIONS, value);
}

export const TASK_TITLE_MAX = 120;
export const TASK_DETAILS_MAX = 1000;
