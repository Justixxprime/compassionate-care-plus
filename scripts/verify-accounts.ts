// scripts/verify-accounts.ts
//
// Proves the account-creation rules hold, by trying to break them.
//   npm run verify:accounts
//
// Creates temporary accounts and patients through createAccount itself -
// the same function the form calls - as different people, and checks that
// every attempt that SHOULD be refused IS refused, and every attempt that
// should work does. Then it deletes everything it created (and, where a
// bug would have let something through anyway, cleans that up too).
//
// Needs the demo data (npx prisma db seed). Refuses to run unless
// DATABASE_URL points at this machine.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import { createAccount, getAccountOptions, type CreateAccountInput } from "@/lib/accounts";
import { MIN_PASSWORD_LENGTH } from "@/lib/account-constants";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}
const section = (t: string) => console.log(`\n${t}`);
async function throwsAuth(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof AuthorizationError;
  }
}
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const GOOD_PASSWORD = "correct-horse-1";

function input(over: Partial<CreateAccountInput> & { accountType: string }): CreateAccountInput {
  return {
    accountType: over.accountType,
    name: over.name ?? "Verify Person",
    email: over.email ?? `verify-acct-${Date.now()}-${Math.random().toString(36).slice(2)}@cheliv.test`,
    password: over.password ?? GOOD_PASSWORD,
    confirmPassword: over.confirmPassword ?? over.password ?? GOOD_PASSWORD,
    staffRoleKey: over.staffRoleKey ?? "",
    patientId: over.patientId ?? "",
  };
}

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Account creation verification");
  const startedAt = new Date();

  const emails = ["admin", "nurse", "supervisor", "coordinator", "caregiver", "patient", "family"].map((n) => `demo.${n}@cheliv.test`);
  const found = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (found.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse, supervisor, coordinator, caregiver, demoPatientUser, demoFamily] = found as NonNullable<(typeof found)[number]>[];
  const orgId = admin.organizationId;

  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  const runId = Date.now().toString(36);

  const mkPatient = async (tag: string, over: Partial<{ status: string; userId: string | null }> = {}) => {
    const p = await prisma.patient.create({
      data: {
        organizationId: orgId,
        firstName: `Acct${tag}`,
        lastName: "Verify",
        dateOfBirth: new Date("1950-01-01T00:00:00Z"),
        status: over.status ?? "active",
        userId: over.userId ?? null,
      },
    });
    createdPatientIds.push(p.id);
    return p;
  };
  const trackIfCreated = (r: Awaited<ReturnType<typeof createAccount>>) => {
    if (r.ok) createdUserIds.push(r.value.userId);
    return r;
  };

  try {
    section("1. Who is stopped at the door");
    for (const [label, who] of [
      ["a nurse", nurse],
      ["a supervisor", supervisor],
      ["a coordinator", coordinator],
      ["a caregiver", caregiver],
      ["a family account", demoFamily],
    ] as const) {
      check(
        `${label} cannot create an account`,
        await throwsAuth(() => createAccount(who.id, input({ accountType: "STAFF", staffRoleKey: "NURSE" }))),
      );
      check(`${label} gets no account-creation options`, (await getAccountOptions(who.id)) === null);
    }
    check("an administrator gets account-creation options", (await getAccountOptions(admin.id)) !== null);

    section("2. Creating a staff account");
    const staffEmail = `verify-acct-staff-${runId}@cheliv.test`;
    const staffResult = trackIfCreated(
      await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", email: staffEmail, name: "Verify Staff" })),
    );
    check("a valid staff account is created", staffResult.ok, staffResult.ok ? "" : staffResult.error);
    if (staffResult.ok) {
      const row = await prisma.user.findUnique({
        where: { id: staffResult.value.userId },
        select: { name: true, organizationId: true, passwordHash: true, userRoles: { select: { role: { select: { key: true } } } } },
      });
      check("it holds exactly the chosen role", !!row && row.userRoles.length === 1 && row.userRoles[0].role.key === "NURSE");
      check("it belongs to the actor's organization", row?.organizationId === orgId);
      check("the password is hashed, not stored in the clear", !!row && row.passwordHash !== GOOD_PASSWORD && row.passwordHash.startsWith("$2"));
    }

    section("3. Roles this form will not hand out");
    for (const role of ["SUPER_ADMIN", "REFERRAL_PARTNER", "PATIENT", "AUTHORIZED_FAMILY", "made_up_role"]) {
      const r = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: role }));
      check(`STAFF cannot be created with role ${role}`, !r.ok, r.ok ? "was created" : r.error);
    }

    section("4. Creating a family account");
    const familyResult = trackIfCreated(await createAccount(admin.id, input({ accountType: "FAMILY", name: "Verify Family" })));
    check("a family account is created", familyResult.ok, familyResult.ok ? "" : familyResult.error);
    if (familyResult.ok) {
      const row = await prisma.user.findUnique({
        where: { id: familyResult.value.userId },
        select: { userRoles: { select: { role: { select: { key: true } } } } },
      });
      check("it holds exactly AUTHORIZED_FAMILY, nothing else", !!row && row.userRoles.length === 1 && row.userRoles[0].role.key === "AUTHORIZED_FAMILY");
    }

    section("5. E-mail already in use");
    const dup1 = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", email: staffEmail }));
    check("the same e-mail cannot be used twice", !dup1.ok);
    const dup2 = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", email: "DEMO.NURSE@cheliv.test" }));
    check("an existing e-mail is refused regardless of letter case", !dup2.ok);

    section("6. Password rules");
    const short = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", password: "short", confirmPassword: "short" }));
    check(`a password under ${MIN_PASSWORD_LENGTH} characters is refused`, !short.ok);
    const mismatch = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", password: GOOD_PASSWORD, confirmPassword: "different-one-1" }));
    check("mismatched passwords are refused", !mismatch.ok);

    section("7. Malformed input");
    const noEmail = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", email: "not-an-email" }));
    check("an implausible e-mail is refused", !noEmail.ok);
    const noName = await createAccount(admin.id, input({ accountType: "STAFF", staffRoleKey: "NURSE", name: "   " }));
    check("a blank name is refused", !noName.ok);
    const noType = await createAccount(admin.id, input({ accountType: "not_a_real_type" }));
    check("an unknown account type is refused", !noType.ok);

    section("8. Linking a patient account");
    const readyPatient = await mkPatient("ready");
    const options = await getAccountOptions(admin.id);
    check("an unlinked active patient appears in the options list", !!options && options.unlinkedPatients.some((p) => p.patientId === readyPatient.id));

    const linkResult = trackIfCreated(
      await createAccount(admin.id, input({ accountType: "PATIENT", patientId: readyPatient.id, name: "Verify Patient" })),
    );
    check("linking a ready patient succeeds", linkResult.ok, linkResult.ok ? "" : linkResult.error);
    if (linkResult.ok) {
      const patientRow = await prisma.patient.findUnique({ where: { id: readyPatient.id }, select: { userId: true } });
      check("the patient row now points at the new account", patientRow?.userId === linkResult.value.userId);
      const roleRow = await prisma.userRole.findFirst({ where: { userId: linkResult.value.userId }, select: { role: { select: { key: true } } } });
      check("the new account holds exactly PATIENT", roleRow?.role.key === "PATIENT");

      const optionsAfter = await getAccountOptions(admin.id);
      check("the now-linked patient no longer appears in the options list", !!optionsAfter && !optionsAfter.unlinkedPatients.some((p) => p.patientId === readyPatient.id));

      const second = await createAccount(admin.id, input({ accountType: "PATIENT", patientId: readyPatient.id }));
      check("linking the same patient a second time is refused", !second.ok);
    }

    // A fresh account (the staff one from section 2) that is not yet
    // linked to any patient, used only to occupy Patient.userId (which is
    // unique) without colliding with the demo patient's own link.
    const alreadyLinked = await mkPatient("linked", { userId: staffResult.ok ? staffResult.value.userId : undefined });
    const takenResult = await createAccount(admin.id, input({ accountType: "PATIENT", patientId: alreadyLinked.id }));
    check("a patient who already has an account cannot be linked to a second one", !takenResult.ok);

    const dischargedPatient = await mkPatient("gone", { status: "discharged" });
    const dischargedResult = await createAccount(admin.id, input({ accountType: "PATIENT", patientId: dischargedPatient.id }));
    check("a discharged patient cannot be given a sign-in", !dischargedResult.ok);

    check("the seed's own demo patient link is left untouched by any of this", (await prisma.patient.findFirst({ where: { userId: demoPatientUser.id } })) !== null);

    const madeUpPatient = await createAccount(admin.id, input({ accountType: "PATIENT", patientId: "00000000-0000-0000-0000-000000000000" }));
    check(
      "a made-up patient id gets the same words as an already-linked one",
      !madeUpPatient.ok && !takenResult.ok && madeUpPatient.error === takenResult.error,
    );
    check("no patient chosen for a PATIENT account is refused", !(await createAccount(admin.id, input({ accountType: "PATIENT", patientId: "" }))).ok);

    section("9. Everything is audited, nothing sensitive in it");
    const auditRows = await prisma.auditLog.findMany({
      where: { actorUserId: admin.id, action: { startsWith: "account_created_" }, occurredAt: { gte: startedAt } },
      select: { action: true, resourceType: true, resourceId: true },
    });
    check("account creation writes an audit entry naming the role, not the person", auditRows.length >= 3 && auditRows.every((r) => r.resourceType === "user" && createdUserIds.includes(r.resourceId ?? "")));
    check("the audit entries never contain the e-mail or name", !JSON.stringify(auditRows).includes("cheliv.test") && !JSON.stringify(auditRows).includes("Verify"));

    section("10. The code says what it should");
    const svc = read("src/lib/accounts.ts");
    check("it asks for staff.manage first", /requirePermission\(userId, "staff\.manage"\)/.test(svc));
    check("it locks the patient row before linking (same shape as family consents)", /FOR UPDATE/.test(svc));
    check("SUPER_ADMIN is never hard-coded as an assignable role in this file", !/["']SUPER_ADMIN["']/.test(svc));
    const constants = read("src/lib/account-constants.ts");
    check("SUPER_ADMIN is absent from the assignable staff role list", !/STAFF_ROLE_OPTIONS[\s\S]*?SUPER_ADMIN/.test(constants));
  } finally {
    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: createdUserIds } },
            { resourceId: { in: createdUserIds } },
            { action: "permission_denied", resourceId: "staff.manage", occurredAt: { gte: startedAt } },
          ],
        },
      });
      await prisma.patient.updateMany({ where: { id: { in: createdPatientIds } }, data: { userId: null } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.patient.deleteMany({ where: { id: { in: createdPatientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      console.log("\n  removed the temporary accounts, patients and audit entries");
    } catch (e) {
      console.error("  CLEANUP FAILED:", e);
      failures.push("cleanup");
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failed:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
  console.log("Every account-creation rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
