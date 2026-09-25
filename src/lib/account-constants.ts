// src/lib/account-constants.ts
//
// The fixed vocabulary for creating an account, in one place. Pure data
// and pure functions: no database, no "server-only". The create-account
// form (a Client Component) and the server-side rules in
// src/lib/accounts.ts read the SAME lists. If they ever disagreed, the
// server's answer would win: the browser is never trusted.

// Three kinds of account this one form can create:
//   STAFF   a person who works here - one of the roles below.
//   FAMILY  an AUTHORIZED_FAMILY account. Creating it does not share any
//           patient's care with them - that is still a separate,
//           deliberate step on /consents (src/lib/family-consents.ts).
//   PATIENT gives an existing patient record (one with no account yet) a
//           sign-in. It never creates a new patient - patients are
//           created by accepting a referral (src/lib/referrals.ts).
export const ACCOUNT_TYPES = [
  { key: "STAFF", label: "Staff" },
  { key: "FAMILY", label: "Family member" },
  { key: "PATIENT", label: "Patient (link an existing patient record)" },
] as const;

export type AccountTypeKey = (typeof ACCOUNT_TYPES)[number]["key"];

export function isAccountType(value: string): value is AccountTypeKey {
  return ACCOUNT_TYPES.some((t) => t.key === value);
}

// Roles this form may assign a STAFF account. SUPER_ADMIN is deliberately
// left off: that role is not something a form should be able to hand out,
// even to another administrator - it is created by hand (the seed, or a
// direct database change), the same reasoning /consents already uses for
// keeping some things off a form. REFERRAL_PARTNER is left off too: it
// holds no permissions yet, and its own portal has not been designed
// (see prisma/seed.ts).
export const STAFF_ROLE_OPTIONS = [
  { key: "ADMIN", label: "Administrator" },
  { key: "CLINICAL_SUPERVISOR", label: "Clinical Supervisor" },
  { key: "NURSE", label: "Nurse" },
  { key: "CARE_COORDINATOR", label: "Care Coordinator" },
  { key: "CAREGIVER", label: "Caregiver" },
] as const;

export type StaffRoleKey = (typeof STAFF_ROLE_OPTIONS)[number]["key"];

export function isStaffRole(value: string): value is StaffRoleKey {
  return STAFF_ROLE_OPTIONS.some((r) => r.key === value);
}

export const FAMILY_ROLE_KEY = "AUTHORIZED_FAMILY";
export const PATIENT_ROLE_KEY = "PATIENT";

// A temporary password the office sets for the person. Not e-mailed to
// them (there is no e-mail service configured yet - see the Request
// care decision in docs/NEXT_STEP.md): the office tells the person
// directly, the same way a workplace hands over a first password today.
export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

// A plain e-mail shape check. Real deliverability is not checked here -
// that would need to actually send something, which is the e-mail
// service decision this project has not made yet.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
