// scripts/verify-access.ts
//
// Proves the access rules actually hold, by trying to break them.
//
// Reading code and believing it is not the same as watching it refuse.
// This script signs in nobody and clicks nothing - it calls the same
// service functions the pages and server actions call (src/lib/visits.ts,
// src/lib/care-plans.ts, src/lib/documents.ts, src/lib/patients.ts) as different people, and checks that every action
// that SHOULD be refused IS refused, and every action that should work
// does. Then it deletes everything it created.
//
// Run it:   npm run verify:access
//
// It needs the demo data (npx prisma db seed) so the three demo accounts
// exist. It creates a temporary patient and several temporary staff accounts for
// the mutation tests, and removes them - and their audit entries - at the
// end, even when a check fails.
//
// SAFETY: it refuses to run unless DATABASE_URL points at this machine.
// It creates and deletes rows; it must never run against anything real.

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getAccessiblePatients } from "@/lib/patients";
import {
  changeVisitStatus,
  getSchedulingOptions,
  listVisits,
  scheduleVisit,
  type ScheduleVisitInput,
} from "@/lib/visits";
import {
  addGoal,
  changePlanStatus,
  createCarePlan,
  getPlanCreateOptions,
  listCarePlans,
  markGoalMet,
  removeGoal,
  updateCarePlan,
} from "@/lib/care-plans";
import {
  GOAL_MAX,
  MAX_GOALS_PER_PLAN,
  SUMMARY_MAX,
  TITLE_MAX,
} from "@/lib/care-plan-constants";
import {
  archiveDocument,
  getDocumentForDownload,
  getDocumentUploadOptions,
  listDocuments,
  uploadDocument,
} from "@/lib/documents";
import {
  MAX_DOCUMENT_BYTES,
  TITLE_MAX as DOC_TITLE_MAX,
  isRestrictedCategory,
} from "@/lib/document-constants";
import { makeDemoPdf } from "../prisma/demo-pdf";
import { ORG_TIMEZONE, orgLocalToUtc } from "@/lib/time";

// ---------- tiny test harness ----------

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

async function throwsAuthorization(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (err) {
    return err instanceof AuthorizationError;
  }
}

function errorOf(result: { ok: boolean; error?: string }): string {
  return result.ok ? "" : (result.error ?? "");
}

