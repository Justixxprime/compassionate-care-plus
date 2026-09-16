// prisma/seed.ts
//
// Populates a fresh database with the minimum needed to sign in and test
// the system: the organization, the permission list, the roles this
// phase cares about, and ONE demo admin account.
//
// This does NOT create demo patients, visits, or clinical data yet -
// that's Milestone D, once there are tables to put them in. Right now
// this only proves the identity/auth tables work end to end.
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
  // Only SUPER_ADMIN is fully wired up right now (it gets every
  // permission). The rest of the roles from
  // PHASE_0_ARCHITECTURE.md section 3 get their specific permission
  // sets defined in the RBAC phase, once authorize() actually exists to
  // enforce them - creating the rows now means the roles table doesn't
  // need another migration when that phase arrives, but the sparse
  // permission sets are intentional for now, not a mistake.
  const roleDefs = [
    { key: "SUPER_ADMIN", name: "Super Admin", allPermissions: true },
    { key: "ADMIN", name: "Administrator", allPermissions: false },
    { key: "CLINICAL_SUPERVISOR", name: "Clinical Supervisor", allPermissions: false },
    { key: "NURSE", name: "Nurse", allPermissions: false },
    { key: "CAREGIVER", name: "Caregiver", allPermissions: false },
    { key: "CARE_COORDINATOR", name: "Care Coordinator", allPermissions: false },
    { key: "PATIENT", name: "Patient", allPermissions: false },
    { key: "AUTHORIZED_FAMILY", name: "Authorized Family Member", allPermissions: false },
    { key: "REFERRAL_PARTNER", name: "Referral Partner", allPermissions: false },
  ] as const;

  const allPermissionRows = await prisma.permission.findMany();

  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: def.key } },
      update: {},
      create: { organizationId: org.id, key: def.key, name: def.name },
    });

    if (def.allPermissions) {
      for (const perm of allPermissionRows) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
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
