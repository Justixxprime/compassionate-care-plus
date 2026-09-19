// prisma/seed.ts
//
// Populates a fresh database with the minimum needed to sign in and test
// the system: the organization, the permission list, roles with real
// permission sets (SUPER_ADMIN, ADMIN, NURSE so far), three demo accounts
// (an admin and two nurses), three synthetic demo patients - each nurse
// assigned to a different one, so relationship-based access
// (src/lib/patients.ts) can be tested for real, not just trusted - and a
// handful of synthetic visits spread across them (src/lib/visits.ts), and
// two synthetic care plans, one active and one waiting for approval
// (src/lib/care-plans.ts), and five synthetic documents, two of them in
// restricted categories (src/lib/documents.ts).
//
// Run with: npx prisma db seed
// (this is wired up in package.json - see the "prisma" block)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { ORG_TIMEZONE, orgLocalToUtc } from "../src/lib/time";
import { makeDemoPdf } from "./demo-pdf";

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
  "care_plans.create",
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
      "care_plans.read", "care_plans.create", "care_plans.update",
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

  // --- A second demo nurse, assigned to a DIFFERENT patient ---
  // With only one nurse, "sees only their own patients' visits" could be
  // confused with "sees nothing else exists". A second nurse on Marcus
  // Delgado makes it provable both ways: each nurse sees exactly their
  // own patient's visits, and the admin sees everyone's. Priya Raman
  // deliberately has nobody on her care team - an unassigned patient, the
  // situation a care coordinator will eventually work from.
  const demoNurse2 = await prisma.user.upsert({
    where: { email: "demo.nurse2@cheliv.test" },
    update: {},
    create: {
      organizationId: org.id,
      email: "demo.nurse2@cheliv.test",
      passwordHash: demoPasswordHash, // same demo password, see docs/DEMO_ACCOUNTS.md
      name: "Demo Nurse Two",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoNurse2.id, roleId: nurseRole.id } },
    update: {},
    create: { userId: demoNurse2.id, roleId: nurseRole.id },
  });
  console.log(`Demo nurse two ready: ${demoNurse2.email}`);

  const marcus = patients[1];
  const existingAssignment2 = await prisma.careTeamMember.findFirst({
    where: { patientId: marcus.id, userId: demoNurse2.id },
  });
  if (!existingAssignment2) {
    await prisma.careTeamMember.create({
      data: {
        patientId: marcus.id,
        userId: demoNurse2.id,
        roleOnCase: "primary_nurse",
      },
    });
  }
  console.log(
    `Demo nurse two assigned to: ${marcus.firstName} ${marcus.lastName}`,
  );

  // --- Synthetic demo visits ---
  // Dates are worked out from the day the seed runs, in office time, so
  // there are always some recent and some upcoming visits. Visits have no
  // natural unique field to upsert on, so this only creates them when the
  // organization has none yet - safe to run repeatedly, and it will not
  // duplicate them. To refresh the dates later, delete the rows in
  // Prisma Studio (or run "npx prisma migrate reset", which also re-seeds).
  const existingVisitCount = await prisma.visit.count({
    where: { organizationId: org.id },
  });

  if (existingVisitCount === 0) {
    // "YYYY-MM-DD" for the given number of days from today, in office time.
    const orgDay = (offsetDays: number) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: ORG_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));

    const visitDefs = [
      // Eleanor Whitfield, with the first demo nurse
      { patient: patients[0], clinician: demoNurse, type: "skilled_nursing", day: -7, time: "10:00", minutes: 60, status: "completed" },
      { patient: patients[0], clinician: demoNurse, type: "skilled_nursing", day: -3, time: "10:00", minutes: 60, status: "completed" },
      { patient: patients[0], clinician: demoNurse, type: "skilled_nursing", day: 1, time: "10:00", minutes: 60, status: "scheduled" },
      { patient: patients[0], clinician: demoNurse, type: "skilled_nursing", day: 4, time: "14:00", minutes: 45, status: "scheduled" },
      // Marcus Delgado, with the second demo nurse
      { patient: marcus, clinician: demoNurse2, type: "physical_therapy", day: -2, time: "09:00", minutes: 60, status: "completed" },
      { patient: marcus, clinician: demoNurse2, type: "physical_therapy", day: 2, time: "09:00", minutes: 60, status: "scheduled" },
    ] as const;

    for (const def of visitDefs) {
      const start = orgLocalToUtc(`${orgDay(def.day)}T${def.time}`);
      if (!start) throw new Error("Seed produced an invalid visit date");
      const end = new Date(start.getTime() + def.minutes * 60000);
      const done = def.status === "completed";

      await prisma.visit.create({
        data: {
          organizationId: org.id,
          patientId: def.patient.id,
          clinicianId: def.clinician.id,
          scheduledById: demoAdmin.id,
          visitType: def.type,
          status: def.status,
          scheduledStart: start,
          scheduledEnd: end,
          checkedInAt: done ? start : null,
          checkedOutAt: done ? end : null,
        },
      });
    }
    console.log(`${visitDefs.length} synthetic demo visits ready`);
  } else {
    console.log(`Visits already exist (${existingVisitCount}), leaving them alone`);
  }

  // --- Synthetic demo care plans ---
  // Eleanor Whitfield gets an ACTIVE plan (written by the first nurse,
  // approved by the admin), with one goal already met. Marcus Delgado gets
  // a DRAFT written by the second nurse and waiting for the admin to
  // approve it - which lets the approval step be clicked through for real.
  // Priya Raman has no plan. Like visits, plans have no natural unique
  // field, so these are only created when the organization has none yet.
  const existingPlanCount = await prisma.carePlan.count({
    where: { organizationId: org.id },
  });

  if (existingPlanCount === 0) {
    const now = new Date();
    const eleanor = patients[0];

    await prisma.carePlan.create({
      data: {
        organizationId: org.id,
        patientId: eleanor.id,
        authorId: demoNurse.id,
        approvedById: demoAdmin.id,
        approvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        status: "active",
        title: "Steady recovery at home",
        summary:
          "Eleanor is recovering at home and wants to stay independent. The team is focused on safe movement around the house, taking medicines on time, and keeping her comfortable and confident.",
        goals: {
          create: [
            { position: 0, description: "Walk to the mailbox and back with her walker, twice a week." },
            { position: 1, description: "Take every medicine on time using a weekly pill organizer.", status: "met", metAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
            { position: 2, description: "Keep the floors clear of loose rugs and cords." },
          ],
        },
      },
    });

    await prisma.carePlan.create({
      data: {
        organizationId: org.id,
        patientId: marcus.id,
        authorId: demoNurse2.id,
        status: "draft",
        title: "Rebuilding strength after a hospital stay",
        summary:
          "Marcus is building his strength back after time in hospital. The plan focuses on safe daily exercises with his therapist and getting up from a chair without help.",
        goals: {
          create: [
            { position: 0, description: "Stand up from a kitchen chair without using his hands, five times in a row." },
            { position: 1, description: "Complete the daily exercise routine on at least five days each week." },
          ],
        },
      },
    });
    console.log("2 synthetic demo care plans ready");
  } else {
    console.log(`Care plans already exist (${existingPlanCount}), leaving them alone`);
  }

  // --- Synthetic demo documents ---
  // Small real PDFs (see prisma/demo-pdf.ts), so they can actually be
  // downloaded and opened. Eleanor gets a consent, a physician order and
  // an insurance card; Marcus gets a consent and a photo ID. The
  // insurance card and the ID are in RESTRICTED categories: the admin can
  // see them, the nurses never can. Priya has none. Like visits and
  // plans, only created when the organization has no documents yet.
  const existingDocumentCount = await prisma.document.count({
    where: { organizationId: org.id },
  });

  if (existingDocumentCount === 0) {
    const eleanorDocs = patients[0];
    const documentDefs = [
      { patient: eleanorDocs, by: demoAdmin, category: "consent_form", title: "Signed consent to treat", file: "consent-to-treat.pdf" },
      { patient: eleanorDocs, by: demoNurse, category: "physician_order", title: "Physician order: skilled nursing visits", file: "physician-order.pdf" },
      { patient: eleanorDocs, by: demoAdmin, category: "insurance", title: "Insurance card (front and back)", file: "insurance-card.pdf" },
      { patient: marcus, by: demoAdmin, category: "consent_form", title: "Signed consent to treat", file: "consent-to-treat.pdf" },
      { patient: marcus, by: demoAdmin, category: "identification", title: "Photo identification", file: "photo-id.pdf" },
    ] as const;

    for (const def of documentDefs) {
      const bytes = makeDemoPdf(`${def.title} - ${def.patient.firstName} ${def.patient.lastName}`);
      await prisma.document.create({
        data: {
          organizationId: org.id,
          patientId: def.patient.id,
          uploadedById: def.by.id,
          category: def.category,
          title: def.title,
          fileName: def.file,
          contentType: "application/pdf",
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          file: { create: { data: Buffer.from(bytes) } },
        },
      });
    }
    console.log(`${documentDefs.length} synthetic demo documents ready`);
  } else {
    console.log(`Documents already exist (${existingDocumentCount}), leaving them alone`);
  }

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
