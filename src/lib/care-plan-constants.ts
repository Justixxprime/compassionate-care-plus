// src/lib/care-plan-constants.ts
//
// The fixed vocabulary for care plans, in one place. Pure data - no
// database, no "server-only" - so the forms (Client Components) and the
// server-side rules in src/lib/care-plans.ts read the SAME numbers. If
// they ever disagreed, the server's answer would win: the browser is
// never trusted.

export const PLAN_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Discarded",
};

// The actions someone can take on a plan, and what each one does. Like
// VISIT_TRANSITIONS, this table IS the state machine: an action that is
// not listed for a plan's current status cannot happen, no matter who
// asks.
//
//   draft  -> approve -> active      (needs care_plans.approve, and the
//                                     approver must NOT be the author)
//   active -> complete -> completed  (needs care_plans.approve)
//   draft  -> discard -> archived    (the care team, or an approver)
//
// completed and archived are final. A finished plan is never reopened;
// if the situation changed, a new draft is written.
export type PlanAction = "approve" | "complete" | "discard";

export const PLAN_TRANSITIONS: Record<
  PlanAction,
  { from: PlanStatus; to: PlanStatus; auditAction: string; label: string }
> = {
  approve: {
    from: "draft",
    to: "active",
    auditAction: "care_plan_approved",
    label: "Approve plan",
  },
  complete: {
    from: "active",
    to: "completed",
    auditAction: "care_plan_completed",
    label: "Complete plan",
  },
  discard: {
    from: "draft",
    to: "archived",
    auditAction: "care_plan_discarded",
    label: "Discard draft",
  },
};

export function isPlanAction(value: string): value is PlanAction {
  return Object.prototype.hasOwnProperty.call(PLAN_TRANSITIONS, value);
}

// Size limits. They keep the database sensible and the screen readable,
// and they stop someone pasting a whole document into a title.
export const TITLE_MAX = 120;
export const SUMMARY_MAX = 2000;
export const GOAL_MAX = 300;
export const MAX_GOALS_PER_PLAN = 15;
