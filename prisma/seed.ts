// prisma/seed.ts
//
// Populates a fresh database with the minimum needed to sign in and test
// the system: the organization, the permission list, roles with real
// permission sets (SUPER_ADMIN, ADMIN, NURSE, CARE_COORDINATOR and
// CLINICAL_SUPERVISOR and CAREGIVER so far), six demo accounts (an admin, two
// nurses, a care coordinator, a clinical supervisor and a caregiver), three synthetic demo
// patients - each nurse
// assigned to a different one, so relationship-based access
// (src/lib/patients.ts) can be tested for real, not just trusted - and a
// handful of synthetic visits spread across them (src/lib/visits.ts), and
// two synthetic care plans, one active and one waiting for approval
// (src/lib/care-plans.ts), and five synthetic documents, two of them in
// restricted categories (src/lib/documents.ts), and six synthetic
// referrals: three already accepted and linked to the demo patients, and
// three about people who are not patients (src/lib/referrals.ts). Near the
// end it also creates a demo patient account, a demo family account and the
// one family permission that connects it to Eleanor (src/lib/family-portal.ts).
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
  "visits.checkin",
  "portal.read",
  "portal.documents.read",
  "partner.referrals.create",
  "partner.referrals.read",
  "family.read",
  "consents.manage",
  "documents.read",
  "documents.upload",
  "documents.delete",
  "documents.grant",
  "messages.read",
  "messages.send",
  "referrals.read",
  "referrals.manage",
  "care_team.read",
  "care_team.manage",
  "tasks.read",
  "tasks.manage",
  "staff.manage",
  "roles.manage",
  "settings.manage",
  "reports.read",
  "audit.read",
  "security.read",
  "care_requests.manage",
] as const;

