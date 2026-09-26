// scripts/verify-access.ts
//
// Proves the access rules actually hold, by trying to break them.
//
// Reading code and believing it is not the same as watching it refuse.
// This script signs in nobody and clicks nothing - it calls the same
// service functions the pages and server actions call (src/lib/visits.ts,
// src/lib/care-plans.ts, src/lib/documents.ts, src/lib/referrals.ts, src/lib/care-team.ts, src/lib/patients.ts) as different people, and checks that every action
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
  UNRESTRICTED_CATEGORY_KEYS,
  isRestrictedCategory,
} from "@/lib/document-constants";
import {
  createShare,
  getShareOptions,
  grantsCover,
  listShares,
  revokeShare,
} from "@/lib/document-grants";
import {
  canRecordReferrals,
  changeReferralStatus,
  createReferral,
  listReferrals,
  updateReferral,
  type ReferralDetailsInput,
} from "@/lib/referrals";
import {
  REFERRAL_CONTACT_NAME_MAX,
  REFERRAL_NAME_MAX,
  REFERRAL_NOTE_MAX,
  REFERRAL_REASON_MAX,
  REFERRAL_SOURCE_ORG_MAX,
} from "@/lib/referral-constants";
import {
  assignToCareTeam,
  endCareTeamAssignment,
  getAssignmentOptions,
  listCareTeam,
  listPatientsNeedingTeam,
} from "@/lib/care-team";
import { makeDemoPdf } from "../prisma/demo-pdf";
import { ORG_TIMEZONE, orgLocalToUtc } from "@/lib/time";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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

  // ----- 0. The shared access helpers exist once -----
  // loadActor, auditDenied and auditAllowed used to be copied into four
  // service files. They now live in src/lib/auth/actor.ts. This reads the
  // source on purpose: a private copy is the kind of change that passes
  // every behaviour test and still leaves one file quietly weaker.
  section("0. The shared access helpers exist once, and every service uses them");
  const sourceFiles: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) sourceFiles.push(full);
    }
  };
  walk(join(process.cwd(), "src"));
  const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, "/");
  const helperFile = "src/lib/auth/actor.ts";
  const privateCopies = sourceFiles
    .filter((f) => rel(f) !== helperFile)
    .filter((f) => /function\s+(loadActor|auditDenied|auditAllowed)\b/.test(readFileSync(f, "utf8")))
    .map(rel);
  check("no file has its own copy of loadActor, auditDenied or auditAllowed", privateCopies.length === 0, privateCopies.join(", "));
  const helperSource = readFileSync(join(process.cwd(), helperFile), "utf8");
  check("the shared file defines all three helpers", ["loadActor", "auditDenied", "auditAllowed"].every((n) => new RegExp(`export async function ${n}\\b`).test(helperSource)));
  for (const service of ["visits", "care-plans", "documents", "document-grants", "referrals", "care-team"]) {
    const src = readFileSync(join(process.cwd(), `src/lib/${service}.ts`), "utf8");
    check(`src/lib/${service}.ts uses the shared helpers`, src.includes('from "@/lib/auth/actor"'));
  }

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

  // ----- 2d. Referrals: reading, with the demo accounts -----
  section("2d. Reading: who sees which referrals (demo accounts)");
  const totalReferrals = await prisma.referral.count({ where: { organizationId: orgId } });
  const adminReferrals = await listReferrals(admin.id);
  const adminReferralRows = [...adminReferrals.open, ...adminReferrals.closed];
  check("admin sees every referral in the organization", adminReferralRows.length === totalReferrals, `${adminReferralRows.length} of ${totalReferrals}`);
  check("admin sees people who are not patients yet", adminReferralRows.some((r) => r.patientId === null));
  check("admin sees the office details on every referral", adminReferralRows.every((r) => r.office !== null));
  check("admin can manage referrals", adminReferrals.canManage);
  for (const [label, nurse] of [["nurse one", nurse1], ["nurse two", nurse2]] as const) {
    const mine = await assignedIds(nurse.id);
    const lists = await listReferrals(nurse.id);
    const rows = [...lists.open, ...lists.closed];
    const expected = await prisma.referral.count({ where: { organizationId: orgId, patientId: { in: mine } } });
    check(`${label} sees only referrals linked to their assigned patients`, rows.every((r) => r.patientId !== null && mine.includes(r.patientId)));
    check(`${label} sees ALL referrals linked to their assigned patients`, rows.length === expected, `${rows.length} of ${expected}`);
    check(`${label} sees no referral about someone who is not a patient`, rows.every((r) => r.patientId !== null));
    check(`${label} gets NO office details on any referral`, rows.every((r) => r.office === null));
    check(`${label} can read the reason for referral`, rows.every((r) => r.reason.length > 0));
    check(`${label} cannot manage, edit or decide anything`, !lists.canManage && rows.every((r) => !r.canEdit && r.actions.length === 0 && r.matchingPatient === null));

    // The office columns must not merely be hidden: their text must not
    // be anywhere in what this person was handed.
    const shown = JSON.stringify(lists);
    const officeRows = await prisma.referral.findMany({
      where: { organizationId: orgId, patientId: { in: mine } },
      select: { sourceContactName: true, sourceContactPhone: true, officeNotes: true, decisionNote: true },
    });
    const officeValues = officeRows.flatMap((o) => [o.sourceContactName, o.sourceContactPhone, o.officeNotes, o.decisionNote]).filter((v): v is string => !!v);
    check(`${label}'s referral data contains none of the office text`, officeValues.length > 0 && officeValues.every((v) => !shown.includes(v)), `${officeValues.length} office values checked`);

    const strangers = await prisma.referral.findMany({ where: { organizationId: orgId, patientId: null }, select: { lastName: true } });
    check(`${label}'s referral data never mentions a person who is not a patient`, strangers.length > 0 && strangers.every((s) => !shown.includes(s.lastName)), `${strangers.length} people checked`);
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
  let tempRoleId = ""; // the temporary referral manager role (section 12)
  const extraTempRoleIds: string[] = []; // the temporary care team manager role (section 13)
  let otherOrgId = ""; // a temporary second organization (section 13e)

  try {
    const nurseA = await makeUser("a", nurseRole.id); // on the team
    const nurseB = await makeUser("b", nurseRole.id); // on the team, a colleague
    const nurseC = await makeUser("c", nurseRole.id); // NOT on the team
    // A caregiver: holds none of the permissions the checks below need (visits.read,
    // care plans, documents, referrals, care teams), only visits.checkin and tasks.read.
    const noPerms = await makeUser("none", caregiverRole.id);

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

    // ----- 12. Referrals -----
    // Its own block, so the helper names used here (bad, dup, offered...)
    // never collide with the names the earlier sections already took.
    {
    section("12a. Referrals: an account without the permission is stopped, and a read-only account cannot change anything");
    // The clinical supervisor role gives administrative reach and holds no
    // referral permissions and no patients.create. (The care coordinator
    // role used to serve here, but a coordinator now really does hold
    // patients.create, which is the point of that role.)
    const coordinatorRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "CLINICAL_SUPERVISOR" } });
    const referralPerms = await prisma.permission.findMany({ where: { key: { in: ["referrals.read", "referrals.manage"] } } });
    check("the two referral permissions exist", referralPerms.length === 2);
    // A temporary role that holds ONLY the two referral permissions. Paired
    // with the administrative CLINICAL_SUPERVISOR role (which holds no
    // referral permissions of its own) it makes a manager with administrative reach
    // but WITHOUT patients.create. On its own it makes a manager whose
    // reach is only "my assigned patients". Both are shapes the real roles
    // do not have yet, and both are exactly what a rule must survive.
    const tempRole = await prisma.role.create({ data: { organizationId: orgId, key: `VERIFY_${runId}`, name: "Verify referral manager" } });
    tempRoleId = tempRole.id;
    await prisma.rolePermission.createMany({ data: referralPerms.map((p) => ({ roleId: tempRole.id, permissionId: p.id })) });
    const manager = await makeUser("manager", coordinatorRole.id); // administrative reach, referrals.read + manage, NO patients.create
    await prisma.userRole.create({ data: { userId: manager.id, roleId: tempRole.id } });
    const remote = await makeUser("remote", tempRole.id); // referrals.read + manage, but reach is only assigned patients
    console.log("  ready: a manager without patients.create, and a manager whose reach is only assigned patients");

    const person = (over: Partial<ReferralDetailsInput> = {}): ReferralDetailsInput => ({
      firstName: "Verify",
      lastName: `Testpatient${runId}`,
      dateOfBirth: "1950-01-01",
      sourceType: "hospital",
      sourceOrganization: "Verify Hospital",
      sourceContactName: "Verify Contact",
      sourceContactPhone: "(281) 555-0100",
      requestedService: "skilled_nursing",
      urgency: "routine",
      reason: "Verify reason text.",
      officeNotes: "Verify office note.",
      ...over,
    });
    const referralCount = () => prisma.referral.count({ where: { createdById: { in: createdUserIds } } });
    const referralRow = (id: string) => prisma.referral.findUniqueOrThrow({ where: { id } });
    const idOf = (r: { ok: boolean; value?: { referralId: string } }) => (r.ok && r.value ? r.value.referralId : "");
    const FORGED_REFERRAL = "00000000-0000-0000-0000-00000000f0f0";
    trackedResourceIds.push(FORGED_REFERRAL);

    check("no-permission account cannot list referrals", await throwsAuthorization(() => listReferrals(noPerms.id)));
    check("no-permission account cannot record a referral", await throwsAuthorization(() => createReferral(noPerms.id, person())));
    check("no-permission account cannot edit a referral", await throwsAuthorization(() => updateReferral(noPerms.id, FORGED_REFERRAL, person())));
    check("no-permission account cannot decide a referral", await throwsAuthorization(() => changeReferralStatus(noPerms.id, FORGED_REFERRAL, "start_review")));
    check("no-permission account gets no referral form", !(await canRecordReferrals(noPerms.id)));

    // A nurse holds referrals.read only.
    check("a nurse CAN list referrals (read permission)", !(await throwsAuthorization(() => listReferrals(nurseA.id))));
    check("a nurse cannot record a referral (no manage permission)", await throwsAuthorization(() => createReferral(nurseA.id, person())));
    check("a nurse cannot edit a referral", await throwsAuthorization(() => updateReferral(nurseA.id, FORGED_REFERRAL, person())));
    check("a nurse cannot decide a referral", await throwsAuthorization(() => changeReferralStatus(nurseA.id, FORGED_REFERRAL, "start_review")));
    check("a nurse gets no referral form", !(await canRecordReferrals(nurseA.id)));
    check("the refusals were written to the audit log", (await prisma.auditLog.count({ where: { actorUserId: nurseA.id, action: "permission_denied", resourceId: "referrals.manage" } })) >= 3);
    check("administrative reach with manage gets the form", (await canRecordReferrals(manager.id)) && (await canRecordReferrals(approver.id)));
    check("manage permission WITHOUT administrative reach gets no form", !(await canRecordReferrals(remote.id)));

    // ----- 12b. Recording -----
    section("12b. Referrals: recording, validation and duplicates");
    const refA = await createReferral(approver.id, person());
    const refAId = idOf(refA);
    check("an administrator CAN record a referral", refA.ok, errorOf(refA));
    trackedResourceIds.push(refAId);
    const rowA = refAId ? await referralRow(refAId) : null;
    check("it starts as received, unlinked and undecided", rowA?.status === "received" && rowA.patientId === null && rowA.decidedById === null);
    check("it records who recorded it", rowA?.createdById === approver.id);

    const dup = await createReferral(manager.id, person({ firstName: "VERIFY", lastName: `testpatient${runId}` }));
    check("a second OPEN referral for the same person is refused (capital letters ignored)", !dup.ok && errorOf(dup).includes("already an open referral"), errorOf(dup));

    const remoteCreate = await createReferral(remote.id, person({ lastName: `Remote${runId}` }));
    check("manage permission without administrative reach CANNOT record a referral", !remoteCreate.ok && errorOf(remoteCreate).includes("cannot record"), errorOf(remoteCreate));
    check("that attempt is on record as denied", (await prisma.auditLog.count({ where: { actorUserId: remote.id, action: "access_denied", outcome: "denied", resourceType: "referral" } })) >= 1);

    const beforeBad = await referralCount();
    const bad: [string, Partial<ReferralDetailsInput>][] = [
      ["blank first name", { firstName: "  " }],
      ["blank last name", { lastName: "" }],
      ["name over the limit", { firstName: "x".repeat(REFERRAL_NAME_MAX + 1) }],
      ["impossible birth date", { dateOfBirth: "1950-02-30" }],
      ["birth date in the future", { dateOfBirth: "2999-01-01" }],
      ["birth date before 1900", { dateOfBirth: "1899-12-31" }],
      ["birth date in the wrong format", { dateOfBirth: "01/01/1950" }],
      ["unknown source", { sourceType: "a_friend_of_a_friend" }],
      ["unknown kind of care", { requestedService: "surgery" }],
      ["unknown urgency", { urgency: "yesterday" }],
      ["blank reason", { reason: "   " }],
      ["reason over the limit", { reason: "x".repeat(REFERRAL_REASON_MAX + 1) }],
      ["organization name over the limit", { sourceOrganization: "x".repeat(REFERRAL_SOURCE_ORG_MAX + 1) }],
      ["contact name over the limit", { sourceContactName: "x".repeat(REFERRAL_CONTACT_NAME_MAX + 1) }],
      ["phone that is not a phone", { sourceContactPhone: "call me" }],
      ["phone that is too short", { sourceContactPhone: "12345" }],
      ["office notes over the limit", { officeNotes: "x".repeat(REFERRAL_NOTE_MAX + 1) }],
    ];
    for (const [label, over] of bad) {
      const r = await createReferral(approver.id, person({ lastName: `Bad${runId}`, ...over }));
      check(`refuses: ${label}`, !r.ok, "it was accepted");
    }
    check("none of the invalid referrals were saved", (await referralCount()) === beforeBad, `${(await referralCount()) - beforeBad} extra rows`);

    const refB = await createReferral(manager.id, person({ lastName: `Second${runId}`, dateOfBirth: "1961-06-06", urgency: "urgent" }));
    const refBId = idOf(refB);
    check("a manager (administrative reach, no patients.create) CAN record a referral", refB.ok, errorOf(refB));
    trackedResourceIds.push(refBId);

    // ----- 12c. Reading an unlinked referral -----
    section("12c. Referrals: a person who is not a patient yet is visible to administrators only");
    const asApprover = await listReferrals(approver.id);
    const seenByApprover = [...asApprover.open, ...asApprover.closed].find((r) => r.id === refAId);
    check("the administrator sees it", !!seenByApprover);
    check("with the office details", seenByApprover?.office?.sourceContactName === "Verify Contact" && seenByApprover.office.sourceContactPhone === "(281) 555-0100");
    const asManager = await listReferrals(manager.id);
    check("the manager with administrative reach sees it, with office details", [...asManager.open, ...asManager.closed].some((r) => r.id === refAId && r.office !== null));
    for (const [label, who] of [["nurse A (on the temporary patient's care team)", nurseA], ["nurse B (a colleague on that team)", nurseB], ["nurse C (not on the team)", nurseC], ["the manager whose reach is only assigned patients", remote]] as const) {
      const lists = await listReferrals(who.id);
      const rows = [...lists.open, ...lists.closed];
      check(`${label} does not see it`, !rows.some((r) => r.id === refAId));
      check(`${label} is handed no trace of the person's name`, !JSON.stringify(lists).includes(`Testpatient${runId}`));
    }
    check("the manager whose reach is only assigned patients cannot manage", !(await listReferrals(remote.id)).canManage);

    // ----- 12d. Editing -----
    section("12d. Referrals: editing an open referral");
    const editOthers = await updateReferral(remote.id, refAId, person());
    const editForged = await updateReferral(remote.id, FORGED_REFERRAL, person());
    check("a manager without administrative reach cannot edit it", !editOthers.ok && errorOf(editOthers).includes("could not be found"), errorOf(editOthers));
    check("...and hears exactly what they hear for an id that does not exist", errorOf(editOthers) === errorOf(editForged), `"${errorOf(editOthers)}" vs "${errorOf(editForged)}"`);
    check("those attempts are on record as denied", (await prisma.auditLog.count({ where: { actorUserId: remote.id, action: "access_denied", resourceType: "referral" } })) >= 3);

    const edited = await updateReferral(manager.id, refAId, person({ reason: "Verify reason, edited.", officeNotes: "Verify office note, edited.", urgency: "urgent" }));
    check("a manager CAN edit an open referral", edited.ok, errorOf(edited));
    const afterEdit = await referralRow(refAId);
    check("the edit is saved", afterEdit.reason === "Verify reason, edited." && afterEdit.officeNotes === "Verify office note, edited." && afterEdit.urgency === "urgent");
    const badEdit = await updateReferral(manager.id, refAId, person({ reason: "   " }));
    check("an invalid edit is refused and changes nothing", !badEdit.ok && (await referralRow(refAId)).reason === "Verify reason, edited.");
    const toBoth = await updateReferral(manager.id, refAId, person({ lastName: `Second${runId}`, dateOfBirth: "1961-06-06" }));
    check("an edit that would duplicate another open referral is refused", !toBoth.ok && errorOf(toBoth).includes("already an open referral"), errorOf(toBoth));

    // ----- 12e. The status machine -----
    section("12e. Referrals: the status machine");
    const skip = await changeReferralStatus(approver.id, refAId, "accept");
    check("cannot accept a referral that has not been reviewed", !skip.ok && errorOf(skip).includes("cannot be changed"), errorOf(skip));
    check("a nurse cannot start a review", await throwsAuthorization(() => changeReferralStatus(nurseA.id, refAId, "start_review")));
    const remoteStart = await changeReferralStatus(remote.id, refAId, "start_review");
    check("a manager without administrative reach cannot start a review (it does not exist to them)", !remoteStart.ok && errorOf(remoteStart).includes("could not be found"), errorOf(remoteStart));
    const nonsense = await changeReferralStatus(approver.id, refAId, "delete_everything");
    check("an action that does not exist is refused", !nonsense.ok && errorOf(nonsense).includes("not recognised"), errorOf(nonsense));
    check("nothing changed so far", (await referralRow(refAId)).status === "received");

    const review = await changeReferralStatus(approver.id, refAId, "start_review");
    check("an administrator CAN start a review", review.ok, errorOf(review));
    const afterReview = await referralRow(refAId);
    check("it is now in review, and starting a review is not yet a decision", afterReview.status === "in_review" && afterReview.decidedById === null && afterReview.decidedAt === null);
    const reviewTwice = await changeReferralStatus(approver.id, refAId, "start_review");
    check("a review cannot be started twice", !reviewTwice.ok && errorOf(reviewTwice).includes("cannot be changed"), errorOf(reviewTwice));

    // Declining needs a written reason.
    const declineNoNote = await changeReferralStatus(manager.id, refBId, "decline");
    const declineBlank = await changeReferralStatus(manager.id, refBId, "decline", { note: "   " });
    const declineLong = await changeReferralStatus(manager.id, refBId, "decline", { note: "x".repeat(REFERRAL_NOTE_MAX + 1) });
    check("declining without a reason is refused", !declineNoNote.ok && !declineBlank.ok && !declineLong.ok);
    check("nothing changed after those refusals", (await referralRow(refBId)).status === "received");
    const declined = await changeReferralStatus(manager.id, refBId, "decline", { note: "Verify: outside the area we serve." });
    check("declining a received referral, with a reason, works", declined.ok, errorOf(declined));
    const declinedRow = await referralRow(refBId);
    check("the decision, decider, time and reason are recorded", declinedRow.status === "declined" && declinedRow.decidedById === manager.id && declinedRow.decidedAt !== null && declinedRow.decisionNote === "Verify: outside the area we serve.");
    for (const action of ["accept", "withdraw", "start_review", "decline"]) {
      const again = await changeReferralStatus(approver.id, refBId, action, { note: "Verify again." });
      check(`a declined referral is final: ${action} is refused`, !again.ok && errorOf(again).includes("cannot be changed"), errorOf(again));
    }
    const editFinal = await updateReferral(approver.id, refBId, person({ lastName: `Second${runId}`, dateOfBirth: "1961-06-06" }));
    check("a declined referral can no longer be edited", !editFinal.ok && errorOf(editFinal).includes("no longer be edited"), errorOf(editFinal));

    const refC = await createReferral(approver.id, person({ lastName: `Third${runId}`, dateOfBirth: "1972-03-03" }));
    const refCId = idOf(refC);
    trackedResourceIds.push(refCId);
    const withdrawNoNote = await changeReferralStatus(approver.id, refCId, "withdraw");
    check("withdrawing without a reason is refused", !withdrawNoNote.ok);
    const withdrawn = await changeReferralStatus(approver.id, refCId, "withdraw", { note: "Verify: the family found other help." });
    check("withdrawing, with a reason, works", withdrawn.ok, errorOf(withdrawn));
    check("it is final and the reason is recorded", (await referralRow(refCId)).status === "withdrawn" && (await referralRow(refCId)).decisionNote === "Verify: the family found other help.");

    const refF = await createReferral(approver.id, person({ lastName: `Fourth${runId}`, dateOfBirth: "1983-04-04" }));
    const refFId = idOf(refF);
    trackedResourceIds.push(refFId);
    await changeReferralStatus(approver.id, refFId, "start_review");
    const declineFromReview = await changeReferralStatus(approver.id, refFId, "decline", { note: "Verify: not eligible." });
    check("a referral in review can be declined too", declineFromReview.ok && (await referralRow(refFId)).status === "declined", errorOf(declineFromReview));

    // ----- 12f. Accepting: linking to a patient -----
    section("12f. Referrals: accepting links the referral to the right patient, never a duplicate");
    const inReview = [...(await listReferrals(approver.id)).open].find((r) => r.id === refAId);
    check("while in review, the administrator is told a patient with this name and birth date already exists", inReview?.matchingPatient?.id === patient.id, JSON.stringify(inReview?.matchingPatient));
    const patientTotal = () => prisma.patient.count({ where: { organizationId: orgId } });
    const patientsBefore = await patientTotal();

    check("a manager WITHOUT patients.create cannot accept and create a new patient", await throwsAuthorization(() => changeReferralStatus(manager.id, refAId, "accept")));
    const createDup = await changeReferralStatus(approver.id, refAId, "accept");
    check("creating a new patient is refused when this person already is one", !createDup.ok && errorOf(createDup).includes("already exists"), errorOf(createDup));
    const toForged = await changeReferralStatus(approver.id, refAId, "accept", { existingPatientId: "00000000-0000-0000-0000-00000000beef" });
    check("linking to a made-up patient id is refused", !toForged.ok && errorOf(toForged).includes("do not have access"), errorOf(toForged));
    const wrongPerson = adminPatients.find((p) => p.id !== patient.id);
    const toWrong = wrongPerson ? await changeReferralStatus(approver.id, refAId, "accept", { existingPatientId: wrongPerson.id }) : null;
    check("linking to a DIFFERENT person's patient record is refused", !!toWrong && !toWrong.ok && errorOf(toWrong).includes("do not match"), toWrong ? errorOf(toWrong) : "no other patient");
    await prisma.patient.update({ where: { id: patient.id }, data: { status: "on_hold" } });
    const toHeld = await changeReferralStatus(approver.id, refAId, "accept", { existingPatientId: patient.id });
    check("linking to a patient who is not active is refused", !toHeld.ok && errorOf(toHeld).includes("active"), errorOf(toHeld));
    await prisma.patient.update({ where: { id: patient.id }, data: { status: "active" } });
    const stillReview = await referralRow(refAId);
    check("after all those refusals the referral is still in review and unlinked", stillReview.status === "in_review" && stillReview.patientId === null);
    check("and no patient was created", (await patientTotal()) === patientsBefore);

    const linked = await changeReferralStatus(manager.id, refAId, "accept", { existingPatientId: patient.id });
    check("linking to the matching patient works, and needs only referrals.manage", linked.ok, errorOf(linked));
    const linkedRow = await referralRow(refAId);
    check("it is accepted, linked to that patient, decided by the manager", linkedRow.status === "accepted" && linkedRow.patientId === patient.id && linkedRow.decidedById === manager.id && linkedRow.decidedAt !== null);
    check("no new patient was created", (await patientTotal()) === patientsBefore);
    const editAccepted = await updateReferral(approver.id, refAId, person());
    check("an accepted referral can no longer be edited", !editAccepted.ok && errorOf(editAccepted).includes("no longer be edited"), errorOf(editAccepted));

    // ----- 12g. Who sees a LINKED referral, and how much -----
    section("12g. Referrals: once linked, the patient's care team sees it, without the office details");
    for (const [label, who] of [["nurse A (on the team)", nurseA], ["nurse B (a colleague on the team)", nurseB]] as const) {
      const lists = await listReferrals(who.id);
      const row = [...lists.open, ...lists.closed].find((r) => r.id === refAId);
      check(`${label} sees it`, !!row);
      check(`${label} can read the reason`, row?.reason === "Verify reason, edited.");
      check(`${label} gets no office details`, row?.office === null);
      check(`${label} cannot edit or decide it`, !!row && !row.canEdit && row.actions.length === 0);
      const shown = JSON.stringify(lists);
      check(`${label} is handed none of the office text`, !shown.includes("Verify Contact") && !shown.includes("(281) 555-0100") && !shown.includes("Verify office note"));
    }
    const asOutsider = await listReferrals(nurseC.id);
    check("nurse C (not on the team) still does not see it", ![...asOutsider.open, ...asOutsider.closed].some((r) => r.id === refAId));
    const adminView = [...(await listReferrals(approver.id)).closed].find((r) => r.id === refAId);
    check("the administrator sees it with office details and the linked patient's name", adminView?.office?.sourceContactName === "Verify Contact" && adminView.patientName === `Verify Testpatient${runId}`);

    const remoteBefore = await listReferrals(remote.id);
    check("the assigned-reach manager does not see it before joining the team", ![...remoteBefore.open, ...remoteBefore.closed].some((r) => r.id === refAId));
    await prisma.careTeamMember.create({ data: { patientId: patient.id, userId: remote.id, roleOnCase: "primary_nurse" } });
    const remoteAfter = await listReferrals(remote.id);
    const remoteRow = [...remoteAfter.open, ...remoteAfter.closed].find((r) => r.id === refAId);
    check("after joining the team they see it", !!remoteRow);
    check("but still get no office details, even holding referrals.manage", remoteRow?.office === null && !JSON.stringify(remoteAfter).includes("Verify Contact"));
    check("and still cannot manage anything", !remoteAfter.canManage && !!remoteRow && remoteRow.actions.length === 0 && !remoteRow.canEdit);
    const remoteEditLinked = await changeReferralStatus(remote.id, refAId, "decline", { note: "Verify: trying anyway." });
    check("and cannot decide it", !remoteEditLinked.ok);
    check("and still cannot record a new referral", !(await createReferral(remote.id, person({ lastName: `Remote2${runId}` }))).ok);

    // ----- 12h. Accepting a person who is not yet a patient -----
    section("12h. Referrals: accepting creates the patient record, once");
    const newFirst = "Verify";
    const newLast = `Newperson${runId}`;
    const refD = await createReferral(approver.id, person({ firstName: newFirst, lastName: newLast, dateOfBirth: "1960-05-05" }));
    const refDId = idOf(refD);
    trackedResourceIds.push(refDId);
    await changeReferralStatus(approver.id, refDId, "start_review");
    const matchBefore = [...(await listReferrals(approver.id)).open].find((r) => r.id === refDId);
    check("for someone who is not a patient, no existing patient is offered", matchBefore?.matchingPatient === null);
    const patientsBeforeNew = await patientTotal();
    check("a manager without patients.create cannot create the patient", await throwsAuthorization(() => changeReferralStatus(manager.id, refDId, "accept")));
    check("...and nothing was created", (await patientTotal()) === patientsBeforeNew && (await referralRow(refDId)).status === "in_review");
    const created = await changeReferralStatus(approver.id, refDId, "accept");
    check("an administrator with patients.create CAN accept and create the patient", created.ok, errorOf(created));
    const createdPatientId = created.ok ? created.value.patientId : null;
    if (createdPatientId) trackedResourceIds.push(createdPatientId);
    const newPatient = createdPatientId ? await prisma.patient.findUnique({ where: { id: createdPatientId }, include: { careTeam: true } }) : null;
    check("exactly one patient was created", (await patientTotal()) === patientsBeforeNew + 1);
    check("with the referral's name and date of birth, active, in this organization", !!newPatient && newPatient.firstName === newFirst && newPatient.lastName === newLast && newPatient.dateOfBirth.toISOString().slice(0, 10) === "1960-05-05" && newPatient.status === "active" && newPatient.organizationId === orgId);
    check("with nobody on the care team yet", !!newPatient && newPatient.careTeam.length === 0);
    const dRow = await referralRow(refDId);
    check("the referral is accepted and linked to it", dRow.status === "accepted" && dRow.patientId === createdPatientId);
    check("administrators can see the new patient", !!createdPatientId && (await getAccessiblePatients(approver.id)).some((p) => p.id === createdPatientId));
    check("no nurse sees that patient's referral (nobody is assigned)", ![...(await listReferrals(nurseA.id)).closed].some((r) => r.id === refDId));

    // The same person referred again later: a patient now, so link, never duplicate.
    const refD2 = await createReferral(approver.id, person({ firstName: newFirst, lastName: newLast, dateOfBirth: "1960-05-05", requestedService: "physical_therapy" }));
    const refD2Id = idOf(refD2);
    check("a new referral for someone who is already a patient can be recorded once the old one is closed", refD2.ok, errorOf(refD2));
    trackedResourceIds.push(refD2Id);
    await changeReferralStatus(approver.id, refD2Id, "start_review");
    const offered = [...(await listReferrals(approver.id)).open].find((r) => r.id === refD2Id);
    check("this time the existing patient is offered", offered?.matchingPatient?.id === createdPatientId);
    const dup2 = await changeReferralStatus(approver.id, refD2Id, "accept");
    check("creating a second patient record for the same person is refused", !dup2.ok && errorOf(dup2).includes("already exists"), errorOf(dup2));
    const link2 = await changeReferralStatus(approver.id, refD2Id, "accept", { existingPatientId: createdPatientId });
    check("linking the new referral to the existing patient works", link2.ok, errorOf(link2));
    check("and there is still only one new patient", (await patientTotal()) === patientsBeforeNew + 1);

    // ----- 12i. The audit trail -----
    section("12i. Referrals: the audit trail");
    const refAudit = (action: string, actorUserId: string) => prisma.auditLog.count({ where: { action, actorUserId } });
    check("referral_created logged for the administrator (five referrals)", (await refAudit("referral_created", approver.id)) === 5);
    check("referral_created logged for the manager", (await refAudit("referral_created", manager.id)) === 1);
    check("referral_updated logged for the manager", (await refAudit("referral_updated", manager.id)) === 1);
    check("referral_review_started logged (four reviews)", (await refAudit("referral_review_started", approver.id)) === 4);
    check("referral_declined logged for both deciders", (await refAudit("referral_declined", manager.id)) === 1 && (await refAudit("referral_declined", approver.id)) === 1);
    check("referral_withdrawn logged", (await refAudit("referral_withdrawn", approver.id)) === 1);
    check("referral_accepted logged for each acceptance", (await refAudit("referral_accepted", manager.id)) === 1 && (await refAudit("referral_accepted", approver.id)) === 2);
    check("patient_created logged", (await refAudit("patient_created", approver.id)) === 1);
    const auditText = JSON.stringify(await prisma.auditLog.findMany({ where: { actorUserId: { in: createdUserIds } }, select: { action: true, resourceType: true, resourceId: true, outcome: true, actorEmail: true } }));
    check("the audit log never holds what a referral said", !auditText.includes("Verify reason") && !auditText.includes("Verify Contact") && !auditText.includes("(281) 555-0100") && !auditText.includes("Verify office note") && !auditText.includes("outside the area"));
    }

    // ===================================================================
    // Milestone E0: care teams, and the two office roles that now hold
    // real permissions (CARE_COORDINATOR, CLINICAL_SUPERVISOR).
    //
    // Everything here is done by REALLY being that role (a temporary
    // account holding the role the seed built), so the permission sets are
    // proven by using them, not by reading the list in the seed.
    // ===================================================================
    {
      const coordRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "CARE_COORDINATOR" } });
      const supRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "CLINICAL_SUPERVISOR" } });
      const coord = await makeUser("coord", coordRole.id);
      const sup = await makeUser("sup", supRole.id);
      const cg2 = await makeUser("cgtwo", caregiverRole.id); // a second caregiver, on no team
      const careTeamPerms = await prisma.permission.findMany({ where: { key: { in: ["care_team.read", "care_team.manage"] } } });
      // A temporary role holding ONLY the two care team permissions. Paired
      // with the NURSE role it makes someone who may manage care teams but
      // whose reach is only their assigned patients: a shape no real role
      // has, and exactly what the reach rule has to survive.
      const tempCareRole = await prisma.role.create({ data: { organizationId: orgId, key: `VERIFYCT_${runId}`, name: "Verify care team manager" } });
      extraTempRoleIds.push(tempCareRole.id);
      await prisma.rolePermission.createMany({ data: careTeamPerms.map((p) => ({ roleId: tempCareRole.id, permissionId: p.id })) });
      const remoteCare = await makeUser("remotecare", nurseRole.id);
      await prisma.userRole.create({ data: { userId: remoteCare.id, roleId: tempCareRole.id } });

      const FORGED_ID = "00000000-0000-0000-0000-00000000c0c0";
      const FORGED_STAFF = "00000000-0000-0000-0000-00000000c0c1";
      trackedResourceIds.push(FORGED_ID, FORGED_STAFF);

      // ----- 13a. The permission sets -----
      section("13a. Care teams: the permission sets, and who is stopped at the door");
      const permsOf = async (roleKey: string) =>
        (await prisma.rolePermission.findMany({ where: { role: { organizationId: orgId, key: roleKey } }, select: { permission: { select: { key: true } } } }))
          .map((r) => r.permission.key)
          .sort();
      const sameSet = (got: string[], want: string[]) => got.length === want.length && [...want].sort().every((k, i) => got[i] === k);
      check("the two care team permissions exist", careTeamPerms.length === 2);
      const coordPerms = await permsOf("CARE_COORDINATOR");
      const supPerms = await permsOf("CLINICAL_SUPERVISOR");
      check(
        "CARE_COORDINATOR holds exactly the agreed set",
        sameSet(coordPerms, ["patients.read", "patients.create", "referrals.read", "referrals.manage", "visits.read", "visits.create", "visits.update", "care_team.read", "care_team.manage", "tasks.read", "tasks.manage"]),
        coordPerms.join(", "),
      );
      check(
        "CLINICAL_SUPERVISOR holds exactly the agreed set",
        sameSet(supPerms, ["patients.read", "care_plans.read", "care_plans.approve", "visits.read", "visits.review", "documents.read", "care_team.read", "tasks.read", "tasks.manage"]),
        supPerms.join(", "),
      );
      const nursePerms = await permsOf("NURSE");
      check("a nurse holds neither care team permission", !nursePerms.includes("care_team.read") && !nursePerms.includes("care_team.manage"));
      const stillEmpty = await Promise.all(["REFERRAL_PARTNER"].map(async (k) => (await permsOf(k)).length));
      check("the referral partner still holds no permissions", stillEmpty.every((n) => n === 0), stillEmpty.join(","));
      const familyPerms = await permsOf("AUTHORIZED_FAMILY");
      check("AUTHORIZED_FAMILY holds exactly the agreed set: see what patients share (family.read) and nothing else", sameSet(familyPerms, ["family.read"]), familyPerms.join(", "));
      const familyHolders = await prisma.rolePermission.findMany({ where: { permission: { key: "family.read" }, role: { organizationId: orgId } }, include: { role: true } });
      check("only AUTHORIZED_FAMILY and SUPER_ADMIN hold family.read", sameSet(familyHolders.map((h) => h.role.key).sort(), ["AUTHORIZED_FAMILY", "SUPER_ADMIN"]), familyHolders.map((h) => h.role.key).join(", "));
      const consentHolders = await prisma.rolePermission.findMany({ where: { permission: { key: "consents.manage" }, role: { organizationId: orgId } }, include: { role: true } });
      check("only ADMIN and SUPER_ADMIN hold consents.manage", sameSet(consentHolders.map((h) => h.role.key).sort(), ["ADMIN", "SUPER_ADMIN"]), consentHolders.map((h) => h.role.key).join(", "));
      const patientPerms = await permsOf("PATIENT");
      check("PATIENT holds exactly the agreed set: own care, documents and messages", sameSet(patientPerms, ["portal.read", "portal.documents.read", "messages.read", "messages.send"]), patientPerms.join(", "));
      const portalHolders = await prisma.rolePermission.findMany({ where: { permission: { key: "portal.read" }, role: { organizationId: orgId } }, include: { role: true } });
      check("only PATIENT and SUPER_ADMIN hold portal.read", sameSet(portalHolders.map((h) => h.role.key).sort(), ["PATIENT", "SUPER_ADMIN"]), portalHolders.map((h) => h.role.key).join(", "));
      const caregiverPerms = await permsOf("CAREGIVER");
      check("CAREGIVER holds exactly the agreed set: check in/out, limited own-visit update, and tasks", sameSet(caregiverPerms, ["visits.checkin", "visits.caregiver_document", "tasks.read"]), caregiverPerms.join(", "));
      const checkinHolders = await prisma.rolePermission.findMany({ where: { permission: { key: "visits.checkin" }, role: { organizationId: orgId } }, include: { role: true } });
      check("only CAREGIVER and SUPER_ADMIN hold visits.checkin", sameSet(checkinHolders.map((h) => h.role.key).sort(), ["CAREGIVER", "SUPER_ADMIN"]), checkinHolders.map((h) => h.role.key).join(", "));
      const demoOffice = await Promise.all(
        [["demo.coordinator@cheliv.test", "CARE_COORDINATOR"], ["demo.supervisor@cheliv.test", "CLINICAL_SUPERVISOR"]].map(async ([email, roleKey]) => {
          const u = await prisma.user.findUnique({ where: { email }, include: { userRoles: { include: { role: true } } } });
          return u?.userRoles.some((ur) => ur.role.key === roleKey) === true;
        }),
      );
      check("the demo coordinator and demo supervisor exist with the right roles", demoOffice.every(Boolean), "run: npx prisma db seed");

      for (const [label, who] of [["an account with no permissions", noPerms], ["a nurse", nurseA]] as const) {
        check(`${label} cannot read a care team`, await throwsAuthorization(() => listCareTeam(who.id, FORGED_ID)));
        check(`${label} cannot see the worklist`, await throwsAuthorization(() => listPatientsNeedingTeam(who.id)));
        check(`${label} cannot add to a care team`, await throwsAuthorization(() => assignToCareTeam(who.id, { patientId: FORGED_ID, staffId: FORGED_STAFF, roleOnCase: "nurse" })));
        check(`${label} cannot end an assignment`, await throwsAuthorization(() => endCareTeamAssignment(who.id, FORGED_ID)));
        check(`${label} gets no add-to-team form`, (await getAssignmentOptions(who.id, FORGED_ID)) === null);
      }
      check("a supervisor cannot add to a care team", await throwsAuthorization(() => assignToCareTeam(sup.id, { patientId: FORGED_ID, staffId: FORGED_STAFF, roleOnCase: "nurse" })));
      check("a supervisor cannot end an assignment", await throwsAuthorization(() => endCareTeamAssignment(sup.id, FORGED_ID)));
      check("a supervisor gets no add-to-team form", (await getAssignmentOptions(sup.id, FORGED_ID)) === null);
      check("the refusals were written to the audit log", (await prisma.auditLog.count({ where: { actorUserId: nurseA.id, action: "permission_denied", resourceId: { in: ["care_team.read", "care_team.manage"] } } })) >= 4);

      // ----- 13b. What the form offers -----
      section("13b. Care teams: what the add-to-team form offers");
      const mkPatient = (tag: string, status = "active") =>
        prisma.patient.create({ data: { organizationId: orgId, firstName: "Verify", lastName: `${tag}${runId}`, dateOfBirth: new Date("1951-02-02"), status } });
      const ct = await mkPatient("Careteam");
      const ctOff = await mkPatient("Careoff", "discharged");
      const ctRace = await mkPatient("Carerace");
      const lone = await mkPatient("Carelone");
      const lone3 = await mkPatient("Carenone");
      trackedResourceIds.push(ct.id, ctOff.id, ctRace.id, lone.id, lone3.id);
      const teamSize = () => prisma.careTeamMember.count({ where: { patientId: ct.id } });
      const activeTeam = (pid: string) => prisma.careTeamMember.findMany({ where: { patientId: pid, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } });
      let assignedByCoord = 0;
      const assign = async (who: { id: string }, staff: { id: string }, place: string, pid: string = ct.id) => {
        const r = await assignToCareTeam(who.id, { patientId: pid, staffId: staff.id, roleOnCase: place });
        if (r.ok) {
          trackedResourceIds.push(r.value.assignmentId);
          if (who.id === coord.id) assignedByCoord++;
        }
        return r;
      };
      const seesPatient = async (userId: string, pid: string) => (await getAccessiblePatients(userId)).some((p) => p.id === pid);

      const needsBefore = await listPatientsNeedingTeam(coord.id);
      check("a patient nobody looks after is on the coordinator's worklist", needsBefore.some((p) => p.id === ct.id && !p.hasAnyTeam));
      check("a discharged patient is not on the worklist", !needsBefore.some((p) => p.id === ctOff.id));

      const opts = await getAssignmentOptions(coord.id, ct.id);
      check("the coordinator is offered the form for an active patient", opts !== null);
      const offered = new Map((opts?.staff ?? []).map((m) => [m.id, m.canFill]));
      check("the offer lists nurses and caregivers", [nurseA, nurseB, nurseC, noPerms, cg2].every((u) => offered.has(u.id)));
      check("the offer never lists an administrator, coordinator or supervisor", [admin, approver, coord, sup].every((u) => !offered.has(u.id)));
      check("a nurse is offered the nurse places only", (offered.get(nurseA.id) ?? []).includes("primary_nurse") && (offered.get(nurseA.id) ?? []).includes("nurse") && !(offered.get(nurseA.id) ?? []).includes("caregiver"));
      check("a caregiver is offered the caregiver place only", JSON.stringify(offered.get(cg2.id)) === JSON.stringify(["caregiver"]));
      check("no form for a discharged patient", (await getAssignmentOptions(coord.id, ctOff.id)) === null);
      check("no form for a made-up patient", (await getAssignmentOptions(coord.id, FORGED_ID)) === null);
      check("no form for someone whose reach does not include the patient", (await getAssignmentOptions(remoteCare.id, ct.id)) === null);

      // ----- 13c. Adding people, and every way to do it wrongly -----
      section("13c. Care teams: adding people, and every way to do it wrongly");
      const first = await assign(coord, nurseC, "nurse");
      check("a coordinator CAN add a nurse (before any primary nurse)", first.ok, errorOf(first));
      check("the patient now has a team but still needs a primary nurse", (await listPatientsNeedingTeam(coord.id)).some((p) => p.id === ct.id && p.hasAnyTeam));
      check("nurse C now sees the patient", await seesPatient(nurseC.id, ct.id));

      const primary = await assign(coord, nurseA, "primary_nurse");
      check("a coordinator CAN add the primary nurse", primary.ok, errorOf(primary));
      const primaryId = primary.ok ? primary.value.assignmentId : "";
      const primaryRow = primaryId ? await prisma.careTeamMember.findUniqueOrThrow({ where: { id: primaryId } }) : null;
      check("the new assignment is open-ended and in the right place", primaryRow?.endsAt === null && primaryRow.roleOnCase === "primary_nurse" && primaryRow.patientId === ct.id && primaryRow.userId === nurseA.id);
      check("nurse A sees the patient the moment she is added", await seesPatient(nurseA.id, ct.id));
      check("the patient left the worklist", !(await listPatientsNeedingTeam(coord.id)).some((p) => p.id === ct.id));
      const caregiverAdd = await assign(coord, noPerms, "caregiver");
      check("a coordinator CAN add a caregiver", caregiverAdd.ok, errorOf(caregiverAdd));
      const nurseCId = first.ok ? first.value.assignmentId : "";
      const caregiverAssignmentId = caregiverAdd.ok ? caregiverAdd.value.assignmentId : "";
      const sizeBefore = await teamSize();

      const twice = await assign(coord, nurseA, "nurse");
      check("the same person cannot be added twice", !twice.ok && errorOf(twice).includes("already on this care team"), errorOf(twice));
      const secondPrimary = await assign(coord, nurseB, "primary_nurse");
      check("a second primary nurse is refused", !secondPrimary.ok && errorOf(secondPrimary).includes("already has a primary nurse"), errorOf(secondPrimary));
      check("the form stops offering the primary place", !(await getAssignmentOptions(coord.id, ct.id))?.places.some((p) => p.key === "primary_nurse"));

      const wrongPeople: [string, () => ReturnType<typeof assign>][] = [
        ["a nurse in the caregiver place", () => assign(coord, nurseB, "caregiver")],
        ["a caregiver in the nurse place", () => assign(coord, cg2, "nurse")],
        ["a caregiver as primary nurse", () => assign(coord, cg2, "primary_nurse")],
        ["an administrator", () => assign(coord, admin, "nurse")],
        ["a coordinator", () => assign(coord, coord, "nurse")],
        ["a clinical supervisor", () => assign(coord, sup, "nurse")],
        ["a person who does not exist", () => assign(coord, { id: FORGED_STAFF }, "nurse")],
      ];
      const wrongMessages = new Set<string>();
      for (const [label, attempt] of wrongPeople) {
        const r = await attempt();
        check(`${label} cannot be put on the team`, !r.ok, "it was allowed");
        wrongMessages.add(errorOf(r));
      }
      check("every one of those refusals says the same words (nothing is given away)", wrongMessages.size === 1, [...wrongMessages].join(" | "));
      const badPlace = await assign(coord, nurseB, "surgeon");
      check("a place that does not exist is refused", !badPlace.ok && errorOf(badPlace) === "Choose a place on the team from the list.", errorOf(badPlace));
      const offDuty = await assign(coord, nurseB, "nurse", ctOff.id);
      check("nobody can be added to a discharged patient's team", !offDuty.ok && errorOf(offDuty).includes("active patient"), errorOf(offDuty));
      const forgedPatient = await assign(coord, nurseB, "nurse", FORGED_ID);
      const outOfReach = await assign(remoteCare, nurseB, "nurse", ct.id);
      check("a made-up patient is refused", !forgedPatient.ok);
      check("a real patient outside the person's reach is refused", !outOfReach.ok);
      check("a made-up patient and an unreachable one sound identical", errorOf(forgedPatient) === errorOf(outOfReach) && errorOf(forgedPatient).length > 0, `${errorOf(forgedPatient)} | ${errorOf(outOfReach)}`);
      check("none of the refused attempts changed the team", (await teamSize()) === sizeBefore, `${await teamSize()} vs ${sizeBefore}`);
      check("nurse B still cannot see the patient", !(await seesPatient(nurseB.id, ct.id)));
      check("the attempts were written to the audit log as denied", (await prisma.auditLog.count({ where: { actorUserId: coord.id, action: "access_denied", outcome: "denied" } })) >= 8 && (await prisma.auditLog.count({ where: { actorUserId: remoteCare.id, action: "access_denied", outcome: "denied" } })) >= 1);
      const adminAdds = await assign(admin, cg2, "caregiver", ctRace.id);
      check("a super administrator CAN add to a care team", adminAdds.ok, errorOf(adminAdds));

      // ----- 13d. Two people at once -----
      section("13d. Care teams: two people acting at the same moment");
      const [race1, race2] = await Promise.all([
        assign(coord, nurseA, "primary_nurse", ctRace.id),
        assign(coord, nurseB, "primary_nurse", ctRace.id),
      ]);
      check("exactly one of two simultaneous primary nurse additions succeeded", [race1, race2].filter((r) => r.ok).length === 1, `${race1.ok}, ${race2.ok}`);
      check("and the patient has exactly one primary nurse", (await activeTeam(ctRace.id)).filter((m) => m.roleOnCase === "primary_nurse").length === 1);

      // ----- 13e. Another organization -----
      section("13e. Care teams: another organization's people and patients do not exist here");
      // The first check in this project that uses a SECOND organization.
      // Phase 0 promises that one organization's data never reaches
      // another's; this is the care team part of that promise.
      const org2 = await prisma.organization.create({ data: { name: `Verify Org ${runId}` } });
      otherOrgId = org2.id;
      const org2NurseRole = await prisma.role.create({ data: { organizationId: org2.id, key: "NURSE", name: "Nurse" } });
      const nurseX = await prisma.user.create({ data: { organizationId: org2.id, email: `verify-${runId}-nursex@cheliv.test`, passwordHash: "not-a-real-hash", name: "Verify NURSEX" } });
      createdUserIds.push(nurseX.id);
      await prisma.userRole.create({ data: { userId: nurseX.id, roleId: org2NurseRole.id } });
      const patX = await prisma.patient.create({ data: { organizationId: org2.id, firstName: "Verify", lastName: `Orgtwo${runId}`, dateOfBirth: new Date("1952-03-03") } });
      const memberX = await prisma.careTeamMember.create({ data: { patientId: patX.id, userId: nurseX.id, roleOnCase: "nurse" } });
      trackedResourceIds.push(patX.id, memberX.id);
      const sizeBeforeOrg = await teamSize();

      const foreignStaff = await assign(coord, nurseX, "nurse");
      check("a nurse from another organization cannot be put on our team", !foreignStaff.ok && wrongMessages.has(errorOf(foreignStaff)), errorOf(foreignStaff));
      const foreignPatient = await assign(coord, nurseB, "nurse", patX.id);
      check("another organization's patient sounds like a made-up one", !foreignPatient.ok && errorOf(foreignPatient) === errorOf(forgedPatient), errorOf(foreignPatient));
      check("nothing was added to either team", (await teamSize()) === sizeBeforeOrg && (await prisma.careTeamMember.count({ where: { patientId: patX.id } })) === 1);
      const foreignEnd = await endCareTeamAssignment(coord.id, memberX.id);
      check("another organization's assignment cannot be ended", !foreignEnd.ok && errorOf(foreignEnd) === errorOf(await endCareTeamAssignment(coord.id, FORGED_ID)), errorOf(foreignEnd));
      check("and it is still open", (await prisma.careTeamMember.findUniqueOrThrow({ where: { id: memberX.id } })).endsAt === null);
      const foreignRead = await listCareTeam(coord.id, patX.id);
      check("another organization's team cannot be read", !foreignRead.ok && errorOf(foreignRead) === errorOf(await listCareTeam(coord.id, FORGED_ID)));
      check("no form for another organization's patient", (await getAssignmentOptions(coord.id, patX.id)) === null);
      check("the worklist never lists another organization's patient", !(await listPatientsNeedingTeam(coord.id)).some((p) => p.id === patX.id));
      check("the form never offers another organization's nurse", !(await getAssignmentOptions(coord.id, ct.id))?.staff.some((m) => m.id === nurseX.id));

      // ----- 14a. The coordinator, by being one -----
      section("14a. The care coordinator: intake and scheduling, no clinical content");
      const allPatients = await prisma.patient.count({ where: { organizationId: orgId } });
      check("a coordinator sees every patient", (await getAccessiblePatients(coord.id)).length === allPatients);
      const visitBase = (startDay: number, time: string) => ({ patientId: ct.id, clinicianId: nurseA.id, visitType: "skilled_nursing", startLocal: `${orgDay(startDay)}T${time}`, durationMinutes: 60 });
      const keepVisit = await scheduleVisit(coord.id, visitBase(3, "11:00"));
      check("a coordinator CAN schedule a visit for a team nurse", keepVisit.ok, errorOf(keepVisit));
      const dropVisit = await scheduleVisit(coord.id, visitBase(4, "11:00"));
      check("and a second one", dropVisit.ok, errorOf(dropVisit));
      const keepVisitId = keepVisit.ok ? keepVisit.value.visitId : "";
      const dropVisitId = dropVisit.ok ? dropVisit.value.visitId : "";
      trackedResourceIds.push(keepVisitId, dropVisitId);
      const notOnTeam = await scheduleVisit(coord.id, { ...visitBase(5, "11:00"), clinicianId: nurseB.id });
      check("a coordinator cannot schedule for someone who is not on that team", !notOnTeam.ok, "it was allowed");
      const coordVisits = await listVisits(coord.id);
      const coordRows = [...coordVisits.upcoming, ...coordVisits.recent];
      check("a coordinator sees the visits and can change any of them", coordRows.some((v) => v.id === keepVisitId) && coordRows.every((v) => v.canChange));
      const cancelled = await changeVisitStatus(coord.id, dropVisitId, "cancel");
      check("a coordinator CAN cancel a visit", cancelled.ok, errorOf(cancelled));
      check("a coordinator cannot list care plans", await throwsAuthorization(() => listCarePlans(coord.id)));
      check("a coordinator cannot start a care plan", await throwsAuthorization(() => createCarePlan(coord.id, { patientId: ct.id, title: "x", summary: "y" })));
      check("a coordinator cannot approve a care plan", await throwsAuthorization(() => changePlanStatus(coord.id, FORGED_ID, "approve")));
      check("a coordinator cannot list documents", await throwsAuthorization(() => listDocuments(coord.id)));
      check("a coordinator cannot archive a document", await throwsAuthorization(() => archiveDocument(coord.id, FORGED_ID)));
      check("a coordinator gets no upload form", (await getDocumentUploadOptions(coord.id)) === null);
      check("a coordinator can record referrals", await canRecordReferrals(coord.id));

      // ----- 14b. The supervisor, by being one -----
      section("14b. The clinical supervisor: review and approve, nothing else");
      const supPlan = await createCarePlan(nurseA.id, { patientId: ct.id, title: "Steady recovery at home", summary: "Keep the patient safe and comfortable." });
      check("nurse A (on the team) writes a plan", supPlan.ok, errorOf(supPlan));
      const supPlanId = supPlan.ok ? supPlan.value.planId : "";
      trackedResourceIds.push(supPlanId);
      const supGoal = await addGoal(nurseA.id, supPlanId, "Walk to the mailbox and back.");
      check("nurse A adds a goal", supGoal.ok, errorOf(supGoal));
      check("a supervisor cannot edit the plan", await throwsAuthorization(() => updateCarePlan(sup.id, supPlanId, { title: "Changed", summary: "Changed" })));
      check("a supervisor cannot add a goal", await throwsAuthorization(() => addGoal(sup.id, supPlanId, "Another goal")));
      check("a supervisor cannot start a plan", await throwsAuthorization(() => createCarePlan(sup.id, { patientId: ct.id, title: "x", summary: "y" })));
      const supRows = await listCarePlans(sup.id);
      check("a supervisor sees the draft plan and may approve it, but not edit it", [...supRows.current, ...supRows.past].some((p) => p.id === supPlanId && p.canApprove && !p.canEditContent));
      const approvedBySup = await changePlanStatus(sup.id, supPlanId, "approve");
      check("a supervisor CAN approve another person's plan", approvedBySup.ok, errorOf(approvedBySup));
      const approvedRow = await prisma.carePlan.findUniqueOrThrow({ where: { id: supPlanId } });
      check("the approval records the supervisor and the time", approvedRow.status === "active" && approvedRow.approvedById === sup.id && approvedRow.approvedAt !== null);
      check("a supervisor sees every patient", (await getAccessiblePatients(sup.id)).length === allPatients);
      const supVisits = await listVisits(sup.id);
      const supVisitRows = [...supVisits.upcoming, ...supVisits.recent];
      check("a supervisor sees visits but cannot change any", supVisitRows.some((v) => v.id === keepVisitId) && supVisitRows.every((v) => !v.canChange));
      check("a supervisor cannot schedule a visit", await throwsAuthorization(() => scheduleVisit(sup.id, visitBase(6, "11:00"))));
      check("a supervisor gets no scheduling form", (await getSchedulingOptions(sup.id)) === null);
      check("a supervisor cannot cancel a visit", await throwsAuthorization(() => changeVisitStatus(sup.id, keepVisitId, "cancel")));
      // DECIDED: a supervisor reaches every patient, but restricted
      // documents (insurance, identification) are seen by the two
      // administrator roles only, unless an administrator shares one on
      // purpose (section 16 tests sharing). So with nothing shared, a
      // supervisor sees every UNRESTRICTED filed document and no
      // restricted one.
      const unrestrictedDocs = await prisma.document.count({ where: { organizationId: orgId, status: "active", category: { in: UNRESTRICTED_CATEGORY_KEYS } } });
      const supDocs = await listDocuments(sup.id);
      check("a supervisor sees every unrestricted filed document", supDocs.length === unrestrictedDocs, `${supDocs.length} vs ${unrestrictedDocs}`);
      check("a supervisor sees NO restricted document until one is shared", supDocs.every((d) => !d.restricted));
      check("a supervisor cannot file a document", (await getDocumentUploadOptions(sup.id)) === null);
      check("a supervisor cannot archive a document", await throwsAuthorization(() => archiveDocument(sup.id, FORGED_ID)));
      check("a supervisor cannot list referrals", await throwsAuthorization(() => listReferrals(sup.id)));

      // ----- 14c. From referral to care team, the whole path -----
      section("14c. A referral becomes a patient, and the coordinator puts a nurse on the team");
      const flow: ReferralDetailsInput = {
        firstName: "Verify",
        lastName: `Careflow${runId}`,
        dateOfBirth: "1949-09-09",
        sourceType: "hospital",
        sourceOrganization: "Verify Hospital",
        sourceContactName: "Verify Contact",
        sourceContactPhone: "(281) 555-0100",
        requestedService: "skilled_nursing",
        urgency: "urgent",
        reason: "Verify reason text.",
        officeNotes: "Verify office note.",
      };
      const flowRef = await createReferral(coord.id, flow);
      check("a coordinator CAN record a referral", flowRef.ok, errorOf(flowRef));
      const flowRefId = flowRef.ok ? flowRef.value.referralId : "";
      const reviewed = await changeReferralStatus(coord.id, flowRefId, "start_review");
      check("a coordinator CAN start a review", reviewed.ok, errorOf(reviewed));
      const accepted = await changeReferralStatus(coord.id, flowRefId, "accept");
      check("a coordinator CAN accept a referral about someone new (this needs patients.create)", accepted.ok, errorOf(accepted));
      const flowPatientId = accepted.ok ? accepted.value.patientId : null;
      check("accepting made a patient record", !!flowPatientId && (await prisma.patient.count({ where: { id: flowPatientId } })) === 1);
      if (flowPatientId) trackedResourceIds.push(flowPatientId);
      check("the new patient has nobody on the care team", flowPatientId !== null && (await prisma.careTeamMember.count({ where: { patientId: flowPatientId } })) === 0);
      check("the new patient is on the coordinator's worklist", flowPatientId !== null && (await listPatientsNeedingTeam(coord.id)).some((p) => p.id === flowPatientId && !p.hasAnyTeam));
      check("nurse C cannot see the new patient yet", flowPatientId !== null && !(await seesPatient(nurseC.id, flowPatientId)));
      const flowAssign = flowPatientId ? await assign(coord, nurseC, "primary_nurse", flowPatientId) : null;
      check("the coordinator CAN put a nurse on the new patient's team", flowAssign?.ok === true, flowAssign ? errorOf(flowAssign) : "no patient");
      check("nurse C now sees the new patient", flowPatientId !== null && (await seesPatient(nurseC.id, flowPatientId)));
      check("the new patient left the worklist", flowPatientId !== null && !(await listPatientsNeedingTeam(coord.id)).some((p) => p.id === flowPatientId));
      const nurseSeesReferral = flowPatientId !== null ? (await listReferrals(nurseC.id)).closed.some((r) => r.id === flowRefId) : false;
      check("and now nurse C can read the accepted referral, without the office details", nurseSeesReferral && !JSON.stringify(await listReferrals(nurseC.id)).includes("Verify Contact"));

      // ----- 15a. Ending an assignment -----
      section("15a. Care teams: ending an assignment, and what stays on record");
      check("a supervisor cannot end an assignment", await throwsAuthorization(() => endCareTeamAssignment(sup.id, caregiverAssignmentId)));
      check("a nurse cannot end an assignment", await throwsAuthorization(() => endCareTeamAssignment(nurseA.id, caregiverAssignmentId)));
      const forgedEnd = await endCareTeamAssignment(coord.id, FORGED_ID);
      const unreachableEnd = await endCareTeamAssignment(remoteCare.id, caregiverAssignmentId);
      check("a made-up assignment is refused", !forgedEnd.ok);
      check("a real one outside the person's reach is refused", !unreachableEnd.ok);
      check("and they sound identical", errorOf(forgedEnd) === errorOf(unreachableEnd) && errorOf(forgedEnd).length > 0, `${errorOf(forgedEnd)} | ${errorOf(unreachableEnd)}`);
      check("the refused attempt changed nothing", (await prisma.careTeamMember.findUniqueOrThrow({ where: { id: caregiverAssignmentId } })).endsAt === null);

      const endCaregiver = await endCareTeamAssignment(coord.id, caregiverAssignmentId);
      check("a coordinator CAN end an assignment", endCaregiver.ok, errorOf(endCaregiver));
      check("ending sets an end date and deletes nothing", (await prisma.careTeamMember.findUniqueOrThrow({ where: { id: caregiverAssignmentId } })).endsAt !== null);
      const endAgain = await endCareTeamAssignment(coord.id, caregiverAssignmentId);
      check("ending the same assignment twice is refused", !endAgain.ok && errorOf(endAgain).includes("already ended"), errorOf(endAgain));

      const endNurseC = await endCareTeamAssignment(coord.id, nurseCId);
      check("a coordinator CAN end a nurse's assignment", endNurseC.ok, errorOf(endNurseC));
      check("nurse C stops seeing the patient the same instant", !(await seesPatient(nurseC.id, ct.id)));

      const endPrimary = await endCareTeamAssignment(coord.id, primaryId);
      check("ending the primary nurse reports the visits still on her calendar", endPrimary.ok && endPrimary.value.futureVisitsToReassign === 1, endPrimary.ok ? String(endPrimary.value.futureVisitsToReassign) : errorOf(endPrimary));
      check("those visits are left for a person to decide about", keepVisitId !== "" && (await prisma.visit.findUniqueOrThrow({ where: { id: keepVisitId } })).status === "scheduled");
      check("nurse A stops seeing the patient the same instant", !(await seesPatient(nurseA.id, ct.id)));
      check("the primary place is free again, and the patient is back on the worklist", !!(await getAssignmentOptions(coord.id, ct.id))?.places.some((p) => p.key === "primary_nurse") && (await listPatientsNeedingTeam(coord.id)).some((p) => p.id === ct.id));
      const reAdd = await assign(coord, nurseA, "primary_nurse");
      check("the same nurse CAN be added again later (a new row)", reAdd.ok, errorOf(reAdd));
      check("the whole history is still on record", (await teamSize()) === 4, String(await teamSize()));

      // ----- 15b. Reading a team -----
      section("15b. Care teams: who may look at a team");
      const coordView = await listCareTeam(coord.id, ct.id);
      check("a coordinator sees the team, and may change it", coordView.ok && coordView.value.canManage && coordView.value.active.length === 1, coordView.ok ? String(coordView.value.active.length) : errorOf(coordView));
      check("the ended assignments are listed as history, not as the team", coordView.ok && coordView.value.past.length === 3 && coordView.value.active.every((m) => m.endsAt === null));
      const supView = await listCareTeam(sup.id, ct.id);
      check("a supervisor sees the team, and may not change it", supView.ok && !supView.value.canManage);
      check("a nurse cannot read a care team (no permission)", await throwsAuthorization(() => listCareTeam(nurseA.id, ct.id)));
      const forgedRead = await listCareTeam(coord.id, FORGED_ID);
      const unreachableRead = await listCareTeam(remoteCare.id, ct.id);
      check("a made-up patient and an unreachable one sound identical when reading", !forgedRead.ok && !unreachableRead.ok && errorOf(forgedRead) === errorOf(unreachableRead));
      // The worklist follows the viewer's reach. Two patients need a
      // primary nurse: one this account is on the team of, one nobody is.
      const remoteOnLone = await assign(coord, remoteCare, "nurse", lone.id);
      check("an account can be put on a team that still needs a primary nurse", remoteOnLone.ok, errorOf(remoteOnLone));
      const coordList = (await listPatientsNeedingTeam(coord.id)).map((p) => p.id);
      const remoteList = (await listPatientsNeedingTeam(remoteCare.id)).map((p) => p.id);
      check("the coordinator's worklist holds both patients that need a primary nurse", coordList.includes(lone.id) && coordList.includes(lone3.id));
      check("a viewer with limited reach sees only the worklist patients they are on the team of", remoteList.length === 1 && remoteList[0] === lone.id, remoteList.join(","));

      // ----- 15c. The audit trail -----
      section("15c. Care teams: the audit trail");
      const teamAudit = (action: string, actorUserId: string) => prisma.auditLog.count({ where: { action, actorUserId } });
      check("care_team_assigned logged for every addition", (await teamAudit("care_team_assigned", coord.id)) === assignedByCoord, `${await teamAudit("care_team_assigned", coord.id)} vs ${assignedByCoord}`);
      check("care_team_assigned logged for the super administrator", (await teamAudit("care_team_assigned", admin.id)) >= 1);
      check("care_team_ended logged for the three endings", (await teamAudit("care_team_ended", coord.id)) === 3);
      const teamAuditText = JSON.stringify(await prisma.auditLog.findMany({ where: { actorUserId: { in: createdUserIds } }, select: { action: true, resourceType: true, resourceId: true, outcome: true, actorEmail: true } }));
      check("the audit log never holds a patient's name", !teamAuditText.includes("Careteam") && !teamAuditText.includes("Careflow") && !teamAuditText.includes("Carerace"));

      // ----- 16. Sharing restricted documents -----
      section("16a. Sharing restricted documents: the permission, and who is stopped");
      const grantPermRow = await prisma.permission.findUnique({ where: { key: "documents.grant" } });
      check("the documents.grant permission exists", grantPermRow !== null, "run: npx prisma db seed");
      const adminPerms = await permsOf("ADMIN");
      check("ADMIN holds documents.grant", adminPerms.includes("documents.grant"));
      check("SUPER_ADMIN holds documents.grant", (await permsOf("SUPER_ADMIN")).includes("documents.grant"));
      for (const roleKey of ["CLINICAL_SUPERVISOR", "CARE_COORDINATOR", "NURSE", "CAREGIVER", "PATIENT", "AUTHORIZED_FAMILY", "REFERRAL_PARTNER"]) {
        check(`${roleKey} does not hold documents.grant`, !(await permsOf(roleKey)).includes("documents.grant"));
      }

      const shareInput = (over: Partial<{ patientId: string; documentId: string; granteeId: string; duration: string }> = {}) => ({
        patientId: patient.id,
        documentId: "",
        granteeId: sup.id,
        duration: "30_days",
        ...over,
      });
      const activeShareCount = () =>
        prisma.documentAccessGrant.count({ where: { patientId: patient.id, revokedAt: null } });
      const restrictedIdsFor = async (userId: string) =>
        (await listDocuments(userId)).filter((d) => d.restricted).map((d) => d.id);
      const NOT_FOUND_TEXT = "could not be found";
      const PERSON_TEXT = "cannot be given access";

      // A temporary role holding documents.grant (and read) but NOT an
      // administrator role: proves the second lock (you must BE an
      // administrator to hand out what administrators see).
      const tempGrantRole = await prisma.role.create({ data: { organizationId: orgId, key: `VERIFYGR_${runId}`, name: "Verify share holder" } });
      extraTempRoleIds.push(tempGrantRole.id);
      const readPermRow = await prisma.permission.findUniqueOrThrow({ where: { key: "documents.read" } });
      await prisma.rolePermission.createMany({ data: [{ roleId: tempGrantRole.id, permissionId: grantPermRow!.id }, { roleId: tempGrantRole.id, permissionId: readPermRow.id }] });
      const notAdminGranter = await makeUser("notadmingrant", nurseRole.id);
      await prisma.userRole.create({ data: { userId: notAdminGranter.id, roleId: tempGrantRole.id } });

      const sharesBefore = await activeShareCount();
      for (const [who, person] of [["an account with no permissions", noPerms], ["a nurse", nurseA], ["a clinical supervisor", sup], ["a care coordinator", coord]] as const) {
        check(`${who} cannot share`, await throwsAuthorization(() => createShare(person.id, shareInput())));
        check(`${who} cannot take a share back`, await throwsAuthorization(() => revokeShare(person.id, FORGED_ID)));
        check(`${who} cannot list shares`, await throwsAuthorization(() => listShares(person.id)));
        check(`${who} gets no sharing form`, (await getShareOptions(person.id)) === null);
      }
      const notAdminTry = await createShare(notAdminGranter.id, shareInput());
      check("holding documents.grant WITHOUT an administrator role is not enough", !notAdminTry.ok, errorOf(notAdminTry));
      check("...and gets no list and no form either", (await throwsAuthorization(() => listShares(notAdminGranter.id))) && (await getShareOptions(notAdminGranter.id)) === null);
      const notAdminRevoke = await revokeShare(notAdminGranter.id, FORGED_ID);
      check("...and cannot take a share back", !notAdminRevoke.ok);
      const grantDeniedCount = await prisma.auditLog.count({ where: { actorUserId: { in: [noPerms.id, nurseA.id, sup.id, coord.id] }, action: "permission_denied", resourceId: "documents.grant", outcome: "denied" } });
      check("the permission refusals were written to the audit log", grantDeniedCount >= 12, String(grantDeniedCount));
      check("the second-lock refusals were written to the audit log as denied", (await prisma.auditLog.count({ where: { actorUserId: notAdminGranter.id, action: "access_denied", outcome: "denied" } })) >= 2);
      check("none of those attempts created a share", (await activeShareCount()) === sharesBefore);

      section("16b. Sharing restricted documents: nothing is shared by default");
      const supBefore = await listDocuments(sup.id);
      check("a supervisor sees the unrestricted documents of the patient", supBefore.some((d) => d.id === consentId) && supBefore.some((d) => d.id === orderId));
      check("a supervisor sees no restricted document", supBefore.every((d) => !d.restricted) && !supBefore.some((d) => d.id === insuranceId || d.id === identId));
      const supDlInsurance = await getDocumentForDownload(sup.id, insuranceId);
      const supDlIdent = await getDocumentForDownload(sup.id, identId);
      check("a supervisor cannot download the insurance card", !supDlInsurance.ok && errorOf(supDlInsurance).includes(NOT_FOUND_TEXT), errorOf(supDlInsurance));
      check("a supervisor cannot download the ID", !supDlIdent.ok && errorOf(supDlIdent).includes(NOT_FOUND_TEXT), errorOf(supDlIdent));
      check("a restricted document looks exactly like one that does not exist", errorOf(supDlInsurance) === errorOf(await getDocumentForDownload(sup.id, FORGED_ID)));
      check("a nurse on the team still sees no restricted document", (await restrictedIdsFor(nurseA.id)).length === 0);
      check("the pure rule: no share covers nothing", !grantsCover([], { id: insuranceId, patientId: patient.id }));
      check("the pure rule: a patient share covers that patient's documents only", grantsCover([{ patientId: patient.id, documentId: null }], { id: "x", patientId: patient.id }) && !grantsCover([{ patientId: patient.id, documentId: null }], { id: "x", patientId: "other" }));
      check("the pure rule: a document share covers that document only", grantsCover([{ patientId: patient.id, documentId: "a" }], { id: "a", patientId: patient.id }) && !grantsCover([{ patientId: patient.id, documentId: "a" }], { id: "b", patientId: patient.id }));

      section("16c. Sharing restricted documents: everything of one patient");
      const s1 = await createShare(approver.id, shareInput());
      check("an ADMIN CAN share all of a patient's restricted documents", s1.ok, errorOf(s1));
      const s1Id = s1.ok ? s1.value.grantId : "";
      trackedResourceIds.push(s1Id);
      const s1Row = await prisma.documentAccessGrant.findUniqueOrThrow({ where: { id: s1Id } });
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      check("the share records who, for whom, and when it ends", s1Row.grantedById === approver.id && s1Row.granteeId === sup.id && s1Row.documentId === null && s1Row.revokedAt === null && s1Row.expiresAt !== null && Math.abs(s1Row.expiresAt.getTime() - (Date.now() + thirtyDays)) < 60000);
      const supShared = await listDocuments(sup.id);
      const supSharedRestricted = supShared.filter((d) => d.restricted);
      check("the supervisor now sees both restricted documents of that patient", supSharedRestricted.some((d) => d.id === insuranceId) && supSharedRestricted.some((d) => d.id === identId));
      check("...marked as shared with them", supSharedRestricted.every((d) => d.sharedWithYou));
      const patientNames = await prisma.document.findMany({ where: { id: { in: supSharedRestricted.map((d) => d.id) } }, select: { patientId: true } });
      check("...and ONLY that patient's: every other patient's restricted documents stay hidden", patientNames.every((d) => d.patientId === patient.id));
      const supDl = await getDocumentForDownload(sup.id, insuranceId);
      check("the supervisor CAN now download the insurance card", supDl.ok, errorOf(supDl));
      check("the bytes are exactly what was filed", supDl.ok && same(supDl.value.bytes, pdfInsurance));
      check("the download was logged", (await prisma.auditLog.count({ where: { actorUserId: sup.id, action: "document_downloaded", resourceId: insuranceId, outcome: "allowed" } })) === 1);
      check("a share does not let the supervisor file", (await getDocumentUploadOptions(sup.id)) === null);
      check("a share does not let the supervisor archive", await throwsAuthorization(() => archiveDocument(sup.id, insuranceId)));
      check("a share does not let the supervisor share onward", await throwsAuthorization(() => createShare(sup.id, shareInput({ granteeId: nurseB.id }))));
      const laterId = await uploadDocument(approver.id, docInput({ category: "identification", title: "Second ID", fileName: "id2.pdf", bytes: pdf("Second identification") }));
      check("an administrator files another restricted document later", laterId.ok, errorOf(laterId));
      if (laterId.ok) trackedResourceIds.push(laterId.value.documentId);
      check("a share of the whole patient covers a document filed later", laterId.ok && (await restrictedIdsFor(sup.id)).includes(laterId.value.documentId));
      const dupShare = await createShare(approver.id, shareInput());
      check("the same share cannot be made twice", !dupShare.ok && errorOf(dupShare).includes("already has this access"), errorOf(dupShare));
      const listedShares = await listShares(approver.id);
      check("the share is on the administrator's list", listedShares.some((s) => s.id === s1Id && s.granteeId === sup.id));

      section("16d. Sharing restricted documents: taking it back");
      const revokeByOutsider = await throwsAuthorization(() => revokeShare(sup.id, s1Id));
      check("the person who was given access cannot take it back or extend it", revokeByOutsider);
      const revoked = await revokeShare(approver.id, s1Id);
      check("an administrator CAN take it back", revoked.ok, errorOf(revoked));
      const s1After = await prisma.documentAccessGrant.findUniqueOrThrow({ where: { id: s1Id } });
      check("taking it back records who and when, and deletes nothing", s1After.revokedAt !== null && s1After.revokedById === approver.id);
      check("access ends at once: no restricted document is listed", (await restrictedIdsFor(sup.id)).length === 0);
      const afterRevokeDl = await getDocumentForDownload(sup.id, insuranceId);
      check("access ends at once: download is refused", !afterRevokeDl.ok && errorOf(afterRevokeDl).includes(NOT_FOUND_TEXT), errorOf(afterRevokeDl));
      const revokedTwice = await revokeShare(approver.id, s1Id);
      check("a share cannot be taken back twice", !revokedTwice.ok, errorOf(revokedTwice));
      const revokeForged = await revokeShare(approver.id, FORGED_ID);
      check("a made-up share id is refused as not found", !revokeForged.ok && errorOf(revokeForged).includes(NOT_FOUND_TEXT), errorOf(revokeForged));
      check("the taken-back share leaves the administrator's list", !(await listShares(approver.id)).some((s) => s.id === s1Id));

      section("16e. Sharing restricted documents: one document, and it can end by itself");
      const s2 = await createShare(approver.id, shareInput({ documentId: insuranceId, duration: "7_days" }));
      check("an administrator CAN share one document", s2.ok, errorOf(s2));
      const s2Id = s2.ok ? s2.value.grantId : "";
      trackedResourceIds.push(s2Id);
      const s2Row = await prisma.documentAccessGrant.findUniqueOrThrow({ where: { id: s2Id } });
      check("a 7 day share ends in 7 days", s2Row.expiresAt !== null && Math.abs(s2Row.expiresAt.getTime() - (Date.now() + 7 * 24 * 60 * 60 * 1000)) < 60000);
      const supOne = await restrictedIdsFor(sup.id);
      check("the supervisor sees exactly that one document", supOne.length === 1 && supOne[0] === insuranceId, supOne.join(","));
      check("...and can download it", (await getDocumentForDownload(sup.id, insuranceId)).ok);
      check("...but not the other restricted document of the same patient", !(await getDocumentForDownload(sup.id, identId)).ok);
      const otherRestricted = await prisma.document.findFirst({ where: { organizationId: orgId, status: "active", category: { notIn: UNRESTRICTED_CATEGORY_KEYS }, patientId: { not: patient.id } }, select: { id: true } });
      const wrongPatientDoc = otherRestricted ? await createShare(approver.id, shareInput({ documentId: otherRestricted.id })) : null;
      check("a document belonging to a different patient cannot be shared under this patient", wrongPatientDoc !== null && !wrongPatientDoc.ok && errorOf(wrongPatientDoc).includes(NOT_FOUND_TEXT), wrongPatientDoc ? errorOf(wrongPatientDoc) : "no other restricted document to test with");
      const unrestrictedShare = await createShare(approver.id, shareInput({ documentId: consentId }));
      check("an unrestricted document cannot be shared (there is nothing to share)", !unrestrictedShare.ok && errorOf(unrestrictedShare).includes(NOT_FOUND_TEXT), errorOf(unrestrictedShare));
      const forgedDocShare = await createShare(approver.id, shareInput({ documentId: FORGED_ID }));
      check("a made-up document id is refused in the same words", !forgedDocShare.ok && errorOf(forgedDocShare) === errorOf(unrestrictedShare), errorOf(forgedDocShare));
      check("the refusals were written to the audit log as denied", (await prisma.auditLog.count({ where: { actorUserId: approver.id, action: "access_denied", resourceType: "document", outcome: "denied" } })) >= 3);
      // The end time passes.
      await prisma.documentAccessGrant.update({ where: { id: s2Id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      check("when the end time passes, access ends by itself", (await restrictedIdsFor(sup.id)).length === 0 && !(await getDocumentForDownload(sup.id, insuranceId)).ok);
      check("an ended share leaves the list of shares in force", !(await listShares(approver.id)).some((s) => s.id === s2Id));
      const s3 = await createShare(approver.id, shareInput({ documentId: insuranceId, duration: "until_revoked" }));
      check("after a share ended, the same one can be made again", s3.ok, errorOf(s3));
      const s3Id = s3.ok ? s3.value.grantId : "";
      trackedResourceIds.push(s3Id);
      check("a share with no end has no end time", (await prisma.documentAccessGrant.findUniqueOrThrow({ where: { id: s3Id } })).expiresAt === null);
      check("an administrator CAN take back a share that already ended", (await revokeShare(approver.id, s2Id)).ok);
      check("...and the open-ended one", (await revokeShare(approver.id, s3Id)).ok);

      section("16f. Sharing restricted documents: only the right people, only the right patients");
      const personRefusals = [
        ["someone who already sees restricted documents (an ADMIN)", approver.id],
        ["someone who already sees restricted documents (a SUPER_ADMIN)", admin.id],
        ["someone with no document permission", noPerms.id],
        ["a care coordinator (no document permission)", coord.id],
        ["someone who does not reach this patient", nurseC.id],
        ["a made-up person", FORGED_STAFF],
      ] as const;
      const personMessages: string[] = [];
      for (const [label, id] of personRefusals) {
        const r = await createShare(approver.id, shareInput({ granteeId: id }));
        personMessages.push(errorOf(r));
        check(`cannot share with ${label}`, !r.ok && errorOf(r).includes(PERSON_TEXT), errorOf(r));
      }
      check("every one of those refusals says the same words (nothing is given away)", new Set(personMessages).size === 1);
      const madeUpPatient = await createShare(approver.id, shareInput({ patientId: "00000000-0000-0000-0000-00000000dead" }));
      check("a made-up patient is refused", !madeUpPatient.ok && errorOf(madeUpPatient).includes("do not have access"), errorOf(madeUpPatient));
      const badDuration = await createShare(approver.id, shareInput({ duration: "forever" }));
      check("an unknown duration is refused", !badDuration.ok, errorOf(badDuration));
      check("none of those attempts created a share", (await activeShareCount()) === sharesBefore);
      const s4 = await createShare(approver.id, shareInput({ granteeId: nurseA.id }));
      check("a nurse on the patient's care team CAN be given access", s4.ok, errorOf(s4));
      const s4Id = s4.ok ? s4.value.grantId : "";
      trackedResourceIds.push(s4Id);
      const nurseRestricted = await restrictedIdsFor(nurseA.id);
      check("the nurse then sees that patient's restricted documents", nurseRestricted.includes(insuranceId) && nurseRestricted.includes(identId));
      check("...can download one", (await getDocumentForDownload(nurseA.id, identId)).ok);
      const nurseOffered = await getDocumentUploadOptions(nurseA.id);
      check("...but is still not offered the restricted kinds to file", nurseOffered !== null && nurseOffered.categories.every((c) => !isRestrictedCategory(c.key)));
      const nurseFile = await uploadDocument(nurseA.id, docInput({ category: "insurance", bytes: pdf("Nurse tries insurance"), title: "Nope" }));
      check("...and still cannot file one", !nurseFile.ok && errorOf(nurseFile).includes("cannot file that kind"), errorOf(nurseFile));
      check("the other nurse on the team sees none of it", (await restrictedIdsFor(nurseB.id)).length === 0);
      check("an outsider still cannot download it", !(await getDocumentForDownload(nurseC.id, insuranceId)).ok);
      check("an administrator CAN take the nurse's access back", (await revokeShare(approver.id, s4Id)).ok);
      check("...and the nurse sees none of it again", (await restrictedIdsFor(nurseA.id)).length === 0);
      // A nurse who later leaves the care team loses the share's effect,
      // because a share never widens reach.
      const s5 = await createShare(approver.id, shareInput({ granteeId: nurseB.id, duration: "7_days" }));
      check("a colleague on the team CAN be given access", s5.ok, errorOf(s5));
      const s5Id = s5.ok ? s5.value.grantId : "";
      trackedResourceIds.push(s5Id);
      await prisma.careTeamMember.updateMany({ where: { patientId: patient.id, userId: nurseB.id, endsAt: null }, data: { endsAt: new Date(Date.now() - 1000) } });
      check("when they leave the care team the share stops working (reach still applies)", (await restrictedIdsFor(nurseB.id)).length === 0 && !(await getDocumentForDownload(nurseB.id, insuranceId)).ok);
      await prisma.careTeamMember.updateMany({ where: { patientId: patient.id, userId: nurseB.id }, data: { endsAt: null } });
      check("an administrator CAN take that back too", (await revokeShare(approver.id, s5Id)).ok);

      section("16g. Sharing restricted documents: the audit trail");
      const shareAudit = (action: string) => prisma.auditLog.count({ where: { action, actorUserId: approver.id, outcome: "allowed" } });
      check("document_access_granted logged for every share (five)", (await shareAudit("document_access_granted")) === 5, String(await shareAudit("document_access_granted")));
      check("document_access_revoked logged for every take-back (five)", (await shareAudit("document_access_revoked")) === 5, String(await shareAudit("document_access_revoked")));
      check("downloads through a share were logged like any download", (await prisma.auditLog.count({ where: { actorUserId: { in: [sup.id, nurseA.id] }, action: "document_downloaded", outcome: "allowed" } })) >= 4);
      const shareAuditText = JSON.stringify(await prisma.auditLog.findMany({ where: { actorUserId: { in: createdUserIds } }, select: { action: true, resourceType: true, resourceId: true, outcome: true, actorEmail: true } }));
      check("the audit log never holds a patient's name or a document's title", !shareAuditText.includes("Testpatient") && !shareAuditText.includes("Insurance card") && !shareAuditText.includes("Photo ID") && !shareAuditText.includes("Second ID"));
      check("finally: nothing is left shared, and the supervisor sees no restricted document", (await activeShareCount()) === sharesBefore && (await restrictedIdsFor(sup.id)).length === 0);
    }
  } finally {
    // ----- Cleanup: leave the database exactly as it was found -----
    section("Cleaning up");
    try {
      // Every temporary patient of this run: the main one, plus any named
      // "Verify ... <run id>" (made for the care team checks, or by
      // accepting a referral). Only ones this script named are ever
      // deleted, so a failing check can never take a real patient with it.
      const madePatients = await prisma.patient.findMany({
        where: { organizationId: orgId, firstName: "Verify", lastName: { contains: runId }, id: { not: patientId || "none" } },
        select: { id: true },
      });
      const testPatientIds = [...(patientId ? [patientId] : []), ...madePatients.map((p) => p.id)];
      trackedResourceIds.push(...testPatientIds);

      // Everything below points at a patient and at the temporary people,
      // and both are protected from deletion while such a row exists, so
      // the rows go first. Each query also catches anything a FAILING
      // check let through, so a failed run still leaves nothing behind.
      const leftoverReferrals = await prisma.referral.findMany({
        where: { OR: [{ patientId: { in: testPatientIds } }, { createdById: { in: createdUserIds } }, { decidedById: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverReferrals.map((r) => r.id));
      await prisma.referral.deleteMany({ where: { id: { in: leftoverReferrals.map((r) => r.id) } } });

      // Shares of restricted documents point at documents, patients and the
      // temporary people, so they go before all of those.
      const leftoverGrants = await prisma.documentAccessGrant.findMany({
        where: { OR: [{ patientId: { in: testPatientIds } }, { granteeId: { in: createdUserIds } }, { grantedById: { in: createdUserIds } }, { revokedById: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverGrants.map((g) => g.id));
      await prisma.documentAccessGrant.deleteMany({ where: { id: { in: leftoverGrants.map((g) => g.id) } } });

      // Documents: the file bytes go with their document.
      const leftoverDocs = await prisma.document.findMany({
        where: { OR: [{ patientId: { in: testPatientIds } }, { uploadedById: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverDocs.map((d) => d.id));
      await prisma.document.deleteMany({ where: { id: { in: leftoverDocs.map((d) => d.id) } } });

      // Care plans: goals go with their plan.
      const leftoverPlans = await prisma.carePlan.findMany({
        where: { OR: [{ patientId: { in: testPatientIds } }, { authorId: { in: createdUserIds } }, { approvedById: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverPlans.map((p) => p.id));
      await prisma.carePlan.deleteMany({ where: { id: { in: leftoverPlans.map((p) => p.id) } } });

      // Visits, including any a failing check let through, so their audit
      // entries are cleaned up too.
      const leftoverVisits = await prisma.visit.findMany({
        where: { OR: [{ patientId: { in: testPatientIds } }, { clinicianId: { in: createdUserIds } }, { scheduledById: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverVisits.map((v) => v.id));
      await prisma.visit.deleteMany({ where: { id: { in: leftoverVisits.map((v) => v.id) } } });

      // Care team rows go with their patient (cascade), but their audit
      // entries are matched by id, so collect the ids first.
      const leftoverTeam = await prisma.careTeamMember.findMany({
        where: { OR: [{ patientId: { in: testPatientIds } }, { userId: { in: createdUserIds } }] },
        select: { id: true },
      });
      trackedResourceIds.push(...leftoverTeam.map((m) => m.id));

      // Now the patients themselves.
      await prisma.patient.deleteMany({ where: { id: { in: madePatients.map((p) => p.id) } } });
      if (patientId) {
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
      if (tempRoleId) await prisma.role.delete({ where: { id: tempRoleId } }); // its permission rows cascade
      for (const roleId of extraTempRoleIds) await prisma.role.delete({ where: { id: roleId } });
      if (otherOrgId) {
        await prisma.patient.deleteMany({ where: { organizationId: otherOrgId } }); // its care team rows cascade
        await prisma.role.deleteMany({ where: { organizationId: otherOrgId } });
        await prisma.organization.delete({ where: { id: otherOrgId } });
      }
      console.log("  removed the temporary patients, care teams, visits, care plans, documents, referrals, people, roles and their audit entries");
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
