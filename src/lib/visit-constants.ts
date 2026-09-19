// src/lib/visit-constants.ts
//
// The fixed vocabulary for visits, in one place. Pure data - no database,
// no "server-only" - so the scheduling form (a Client Component) and the
// server-side rules in src/lib/visits.ts both read the SAME list. If the
// form and the server ever disagreed about what a valid visit type is,
// the server's list would win, since the browser is never trusted.
//
// These visit types deliberately are NOT read from services-data.ts. That
// file is public marketing copy; a visit type is clinical scheduling data.
// Coupling the two would mean a wording change on the website could
// quietly change what the database accepts.

export const VISIT_TYPES = [
  { key: "skilled_nursing", label: "Skilled nursing" },
  { key: "physical_therapy", label: "Physical therapy" },
  { key: "occupational_therapy", label: "Occupational therapy" },
  { key: "speech_therapy", label: "Speech therapy" },
  { key: "medical_social_services", label: "Medical social services" },
  { key: "home_health_aide", label: "Home health aide" },
] as const;

export type VisitTypeKey = (typeof VISIT_TYPES)[number]["key"];

export function isVisitType(value: string): value is VisitTypeKey {
  return VISIT_TYPES.some((t) => t.key === value);
}

export function visitTypeLabel(key: string): string {
  return VISIT_TYPES.find((t) => t.key === key)?.label ?? key;
}

// How long a visit is scheduled for, in minutes. A short fixed list keeps
// the form simple and rules out nonsense like a 9,000 minute visit.
export const VISIT_DURATIONS_MINUTES = [30, 45, 60, 90, 120] as const;

export function isVisitDuration(value: number): boolean {
  return (VISIT_DURATIONS_MINUTES as readonly number[]).includes(value);
}

export const VISIT_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "missed",
] as const;

export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  missed: "Missed",
};

// The actions someone can take on a visit, and what each one does. This
// table IS the state machine: an action that is not listed for a visit's
// current status simply cannot happen, no matter who asks.
//
//   scheduled   -> check_in  -> in_progress
//   scheduled   -> cancel    -> cancelled
//   scheduled   -> mark_missed -> missed
//   in_progress -> check_out -> completed
//
// completed, cancelled and missed are final. A finished visit is never
// quietly reopened or rewritten - if one was recorded wrong, that is a
// correction with its own audit trail, not a status flip.
export type VisitAction = "check_in" | "check_out" | "cancel" | "mark_missed";

export const VISIT_TRANSITIONS: Record<
  VisitAction,
  { from: VisitStatus; to: VisitStatus; auditAction: string; label: string }
> = {
  check_in: {
    from: "scheduled",
    to: "in_progress",
    auditAction: "visit_checked_in",
    label: "Check in",
  },
  check_out: {
    from: "in_progress",
    to: "completed",
    auditAction: "visit_checked_out",
    label: "Check out",
  },
  cancel: {
    from: "scheduled",
    to: "cancelled",
    auditAction: "visit_cancelled",
    label: "Cancel visit",
  },
  mark_missed: {
    from: "scheduled",
    to: "missed",
    auditAction: "visit_marked_missed",
    label: "Mark missed",
  },
};

export function isVisitAction(value: string): value is VisitAction {
  return Object.prototype.hasOwnProperty.call(VISIT_TRANSITIONS, value);
}

// Which actions make sense to OFFER for a visit in a given status. Used by
// the UI to decide which buttons to draw. The server re-checks every
// action regardless - offering a button is convenience, not permission.
export function actionsAvailableFor(status: string): VisitAction[] {
  return (Object.keys(VISIT_TRANSITIONS) as VisitAction[]).filter(
    (action) => VISIT_TRANSITIONS[action].from === status,
  );
}

// Guard rails on when a visit can be scheduled. Loose on purpose (the
// office may need to log a visit that happened earlier today), but tight
// enough to catch a typo like the wrong year.
export const MAX_DAYS_IN_PAST = 1;
export const MAX_DAYS_AHEAD = 365;