async function main() {
  // SAFETY (REVIEW_MILESTONE_D.md item 12). This script creates accounts
  // with a known, documented password, including a super administrator. If
  // it ever ran against a hosted database, anybody who read the docs could
  // sign in. So it refuses unless the database is on THIS machine, the same
  // guard the verify scripts already have.
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error(
      "Refusing to seed: DATABASE_URL does not point at localhost. " +
        "The seed creates demo accounts with a known password, so it only runs on your own machine.",
    );
    process.exit(2);
  }

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
  // Permission sets defined so far: SUPER_ADMIN (everything), ADMIN,
  // NURSE, CARE_COORDINATOR, CLINICAL_SUPERVISOR, CAREGIVER and PATIENT.
  // The remaining role (REFERRAL_PARTNER) intentionally still holds no
  // permissions yet - its real permission set is designed together with
  // its own portal, not rushed as a side effect of another round.
  //
  // This seed only ever ADDS permissions to a role. It never takes one
  // away, so running it again on an existing database is always safe.
  const PERMISSION_SETS: Record<string, readonly string[] | "ALL"> = {
    SUPER_ADMIN: "ALL",
    ADMIN: [
      "patients.read", "patients.create", "patients.update", "patients.archive",
      "clinical_records.read", "care_plans.read", "care_plans.approve",
      "visits.read", "visits.create", "visits.update", "visits.review",
      "documents.read", "documents.upload", "documents.grant",
      "messages.read", "messages.send",
      "referrals.read", "referrals.manage",
      "care_team.read", "care_team.manage",
      "tasks.read", "tasks.manage",
      "consents.manage",
      "staff.manage", "roles.manage", "settings.manage",
      "reports.read", "audit.read", "security.read",
      "care_requests.manage",
    ],
    NURSE: [
      "patients.read",
      "clinical_records.read", "clinical_records.create", "clinical_records.update",
      "care_plans.read", "care_plans.create", "care_plans.update",
      "visits.read", "visits.create", "visits.update", "visits.document",
      "documents.read", "documents.upload",
      "messages.read", "messages.send",
      "referrals.read",
      "tasks.read", "tasks.manage",
    ],
    // The care coordinator's job is intake: referrals in, patients put on
    // care teams, visits scheduled. patients.create is there because
    // accepting a referral about someone new creates the patient record
    // (src/lib/referrals.ts asks for it), and without it the coordinator
    // could start a review but never finish the job. No clinical content:
    // no care plans, no documents, no clinical records.
    CARE_COORDINATOR: [
      "patients.read", "patients.create",
      "referrals.read", "referrals.manage",
      "visits.read", "visits.create", "visits.update",
      "care_team.read", "care_team.manage",
      "tasks.read", "tasks.manage",
    ],
    // The caregiver (home health aide) works from a phone: sees their OWN
    // visits for today, checks in and out, and finishes tasks given to
    // them. visits.checkin means exactly that and nothing more (see
    // src/lib/caregiver.ts). No patient list, no chart, no scheduling, no
    // notes: each of those is a later, separate decision.
    CAREGIVER: ["visits.checkin", "tasks.read"],
    // The patient sees THEIR OWN care and nothing else: next visits, care
    // team, active care plan. portal.read means exactly that, and only
    // works for the one patient record linked to the account (see
    // src/lib/patient-portal.ts). It opens no staff screen at all.
    PATIENT: ["portal.read", "portal.documents.read", "messages.read", "messages.send"],
    // A family member sees only what a patient has chosen to share with
    // them. family.read means exactly that: the consent decides which
    // patient and which parts (see src/lib/family-portal.ts). It opens no
    // staff screen at all.
    AUTHORIZED_FAMILY: ["family.read"],
    REFERRAL_PARTNER: ["partner.referrals.create", "partner.referrals.read"],
    // The clinical supervisor reviews: approves care plans (someone other
    // than the author, always) and can read visits and documents. Cannot
    // write plans, schedule, or change care teams.
    CLINICAL_SUPERVISOR: [
      "patients.read",
      "care_plans.read", "care_plans.approve",
      "visits.read", "visits.review",
      "documents.read",
      "care_team.read",
      "tasks.read", "tasks.manage",
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

  // --- A demo care coordinator and a demo clinical supervisor ---
  // The two office roles that held no permissions until Milestone E. They
  // exist so their permission sets can be checked by really being them
  // (npm run verify:access does), not just by reading the list above.
  for (const def of [
    { email: "demo.coordinator@cheliv.test", name: "Demo Coordinator", roleKey: "CARE_COORDINATOR" },
    { email: "demo.supervisor@cheliv.test", name: "Demo Supervisor", roleKey: "CLINICAL_SUPERVISOR" },
  ] as const) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        organizationId: org.id,
        email: def.email,
        passwordHash: demoPasswordHash, // same demo password, see docs/DEMO_ACCOUNTS.md
        name: def.name,
      },
    });
    const role = roleRows.get(def.roleKey)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    console.log(`Demo ${def.name.replace("Demo ", "").toLowerCase()} ready: ${user.email}`);
  }

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

  // --- Synthetic demo referrals ---
  // Six referrals, all about fictional people, made to make the access
  // rules testable with the three demo accounts:
  //   - Eleanor, Marcus and Priya each have the referral that brought
  //     them in, ACCEPTED and linked to their patient record. The nurse
  //     on a patient's team sees that patient's referral (with the
  //     reason, without the office details); the admin sees all three.
  //   - Walter Brennan (in review, urgent), Grace Holloway (just
  //     received) and Tomas Reyes (declined) are not patients, so no
  //     nurse can see them at all. Only the admin can.
  // Every phone number uses the 555-01xx range, which is reserved for
  // fiction. Like visits, plans and documents, these are only created
  // when the organization has no referrals yet.
  const existingReferralCount = await prisma.referral.count({
    where: { organizationId: org.id },
  });

  if (existingReferralCount === 0) {
    const day = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const [eleanorRef, marcusRef, priyaRef] = patients;

    const referralDefs = [
      {
        who: patientDefs[0],
        patientId: eleanorRef.id,
        status: "accepted",
        daysAgo: 21,
        decided: true,
        sourceType: "hospital",
        sourceOrganization: "Riverbend Regional Hospital",
        sourceContactName: "Dana Okafor",
        sourceContactPhone: "(281) 555-0142",
        requestedService: "skilled_nursing",
        urgency: "urgent",
        reason:
          "Hip replacement surgery, sent home from hospital. Needs nursing visits for wound checks and a review of her new medicines.",
        officeNotes: "Discharge planner called ahead. Family wants morning visits.",
        decisionNote: null,
      },
      {
        who: patientDefs[1],
        patientId: marcusRef.id,
        status: "accepted",
        daysAgo: 14,
        decided: true,
        sourceType: "physician_office",
        sourceOrganization: "Lakeside Family Medicine",
        sourceContactName: "Nurse Ruiz",
        sourceContactPhone: "(281) 555-0177",
        requestedService: "physical_therapy",
        urgency: "routine",
        reason:
          "Weak and unsteady after a long hospital stay. Needs physical therapy to rebuild strength and move safely around the house.",
        officeNotes: "Doctor's order arrived by fax.",
        decisionNote: null,
      },
      {
        who: patientDefs[2],
        patientId: priyaRef.id,
        status: "accepted",
        daysAgo: 6,
        decided: true,
        sourceType: "family",
        sourceOrganization: null,
        sourceContactName: "Anand Raman",
        sourceContactPhone: "(281) 555-0119",
        requestedService: "skilled_nursing",
        urgency: "routine",
        reason:
          "Diabetes with a foot wound that is slow to heal. Needs nursing visits for wound care and help understanding her medicines.",
        officeNotes: "Son is the main contact. Nobody is on the care team yet.",
        decisionNote: null,
      },
      {
        who: { firstName: "Walter", lastName: "Brennan", dateOfBirth: new Date("1939-08-21") },
        patientId: null,
        status: "in_review",
        daysAgo: 2,
        decided: false,
        sourceType: "hospital",
        sourceOrganization: "Riverbend Regional Hospital",
        sourceContactName: "Dana Okafor",
        sourceContactPhone: "(281) 555-0142",
        requestedService: "occupational_therapy",
        urgency: "urgent",
        reason:
          "Went home yesterday after a fall that broke his wrist. Lives alone and needs help with dressings and with getting dressed and bathing safely.",
        officeNotes: "Checking his coverage before accepting.",
        decisionNote: null,
      },
      {
        who: { firstName: "Grace", lastName: "Holloway", dateOfBirth: new Date("1971-02-09") },
        patientId: null,
        status: "received",
        daysAgo: 0,
        decided: false,
        sourceType: "self",
        sourceOrganization: null,
        sourceContactName: null,
        sourceContactPhone: "(281) 555-0163",
        requestedService: "skilled_nursing",
        urgency: "routine",
        reason:
          "Newly told she has a heart condition and would like help learning to take her medicines and change what she eats.",
        officeNotes: null,
        decisionNote: null,
      },
      {
        who: { firstName: "Tomas", lastName: "Reyes", dateOfBirth: new Date("1966-12-30") },
        patientId: null,
        status: "declined",
        daysAgo: 9,
        decided: true,
        sourceType: "physician_office",
        sourceOrganization: "Lakeside Family Medicine",
        sourceContactName: "Nurse Ruiz",
        sourceContactPhone: "(281) 555-0177",
        requestedService: "home_health_aide",
        urgency: "routine",
        reason: "Needs help with bathing and daily tasks after a stroke.",
        officeNotes: null,
        decisionNote:
          "Home is outside the area we serve. Called the doctor's office so they could find a closer agency.",
      },
    ] as const;

    for (const def of referralDefs) {
      const createdAt = new Date(nowMs - def.daysAgo * day);
      await prisma.referral.create({
        data: {
          organizationId: org.id,
          patientId: def.patientId,
          createdById: demoAdmin.id,
          decidedById: def.decided ? demoAdmin.id : null,
          decidedAt: def.decided ? new Date(createdAt.getTime() + day) : null,
          firstName: def.who.firstName,
          lastName: def.who.lastName,
          dateOfBirth: def.who.dateOfBirth,
          sourceType: def.sourceType,
          sourceOrganization: def.sourceOrganization,
          sourceContactName: def.sourceContactName,
          sourceContactPhone: def.sourceContactPhone,
          requestedService: def.requestedService,
          urgency: def.urgency,
          reason: def.reason,
          officeNotes: def.officeNotes,
          decisionNote: def.decisionNote,
          status: def.status,
          createdAt,
        },
      });
    }
    console.log(`${referralDefs.length} synthetic demo referrals ready`);
  } else {
    console.log(`Referrals already exist (${existingReferralCount}), leaving them alone`);
  }

  // --- Synthetic demo tasks ---
  // Three made-up tasks so the Tasks page is not empty on first sight.
  // Only created when the organization has none, so re-seeding never
  // duplicates them. Nothing here is a real person or a real need.
  const existingTaskCount = await prisma.task.count({ where: { organizationId: org.id } });
  if (existingTaskCount === 0) {
    const byEmail = async (email: string) =>
      prisma.user.findUnique({ where: { email }, select: { id: true } });
    const [adminUser, nurseUser, coordUser] = await Promise.all([
      byEmail("demo.admin@cheliv.test"),
      byEmail("demo.nurse@cheliv.test"),
      byEmail("demo.coordinator@cheliv.test"),
    ]);
    const eleanorRow = await prisma.patient.findFirst({
      where: { organizationId: org.id, firstName: "Eleanor", lastName: "Whitfield" },
      select: { id: true },
    });
    if (adminUser && nurseUser && coordUser && eleanorRow) {
      const day = (n: number) => {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() + n);
        return d;
      };
      await prisma.task.createMany({
        data: [
          {
            organizationId: org.id,
            patientId: eleanorRow.id,
            assigneeId: nurseUser.id,
            createdById: adminUser.id,
            title: "Confirm the medication list with the family",
            details: "Synthetic demo task.",
            dueDate: day(2),
          },
          {
            organizationId: org.id,
            assigneeId: coordUser.id,
            createdById: adminUser.id,
            title: "Call back the two referral sources waiting on an answer",
            details: "Synthetic demo task.",
            dueDate: day(-1),
          },
          {
            organizationId: org.id,
            assigneeId: adminUser.id,
            createdById: adminUser.id,
            title: "Review this week's schedule for gaps",
            dueDate: day(5),
          },
        ],
      });
      console.log("3 synthetic demo tasks ready");
    }
  } else {
    console.log(`Tasks already exist (${existingTaskCount}), leaving them alone`);
  }

  // --- A demo caregiver (home health aide) ---
  // Exists so the caregiver portal (/caregiver) can be clicked through for
  // real. She is on Eleanor Whitfield's care team in the caregiver place, so
  // she reaches only Eleanor. Her visits and tasks are created only when
  // she has none for today, so running the seed again never piles up
  // duplicates, and running it on a later day gives her a fresh day.
  const demoCaregiver = await prisma.user.upsert({
    where: { email: "demo.caregiver@cheliv.test" },
    update: {},
    create: {
      organizationId: org.id,
      email: "demo.caregiver@cheliv.test",
      passwordHash: demoPasswordHash, // same demo password, see docs/DEMO_ACCOUNTS.md
      name: "Demo Caregiver",
    },
  });
  const caregiverRoleRow = roleRows.get("CAREGIVER")!;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoCaregiver.id, roleId: caregiverRoleRow.id } },
    update: {},
    create: { userId: demoCaregiver.id, roleId: caregiverRoleRow.id },
  });
  const caregiverOnTeam = await prisma.careTeamMember.findFirst({
    where: { patientId: patients[0].id, userId: demoCaregiver.id },
  });
  if (!caregiverOnTeam) {
    await prisma.careTeamMember.create({
      data: { patientId: patients[0].id, userId: demoCaregiver.id, roleOnCase: "caregiver" },
    });
  }
  console.log(`Demo caregiver ready: ${demoCaregiver.email}`);

  {
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: ORG_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const soon = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const later = new Date(Date.now() + 36 * 60 * 60 * 1000);
    const near = await prisma.visit.findMany({
      where: { clinicianId: demoCaregiver.id, scheduledStart: { gte: soon, lte: later } },
      select: { scheduledStart: true },
    });
    const hasToday = near.some(
      (v) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: ORG_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(v.scheduledStart) === todayKey,
    );
    if (!hasToday) {
      for (const def of [
        { time: "09:00", minutes: 60 },
        { time: "13:00", minutes: 60 },
        { time: "16:30", minutes: 45 },
      ]) {
        const start = orgLocalToUtc(`${todayKey}T${def.time}`);
        if (!start) throw new Error("Seed produced an invalid visit date");
        await prisma.visit.create({
          data: {
            organizationId: org.id,
            patientId: patients[0].id,
            clinicianId: demoCaregiver.id,
            scheduledById: demoAdmin.id,
            visitType: "home_health_aide",
            status: "scheduled",
            scheduledStart: start,
            scheduledEnd: new Date(start.getTime() + def.minutes * 60000),
          },
        });
      }
      console.log("3 synthetic visits today ready for the demo caregiver");
    }

    const caregiverTasks = await prisma.task.count({ where: { assigneeId: demoCaregiver.id } });
    if (caregiverTasks === 0) {
      const day = (n: number) => {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() + n);
        return d;
      };
      await prisma.task.createMany({
        data: [
          {
            organizationId: org.id,
            patientId: patients[0].id,
            assigneeId: demoCaregiver.id,
            createdById: demoAdmin.id,
            title: "Walk to the mailbox and back with the walker",
            details: "Synthetic demo task.",
            dueDate: day(0),
          },
          {
            organizationId: org.id,
            patientId: patients[0].id,
            assigneeId: demoCaregiver.id,
            createdById: demoAdmin.id,
            title: "Check that the floors are clear of loose rugs and cords",
            details: "Synthetic demo task.",
            dueDate: day(1),
          },
        ],
      });
      console.log("2 synthetic checklist tasks ready for the demo caregiver");
    }
  }

  // --- A demo patient account ---
  // Exists so the patient portal (/my-care) can be clicked through. The
  // account is linked to Eleanor Whitfield's record, so it shows her care
  // and nobody else's. The link is only made when the record has none.
  const patientRoleRow = roleRows.get("PATIENT")!;
  const demoPatientUser = await prisma.user.upsert({
    where: { email: "demo.patient@cheliv.test" },
    update: {},
    create: {
      organizationId: org.id,
      email: "demo.patient@cheliv.test",
      passwordHash: demoPasswordHash, // same demo password, see docs/DEMO_ACCOUNTS.md
      name: "Eleanor Whitfield",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoPatientUser.id, roleId: patientRoleRow.id } },
    update: {},
    create: { userId: demoPatientUser.id, roleId: patientRoleRow.id },
  });
  const eleanorRecord = await prisma.patient.findUniqueOrThrow({ where: { id: patients[0].id } });
  if (!eleanorRecord.userId) {
    await prisma.patient.update({
      where: { id: eleanorRecord.id },
      data: { userId: demoPatientUser.id },
    });
  }
  console.log(`Demo patient ready: ${demoPatientUser.email}`);

  {
    // Two visits ahead for her (tomorrow and the day after), created only
    // when she has fewer than two coming up, so the portal has something to
    // show on any day the seed is run.
    const ahead = await prisma.visit.count({
      where: { patientId: eleanorRecord.id, status: "scheduled", scheduledStart: { gt: new Date() } },
    });
    if (ahead < 2) {
      const dayKey = (n: number) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: ORG_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(Date.now() + n * 24 * 60 * 60 * 1000));
      for (const def of [
        { n: 1, time: "10:00", minutes: 60, clinician: demoNurse.id, type: "skilled_nursing" },
        { n: 2, time: "14:00", minutes: 60, clinician: demoCaregiver.id, type: "home_health_aide" },
      ]) {
        const start = orgLocalToUtc(`${dayKey(def.n)}T${def.time}`);
        if (!start) throw new Error("Seed produced an invalid visit date");
        await prisma.visit.create({
          data: {
            organizationId: org.id,
            patientId: eleanorRecord.id,
            clinicianId: def.clinician,
            scheduledById: demoAdmin.id,
            visitType: def.type,
            status: "scheduled",
            scheduledStart: start,
            scheduledEnd: new Date(start.getTime() + def.minutes * 60000),
          },
        });
      }
      console.log("2 synthetic upcoming visits ready for the demo patient");
    }
  }

  // --- A demo family account ---
  // Exists so the family portal (/family) can be clicked through. The
  // patient (Eleanor) has chosen to share her visit schedule and her care
  // team with her daughter, and NOT her care plan, so the screen shows
  // both a shared part and a part that says "not shared". The consent is
  // only made when the daughter has none in force for Eleanor.
  const familyRoleRow = roleRows.get("AUTHORIZED_FAMILY")!;
  const demoFamilyUser = await prisma.user.upsert({
    where: { email: "demo.family@cheliv.test" },
    update: {},
    create: {
      organizationId: org.id,
      email: "demo.family@cheliv.test",
      passwordHash: demoPasswordHash, // same demo password, see docs/DEMO_ACCOUNTS.md
      name: "Claire Whitfield",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoFamilyUser.id, roleId: familyRoleRow.id } },
    update: {},
    create: { userId: demoFamilyUser.id, roleId: familyRoleRow.id },
  });
  const consentNow = new Date();
  const eleanorConsent = await prisma.familyConsent.count({
    where: {
      patientId: eleanorRecord.id,
      familyUserId: demoFamilyUser.id,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: consentNow } }],
    },
  });
  if (eleanorConsent === 0) {
    await prisma.familyConsent.create({
      data: {
        organizationId: org.id,
        patientId: eleanorRecord.id,
        familyUserId: demoFamilyUser.id,
        relationship: "adult_child",
        scopes: ["visits", "care_team"],
        grantedById: demoAdmin.id,
        expiresAt: null,
      },
    });
    console.log("1 synthetic family permission ready for the demo family account");
  }
  console.log(`Demo family member ready: ${demoFamilyUser.email}`);

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
