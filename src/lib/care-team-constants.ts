// src/lib/care-team-constants.ts
//
// The fixed vocabulary for care teams, in one place. Pure data - no
// database, no "server-only" - so a screen (a Client Component, later) and
// the server-side rules in src/lib/care-team.ts read the SAME list. If a
// screen and the server ever disagreed, the server's list would win: the
// browser is never trusted.
//
// A care team is the short list of staff looking after ONE patient. Being
// on it is what lets a nurse see that patient at all (src/lib/patients.ts),
// so who may be put on a team is an access decision, not just bookkeeping.

// Which kind of staff account may hold which place on a team. The check is
// against the roles the person REALLY has in the database, never against
// what a form says. A caregiver cannot be made a primary nurse, and an
// administrator cannot be put on a team as a nurse by accident.
export const CARE_TEAM_ROLES = [
  {
    key: "primary_nurse",
    label: "Primary nurse",
    eligibleRoleKeys: ["NURSE"],
    // At most one person at a time can hold this place for a patient.
    onePerPatient: true,
  },
  {
    key: "nurse",
    label: "Nurse",
    eligibleRoleKeys: ["NURSE"],
    onePerPatient: false,
  },
  {
    key: "caregiver",
    label: "Caregiver",
    eligibleRoleKeys: ["CAREGIVER"],
    onePerPatient: false,
  },
] as const;

export type CareTeamRoleKey = (typeof CARE_TEAM_ROLES)[number]["key"];

export function isCareTeamRole(value: string): value is CareTeamRoleKey {
  return CARE_TEAM_ROLES.some((r) => r.key === value);
}

export function careTeamRoleLabel(key: string): string {
  return CARE_TEAM_ROLES.find((r) => r.key === key)?.label ?? key.replace(/_/g, " ");
}

// Every role key that may be put on a care team at all.
export const ASSIGNABLE_STAFF_ROLE_KEYS: readonly string[] = Array.from(
  new Set(CARE_TEAM_ROLES.flatMap((r) => r.eligibleRoleKeys)),
);

// Can a person who holds these real roles fill this place on a team?
export function staffMayFill(
  staffRoleKeys: readonly string[],
  place: CareTeamRoleKey,
): boolean {
  const def = CARE_TEAM_ROLES.find((r) => r.key === place);
  if (!def) return false;
  return def.eligibleRoleKeys.some((k) => staffRoleKeys.includes(k));
}
