// src/lib/referral-constants.ts
//
// The fixed vocabulary for referrals, in one place. Pure data - no
// database, no "server-only" - so the forms (Client Components) and the
// server-side rules in src/lib/referrals.ts read the SAME numbers. If
// they ever disagreed, the server's answer would win: the browser is
// never trusted.
//
// The kinds of care a referral can ask for are the same six kinds a
// visit can be (see visit-constants.ts). That is on purpose: a referral
// says "this person needs skilled nursing", and a visit is how that
// happens. One list means the two can never drift apart.

export const REFERRAL_SOURCES = [
  { key: "hospital", label: "Hospital or discharge planner" },
  { key: "physician_office", label: "Physician's office" },
  { key: "family", label: "Family member" },
  { key: "self", label: "The person themselves" },
  { key: "other", label: "Someone else" },
] as const;

export type ReferralSourceKey = (typeof REFERRAL_SOURCES)[number]["key"];

export function isReferralSource(value: string): value is ReferralSourceKey {
  return REFERRAL_SOURCES.some((s) => s.key === value);
}

export function referralSourceLabel(key: string): string {
  return REFERRAL_SOURCES.find((s) => s.key === key)?.label ?? key;
}

export const REFERRAL_URGENCIES = [
  { key: "routine", label: "Routine" },
  { key: "urgent", label: "Urgent" },
] as const;

export type ReferralUrgency = (typeof REFERRAL_URGENCIES)[number]["key"];

export function isReferralUrgency(value: string): value is ReferralUrgency {
  return REFERRAL_URGENCIES.some((u) => u.key === value);
}

export const REFERRAL_STATUSES = [
  "received",
  "in_review",
  "accepted",
  "declined",
  "withdrawn",
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  received: "Received",
  in_review: "In review",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

// A referral that is still being worked on. Everything else is final.
export const OPEN_REFERRAL_STATUSES: readonly ReferralStatus[] = [
  "received",
  "in_review",
];

export function isOpenReferralStatus(status: string): boolean {
  return OPEN_REFERRAL_STATUSES.some((s) => s === status);
}

// The actions someone can take on a referral. Like VISIT_TRANSITIONS and
// PLAN_TRANSITIONS, this table IS the state machine: an action that is
// not listed for a referral's current status cannot happen, no matter
// who asks.
//
//   received  -> start_review -> in_review
//   in_review -> accept       -> accepted    (links or creates the patient)
//   received or in_review -> decline   -> declined   (a written reason is required)
//   received or in_review -> withdraw  -> withdrawn  (a written reason is required)
//
// accepted, declined and withdrawn are final. A finished referral is
// never reopened; if the situation changes, a new referral is recorded.
export type ReferralAction =
  | "start_review"
  | "accept"
  | "decline"
  | "withdraw";

export const REFERRAL_TRANSITIONS: Record<
  ReferralAction,
  {
    from: readonly ReferralStatus[];
    to: ReferralStatus;
    auditAction: string;
    label: string;
    needsNote: boolean;
  }
> = {
  start_review: {
    from: ["received"],
    to: "in_review",
    auditAction: "referral_review_started",
    label: "Start review",
    needsNote: false,
  },
  accept: {
    from: ["in_review"],
    to: "accepted",
    auditAction: "referral_accepted",
    label: "Accept",
    needsNote: false,
  },
  decline: {
    from: ["received", "in_review"],
    to: "declined",
    auditAction: "referral_declined",
    label: "Decline",
    needsNote: true,
  },
  withdraw: {
    from: ["received", "in_review"],
    to: "withdrawn",
    auditAction: "referral_withdrawn",
    label: "Mark withdrawn",
    needsNote: true,
  },
};

export function isReferralAction(value: string): value is ReferralAction {
  return Object.prototype.hasOwnProperty.call(REFERRAL_TRANSITIONS, value);
}

// The actions that make sense for a referral in this status, in the
// order the buttons should appear.
export function referralActionsFor(status: string): ReferralAction[] {
  return (Object.keys(REFERRAL_TRANSITIONS) as ReferralAction[]).filter((a) =>
    REFERRAL_TRANSITIONS[a].from.some((s) => s === status),
  );
}

// Limits. Generous enough for real use, small enough to stop nonsense.
export const REFERRAL_NAME_MAX = 80;
export const REFERRAL_SOURCE_ORG_MAX = 120;
export const REFERRAL_CONTACT_NAME_MAX = 80;
export const REFERRAL_PHONE_MAX = 30;
export const REFERRAL_REASON_MAX = 1000;
export const REFERRAL_NOTE_MAX = 1000;

// Nobody in this system was born before this year. It catches typos
// like 0194 or 1094 without ruling out any living person.
export const REFERRAL_EARLIEST_BIRTH_YEAR = 1900;
