// prisma/seed.ts
//
// Populates a fresh database with the minimum needed to sign in and test
// the system: the organization, the permission list, roles with real
// permission sets (SUPER_ADMIN, ADMIN, NURSE so far), two demo accounts
// (an admin and a nurse), and three synthetic demo patients - one of
// which the nurse is actually assigned to, so relationship-based access
// (src/lib/patients.ts) can be tested for real, not just trusted.
//
// Run with: npx prisma db seed
// (this is wired up in package.json - see the "prisma" block)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// The full permission list from PHASE_0_ARCHITECTURE.md section 8.
// Not every permission is enforced yet - RBAC enforcement is a later
// phase - but the rows exist now so roles can be built against them
// incrementally instead of migrating the permissions table repeatedly.
const PERMISSIONS = [
  "patients.read",
  "patients.create",
  "patients.update",
  "patients.archive",
  "clinical_records.read",
  "clinical_records.create",
  "clinical_records.update",
  "care_plans.read",
  "care_plans.update",
  "care_plans.approve",
  "visits.read",
  "visits.create",
  "visits.update",
  "visits.document",
  "visits.review",
  "documents.read",
  "documents.upload",
  "documents.delete",
  "messages.read",
  "messages.send",
  "referrals.read",
  "referrals.manage",
  "tasks.read",
  "tasks.manage",
  "staff.manage",
  "roles.manage",
  "settings.manage",
  "reports.read",
  "audit.read",
  "security.read",
] as const;

