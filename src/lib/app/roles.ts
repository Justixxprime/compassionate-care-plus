// src/lib/app/roles.ts
//
// Plain words about roles for the screens. Pure data: no database, no
// "server-only". Nothing here grants anything. What a person may DO comes
// only from the permissions and reach the services check, never from this
// file. It only chooses which sentence to show.

// Most senior first. A person with two roles is described by the first one
// in this list that they hold.
const ROLE_PRIORITY = [
  "SUPER_ADMIN",
  "ADMIN",
  "CLINICAL_SUPERVISOR",
  "CARE_COORDINATOR",
  "NURSE",
  "CAREGIVER",
  "PATIENT",
  "AUTHORIZED_FAMILY",
  "REFERRAL_PARTNER",
] as const;

export function primaryRoleKey(roleKeys: readonly string[]): string | null {
  return ROLE_PRIORITY.find((key) => roleKeys.includes(key)) ?? null;
}

// One sentence under the greeting: what this person's dashboard is for.
const ROLE_INTRO: Record<string, string> = {
  SUPER_ADMIN:
    "The whole organization at a glance: referrals waiting, patients who need a nurse, and plans to approve.",
  ADMIN:
    "The whole organization at a glance: referrals waiting, patients who need a nurse, and plans to approve.",
  CLINICAL_SUPERVISOR:
    "Care plans waiting for your approval, patients without a primary nurse, and how today's visits are going.",
  CARE_COORDINATOR:
    "Referrals to answer, patients who need a nurse, and today's schedule.",
  NURSE: "Your visits today and the patients you look after.",
};

const DEFAULT_INTRO =
  "Your account is set up. The screens for your role are still being built, so there is nothing to open here yet.";

export function roleIntro(roleKeys: readonly string[]): string {
  const key = primaryRoleKey(roleKeys);
  return (key && ROLE_INTRO[key]) || DEFAULT_INTRO;
}

// "Good morning", "Good afternoon" or "Good evening", from the office hour.
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// The first word of a name, for the greeting. "Demo Coordinator" -> "Demo".
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
