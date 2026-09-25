// src/lib/care-request-constants.ts
//
// The fixed vocabulary for the public "Request care" form, in one place.
// Pure data and pure functions - no database, no "server-only" - so the
// form (a Client Component, in the (public) group) and the server-side
// rules in src/lib/care-requests.ts read the SAME lists. If they ever
// disagreed, the server's answer would win: the browser is never
// trusted, and this form is reachable by anyone on the internet, signed
// in or not.

export const RELATIONSHIP_OPTIONS = [
  "Myself",
  "Family member",
  "Friend or caregiver",
  "Healthcare professional / referral",
  "Other",
] as const;

export const CONTACT_TIME_OPTIONS = ["Morning", "Afternoon", "Evening", "Anytime"] as const;

export const PREFERRED_CONTACT_OPTIONS = ["Phone", "Email"] as const;
export type PreferredContact = (typeof PREFERRED_CONTACT_OPTIONS)[number];

export function isPreferredContact(value: string): value is PreferredContact {
  return (PREFERRED_CONTACT_OPTIONS as readonly string[]).includes(value);
}

export const CARE_REQUEST_STATUSES = ["new", "contacted", "closed"] as const;
export type CareRequestStatus = (typeof CARE_REQUEST_STATUSES)[number];

export const CARE_REQUEST_STATUS_LABELS: Record<CareRequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
};

// contact:  someone on staff has reached out. Needs care_requests.manage.
// close:    the request is done with (reached, or turned out not to be a
//           real inquiry). Needs care_requests.manage.
// Both are one-way. "closed" is final; "contacted" can still be closed.
export type CareRequestAction = "contact" | "close";

export const CARE_REQUEST_TRANSITIONS: Record<
  CareRequestAction,
  { to: CareRequestStatus; auditAction: string; label: string }
> = {
  contact: { to: "contacted", auditAction: "care_request_contacted", label: "Mark contacted" },
  close: { to: "closed", auditAction: "care_request_closed", label: "Close" },
};

export function isCareRequestAction(value: string): value is CareRequestAction {
  return Object.prototype.hasOwnProperty.call(CARE_REQUEST_TRANSITIONS, value);
}

// Generous limits: this is free text from a stranger on the internet.
// Long enough for a real message, short enough that nobody can use the
// field to store something enormous for free.
export const NAME_MAX = 120;
export const CONTACT_MAX = 120; // email or phone, either one
export const MESSAGE_MAX = 1500;

// A plain e-mail shape check, the same one src/lib/account-constants.ts
// uses - not copied here twice, just re-exported so this file has a
// complete, self-describing vocabulary of its own.
export { isPlausibleEmail, normalizeEmail } from "@/lib/account-constants";

// The office address a submitted request is meant to reach, until a
// real e-mail service exists (docs/CARE_REQUESTS.md explains why one
// isn't wired up yet). Overridable per environment so this is never
// hard-coded in more than one place; the fallback is the address the
// owner asked to use for now.
const DEFAULT_NOTIFY_EMAIL = "justixxchiobi@gmail.com";

export function careRequestNotifyEmail(): string {
  const configured = process.env.CARE_REQUEST_NOTIFY_EMAIL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_NOTIFY_EMAIL;
}