async function main() {
  console.log("Seeding database...");

  // --- Organization ---
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Cheliv Compassionate Care Plus Inc",
    },
  });
  console.log(`Organization ready: ${org.name}`);

  // --- Permissions ---
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }
  console.log(`${PERMISSIONS.length} permissions ready`);

  // --- Roles ---
  // Permission sets defined so far: SUPER_ADMIN (everything) and ADMIN,
  // NURSE (needed to actually demonstrate relationship-based access
  // this round - see src/lib/patients.ts). The remaining roles
  // (CAREGIVER, CARE_COORDINATOR, CLINICAL_SUPERVISOR, PATIENT,
  // AUTHORIZED_FAMILY, REFERRAL_PARTNER) intentionally still hold no
  // permissions yet - designing each one's real permission set properly
  // is its own piece of work, not something to rush through as a side
  // effect of this round.
  const PERMISSION_SETS: Record<string, readonly string[] | "ALL"> = {
    SUPER_ADMIN: "ALL",
    ADMIN: [
      "patients.read", "patients.create", "patients.update", "patients.archive",
      "clinical_records.read", "care_plans.read", "care_plans.approve",
      "visits.read", "visits.create", "visits.update",
      "documents.read", "documents.upload",
      "messages.read", "messages.send",
      "referrals.read", "referrals.manage",
      "tasks.read", "tasks.manage",
      "staff.manage", "roles.manage", "settings.manage",
      "reports.read", "audit.read", "security.read",
    ],
    NURSE: [
      "patients.read",
      "clinical_records.read", "clinical_records.create", "clinical_records.update",
      "care_plans.read",
      "visits.read", "visits.create", "visits.update", "visits.document",
      "documents.read", "documents.upload",
      "messages.read", "messages.send",
      "tasks.read",
    ],
  };

  const roleDefs = [
    { key: "SUPER_ADMIN", name: "Super Admin" },
    { key: "ADMIN", name: "Administrator" },
    { key: "CLINICAL_SUPERVISOR", name: "Clinical Supervisor" },
    { key: "NURSE", name: "Nurse" },
    { key: "CAREGIVER", name: "Caregiver" },
    { key: "CARE_COORDINATOR", name: "Care Coordinator" },
    { key: "PATIENT", name: "Patient" },
    { key: "AUTHORIZED_FAMILY", name: "Authorized Family Member" },
    { key: "REFERRAL_PARTNER", name: "Referral Partner" },
  ] as const;

  const allPermissionRows = await prisma.permission.findMany();
  const roleRows = new Map<string, { id: string }>();

  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: def.key } },
      update: {},
      create: { organizationId: org.id, key: def.key, name: def.name },
    });
    roleRows.set(def.key, role);

    const grantSpec = PERMISSION_SETS[def.key];
    const permsToGrant =
      grantSpec === "ALL"
        ? allPermissionRows
        : allPermissionRows.filter((p: { key: string }) =>
            (grantSpec ?? []).includes(p.key),
          );

    for (const perm of permsToGrant) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
  console.log(`${roleDefs.length} roles ready`);

  // --- One demo admin account ---
  // Password is intentionally simple and documented in
  // docs/DEMO_ACCOUNTS.md (git-ignored, local only) - this is
  // development-only, never a real credential.
  const demoPasswordHash = await bcrypt.hash("ChangeMe123!", 12);

  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, key: "SUPER_ADMIN" },
  });

  const demoAdmin = await prisma.user.upsert({
    where: { email: "demo.admin@cheliv.test" },
    update: {},
    create: {
      organizationId: org.id,
      email: "demo.admin@cheliv.test",
      passwordHash: demoPasswordHash,
      name: "Demo Admin",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: demoAdmin.id, roleId: superAdminRole.id },
  });

  console.log(`Demo admin ready: ${demoAdmin.email}`);

  // --- One demo nurse account ---
  // Exists specifically to prove relationship-based access actually
  // works, not just role permissions - see src/lib/patients.ts. This
  // account holds patients.read (same as the admin), but should only
  // ever see the ONE patient it's actually assigned to below, while the
  // admin sees all three.
  const nurseRole = roleRows.get("NURSE")!;
  const demoNurse = await prisma.user.upsert({
    where: { email: "demo.nurse@cheliv.test" },
    update: {},
    create: {
      organizationId: org.id,
      email: "demo.nurse@cheliv.test",
      passwordHash: demoPasswordHash, // same demo password, see docs/DEMO_ACCOUNTS.md
      name: "Demo Nurse",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoNurse.id, roleId: nurseRole.id } },
    update: {},
    create: { userId: demoNurse.id, roleId: nurseRole.id },
  });
  console.log(`Demo nurse ready: ${demoNurse.email}`);

  // --- Synthetic demo patients ---
  // Clearly fictional names, synthetic data only - see the opening
  // rules in PHASE_0_ARCHITECTURE.md. Never real patient information.
  const patientDefs = [
    { firstName: "Eleanor", lastName: "Whitfield", dateOfBirth: new Date("1948-03-14") },
    { firstName: "Marcus", lastName: "Delgado", dateOfBirth: new Date("1955-11-02") },
    { firstName: "Priya", lastName: "Raman", dateOfBirth: new Date("1962-07-29") },
  ] as const;

  const patients = [];
  for (const def of patientDefs) {
    // No natural unique field to upsert on besides a real ID, so this
    // checks for an existing row with the same name first - safe to
    // run this seed script repeatedly without creating duplicates.
    const existing = await prisma.patient.findFirst({
      where: { organizationId: org.id, firstName: def.firstName, lastName: def.lastName },
    });
    const patient =
      existing ??
      (await prisma.patient.create({
        data: { organizationId: org.id, ...def },
      }));
    patients.push(patient);
  }
  console.log(`${patients.length} synthetic demo patients ready`);

  // Assign the demo nurse to exactly ONE of the three patients
  // (Eleanor Whitfield) - the admin will see all three, the nurse
  // should see only this one. That difference IS the test.
  const assignedPatient = patients[0];
  const existingAssignment = await prisma.careTeamMember.findFirst({
    where: { patientId: assignedPatient.id, userId: demoNurse.id },
  });
  if (!existingAssignment) {
    await prisma.careTeamMember.create({
      data: {
        patientId: assignedPatient.id,
        userId: demoNurse.id,
        roleOnCase: "primary_nurse",
      },
    });
  }
  console.log(
    `Demo nurse assigned to: ${assignedPatient.firstName} ${assignedPatient.lastName}`,
  );

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
