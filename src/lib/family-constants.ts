// src/lib/family-constants.ts
//
// The fixed vocabulary for family access, in one place. Pure data and pure
// functions: no database, no "server-only". The consent form (a Client
// Component) and the server-side rules in src/lib/family-consents.ts read
// the SAME lists. If they ever disagreed, the server's answer would win:
// the browser is never trusted.

// WHAT A PATIENT CAN CHOOSE TO SHARE. Three separate things, each chosen on
// its own. Nothing is shared unless it is named here AND ticked on the
// consent. Visit notes, tasks, documents, referrals and messages are not on
// this list on purpose: each of those would need its own design first.
export const CONSENT_SCOPES = [
  {
    key: "visits",
    label: "Visit schedule",
    help: "Dates, times and the name of the person coming, for upcoming and recent visits.",
  },
  {
    key: "care_team",
    label: "Care team",
    help: "The names and jobs of the people looking after the patient.",
  },
  {
    key: "care_plan",
    label: "Care plan",
    help: "The approved care plan and its goals.",
  },
] as const;

export type ConsentScopeKey = (typeof CONSENT_SCOPES)[number]["key"];

export function isConsentScope(value: string): value is ConsentScopeKey {
  return CONSENT_SCOPES.some((s) => s.key === value);
}

export function consentScopeLabel(key: string): string {
  return CONSENT_SCOPES.find((s) => s.key === key)?.label ?? key;
}

// Turns whatever list a form sent into a clean list of known scopes, in
// the fixed order above, with no repeats. Returns null when anything in it
// is unknown or the list is empty, so a made-up scope is refused rather
// than quietly dropped.
export function cleanScopes(raw: readonly string[]): ConsentScopeKey[] | null {
  if (raw.length === 0) return null;
  if (!raw.every((s) => isConsentScope(s))) return null;
  const set = new Set(raw);
  return CONSENT_SCOPES.filter((s) => set.has(s.key)).map((s) => s.key);
}

// How the family member is related. A label for the people reading the
// screen. It grants nothing by itself: only the ticked scopes do.
export const FAMILY_RELATIONSHIPS = [
  { key: "spouse_partner", label: "Spouse or partner" },
  { key: "adult_child", label: "Son or daughter" },
  { key: "sibling", label: "Brother or sister" },
  { key: "other_relative", label: "Other relative" },
  { key: "friend", label: "Friend" },
  { key: "legal_representative", label: "Legal representative" },
] as const;

export type FamilyRelationshipKey = (typeof FAMILY_RELATIONSHIPS)[number]["key"];

export function isFamilyRelationship(value: string): value is FamilyRelationshipKey {
  return FAMILY_RELATIONSHIPS.some((r) => r.key === value);
}

export function relationshipLabel(key: string): string {
  return FAMILY_RELATIONSHIPS.find((r) => r.key === key)?.label ?? "Family member";
}

// How long a consent lasts. The keys are what a form sends; the server
// maps them to a real end time and refuses anything else. A consent
// always has an end unless the patient chooses to leave it open.
export const CONSENT_DURATIONS = [
  { key: "90_days", label: "90 days", days: 90 },
  { key: "1_year", label: "1 year", days: 365 },
  { key: "until_revoked", label: "Until the patient withdraws it", days: null },
] as const;

export type ConsentDurationKey = (typeof CONSENT_DURATIONS)[number]["key"];

export function isConsentDuration(value: string): value is ConsentDurationKey {
  return CONSENT_DURATIONS.some((d) => d.key === value);
}

// The end time for a consent that starts at `now`, or null for "no end".
export function consentExpiry(key: ConsentDurationKey, now: Date): Date | null {
  const found = CONSENT_DURATIONS.find((d) => d.key === key);
  if (!found || found.days === null) return null;
  return new Date(now.getTime() + found.days * 24 * 60 * 60 * 1000);
}

// A patient can have at most this many consents in force at once. It keeps
// a patient's list of people who can look at their care short enough to
// read and to review.
export const MAX_CONSENTS_PER_PATIENT = 10;

// The role key of the accounts a consent can be made for.
export const FAMILY_ROLE_KEY = "AUTHORIZED_FAMILY";