// "YYYY-MM-DD" for N days from today, in office time.
function orgDay(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ORG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

// ---------- main ----------

async function main() {
  // Safety: never run against anything but a local database.
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(dbUrl)) {
    console.error(
      "Refusing to run: DATABASE_URL does not point at localhost. " +
        "This script creates and deletes rows, so it only runs against a local development database.",
    );
    process.exit(2);
  }

  const runId = Date.now().toString(36);
  console.log(`Access verification, run ${runId}`);

  // ----- 1. Time conversion -----
  section("1. Office time to UTC (Texas, including daylight saving)");
  const iso = (s: string) => orgLocalToUtc(s)?.toISOString() ?? "null";
  check("summer time (CDT, UTC-5)", iso("2026-07-01T10:00") === "2026-07-01T15:00:00.000Z", iso("2026-07-01T10:00"));
  check("winter time (CST, UTC-6)", iso("2026-12-01T10:00") === "2026-12-01T16:00:00.000Z", iso("2026-12-01T10:00"));
  check("just before clocks go forward (Mar 8 2026, 1:30 CST)", iso("2026-03-08T01:30") === "2026-03-08T07:30:00.000Z", iso("2026-03-08T01:30"));
  check("just after clocks go forward (Mar 8 2026, 3:30 CDT)", iso("2026-03-08T03:30") === "2026-03-08T08:30:00.000Z", iso("2026-03-08T03:30"));
  check("day before clocks go back (Oct 31 2026, noon CDT)", iso("2026-10-31T12:00") === "2026-10-31T17:00:00.000Z", iso("2026-10-31T12:00"));
  check("day clocks go back (Nov 1 2026, noon CST)", iso("2026-11-01T12:00") === "2026-11-01T18:00:00.000Z", iso("2026-11-01T12:00"));
  check("rejects Feb 30", orgLocalToUtc("2026-02-30T10:00") === null);
  check("rejects 25:00", orgLocalToUtc("2026-06-01T25:00") === null);
  check("rejects nonsense", orgLocalToUtc("next tuesday") === null);

  // ----- 2. Demo accounts and reading -----
  section("2. Reading: who sees which patients and visits (demo accounts)");
  const [admin, nurse1, nurse2] = await Promise.all(
    ["demo.admin@cheliv.test", "demo.nurse@cheliv.test", "demo.nurse2@cheliv.test"].map((email) =>
      prisma.user.findUnique({ where: { email } }),
    ),
  );
  if (!admin || !nurse1 || !nurse2) {
    console.error(
      "\nThe demo accounts are missing. Run: npx prisma db seed\n" +
        "(needs demo.admin, demo.nurse and demo.nurse2)",
    );
    process.exit(2);
  }
  const orgId = admin.organizationId;

  const assignedIds = async (userId: string) =>
    (
      await prisma.careTeamMember.findMany({
        where: { userId, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
        select: { patientId: true },
      })
    ).map((m) => m.patientId);

  const totalPatients = await prisma.patient.count({ where: { organizationId: orgId } });
  const adminPatients = await getAccessiblePatients(admin.id);
  check("admin sees every patient in the organization", adminPatients.length === totalPatients, `${adminPatients.length} of ${totalPatients}`);

  for (const [label, nurse] of [["nurse one", nurse1], ["nurse two", nurse2]] as const) {
    const mine = await assignedIds(nurse.id);
    const seen = (await getAccessiblePatients(nurse.id)).map((p) => p.id);
    check(`${label} sees exactly their assigned patients`, seen.length === mine.length && seen.every((id) => mine.includes(id)), `sees ${seen.length}, assigned ${mine.length}`);
    check(`${label} does not see every patient`, seen.length < totalPatients);
  }

  const totalVisits = await prisma.visit.count({ where: { organizationId: orgId } });
  const adminLists = await listVisits(admin.id);
  const adminVisitIds = [...adminLists.upcoming, ...adminLists.recent].map((v) => v.id);
  check("admin sees every visit in the organization", adminVisitIds.length === totalVisits, `${adminVisitIds.length} of ${totalVisits}`);

  for (const [label, nurse] of [["nurse one", nurse1], ["nurse two", nurse2]] as const) {
    const mine = await assignedIds(nurse.id);
    const lists = await listVisits(nurse.id);
    const rows = [...lists.upcoming, ...lists.recent];
    const expected = await prisma.visit.count({ where: { organizationId: orgId, patientId: { in: mine } } });
    check(`${label} sees only visits of their assigned patients`, rows.every((v) => mine.includes(v.patientId)));
    check(`${label} sees ALL visits of their assigned patients`, rows.length === expected, `${rows.length} of ${expected}`);
    check(`${label} can change only visits assigned to them`, rows.every((v) => v.canChange === (v.clinicianId === nurse.id)));
  }
  check("admin can change every visit", [...adminLists.upcoming, ...adminLists.recent].every((v) => v.canChange));

  // ----- 2b. Care plans: reading, with the demo accounts -----
  section("2b. Reading: who sees which care plans (demo accounts)");
  const totalPlans = await prisma.carePlan.count({ where: { organizationId: orgId } });
  const adminPlanLists = await listCarePlans(admin.id);
  const adminPlanIds = [...adminPlanLists.current, ...adminPlanLists.past].map((p) => p.id);
  check("admin sees every care plan in the organization", adminPlanIds.length === totalPlans, `${adminPlanIds.length} of ${totalPlans}`);
  for (const [label, nurse] of [["nurse one", nurse1], ["nurse two", nurse2]] as const) {
    const mine = await assignedIds(nurse.id);
    const lists = await listCarePlans(nurse.id);
    const rows = [...lists.current, ...lists.past];
    const expected = await prisma.carePlan.count({ where: { organizationId: orgId, patientId: { in: mine } } });
    check(`${label} sees only care plans of their assigned patients`, rows.every((p) => mine.includes(p.patientId)));
    check(`${label} sees ALL care plans of their assigned patients`, rows.length === expected, `${rows.length} of ${expected}`);
    check(`${label} cannot approve or complete anything`, rows.every((p) => !p.canApprove && !p.canComplete));
  }
  check("admin cannot edit any plan's wording (not on those care teams)", [...adminPlanLists.current, ...adminPlanLists.past].every((p) => !p.canEditContent && !p.canMarkGoals));

  // ----- 2c. Documents: reading, with the demo accounts -----
  section("2c. Reading: who sees which documents (demo accounts)");
  const totalDocs = await prisma.document.count({ where: { organizationId: orgId, status: "active" } });
  const adminDocs = await listDocuments(admin.id);
  check("admin sees every active document in the organization", adminDocs.length === totalDocs, `${adminDocs.length} of ${totalDocs}`);
  check("admin is offered Archive on every document", adminDocs.every((d) => d.canArchive));
  for (const [label, nurse] of [["nurse one", nurse1], ["nurse two", nurse2]] as const) {
    const mine = await assignedIds(nurse.id);
    const rows = await listDocuments(nurse.id);
    const theirs = await prisma.document.findMany({ where: { organizationId: orgId, status: "active", patientId: { in: mine } }, select: { id: true, category: true } });
    const expected = theirs.filter((d) => !isRestrictedCategory(d.category));
    const hidden = theirs.filter((d) => isRestrictedCategory(d.category));
    check(`${label} sees only documents of their assigned patients`, rows.every((d) => mine.includes(d.patientId)));
    check(`${label} sees NO restricted document`, rows.every((d) => !d.restricted && !isRestrictedCategory(d.category)));
    check(`${label} sees ALL the unrestricted documents of their patients`, rows.length === expected.length, `${rows.length} of ${expected.length}`);
    check(`${label} is not offered Archive`, rows.every((d) => !d.canArchive));
    const someoneElses = await prisma.document.findFirst({
      where: { organizationId: orgId, status: "active", patientId: { notIn: mine }, category: { in: ["consent_form", "physician_order", "care_correspondence"] } },
      select: { id: true },
    });
    if (someoneElses) {
      const tryOther = await getDocumentForDownload(nurse.id, someoneElses.id);
      check(`${label} cannot download a clinical document of a patient they are not assigned to`, !tryOther.ok && errorOf(tryOther).includes("could not be found"), errorOf(tryOther));
    }
    if (hidden.length > 0) {
      const tryHidden = await getDocumentForDownload(nurse.id, hidden[0].id);
      check(`${label} cannot download a restricted document on their own patient`, !tryHidden.ok && errorOf(tryHidden).includes("could not be found"), errorOf(tryHidden));
    }
  }

  // ----- 3. Temporary people and patient for mutation tests -----
  section("3. Setting up temporary test people and a temporary patient");
  const nurseRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "NURSE" } });
  const caregiverRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "CAREGIVER" } });

  const createdUserIds: string[] = [];
  const makeUser = async (tag: string, roleId: string) => {
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: `verify-${runId}-${tag}@cheliv.test`,
        passwordHash: "not-a-real-hash",
        name: `Verify ${tag.toUpperCase()}`,
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });
    createdUserIds.push(user.id);
    return user;
  };

  const trackedResourceIds: string[] = [];
  const visitIds: string[] = [];
  let patientId = "";

  try {
    const nurseA = await makeUser("a", nurseRole.id); // on the team
    const nurseB = await makeUser("b", nurseRole.id); // on the team, a colleague
    const nurseC = await makeUser("c", nurseRole.id); // NOT on the team
    const noPerms = await makeUser("none", caregiverRole.id); // holds no permissions at all

    const patient = await prisma.patient.create({
      data: { organizationId: orgId, firstName: "Verify", lastName: `Testpatient${runId}`, dateOfBirth: new Date("1950-01-01") },
    });
    patientId = patient.id;
    trackedResourceIds.push(patient.id);
    for (const nurse of [nurseA, nurseB]) {
      await prisma.careTeamMember.create({ data: { patientId: patient.id, userId: nurse.id, roleOnCase: "primary_nurse" } });
    }
    console.log("  ready: 3 nurses (A and B on the care team, C not), 1 account with no permissions, 1 patient");

    const tomorrow = orgDay(1);
    const base = (over: Partial<ScheduleVisitInput> = {}): ScheduleVisitInput => ({
      patientId: patient.id,
      clinicianId: nurseA.id,
      visitType: "skilled_nursing",
      startLocal: `${tomorrow}T12:00`,
      durationMinutes: 60,
      ...over,
    });
    const visitCountForPatient = () => prisma.visit.count({ where: { patientId: patient.id } });

    // ----- 4. Permission gate -----
    section("4. An account with no permissions is stopped before anything runs");
    check("cannot list visits", await throwsAuthorization(() => listVisits(noPerms.id)));
    check("cannot schedule a visit", await throwsAuthorization(() => scheduleVisit(noPerms.id, base())));
    check("cannot change a visit", await throwsAuthorization(() => changeVisitStatus(noPerms.id, "anything", "cancel")));
    check("gets no scheduling form", (await getSchedulingOptions(noPerms.id)) === null);
    const deniedCount = await prisma.auditLog.count({ where: { actorUserId: noPerms.id, action: "permission_denied", outcome: "denied" } });
    check("every refusal was written to the audit log", deniedCount >= 3, `${deniedCount} entries`);

    // ----- 5. Scheduling -----
    section("5. Scheduling: relationship and validation rules");

    const own = await scheduleVisit(nurseA.id, base());
    check("nurse on the team CAN schedule a visit for themselves", own.ok, errorOf(own));
    if (own.ok) { visitIds.push(own.value.visitId); trackedResourceIds.push(own.value.visitId); }

    const forColleague = await scheduleVisit(nurseA.id, base({ clinicianId: nurseB.id, startLocal: `${tomorrow}T15:00` }));
    check("nurse CANNOT schedule a visit for a colleague", !forColleague.ok);

    const outsider = await scheduleVisit(nurseC.id, base({ clinicianId: nurseC.id, startLocal: `${tomorrow}T16:00` }));
    check("nurse NOT on the team cannot schedule for that patient", !outsider.ok && errorOf(outsider).includes("do not have access"), errorOf(outsider));

    const forged = await scheduleVisit(nurseA.id, base({ patientId: "00000000-0000-0000-0000-00000000dead" }));
    check("a made-up patient id is refused like an inaccessible one", !forged.ok && errorOf(forged).includes("do not have access"), errorOf(forged));
    const forgedAdmin = await scheduleVisit(admin.id, base({ patientId: "00000000-0000-0000-0000-00000000dead" }));
    check("a made-up patient id is refused for an admin too", !forgedAdmin.ok, errorOf(forgedAdmin));
    trackedResourceIds.push("00000000-0000-0000-0000-00000000dead");

    const adminForB = await scheduleVisit(admin.id, base({ clinicianId: nurseB.id }));
    check("admin CAN schedule for any care team member", adminForB.ok, errorOf(adminForB));
    if (adminForB.ok) { visitIds.push(adminForB.value.visitId); trackedResourceIds.push(adminForB.value.visitId); }

    const adminForC = await scheduleVisit(admin.id, base({ clinicianId: nurseC.id, startLocal: `${tomorrow}T17:00` }));
    check("admin CANNOT assign someone who is not on the care team", !adminForC.ok && errorOf(adminForC).includes("care team"), errorOf(adminForC));

    const clash = await scheduleVisit(nurseA.id, base({ startLocal: `${tomorrow}T12:30` }));
    check("a clinician cannot be double-booked", !clash.ok && errorOf(clash).includes("already has a visit"), errorOf(clash));

    const back = await scheduleVisit(nurseA.id, base({ startLocal: `${tomorrow}T13:00` }));
    check("a visit starting exactly when another ends is fine", back.ok, errorOf(back));
    if (back.ok) { visitIds.push(back.value.visitId); trackedResourceIds.push(back.value.visitId); }

    const before = await visitCountForPatient();
    const bad: [string, ScheduleVisitInput][] = [
      ["unknown visit type", base({ visitType: "surgery", startLocal: `${tomorrow}T18:00` })],
      ["length not on the list", base({ durationMinutes: 999, startLocal: `${tomorrow}T18:00` })],
      ["impossible date", base({ startLocal: "2026-02-30T10:00" })],
      ["date years ahead", base({ startLocal: `${Number(tomorrow.slice(0, 4)) + 5}-06-01T10:00` })],
      ["date well in the past", base({ startLocal: `${orgDay(-10)}T10:00` })],
    ];
    for (const [label, input] of bad) {
      const r = await scheduleVisit(nurseA.id, input);
      check(`rejects: ${label}`, !r.ok);
    }
    check("none of the rejected requests created a visit", (await visitCountForPatient()) === before);

    await prisma.patient.update({ where: { id: patient.id }, data: { status: "on_hold" } });
    const held = await scheduleVisit(admin.id, base({ startLocal: `${tomorrow}T19:00` }));
    check("cannot schedule for a patient who is on hold", !held.ok && errorOf(held).includes("active"), errorOf(held));
    await prisma.patient.update({ where: { id: patient.id }, data: { status: "active" } });

    // ----- 6. Options offered to the form -----
    section("6. What the scheduling form is allowed to offer");
    const optsA = (await getSchedulingOptions(nurseA.id)) ?? [];
    const forPatientA = optsA.find((o) => o.patientId === patient.id);
    check("nurse is offered only themselves as clinician", forPatientA?.clinicians.length === 1 && forPatientA.clinicians[0].id === nurseA.id);
    check("nurse is offered only patients they are assigned to", optsA.every((o) => o.patientId === patient.id));
    const optsAdmin = (await getSchedulingOptions(admin.id)) ?? [];
    const forPatientAdmin = optsAdmin.find((o) => o.patientId === patient.id);
    const offered = forPatientAdmin?.clinicians.map((c) => c.id) ?? [];
    check("admin is offered the whole care team", offered.includes(nurseA.id) && offered.includes(nurseB.id));
    check("admin is not offered someone off the care team", !offered.includes(nurseC.id));
    check("someone off the team is offered nothing for this patient", ((await getSchedulingOptions(nurseC.id)) ?? []).every((o) => o.patientId !== patient.id));

    // ----- 7. Seeing a colleague's visit -----
    section("7. Reading a colleague's visit");
    const listB = await listVisits(nurseB.id);
    const rowOfA = [...listB.upcoming, ...listB.recent].find((v) => v.id === (own.ok ? own.value.visitId : ""));
    check("colleague on the team CAN see the visit", rowOfA !== undefined);
    check("...but cannot change it", rowOfA?.canChange === false);
    const listC = await listVisits(nurseC.id);
    check("nurse off the team does NOT see it", ![...listC.upcoming, ...listC.recent].some((v) => visitIds.includes(v.id)));

    // ----- 8. Changing status -----
    section("8. Changing a visit's status");
    const visitOfA = own.ok ? own.value.visitId : "";
    const visitOfB = adminForB.ok ? adminForB.value.visitId : "";

    const byColleague = await changeVisitStatus(nurseB.id, visitOfA, "cancel");
    check("colleague CANNOT cancel someone else's visit", !byColleague.ok && errorOf(byColleague).includes("assigned clinician"), errorOf(byColleague));
    const byOutsider = await changeVisitStatus(nurseC.id, visitOfA, "cancel");
    check("nurse off the team gets 'not found' for it", !byOutsider.ok && errorOf(byOutsider).includes("could not be found"), errorOf(byOutsider));
    const byForgedId = await changeVisitStatus(nurseA.id, "00000000-0000-0000-0000-00000000beef", "cancel");
    trackedResourceIds.push("00000000-0000-0000-0000-00000000beef");
    check("a made-up visit id looks exactly like an off-limits one", !byForgedId.ok && errorOf(byForgedId) === errorOf(byOutsider), errorOf(byForgedId));
    const badAction = await changeVisitStatus(nurseA.id, visitOfA, "delete_everything");
    check("an unknown action is refused", !badAction.ok);

    const skip = await changeVisitStatus(nurseA.id, visitOfA, "check_out");
    check("cannot check out a visit that never started", !skip.ok, errorOf(skip));
    const checkIn = await changeVisitStatus(nurseA.id, visitOfA, "check_in");
    check("assigned nurse CAN check in", checkIn.ok, errorOf(checkIn));
    const again = await changeVisitStatus(nurseA.id, visitOfA, "check_in");
    check("cannot check in twice", !again.ok);
    const cancelStarted = await changeVisitStatus(nurseA.id, visitOfA, "cancel");
    check("cannot cancel a visit already in progress", !cancelStarted.ok);
    const checkOut = await changeVisitStatus(nurseA.id, visitOfA, "check_out");
    check("assigned nurse CAN check out", checkOut.ok, errorOf(checkOut));
    const reopen = await changeVisitStatus(nurseA.id, visitOfA, "cancel");
    check("a completed visit is final", !reopen.ok);
    const stamps = await prisma.visit.findUniqueOrThrow({ where: { id: visitOfA } });
    check("check in and check out times were recorded", stamps.checkedInAt !== null && stamps.checkedOutAt !== null && stamps.status === "completed");

    const adminCancel = await changeVisitStatus(admin.id, visitOfB, "cancel");
    check("admin CAN cancel any visit", adminCancel.ok, errorOf(adminCancel));

    // ----- 9. Audit trail -----
    section("9. The audit trail recorded what happened");
    const auditFor = (action: string, actorUserId: string) =>
      prisma.auditLog.count({ where: { action, actorUserId } });
    check("visit_created logged", (await auditFor("visit_created", nurseA.id)) >= 1);
    check("visit_checked_in logged", (await auditFor("visit_checked_in", nurseA.id)) === 1);
    check("visit_checked_out logged", (await auditFor("visit_checked_out", nurseA.id)) === 1);
    check("visit_cancelled logged", (await auditFor("visit_cancelled", admin.id)) >= 1);
    check("nurse's attempt on a colleague's visit logged as denied", (await prisma.auditLog.count({ where: { actorUserId: nurseB.id, action: "access_denied", outcome: "denied" } })) >= 1);
    check("outsider's attempts logged as denied", (await prisma.auditLog.count({ where: { actorUserId: nurseC.id, action: "access_denied", outcome: "denied" } })) >= 2);

    // ----- 10. Care plans -----
    // Three questions are asked: permission, relationship, and (for
    // writing) being on THIS patient's care team. These checks try to
    // break each one. An ADMIN-role account holds approve but not
    // create/update; a SUPER_ADMIN holds everything but is only "on the
    // team" when assigned.
    const adminRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "ADMIN" } });
    const superRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "SUPER_ADMIN" } });
    const approver = await makeUser("approver", adminRole.id); // can approve, not on the team
    const superOnTeam = await makeUser("super", superRole.id); // holds everything AND is on the team
    await prisma.careTeamMember.create({ data: { patientId: patient.id, userId: superOnTeam.id, roleOnCase: "primary_nurse" } });

    const planInput = (over: Partial<{ patientId: string; title: string; summary: string }> = {}) => ({
      patientId: patient.id,
      title: "Steady recovery at home",
      summary: "Keep the patient safe and comfortable at home.",
      ...over,
    });
    const planStatus = async (id: string) => (await prisma.carePlan.findUniqueOrThrow({ where: { id } })).status;
    const planCount = () => prisma.carePlan.count({ where: { patientId: patient.id } });

    section("10a. Care plans: the permission gate");
    check("no-permission account cannot list plans", await throwsAuthorization(() => listCarePlans(noPerms.id)));
    check("no-permission account cannot create a plan", await throwsAuthorization(() => createCarePlan(noPerms.id, planInput())));
    check("no-permission account cannot approve a plan", await throwsAuthorization(() => changePlanStatus(noPerms.id, "anything", "approve")));
    check("no-permission account cannot discard a plan", await throwsAuthorization(() => changePlanStatus(noPerms.id, "anything", "discard")));
    check("no-permission account gets no create form", (await getPlanCreateOptions(noPerms.id)) === null);
    check("approver (no create permission) cannot create a plan", await throwsAuthorization(() => createCarePlan(approver.id, planInput())));
    check("approver (no update permission) cannot add a goal", await throwsAuthorization(() => addGoal(approver.id, "anything", "A goal")));
    check("approver gets no create form", (await getPlanCreateOptions(approver.id)) === null);
    check("nurse (no approve permission) cannot approve", await throwsAuthorization(() => changePlanStatus(nurseA.id, "anything", "approve")));
    check("nurse (no approve permission) cannot complete", await throwsAuthorization(() => changePlanStatus(nurseA.id, "anything", "complete")));

    section("10b. Care plans: writing needs relationship AND team membership");
    const before10 = await planCount();
    const offTeam = await createCarePlan(nurseC.id, planInput());
    check("nurse NOT on the team cannot start a plan", !offTeam.ok && errorOf(offTeam).includes("do not have access"), errorOf(offTeam));
    const forgedPatient = await createCarePlan(nurseA.id, planInput({ patientId: "00000000-0000-0000-0000-00000000dead" }));
    check("a made-up patient id is refused", !forgedPatient.ok && errorOf(forgedPatient).includes("do not have access"), errorOf(forgedPatient));
    const superOffTeam = await createCarePlan(admin.id, planInput());
    check("SUPER_ADMIN holds the permission and reaches the patient, but is NOT on the team: refused", !superOffTeam.ok && errorOf(superOffTeam).includes("care team"), errorOf(superOffTeam));
    check("none of those attempts created a plan", (await planCount()) === before10);

    const badPlans: [string, Partial<{ title: string; summary: string }>][] = [
      ["empty title", { title: "   " }],
      ["empty summary", { summary: "" }],
      [`title over ${TITLE_MAX} characters`, { title: "x".repeat(TITLE_MAX + 1) }],
      [`summary over ${SUMMARY_MAX} characters`, { summary: "x".repeat(SUMMARY_MAX + 1) }],
    ];
    for (const [label, over] of badPlans) {
      const r = await createCarePlan(nurseA.id, planInput(over));
      check(`rejects: ${label}`, !r.ok);
    }
    check("none of the rejected plans were created", (await planCount()) === before10);

    await prisma.patient.update({ where: { id: patient.id }, data: { status: "on_hold" } });
    const heldPlan = await createCarePlan(nurseA.id, planInput());
    check("cannot start a plan for a patient who is on hold", !heldPlan.ok && errorOf(heldPlan).includes("active"), errorOf(heldPlan));
    await prisma.patient.update({ where: { id: patient.id }, data: { status: "active" } });

    const optsPlanA = (await getPlanCreateOptions(nurseA.id)) ?? [];
    check("nurse on the team is offered this patient", optsPlanA.some((o) => o.patientId === patient.id));
    check("nurse is offered only patients they are on the team of", optsPlanA.every((o) => o.patientId === patient.id));
    check("nurse off the team is offered nothing for this patient", ((await getPlanCreateOptions(nurseC.id)) ?? []).every((o) => o.patientId !== patient.id));
    check("SUPER_ADMIN off the team is offered nothing", ((await getPlanCreateOptions(admin.id)) ?? []).every((o) => o.patientId !== patient.id));

    const d1 = await createCarePlan(nurseA.id, planInput());
    check("nurse on the team CAN start a draft", d1.ok, errorOf(d1));
    const d1Id = d1.ok ? d1.value.planId : "";
    trackedResourceIds.push(d1Id);
    const secondDraft = await createCarePlan(nurseB.id, planInput({ title: "A second draft" }));
    check("a patient cannot have two drafts at once", !secondDraft.ok && errorOf(secondDraft).includes("already has a draft"), errorOf(secondDraft));
    check("nurse is no longer offered this patient while a draft exists", ((await getPlanCreateOptions(nurseA.id)) ?? []).every((o) => o.patientId !== patient.id));

    section("10c. Care plans: editing a draft is a team job");
    const edit = await updateCarePlan(nurseB.id, d1Id, { title: "Steady recovery at home (revised)", summary: "Revised by a colleague." });
    check("a colleague on the team CAN edit the draft", edit.ok, errorOf(edit));
    const editOutsider = await updateCarePlan(nurseC.id, d1Id, { title: "Hijacked", summary: "Hijacked" });
    check("nurse off the team gets 'not found' for it", !editOutsider.ok && errorOf(editOutsider).includes("could not be found"), errorOf(editOutsider));
    const editAdmin = await updateCarePlan(admin.id, d1Id, { title: "Hijacked", summary: "Hijacked" });
    check("SUPER_ADMIN off the team cannot edit the wording", !editAdmin.ok && errorOf(editAdmin).includes("care team"), errorOf(editAdmin));
    const editForged = await updateCarePlan(nurseA.id, "00000000-0000-0000-0000-00000000beef", { title: "x", summary: "x" });
    trackedResourceIds.push("00000000-0000-0000-0000-00000000beef");
    check("a made-up plan id looks exactly like an off-limits one", !editForged.ok && errorOf(editForged) === errorOf(editOutsider), errorOf(editForged));
    const editBad = await updateCarePlan(nurseA.id, d1Id, { title: "", summary: "still here" });
    check("an edit with an empty title is rejected", !editBad.ok);
    const afterEdits = await prisma.carePlan.findUniqueOrThrow({ where: { id: d1Id } });
    check("only the legitimate edit took effect", afterEdits.title === "Steady recovery at home (revised)" && afterEdits.summary === "Revised by a colleague.");

    section("10d. Care plans: approval rules");
    const noGoalsYet = await changePlanStatus(approver.id, d1Id, "approve");
    check("a plan with no goals cannot be approved", !noGoalsYet.ok && errorOf(noGoalsYet).includes("at least one goal"), errorOf(noGoalsYet));

    const g1 = await addGoal(nurseA.id, d1Id, "Walk to the mailbox and back twice a week.");
    check("nurse on the team CAN add a goal", g1.ok, errorOf(g1));
    const g2 = await addGoal(nurseB.id, d1Id, "Take every medicine on time.");
    check("a colleague on the team CAN add a goal", g2.ok, errorOf(g2));
    const goalOutsider = await addGoal(nurseC.id, d1Id, "Sneaky goal");
    check("nurse off the team cannot add a goal", !goalOutsider.ok && errorOf(goalOutsider).includes("could not be found"), errorOf(goalOutsider));
    const goalAdmin = await addGoal(admin.id, d1Id, "Sneaky goal");
    check("SUPER_ADMIN off the team cannot add a goal", !goalAdmin.ok && errorOf(goalAdmin).includes("care team"), errorOf(goalAdmin));
    check("empty goal rejected", !(await addGoal(nurseA.id, d1Id, "  ")).ok);
    check(`goal over ${GOAL_MAX} characters rejected`, !(await addGoal(nurseA.id, d1Id, "x".repeat(GOAL_MAX + 1))).ok);

    const removeOutsider = await removeGoal(nurseC.id, g2.ok ? g2.value.goalId : "");
    check("nurse off the team cannot remove a goal", !removeOutsider.ok && errorOf(removeOutsider).includes("could not be found"), errorOf(removeOutsider));
    const extra = await addGoal(nurseA.id, d1Id, "A goal that will be removed.");
    const removed = await removeGoal(nurseB.id, extra.ok ? extra.value.goalId : "");
    check("a colleague on the team CAN remove a goal from a draft", removed.ok, errorOf(removed));

    // Fill the plan to the cap, then prove the next goal is refused.
    let addedToCap = 0;
    for (let i = 0; i < MAX_GOALS_PER_PLAN; i++) {
      const r = await addGoal(nurseA.id, d1Id, `Extra goal ${i + 1}`);
      if (r.ok) addedToCap++;
    }
    const goalTotal = await prisma.carePlanGoal.count({ where: { carePlanId: d1Id } });
    check(`a plan holds at most ${MAX_GOALS_PER_PLAN} goals`, goalTotal === MAX_GOALS_PER_PLAN && addedToCap === MAX_GOALS_PER_PLAN - 2, `${goalTotal} goals, ${addedToCap} added`);
    // trim back down so later checks stay readable
    const spare = await prisma.carePlanGoal.findMany({ where: { carePlanId: d1Id, description: { startsWith: "Extra goal" } }, select: { id: true } });
    await prisma.carePlanGoal.deleteMany({ where: { id: { in: spare.map((g) => g.id) } } });

    const approveByNurse = await throwsAuthorization(() => changePlanStatus(nurseB.id, d1Id, "approve"));
    check("a nurse on the team cannot approve (no approve permission)", approveByNurse);
    const approveOutsider = await changePlanStatus(approver.id, "00000000-0000-0000-0000-00000000cafe", "approve");
    trackedResourceIds.push("00000000-0000-0000-0000-00000000cafe");
    check("approving a made-up plan id is refused as not found", !approveOutsider.ok && errorOf(approveOutsider).includes("could not be found"), errorOf(approveOutsider));
    const badPlanAction = await changePlanStatus(approver.id, d1Id, "delete_everything");
    check("an unknown action is refused", !badPlanAction.ok);
    const skipComplete = await changePlanStatus(approver.id, d1Id, "complete");
    check("cannot complete a plan that was never approved", !skipComplete.ok, errorOf(skipComplete));

    const approved = await changePlanStatus(approver.id, d1Id, "approve");
    check("an approver who did not write it CAN approve", approved.ok, errorOf(approved));
    const d1Row = await prisma.carePlan.findUniqueOrThrow({ where: { id: d1Id } });
    check("approval recorded who and when", d1Row.status === "active" && d1Row.approvedById === approver.id && d1Row.approvedAt !== null);
    const approveTwice = await changePlanStatus(approver.id, d1Id, "approve");
    check("cannot approve twice", !approveTwice.ok);

    section("10e. Care plans: an approved plan is locked");
    const lockedEdit = await updateCarePlan(nurseA.id, d1Id, { title: "Quiet change", summary: "Quiet change" });
    check("the wording of an active plan cannot be edited", !lockedEdit.ok && errorOf(lockedEdit).includes("locked"), errorOf(lockedEdit));
    const lockedAdd = await addGoal(nurseA.id, d1Id, "A late goal");
    check("goals cannot be added to an active plan", !lockedAdd.ok, errorOf(lockedAdd));
    const anyGoal = await prisma.carePlanGoal.findFirstOrThrow({ where: { carePlanId: d1Id }, orderBy: { position: "asc" } });
    const lockedRemove = await removeGoal(nurseA.id, anyGoal.id);
    check("goals cannot be removed from an active plan", !lockedRemove.ok, errorOf(lockedRemove));
    const lockedDiscard = await changePlanStatus(nurseA.id, d1Id, "discard");
    check("an active plan cannot be discarded", !lockedDiscard.ok, errorOf(lockedDiscard));
    const still = await prisma.carePlan.findUniqueOrThrow({ where: { id: d1Id }, include: { goals: true } });
    check("nothing about the active plan changed", still.title === "Steady recovery at home (revised)" && still.goals.length === 2);

    const metOutsider = await markGoalMet(nurseC.id, anyGoal.id);
    check("nurse off the team cannot mark a goal met", !metOutsider.ok && errorOf(metOutsider).includes("could not be found"), errorOf(metOutsider));
    const metAdmin = await markGoalMet(admin.id, anyGoal.id);
    check("SUPER_ADMIN off the team cannot mark a goal met", !metAdmin.ok && errorOf(metAdmin).includes("care team"), errorOf(metAdmin));
    const met = await markGoalMet(nurseB.id, anyGoal.id);
    check("a colleague on the team CAN mark a goal met", met.ok, errorOf(met));
    const metAgain = await markGoalMet(nurseA.id, anyGoal.id);
    check("a goal cannot be marked met twice", !metAgain.ok, errorOf(metAgain));
    const metRow = await prisma.carePlanGoal.findUniqueOrThrow({ where: { id: anyGoal.id } });
    check("the met time was recorded", metRow.status === "met" && metRow.metAt !== null);

    section("10f. Care plans: the four-eyes rule and one active plan");
    const d2 = await createCarePlan(superOnTeam.id, planInput({ title: "Next stage of care" }));
    check("a draft CAN be written while another plan is active", d2.ok, errorOf(d2));
    const d2Id = d2.ok ? d2.value.planId : "";
    trackedResourceIds.push(d2Id);
    const d2goal = await addGoal(superOnTeam.id, d2Id, "Keep up the daily exercises.");
    check("the author adds a goal to their own draft", d2goal.ok, errorOf(d2goal));

    const selfApprove = await changePlanStatus(superOnTeam.id, d2Id, "approve");
    check("the author CANNOT approve their own plan, even holding every permission", !selfApprove.ok && errorOf(selfApprove).includes("cannot approve a plan you wrote"), errorOf(selfApprove));
    check("the plan is still a draft after the attempt", (await planStatus(d2Id)) === "draft");
    const blocked = await changePlanStatus(approver.id, d2Id, "approve");
    check("a second plan cannot become active while one already is", !blocked.ok && errorOf(blocked).includes("already has an active"), errorOf(blocked));
    check("the plan is still a draft after that too", (await planStatus(d2Id)) === "draft");

    const completeByNurse = await throwsAuthorization(() => changePlanStatus(nurseA.id, d1Id, "complete"));
    check("a nurse cannot complete a plan", completeByNurse);
    const completeOutsider = await changePlanStatus(approver.id, "00000000-0000-0000-0000-00000000f00d", "complete");
    trackedResourceIds.push("00000000-0000-0000-0000-00000000f00d");
    check("completing a made-up plan id is refused as not found", !completeOutsider.ok);
    const completed = await changePlanStatus(approver.id, d1Id, "complete");
    check("an approver CAN complete the active plan", completed.ok, errorOf(completed));
    const completedRow = await prisma.carePlan.findUniqueOrThrow({ where: { id: d1Id } });
    check("completion recorded when", completedRow.status === "completed" && completedRow.completedAt !== null);
    const reopenPlan = await changePlanStatus(approver.id, d1Id, "approve");
    check("a completed plan is final", !reopenPlan.ok, errorOf(reopenPlan));
    const metLate = await markGoalMet(nurseA.id, anyGoal.id);
    check("goals of a completed plan can no longer change", !metLate.ok, errorOf(metLate));

    const approveNext = await changePlanStatus(approver.id, d2Id, "approve");
    check("once the old plan is complete, the next one CAN be approved", approveNext.ok, errorOf(approveNext));

    section("10g. Care plans: discarding a draft");
    const d3 = await createCarePlan(nurseA.id, planInput({ title: "A draft to throw away" }));
    check("a new draft CAN be started while a plan is active", d3.ok, errorOf(d3));
    const d3Id = d3.ok ? d3.value.planId : "";
    trackedResourceIds.push(d3Id);
    const discardOutsider = await changePlanStatus(nurseC.id, d3Id, "discard");
    check("nurse off the team gets 'not found' trying to discard", !discardOutsider.ok && errorOf(discardOutsider).includes("could not be found"), errorOf(discardOutsider));
    const discard = await changePlanStatus(nurseB.id, d3Id, "discard");
    check("a nurse on the team CAN discard a draft", discard.ok, errorOf(discard));
    check("the draft is now archived", (await planStatus(d3Id)) === "archived");
    const approveDiscarded = await changePlanStatus(approver.id, d3Id, "approve");
    check("a discarded plan is final", !approveDiscarded.ok, errorOf(approveDiscarded));

    const d4 = await createCarePlan(nurseA.id, planInput({ title: "Another draft" }));
    const d4Id = d4.ok ? d4.value.planId : "";
    if (d4.ok) trackedResourceIds.push(d4Id);
    const discardByApprover = await changePlanStatus(approver.id, d4Id, "discard");
    check("an approver CAN discard a draft they are not on the team for", discardByApprover.ok, errorOf(discardByApprover));

    section("10h. Care plans: what each person is shown");
    const d5 = await createCarePlan(nurseA.id, planInput({ title: "Draft for the flag checks" }));
    const d5Id = d5.ok ? d5.value.planId : "";
    if (d5.ok) trackedResourceIds.push(d5Id);
    await addGoal(nurseA.id, d5Id, "A goal.");
    const flagsOf = async (userId: string, planId: string) => {
      const lists = await listCarePlans(userId);
      return [...lists.current, ...lists.past].find((p) => p.id === planId);
    };
    const asAuthor = await flagsOf(nurseA.id, d5Id);
    check("author sees edit controls, but NOT approve", asAuthor?.canEditContent === true && asAuthor.canApprove === false && asAuthor.canDiscard === true);
    const asColleague = await flagsOf(nurseB.id, d5Id);
    check("a colleague on the team sees edit controls too", asColleague?.canEditContent === true);
    const asApprover = await flagsOf(approver.id, d5Id);
    check("an approver sees approve and discard, but NOT edit", asApprover?.canApprove === true && asApprover.canDiscard === true && asApprover.canEditContent === false);
    check("nurse off the team does not see the plan at all", (await flagsOf(nurseC.id, d5Id)) === undefined);
    const activeD2 = await flagsOf(approver.id, d2Id);
    check("an approver sees Complete on the active plan", activeD2?.canComplete === true && activeD2.canApprove === false);
    const activeD2Team = await flagsOf(nurseA.id, d2Id);
    check("the team can mark goals met on the active plan but not edit it", activeD2Team?.canMarkGoals === true && activeD2Team.canEditContent === false);
    check("the completed plan offers nothing to anyone", await (async () => {
      const r = await flagsOf(approver.id, d1Id);
      return r !== undefined && !r.canApprove && !r.canComplete && !r.canDiscard && !r.canEditContent && !r.canMarkGoals;
    })());

    section("10i. Care plans: the audit trail");
    const auditFor2 = (action: string, actorUserId: string) => prisma.auditLog.count({ where: { action, actorUserId } });
    check("care_plan_created logged", (await auditFor2("care_plan_created", nurseA.id)) >= 1);
    check("care_plan_updated logged", (await auditFor2("care_plan_updated", nurseB.id)) === 1);
    check("care_plan_goal_added logged", (await auditFor2("care_plan_goal_added", nurseA.id)) >= 1);
    check("care_plan_goal_removed logged", (await auditFor2("care_plan_goal_removed", nurseB.id)) === 1);
    check("care_plan_goal_met logged", (await auditFor2("care_plan_goal_met", nurseB.id)) === 1);
    check("care_plan_approved logged", (await auditFor2("care_plan_approved", approver.id)) === 2);
    check("care_plan_completed logged", (await auditFor2("care_plan_completed", approver.id)) === 1);
    check("care_plan_discarded logged", (await auditFor2("care_plan_discarded", nurseB.id)) === 1);
    check("the self-approval attempt is on record as denied", (await prisma.auditLog.count({ where: { actorUserId: superOnTeam.id, action: "access_denied", outcome: "denied" } })) >= 1);
    check("the outsider's attempts are on record as denied", (await prisma.auditLog.count({ where: { actorUserId: nurseC.id, action: "access_denied", outcome: "denied" } })) >= 8);
    check("SUPER_ADMIN's off-team writes are on record as denied", (await prisma.auditLog.count({ where: { actorUserId: admin.id, action: "access_denied", outcome: "denied", resourceId: { in: trackedResourceIds } } })) >= 3);
    check("permission refusals are on record", (await prisma.auditLog.count({ where: { actorUserId: approver.id, action: "permission_denied", outcome: "denied" } })) >= 2);

    // ----- 11. Documents -----
    // Three questions: permission, relationship, and CATEGORY. Insurance
    // and identification documents are restricted to administrative
    // roles. approver (ADMIN role) holds read and upload but not delete;
    // admin (SUPER_ADMIN) holds delete too.
    const pdf = (title: string) => makeDemoPdf(`${title} ${runId}`);
    const pdfConsent = pdf("Consent");
    const pdfOrder = pdf("Order");
    const pdfInsurance = pdf("Insurance");
    const pdfId = pdf("Identification");
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3]);
    const docInput = (over: Partial<{ patientId: string; category: string; title: string; fileName: string; bytes: Uint8Array }> = {}) => ({
      patientId: patient.id,
      category: "consent_form",
      title: "Signed consent",
      fileName: "consent.pdf",
      bytes: pdfConsent,
      ...over,
    });
    const activeDocCount = () => prisma.document.count({ where: { patientId: patient.id, status: "active" } });
    const idsIn = async (userId: string) => (await listDocuments(userId)).map((d) => d.id);
    const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

    section("11a. Documents: the permission gate");
    check("no-permission account cannot list documents", await throwsAuthorization(() => listDocuments(noPerms.id)));
    check("no-permission account cannot file a document", await throwsAuthorization(() => uploadDocument(noPerms.id, docInput())));
    check("no-permission account cannot download", await throwsAuthorization(() => getDocumentForDownload(noPerms.id, "anything")));
    check("no-permission account cannot archive", await throwsAuthorization(() => archiveDocument(noPerms.id, "anything")));
    check("no-permission account gets no upload form", (await getDocumentUploadOptions(noPerms.id)) === null);
    check("a nurse (no documents.delete) cannot archive", await throwsAuthorization(() => archiveDocument(nurseA.id, "anything")));
    check("an ADMIN-role account (no documents.delete) cannot archive", await throwsAuthorization(() => archiveDocument(approver.id, "anything")));

    section("11b. Documents: filing needs relationship AND the right category");
    const docsBefore = await activeDocCount();
    const offTeamDoc = await uploadDocument(nurseC.id, docInput());
    check("nurse NOT on the team cannot file for that patient", !offTeamDoc.ok && errorOf(offTeamDoc).includes("do not have access"), errorOf(offTeamDoc));
    const forgedDocPatient = await uploadDocument(nurseA.id, docInput({ patientId: "00000000-0000-0000-0000-00000000dead" }));
    check("a made-up patient id is refused", !forgedDocPatient.ok && errorOf(forgedDocPatient).includes("do not have access"), errorOf(forgedDocPatient));
    const nurseInsurance = await uploadDocument(nurseA.id, docInput({ category: "insurance", bytes: pdfInsurance, title: "Insurance card" }));
    check("a nurse CANNOT file a restricted document (insurance)", !nurseInsurance.ok && errorOf(nurseInsurance).includes("cannot file that kind"), errorOf(nurseInsurance));
    const nurseIdentification = await uploadDocument(nurseA.id, docInput({ category: "identification", bytes: pdfId, title: "Photo ID" }));
    check("a nurse CANNOT file a restricted document (identification)", !nurseIdentification.ok && errorOf(nurseIdentification).includes("cannot file that kind"), errorOf(nurseIdentification));
    check("an unknown category is refused", !(await uploadDocument(nurseA.id, docInput({ category: "top_secret" }))).ok);
    check("none of those attempts filed anything", (await activeDocCount()) === docsBefore);

    const consent = await uploadDocument(nurseA.id, docInput());
    check("nurse on the team CAN file a clinical document", consent.ok, errorOf(consent));
    const consentId = consent.ok ? consent.value.documentId : "";
    trackedResourceIds.push(consentId);
    const order = await uploadDocument(nurseB.id, docInput({ category: "physician_order", title: "Physician order", fileName: "order.pdf", bytes: pdfOrder }));
    check("a colleague on the team CAN file one too", order.ok, errorOf(order));
    const orderId = order.ok ? order.value.documentId : "";
    trackedResourceIds.push(orderId);
    const insurance = await uploadDocument(approver.id, docInput({ category: "insurance", title: "Insurance card", fileName: "card.pdf", bytes: pdfInsurance }));
    check("an administrative role CAN file a restricted document", insurance.ok, errorOf(insurance));
    const insuranceId = insurance.ok ? insurance.value.documentId : "";
    trackedResourceIds.push(insuranceId);
    const ident = await uploadDocument(admin.id, docInput({ category: "identification", title: "Photo ID", fileName: "id.pdf", bytes: pdfId }));
    check("SUPER_ADMIN CAN file identification for a patient they are not on the team of", ident.ok, errorOf(ident));
    const identId = ident.ok ? ident.value.documentId : "";
    trackedResourceIds.push(identId);

    const png = await uploadDocument(nurseA.id, docInput({ category: "care_correspondence", title: "Scanned letter", fileName: "C:\\fakepath\\..\\scan.pdf", bytes: pngBytes }));
    check("a PNG is accepted", png.ok, errorOf(png));
    const pngId = png.ok ? png.value.documentId : "";
    trackedResourceIds.push(pngId);
    const pngRow = pngId ? await prisma.document.findUnique({ where: { id: pngId } }) : null;
    check("its type comes from its own bytes, not from the name it arrived with", pngRow?.contentType === "image/png");
    check("its stored name has no folders and the right extension", pngRow?.fileName === "scan.png", pngRow?.fileName);

    const beforeBad = await activeDocCount();
    const badDocs: [string, Parameters<typeof docInput>[0]][] = [
      ["empty title", { title: "  ", bytes: pdf("x1") }],
      [`title over ${DOC_TITLE_MAX} characters`, { title: "x".repeat(DOC_TITLE_MAX + 1), bytes: pdf("x2") }],
      ["empty file", { bytes: new Uint8Array(0) }],
      ["file over the size limit", { bytes: Object.assign(new Uint8Array(MAX_DOCUMENT_BYTES + 1), { 0: 0x25, 1: 0x50, 2: 0x44, 3: 0x46, 4: 0x2d }) }],
      ["a text file", { bytes: new TextEncoder().encode("just some words"), fileName: "notes.txt" }],
      ["a text file renamed .pdf", { bytes: new TextEncoder().encode("just some words"), fileName: "letter.pdf" }],
      ["a script renamed .pdf", { bytes: new TextEncoder().encode("<script>alert(1)</script>"), fileName: "invoice.pdf" }],
    ];
    for (const [label, over] of badDocs) {
      const r = await uploadDocument(nurseA.id, docInput(over));
      check(`rejects: ${label}`, !r.ok);
    }
    check("none of the rejected files were filed", (await activeDocCount()) === beforeBad);

    const dup = await uploadDocument(nurseB.id, docInput({ title: "Same file again", fileName: "again.pdf" }));
    check("the exact same file cannot be filed twice for a patient", !dup.ok && errorOf(dup).includes("already on file"), errorOf(dup));

    await prisma.patient.update({ where: { id: patient.id }, data: { status: "on_hold" } });
    const heldDoc = await uploadDocument(approver.id, docInput({ title: "Held", bytes: pdf("held") }));
    check("cannot file for a patient who is on hold", !heldDoc.ok && errorOf(heldDoc).includes("active"), errorOf(heldDoc));
    await prisma.patient.update({ where: { id: patient.id }, data: { status: "active" } });

    const optsDocA = (await getDocumentUploadOptions(nurseA.id)) ?? { patients: [], categories: [] };
    check("nurse is offered the patients they are assigned to", optsDocA.patients.some((p) => p.patientId === patient.id));
    check("nurse is offered ONLY the three clinical categories", optsDocA.categories.length === 3 && optsDocA.categories.every((c) => !isRestrictedCategory(c.key)));
    const optsDocApprover = (await getDocumentUploadOptions(approver.id)) ?? { patients: [], categories: [] };
    check("an administrative role is offered all five categories", optsDocApprover.categories.length === 5);
    check("nurse off the team is offered nothing for this patient", ((await getDocumentUploadOptions(nurseC.id)) ?? { patients: [] }).patients.every((p) => p.patientId !== patient.id));

    section("11c. Documents: who sees what is on file");
    const docListA = await idsIn(nurseA.id);
    check("nurse sees the consent, the order and the letter", [consentId, orderId, pngId].every((id) => docListA.includes(id)));
    check("nurse does NOT see the insurance card or the ID", !docListA.includes(insuranceId) && !docListA.includes(identId));
    const docListB = await idsIn(nurseB.id);
    check("a colleague on the team sees the same set", [consentId, orderId, pngId].every((id) => docListB.includes(id)) && !docListB.includes(insuranceId) && !docListB.includes(identId));
    const docListC = await idsIn(nurseC.id);
    check("nurse off the team sees none of this patient's documents", ![consentId, orderId, pngId, insuranceId, identId].some((id) => docListC.includes(id)));
    const listApprover = await idsIn(approver.id);
    check("an administrative role sees all five, restricted included", [consentId, orderId, pngId, insuranceId, identId].every((id) => listApprover.includes(id)));
    const listAdmin = await listDocuments(admin.id);
    check("SUPER_ADMIN sees all five and can archive", [consentId, orderId, pngId, insuranceId, identId].every((id) => listAdmin.some((d) => d.id === id && d.canArchive)));
    check("the restricted ones are labelled restricted", listAdmin.filter((d) => [insuranceId, identId].includes(d.id)).every((d) => d.restricted));

    section("11d. Documents: downloading is checked on its own");
    const downloadsBefore = await prisma.auditLog.count({ where: { action: "document_downloaded", actorUserId: nurseA.id } });
    const got = await getDocumentForDownload(nurseA.id, consentId);
    check("nurse on the team CAN download the consent", got.ok, errorOf(got));
    check("the bytes that come back are exactly the bytes that went in", got.ok && same(got.value.bytes, pdfConsent));
    check("it comes back typed as a PDF with a clean name", got.ok && got.value.contentType === "application/pdf" && got.value.fileName === "consent.pdf");
    const gotByColleague = await getDocumentForDownload(nurseB.id, consentId);
    check("a colleague on the team CAN download it too", gotByColleague.ok, errorOf(gotByColleague));
    const restrictedDl = await getDocumentForDownload(nurseA.id, insuranceId);
    check("nurse CANNOT download a restricted document, even on their own patient", !restrictedDl.ok && errorOf(restrictedDl).includes("could not be found"), errorOf(restrictedDl));
    const forgedDl = await getDocumentForDownload(nurseA.id, "00000000-0000-0000-0000-00000000f11e");
    trackedResourceIds.push("00000000-0000-0000-0000-00000000f11e");
    check("a restricted document looks exactly like one that does not exist", !forgedDl.ok && errorOf(forgedDl) === errorOf(restrictedDl), errorOf(forgedDl));
    const outsiderDl = await getDocumentForDownload(nurseC.id, consentId);
    check("nurse off the team gets the same 'not found'", !outsiderDl.ok && errorOf(outsiderDl) === errorOf(restrictedDl), errorOf(outsiderDl));
    const adminRestricted = await getDocumentForDownload(approver.id, insuranceId);
    check("an administrative role CAN download the insurance card", adminRestricted.ok && same(adminRestricted.value.bytes, pdfInsurance), errorOf(adminRestricted));
    const adminId = await getDocumentForDownload(admin.id, identId);
    check("SUPER_ADMIN CAN download the ID", adminId.ok && same(adminId.value.bytes, pdfId), errorOf(adminId));
    const downloadsAfter = await prisma.auditLog.count({ where: { action: "document_downloaded", actorUserId: nurseA.id } });
    check("only the download that succeeded was logged as a download", downloadsAfter - downloadsBefore === 1, `${downloadsAfter - downloadsBefore}`);

    section("11e. Documents: archiving hides a document and keeps it");
    const archived = await archiveDocument(admin.id, pngId);
    check("SUPER_ADMIN CAN archive a document", archived.ok, errorOf(archived));
    const archivedRow = await prisma.document.findUniqueOrThrow({ where: { id: pngId } });
    check("archiving recorded who and when", archivedRow.status === "archived" && archivedRow.archivedById === admin.id && archivedRow.archivedAt !== null);
    const archivedAgain = await archiveDocument(admin.id, pngId);
    check("cannot archive twice", !archivedAgain.ok, errorOf(archivedAgain));
    check("an archived document leaves every list", !(await idsIn(nurseA.id)).includes(pngId) && !(await idsIn(approver.id)).includes(pngId) && !(await listDocuments(admin.id)).some((d) => d.id === pngId));
    const archivedDl = await getDocumentForDownload(approver.id, pngId);
    check("an archived document cannot be downloaded, even by an administrator", !archivedDl.ok, errorOf(archivedDl));
    const stillStored = await prisma.documentFile.count({ where: { documentId: pngId } });
    check("but nothing was deleted: the file is still on record", stillStored === 1);
    const forgedArchive = await archiveDocument(admin.id, "00000000-0000-0000-0000-00000000a4c1");
    trackedResourceIds.push("00000000-0000-0000-0000-00000000a4c1");
    check("archiving a made-up id is refused as not found", !forgedArchive.ok && errorOf(forgedArchive).includes("could not be found"), errorOf(forgedArchive));

    section("11f. Documents: the audit trail (reading is logged too)");
    const docAudit = (action: string, actorUserId: string) => prisma.auditLog.count({ where: { action, actorUserId } });
    check("document_uploaded logged for the nurse", (await docAudit("document_uploaded", nurseA.id)) >= 2);
    check("document_uploaded logged for the administrative filer", (await docAudit("document_uploaded", approver.id)) === 1);
    check("document_downloaded logged for a colleague", (await docAudit("document_downloaded", nurseB.id)) === 1);
    check("document_downloaded logged for the administrator", (await docAudit("document_downloaded", approver.id)) === 1);
    check("document_archived logged", (await docAudit("document_archived", admin.id)) === 1);
    check("the nurse's reach for restricted documents is on record as denied", (await prisma.auditLog.count({ where: { actorUserId: nurseA.id, action: "access_denied", outcome: "denied" } })) >= 4);
    check("the outsider's attempts are on record as denied", (await prisma.auditLog.count({ where: { actorUserId: nurseC.id, action: "access_denied", outcome: "denied", resourceType: { in: ["document", "patient"] } } })) >= 2);
  } finally {
    // ----- Cleanup: leave the database exactly as it was found -----
    section("Cleaning up");
    try {
      // Documents first of all: they point at the patient and at the
      // temporary people, and both are protected while a document exists.
      // The file bytes go with their document. This also catches any
      // document a FAILING check let through.
      const leftoverDocs = await prisma.document.findMany({
        where: { OR: [{ patientId: patientId || "none" }, { uploadedById: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverDocs.map((d) => d.id));
      await prisma.document.deleteMany({ where: { id: { in: leftoverDocs.map((d) => d.id) } } });

      // Care plans next: they point at the patient and at the temporary
      // people, and both are protected from deletion while a plan
      // exists. Goals go with their plan. This also catches any plan a
      // FAILING check let through, so a failed run leaves nothing behind.
      const leftoverPlans = await prisma.carePlan.findMany({
        where: { OR: [{ patientId: patientId || "none" }, { authorId: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverPlans.map((p) => p.id));
      await prisma.carePlan.deleteMany({ where: { id: { in: leftoverPlans.map((p) => p.id) } } });

      if (patientId) {
        // Find every visit on the temporary patient, including any a
        // FAILING check let through unexpectedly, so their audit entries
        // are cleaned up too and a failed run still leaves nothing behind.
        const leftover = await prisma.visit.findMany({ where: { patientId }, select: { id: true } });
        trackedResourceIds.push(...leftover.map((v) => v.id));
        await prisma.visit.deleteMany({ where: { patientId } });
        await prisma.patient.delete({ where: { id: patientId } }); // care team rows cascade
      }
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: createdUserIds } },
            { resourceId: { in: trackedResourceIds } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }); // user roles cascade
      console.log("  removed the temporary patient, visits, care plans, documents, people and their audit entries");
    } catch (err) {
      console.error("  CLEANUP FAILED - check Prisma Studio for rows named Verify or Testpatient:", err);
      failures.push("cleanup");
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("Failed:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
  console.log("Every access rule held.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
