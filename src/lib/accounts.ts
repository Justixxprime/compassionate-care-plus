// src/lib/accounts.ts
//
// Creating a real sign-in account, so nothing depends on the seed script
// any more (NEXT_STEP.md item (a)). One form, three outcomes:
//
//   STAFF    a new user with one of the staff roles in
//            src/lib/account-constants.ts (not SUPER_ADMIN - see there
//            for why).
//   FAMILY   a new AUTHORIZED_FAMILY account. This does NOT share any
//            patient's care - that is still the separate, deliberate
//            step on /consents (src/lib/family-consents.ts). A family
//            account with no consent sees nobody, exactly as before.
//   PATIENT  gives an EXISTING patient record - one with no account yet
//            - a sign-in, and the PATIENT role. It never creates a new
//            patient (referrals do that: src/lib/referrals.ts).
//
// THE RULES
//   1. staff.manage, held only by ADMIN and SUPER_ADMIN. Same permission
//      the read-only staff directory already requires (src/lib/staff.ts)
//      - and, like that file notes, both roles that hold it already
//      reach every patient in the organization, so there is no second,
//      relationship-shaped question to ask for the PATIENT case.
//   2. An e-mail already in use, in any organization, is refused with the
//      same plain words whether it belongs to this organization or
//      another one - it never reveals which.
//   3. The office sets the first password directly (there is no e-mail
//      service configured yet - see the Request care decision in
//      docs/NEXT_STEP.md) and tells the person separately. It is hashed
//      the same way every other password in this project is
//      (bcryptjs, src/lib/auth/actions.ts) and is never written to the
//      audit log.
//   4. Linking a PATIENT account only ever targets a patient who is
//      active or on hold and does not already have one, checked again
//      inside a transaction that locks the patient's row - the same
//      shape as recording a family consent (src/lib/family-consents.ts)
//      - so two people submitting the form for the same patient at the
//      same moment cannot both win.
//   5. The audit log records that an account was created and for which
//      role, never the name, e-mail or password.

import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/authorize";
import { auditAllowed, loadActor } from "@/lib/auth/actor";
import type { Result } from "@/lib/visits";
import {
  FAMILY_ROLE_KEY,
  PATIENT_ROLE_KEY,
  isAccountType,
  isPlausibleEmail,
  isStaffRole,
  normalizeEmail,
  passwordProblem,
  type AccountTypeKey,
} from "@/lib/account-constants";

const BCRYPT_COST = 12;

// Only patients being looked after now can be given a sign-in.
const LINKABLE_PATIENT_STATUSES = ["active", "on_hold"];

const EMAIL_IN_USE = "An account with that e-mail address already exists.";
const NO_PATIENT = "That patient could not be found, or already has an account.";

export interface AccountOptions {
  unlinkedPatients: { patientId: string; patientName: string }[];
}

// What the form may offer. null for anyone who may not create accounts,
// so the page leaves the form out - the same pattern
// getConsentOptions uses. (The form being absent is a convenience;
// createAccount is what actually enforces it.)
export async function getAccountOptions(userId: string): Promise<AccountOptions | null> {
  if (!(await hasPermission(userId, "staff.manage"))) return null;
  const actor = await loadActor(userId);

  const patients = await prisma.patient.findMany({
    where: {
      organizationId: actor.organizationId,
      userId: null,
      status: { in: LINKABLE_PATIENT_STATUSES },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return {
    unlinkedPatients: patients.map((p) => ({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
    })),
  };
}

export interface CreateAccountInput {
  accountType: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  staffRoleKey: string; // only read when accountType is STAFF
  patientId: string; // only read when accountType is PATIENT
}

export async function createAccount(
  userId: string,
  input: CreateAccountInput,
): Promise<Result<{ userId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "staff.manage");
  const actor = await loadActor(userId);

  // 2. Shape of the account.
  if (!isAccountType(input.accountType)) {
    return { ok: false, error: "Choose what kind of account this is." };
  }
  const accountType: AccountTypeKey = input.accountType;

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Enter the person's name." };
  }

  const email = normalizeEmail(input.email);
  if (!isPlausibleEmail(email)) {
    return { ok: false, error: "Enter a valid e-mail address." };
  }

  if (input.password !== input.confirmPassword) {
    return { ok: false, error: "The two passwords do not match." };
  }
  const passwordIssue = passwordProblem(input.password);
  if (passwordIssue) {
    return { ok: false, error: passwordIssue };
  }

  // 3. Which role, and (for PATIENT) which existing patient.
  let roleKey: string;
  if (accountType === "STAFF") {
    if (!isStaffRole(input.staffRoleKey)) {
      return { ok: false, error: "Choose a role for this staff account." };
    }
    roleKey = input.staffRoleKey;
  } else if (accountType === "FAMILY") {
    roleKey = FAMILY_ROLE_KEY;
  } else {
    if (!input.patientId) {
      return { ok: false, error: "Choose which patient this account is for." };
    }
    roleKey = PATIENT_ROLE_KEY;
  }

  // 4. E-mail not already in use - anywhere, not just this organization.
  //    Same words either way, so this never reveals whether the address
  //    belongs to another organization.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: EMAIL_IN_USE };
  }

  const role = await prisma.role.findFirst({
    where: { organizationId: actor.organizationId, key: roleKey },
    select: { id: true },
  });
  if (!role) {
    return { ok: false, error: "That role is not set up for this organization." };
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (accountType === "PATIENT") {
        // Lock the patient row so two submissions for the same person
        // cannot both succeed - the same shape createConsent uses.
        await tx.$queryRaw`SELECT id FROM patients WHERE id = ${input.patientId} FOR UPDATE`;
        const patient = await tx.patient.findFirst({
          where: {
            id: input.patientId,
            organizationId: actor.organizationId,
            userId: null,
            status: { in: LINKABLE_PATIENT_STATUSES },
          },
          select: { id: true },
        });
        if (!patient) return { kind: "no_patient" as const };
      }

      const user = await tx.user.create({
        data: { organizationId: actor.organizationId, email, passwordHash, name },
        select: { id: true },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

      if (accountType === "PATIENT") {
        const linked = await tx.patient.updateMany({
          where: {
            id: input.patientId,
            organizationId: actor.organizationId,
            userId: null,
            status: { in: LINKABLE_PATIENT_STATUSES },
          },
          data: { userId: user.id },
        });
        if (linked.count !== 1) {
          // Somebody else linked this patient between the lock above and
          // now - roll back rather than leave an unlinked account behind.
          throw new PatientAlreadyLinkedError();
        }
      }

      return { kind: "created" as const, id: user.id };
    });

    if (created.kind === "no_patient") {
      return { ok: false, error: NO_PATIENT };
    }

    await auditAllowed(actor, `account_created_${roleKey.toLowerCase()}`, "user", created.id);
    return { ok: true, value: { userId: created.id } };
  } catch (err) {
    if (err instanceof PatientAlreadyLinkedError) {
      return { ok: false, error: NO_PATIENT };
    }
    throw err;
  }
}

class PatientAlreadyLinkedError extends Error {}
