// scripts/verify-family.ts
//
// Proves the family portal and the consent rules hold, by trying to break
// them.
//   npm run verify:family
//
// Needs the demo data (npx prisma db seed). Creates temporary patients,
// staff, family accounts, visits, notes, tasks, plans, consents, one
// temporary role and one temporary organization, and removes them (and
// their audit entries) at the end, even when a check fails. Refuses to run
// unless DATABASE_URL points at this machine.
//
// The clock is passed in (a day in 2030), so "upcoming" and "recent" are
// exact and the script gives the same answer on any day.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, getUserPermissions } from "@/lib/auth/authorize";
import { getFamilyCare } from "@/lib/family-portal";
import {
  createConsent,
  getConsentOptions,
  listConsents,
  revokeConsent,
  type CreateConsentInput,
} from "@/lib/family-consents";
import {
  CONSENT_SCOPES,
  MAX_CONSENTS_PER_PATIENT,
  cleanScopes,
  consentExpiry,
  isConsentDuration,
} from "@/lib/family-constants";
import { getMyCare } from "@/lib/patient-portal";
import { getDashboardData } from "@/lib/app/dashboard";
import { buildNavigation, navHrefs } from "@/lib/app/navigation";
import { changeVisitStatus, listVisits } from "@/lib/visits";
import { changeTaskStatus, createTask, listTasks } from "@/lib/tasks";
import { getAccessiblePatients } from "@/lib/patients";
import { listDocuments } from "@/lib/documents";
import { listCarePlans } from "@/lib/care-plans";
import { getCaregiverDay } from "@/lib/caregiver";
import { orgLocalToUtc } from "@/lib/time";

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
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...b].sort().every((k, i) => [...a].sort()[i] === k);
type Res = { ok: true; value: { consentId: string } } | { ok: false; error: string };
const errOf = (r: { ok: boolean; error?: string }) => (r.ok ? "" : (r.error ?? ""));

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Family portal verification");
  const startedAt = new Date();

  const emails = ["admin", "nurse", "supervisor", "coordinator", "caregiver", "patient", "family"].map((n) => `demo.${n}@cheliv.test`);
  const found = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (found.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse, supervisor, coordinator, caregiver, demoPatientUser, demoFamily] = found as NonNullable<(typeof found)[number]>[];
  const orgId = admin.organizationId;
  const eleanor = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Eleanor" } });
  const roleId = async (key: string) => (await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key } })).id;

  const tempUserIds: string[] = [];
  const patientIds: string[] = [];
  const visitIds: string[] = [];
  const noteIds: string[] = [];
  const taskIds: string[] = [];
  const teamIds: string[] = [];
  const planIds: string[] = [];
  const orgIds: string[] = [];
  const consentIds: string[] = [];
  const tempRoleIds: string[] = [];
  const runId = Date.now().toString(36);
  const mkUser = async (tag: string, role: string) => {
    const u = await prisma.user.create({
      data: { organizationId: orgId, email: `verify-fam-${runId}-${tag}@cheliv.test`, passwordHash: "not-a-real-hash", name: `Verify ${tag}` },
    });
    await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(role) } });
    tempUserIds.push(u.id);
    return u;
  };
  const mkPatient = async (tag: string, over: Partial<{ userId: string; status: string; organizationId: string }> = {}) => {
    const p = await prisma.patient.create({
      data: { organizationId: over.organizationId ?? orgId, firstName: `Fam${tag}`, lastName: "Verify", dateOfBirth: new Date("1950-01-01T00:00:00Z"), status: over.status ?? "active", userId: over.userId ?? null },
    });
    patientIds.push(p.id);
    return p;
  };

  // The pretend clock: 10:00 office time on 15 June 2030.
  const NOW = orgLocalToUtc("2030-06-15T10:00")!;
  const at = (localDateTime: string, minutes = 60) => {
    const start = orgLocalToUtc(localDateTime)!;
    return { start, end: new Date(start.getTime() + minutes * 60000) };
  };
  const mkVisit = async (patientId: string, clinicianId: string, localDateTime: string, status = "scheduled", minutes = 60) => {
    const { start, end } = at(localDateTime, minutes);
    const v = await prisma.visit.create({
      data: { organizationId: orgId, patientId, clinicianId, scheduledById: admin.id, visitType: "skilled_nursing", status, scheduledStart: start, scheduledEnd: end },
    });
    visitIds.push(v.id);
    return v.id;
  };

  try {
    // A temporary administrator does the recording, so every audit entry
    // this script causes can be found and removed by actor.
    const tempAdmin = await mkUser("adm", "ADMIN");
    let recordedByAdmin = 0;
    const record = async (actorId: string, input: CreateConsentInput): Promise<Res> => {
      const r = (await createConsent(actorId, input)) as Res;
      if (r.ok) {
        consentIds.push(r.value.consentId);
        if (actorId === tempAdmin.id) recordedByAdmin++;
      }
      return r;
    };

    section("0. The agreed permission sets, the pure rules and the seeded demo family account");
    const famPerms = await getUserPermissions(demoFamily.id);
    check("the demo family account holds exactly family.read", sameSet(famPerms, ["family.read"]), famPerms.join(", "));
    const holders = async (key: string) =>
      (await prisma.rolePermission.findMany({ where: { permission: { key }, role: { organizationId: orgId } }, include: { role: true } })).map((h) => h.role.key);
    check("only AUTHORIZED_FAMILY and SUPER_ADMIN hold family.read", sameSet(await holders("family.read"), ["AUTHORIZED_FAMILY", "SUPER_ADMIN"]));
    check("only ADMIN and SUPER_ADMIN hold consents.manage", sameSet(await holders("consents.manage"), ["ADMIN", "SUPER_ADMIN"]));
    const demoView = await getFamilyCare(demoFamily.id);
    check("the demo family member sees Eleanor, as her son or daughter", demoView.length === 1 && demoView[0].patientName === "Eleanor Whitfield" && demoView[0].relationshipLabel === "Son or daughter");
    check("the demo consent shares the visit schedule and the care team, not the care plan", demoView[0].visits !== null && demoView[0].team !== null && demoView[0].plan === null);
    check("a list of scopes is cleaned into the fixed order, without repeats", JSON.stringify(cleanScopes(["care_plan", "visits", "visits"])) === JSON.stringify(["visits", "care_plan"]));
    check("an empty list of scopes is refused", cleanScopes([]) === null);
    check("an unknown scope anywhere in the list refuses the whole list", cleanScopes(["visits", "notes"]) === null && cleanScopes(["documents"]) === null);
    check("exactly the three agreed scopes exist", sameSet(CONSENT_SCOPES.map((s) => s.key), ["visits", "care_team", "care_plan"]));
    const d0 = new Date("2030-01-01T00:00:00.000Z");
    check("a 90 day consent ends in 90 days, a 1 year consent in 365, an open one never", consentExpiry("90_days", d0)!.getTime() === d0.getTime() + 90 * 86400000 && consentExpiry("1_year", d0)!.getTime() === d0.getTime() + 365 * 86400000 && consentExpiry("until_revoked", d0) === null);
    check("an unknown duration is not a duration", !isConsentDuration("forever") && !isConsentDuration(""));

    section("1. Who is stopped at the door");
    const tempFam = await mkUser("fam", "AUTHORIZED_FAMILY");
    const tempPatientRole = await mkUser("ptrole", "PATIENT");
    const anyId = "00000000-0000-0000-0000-00000000dead";
    for (const [label, who] of [
      ["a patient account", tempPatientRole],
      ["a nurse", nurse],
      ["a supervisor", supervisor],
      ["a coordinator", coordinator],
      ["a caregiver", caregiver],
    ] as const) {
      check(`${label} cannot open the family portal`, await throwsAuth(() => getFamilyCare(who.id, NOW)));
    }
    for (const [label, who] of [
      ["a family account", tempFam],
      ["a patient account", tempPatientRole],
      ["a nurse", nurse],
      ["a supervisor", supervisor],
      ["a coordinator", coordinator],
      ["a caregiver", caregiver],
    ] as const) {
      check(`${label} cannot list consents`, await throwsAuth(() => listConsents(who.id)));
      check(`${label} cannot record a consent`, await throwsAuth(() => createConsent(who.id, { patientId: eleanor.id, familyUserId: tempFam.id, relationship: "friend", scopes: ["visits"], duration: "until_revoked", confirmed: "yes" })));
      check(`${label} cannot withdraw a consent`, await throwsAuth(() => revokeConsent(who.id, anyId)));
      check(`${label} gets no consent form`, (await getConsentOptions(who.id)) === null);
    }
    const familyDenied = await prisma.auditLog.count({ where: { actorUserId: { in: [tempPatientRole.id, nurse.id, supervisor.id, coordinator.id, caregiver.id] }, action: "permission_denied", resourceId: "family.read", outcome: "denied", occurredAt: { gte: startedAt } } });
    check("the family portal refusals were written to the audit log", familyDenied >= 5, String(familyDenied));
    const consentDenied = await prisma.auditLog.count({ where: { actorUserId: { in: [tempFam.id, tempPatientRole.id, nurse.id, supervisor.id, coordinator.id, caregiver.id] }, action: "permission_denied", resourceId: "consents.manage", outcome: "denied", occurredAt: { gte: startedAt } } });
    check("the consent refusals were written to the audit log", consentDenied >= 18, String(consentDenied));
    check("none of those attempts created a consent", (await prisma.familyConsent.count({ where: { OR: [{ familyUserId: tempFam.id }, { grantedById: { in: [tempFam.id, tempPatientRole.id, nurse.id, supervisor.id, coordinator.id, caregiver.id] } }] } })) === 0);

    section("2. An account with no consent gets nothing, never everybody");
    check("a family account with no consent sees nobody", (await getFamilyCare(tempFam.id, NOW)).length === 0);
    check("an administrator holds the permission but has no consent, so sees nobody", (await getFamilyCare(admin.id, NOW)).length === 0);

    section("3. A consent shows exactly the parts it names, of exactly one patient");
    const me = await mkPatient("Me");
    const them = await mkPatient("Them");
    const hereNow = await mkVisit(me.id, nurse.id, "2030-06-15T09:00", "in_progress");
    const soon = await mkVisit(me.id, nurse.id, "2030-06-16T09:00");
    const later = await mkVisit(me.id, caregiver.id, "2030-06-20T14:00");
    const endedToday = await mkVisit(me.id, nurse.id, "2030-06-15T07:00");
    const cancelled = await mkVisit(me.id, nurse.id, "2030-06-17T09:00", "cancelled");
    const missed = await mkVisit(me.id, nurse.id, "2030-06-18T09:00", "missed");
    const done1 = await mkVisit(me.id, nurse.id, "2030-06-10T09:00", "completed");
    const done2 = await mkVisit(me.id, nurse.id, "2030-06-12T09:00", "completed");
    const theirVisit = await mkVisit(them.id, nurse.id, "2030-06-16T11:00");
    const m1 = await prisma.careTeamMember.create({ data: { patientId: me.id, userId: nurse.id, roleOnCase: "primary_nurse" } });
    const m2 = await prisma.careTeamMember.create({ data: { patientId: me.id, userId: caregiver.id, roleOnCase: "caregiver" } });
    const m3 = await prisma.careTeamMember.create({ data: { patientId: me.id, userId: supervisor.id, roleOnCase: "caregiver", endsAt: new Date(NOW.getTime() - 86400000) } });
    const m4 = await prisma.careTeamMember.create({ data: { patientId: them.id, userId: coordinator.id, roleOnCase: "caregiver" } });
    teamIds.push(m1.id, m2.id, m3.id, m4.id);
    const planBase = { organizationId: orgId, patientId: me.id, authorId: nurse.id };
    const draft = await prisma.carePlan.create({ data: { ...planBase, status: "draft", title: "SECRETDRAFTTITLE", summary: "SECRETDRAFTSUMMARY", goals: { create: [{ position: 0, description: "SECRETDRAFTGOAL" }] } } });
    const oldPlan = await prisma.carePlan.create({ data: { ...planBase, status: "completed", title: "SECRETOLDTITLE", summary: "SECRETOLDSUMMARY" } });
    const active = await prisma.carePlan.create({
      data: { ...planBase, approvedById: admin.id, approvedAt: NOW, status: "active", title: "Walking steadily", summary: "A plan for steady walking.", goals: { create: [{ position: 1, description: "Second goal", status: "met", metAt: NOW }, { position: 0, description: "First goal" }] } },
    });
    const themPlan = await prisma.carePlan.create({ data: { organizationId: orgId, patientId: them.id, authorId: nurse.id, approvedById: admin.id, approvedAt: NOW, status: "active", title: "THEMPLANTITLE", summary: "THEMPLANSUMMARY" } });
    planIds.push(draft.id, oldPlan.id, active.id, themPlan.id);
    const note = await prisma.visitNote.create({ data: { organizationId: orgId, visitId: done1, authorId: nurse.id, content: "SECRETNOTEWORDS", status: "reviewed", reviewedById: supervisor.id, reviewedAt: NOW } });
    noteIds.push(note.id);
    const task = await prisma.task.create({ data: { organizationId: orgId, patientId: me.id, assigneeId: nurse.id, createdById: admin.id, title: "SECRETTASKTITLE" } });
    taskIds.push(task.id);

    const f1 = await mkUser("f1", "AUTHORIZED_FAMILY"); // visits only
    const f2 = await mkUser("f2", "AUTHORIZED_FAMILY"); // care team only
    const f3 = await mkUser("f3", "AUTHORIZED_FAMILY"); // care plan only
    const f4 = await mkUser("f4", "AUTHORIZED_FAMILY"); // all three
    const base = (over: Partial<CreateConsentInput> = {}): CreateConsentInput => ({ patientId: me.id, familyUserId: f4.id, relationship: "adult_child", scopes: ["visits"], duration: "until_revoked", confirmed: "yes", ...over });
    const c1 = await record(tempAdmin.id, base({ familyUserId: f1.id, scopes: ["visits"] }));
    const c2 = await record(tempAdmin.id, base({ familyUserId: f2.id, scopes: ["care_team"], relationship: "sibling" }));
    const c3 = await record(tempAdmin.id, base({ familyUserId: f3.id, scopes: ["care_plan"], relationship: "friend" }));
    const c4 = await record(tempAdmin.id, base({ familyUserId: f4.id, scopes: ["care_plan", "care_team", "visits"] }));
    check("the administrator CAN record four consents", c1.ok && c2.ok && c3.ok && c4.ok, [c1, c2, c3, c4].map(errOf).join(" | "));
    const row4 = await prisma.familyConsent.findUniqueOrThrow({ where: { id: (c4 as { value: { consentId: string } }).value.consentId } });
    check("a consent records who recorded it, the fixed order of scopes and no end", row4.grantedById === tempAdmin.id && JSON.stringify(row4.scopes) === JSON.stringify(["visits", "care_team", "care_plan"]) && row4.expiresAt === null && row4.revokedAt === null);

    const v1 = (await getFamilyCare(f1.id, NOW))[0];
    const v2 = (await getFamilyCare(f2.id, NOW))[0];
    const v3 = (await getFamilyCare(f3.id, NOW))[0];
    const v4 = (await getFamilyCare(f4.id, NOW))[0];
    check("each family account sees exactly one patient", [v1, v2, v3, v4].every((v) => v !== undefined) && (await Promise.all([f1, f2, f3, f4].map(async (f) => (await getFamilyCare(f.id, NOW)).length))).every((n) => n === 1));
    check("visits only: visits shared, care team and care plan NOT shared", v1.visits !== null && v1.team === null && v1.plan === null);
    check("care team only: only the team is shared", v2.visits === null && v2.team !== null && v2.plan === null);
    check("care plan only: only the plan is shared", v3.visits === null && v3.team === null && v3.plan !== null);
    check("all three: everything named is shared", v4.visits !== null && v4.team !== null && v4.plan !== null);
    const upIds = v4.visits!.upcoming.map((v) => v.id);
    check("upcoming holds the visit happening now, then the scheduled ones, soonest first", JSON.stringify(upIds) === JSON.stringify([hereNow, soon, later]), upIds.join(","));
    check("a scheduled visit whose window is over, and cancelled or missed visits, are not upcoming", ![endedToday, cancelled, missed].some((id) => upIds.includes(id)));
    check("recent holds completed visits only, newest first", JSON.stringify(v4.visits!.recent.map((v) => v.id)) === JSON.stringify([done2, done1]));
    check("the team lists the two people on it now, not the one whose assignment ended", sameSet(v4.team!.map((t) => t.name), [nurse.name, caregiver.name]) && v4.team!.every((t) => t.roleLabel.length > 0 && !t.roleLabel.includes("_")));
    check("only the active plan is shown, with its goals in order and done marked", v4.plan!.plan?.title === "Walking steadily" && v4.plan!.plan.goals.map((g) => `${g.description}:${g.met}`).join("|") === "First goal:false|Second goal:true");
    check("a part that is not shared carries none of its words (visits-only account sees no plan words)", !JSON.stringify(v1).includes("Walking steadily") && !JSON.stringify(v1).includes("First goal") && !JSON.stringify(v1).includes("steady walking"));
    check("a part that is not shared carries none of its words (plan-only account sees no visit or staff)", !JSON.stringify(v3).includes(hereNow) && !JSON.stringify(v3).includes(nurse.name) && !JSON.stringify(v3).includes(caregiver.name));
    check("the relationship is shown in plain words", v1.relationshipLabel === "Son or daughter" && v2.relationshipLabel === "Brother or sister" && v3.relationshipLabel === "Friend");
    check("nothing shows when it ends: an open consent says so", v4.sharedUntil === null);
    const everything = JSON.stringify([v1, v2, v3, v4]);
    check("another patient's visits, team and plan are never shown", !everything.includes(theirVisit) && !everything.includes("THEMPLAN") && !everything.includes(coordinator.name));
    check("no visit note words, no task title, no draft or finished plan words", !everything.includes("SECRETNOTEWORDS") && !everything.includes("SECRETTASKTITLE") && !everything.includes("SECRETDRAFT") && !everything.includes("SECRETOLD"));
    check("no e-mail address, no internal id of a person, no date of birth and no record id", !everything.includes("@cheliv.test") && !everything.includes(nurse.id) && !everything.includes(admin.id) && !everything.includes(me.id) && !everything.includes("1950"));
    check("the patient is named for the family member, first and last", v4.patientName === "FamMe Verify" && v4.patientFirstName === "FamMe");

    section("4. Time, withdrawal, status and organization all end access");
    const mkRow = async (familyUserId: string, patientId: string, over: Partial<{ organizationId: string; expiresAt: Date | null; revokedAt: Date | null }> = {}) => {
      const r = await prisma.familyConsent.create({
        data: { organizationId: over.organizationId ?? orgId, patientId, familyUserId, relationship: "friend", scopes: ["visits", "care_team", "care_plan"], grantedById: tempAdmin.id, expiresAt: over.expiresAt ?? null, revokedAt: over.revokedAt ?? null },
      });
      consentIds.push(r.id);
      return r;
    };
    const f5 = await mkUser("f5", "AUTHORIZED_FAMILY");
    await mkRow(f5.id, me.id, { expiresAt: new Date(NOW.getTime() + 3600000) });
    check("a consent that has not run out yet shows", (await getFamilyCare(f5.id, NOW)).length === 1);
    check("the same consent shows nothing once its end time has passed", (await getFamilyCare(f5.id, new Date(NOW.getTime() + 2 * 3600000))).length === 0);
    check("an end date shows to the family member while it lasts", (await getFamilyCare(f5.id, NOW))[0].sharedUntil?.getTime() === NOW.getTime() + 3600000);
    const f6 = await mkUser("f6", "AUTHORIZED_FAMILY");
    await mkRow(f6.id, me.id, { revokedAt: new Date(NOW.getTime() - 60000) });
    check("a withdrawn consent shows nothing", (await getFamilyCare(f6.id, NOW)).length === 0);
    const f7 = await mkUser("f7", "AUTHORIZED_FAMILY");
    const gonePatient = await mkPatient("Gone", { status: "discharged" });
    await mkRow(f7.id, gonePatient.id);
    check("a discharged patient shows nothing", (await getFamilyCare(f7.id, NOW)).length === 0);
    const f7b = await mkUser("f7b", "AUTHORIZED_FAMILY");
    const holdPatient = await mkPatient("Hold", { status: "on_hold" });
    await mkRow(f7b.id, holdPatient.id);
    check("a patient on hold still shows", (await getFamilyCare(f7b.id, NOW)).length === 1);
    const otherOrg = await prisma.organization.create({ data: { name: `Verify org ${runId}` } });
    orgIds.push(otherOrg.id);
    const f8 = await mkUser("f8", "AUTHORIZED_FAMILY");
    const foreignPatient = await mkPatient("Foreign", { organizationId: otherOrg.id });
    await mkRow(f8.id, foreignPatient.id);
    check("a consent that points at a patient of another organization shows nothing", (await getFamilyCare(f8.id, NOW)).length === 0);
    const f8b = await mkUser("f8b", "AUTHORIZED_FAMILY");
    await mkRow(f8b.id, me.id, { organizationId: otherOrg.id });
    check("a consent written in another organization shows nothing", (await getFamilyCare(f8b.id, NOW)).length === 0);
    check("someone else's consent gives an account with none nothing", (await getFamilyCare(tempFam.id, NOW)).length === 0);
    const two = await mkUser("two", "AUTHORIZED_FAMILY");
    const twoPatient = await mkPatient("Two");
    await mkRow(two.id, me.id);
    await mkRow(two.id, twoPatient.id);
    check("one account can be shared with by two patients, and sees both", (await getFamilyCare(two.id, NOW)).length === 2);
    const ninety = await mkUser("ninety", "AUTHORIZED_FAMILY");
    const cNinety = await record(tempAdmin.id, base({ patientId: twoPatient.id, familyUserId: ninety.id, duration: "90_days" }));
    const rowNinety = cNinety.ok ? await prisma.familyConsent.findUniqueOrThrow({ where: { id: cNinety.value.consentId } }) : null;
    check("a 90 day consent recorded through the service ends 90 days after it was recorded", rowNinety !== null && rowNinety.expiresAt !== null && Math.abs(rowNinety.expiresAt.getTime() - (rowNinety.createdAt.getTime() + 90 * 86400000)) < 2000);
    check("...and is shown until then and not after", rowNinety !== null && (await getFamilyCare(ninety.id, new Date(rowNinety.createdAt.getTime() + 89 * 86400000))).length === 1 && (await getFamilyCare(ninety.id, new Date(rowNinety.createdAt.getTime() + 91 * 86400000))).length === 0);

    section("5. Recording: every way to do it wrongly");
    const countConsents = () => prisma.familyConsent.count({ where: { patientId: { in: patientIds } } });
    const before = await countConsents();
    const g1 = await mkUser("g1", "AUTHORIZED_FAMILY");
    const target = await mkPatient("Target");
    const tb = (over: Partial<CreateConsentInput> = {}) => base({ patientId: target.id, familyUserId: g1.id, ...over });
    for (const [label, over] of [
      ["the confirmation missing", { confirmed: "" }],
      ["the confirmation saying no", { confirmed: "no" }],
      ["the confirmation saying true", { confirmed: "true" }],
      ["an unknown relationship", { relationship: "neighbour" }],
      ["a blank relationship", { relationship: "" }],
      ["no scopes", { scopes: [] }],
      ["an unknown scope", { scopes: ["notes"] }],
      ["a known scope next to an unknown one", { scopes: ["visits", "documents"] }],
      ["an unknown duration", { duration: "forever" }],
      ["a blank duration", { duration: "" }],
    ] as const) {
      const r = await record(tempAdmin.id, tb(over as Partial<CreateConsentInput>));
      check(`refuses: ${label}`, !r.ok, r.ok ? "it was accepted" : "");
    }
    check("none of those refused consents were saved", (await countConsents()) === before);
    const okOne = await record(tempAdmin.id, tb());
    check("a complete request is accepted", okOne.ok, errOf(okOne));
    const dup = await record(tempAdmin.id, tb({ scopes: ["care_plan"] }));
    check("a second consent for the same person and patient is refused", !dup.ok && errOf(dup).includes("already has a permission"), errOf(dup));
    const otherPatientOk = await record(tempAdmin.id, tb({ patientId: twoPatient.id }));
    check("the same person CAN have a consent for a different patient", otherPatientOk.ok, errOf(otherPatientOk));

    const selfFam = await mkUser("self", "AUTHORIZED_FAMILY");
    const selfPatient = await mkPatient("Self", { userId: selfFam.id });
    const adminAsFamily = await record(tempAdmin.id, tb({ familyUserId: tempAdmin.id }));
    const nurseAsFamily = await record(tempAdmin.id, tb({ familyUserId: nurse.id }));
    const patientAsFamily = await record(tempAdmin.id, tb({ familyUserId: tempPatientRole.id }));
    const madeUpFamily = await record(tempAdmin.id, tb({ familyUserId: anyId }));
    const foreignUser = await prisma.user.create({ data: { organizationId: otherOrg.id, email: `verify-fam-${runId}-foreign@cheliv.test`, passwordHash: "x", name: "Verify foreign" } });
    tempUserIds.push(foreignUser.id);
    await prisma.userRole.create({ data: { userId: foreignUser.id, roleId: (await prisma.role.create({ data: { organizationId: otherOrg.id, key: "AUTHORIZED_FAMILY", name: "Foreign family" } })).id } });
    const foreignAsFamily = await record(tempAdmin.id, tb({ familyUserId: foreignUser.id }));
    const ownAccount = await record(tempAdmin.id, base({ patientId: selfPatient.id, familyUserId: selfFam.id }));
    const badPeople = [adminAsFamily, nurseAsFamily, patientAsFamily, madeUpFamily, foreignAsFamily, ownAccount];
    check("cannot give access to an administrator, a nurse, a patient account, a made-up person, another organization's account or the patient's own account", badPeople.every((r) => !r.ok));
    check("every one of those refusals says the same words (nothing is given away)", new Set(badPeople.map(errOf)).size === 1 && errOf(badPeople[0]).includes("cannot be given access"), badPeople.map(errOf).join(" | "));
    const dischargedTry = await record(tempAdmin.id, tb({ patientId: gonePatient.id }));
    const madeUpPatient = await record(tempAdmin.id, tb({ patientId: anyId }));
    const foreignPatientTry = await record(tempAdmin.id, tb({ patientId: foreignPatient.id }));
    const badPatients = [dischargedTry, madeUpPatient, foreignPatientTry];
    check("cannot record for a discharged patient, a made-up patient or another organization's patient", badPatients.every((r) => !r.ok));
    check("those three sound identical", new Set(badPatients.map(errOf)).size === 1 && errOf(badPatients[0]).includes("do not have access"), badPatients.map(errOf).join(" | "));
    const onHoldOk = await record(tempAdmin.id, tb({ patientId: holdPatient.id }));
    check("a patient on hold CAN have a consent recorded", onHoldOk.ok, errOf(onHoldOk));
    const refusedAudit = await prisma.auditLog.count({ where: { actorUserId: tempAdmin.id, action: "access_denied", outcome: "denied", occurredAt: { gte: startedAt } } });
    check("the refusals about people and patients were written to the audit log as denied", refusedAudit >= 9, String(refusedAudit));
    const refusedPeopleRows = await prisma.familyConsent.count({ where: { familyUserId: { in: [tempAdmin.id, nurse.id, tempPatientRole.id, foreignUser.id, selfFam.id] } } });
    const refusedPatientRows = await prisma.familyConsent.count({ where: { patientId: { in: [gonePatient.id, foreignPatient.id] }, familyUserId: g1.id } });
    check("no consent exists for the refused people or for the refused patients", refusedPeopleRows === 0 && refusedPatientRows === 0, `${refusedPeopleRows} and ${refusedPatientRows}`);

    section("5b. A patient has a limited number of people, and two clicks at once are handled one after the other");
    const full = await mkPatient("Full");
    const limitResults: Res[] = [];
    for (let i = 0; i < MAX_CONSENTS_PER_PATIENT; i++) {
      const u = await mkUser(`lim${i}`, "AUTHORIZED_FAMILY");
      limitResults.push(await record(tempAdmin.id, base({ patientId: full.id, familyUserId: u.id })));
    }
    check(`${MAX_CONSENTS_PER_PATIENT} people can be given access`, limitResults.every((r) => r.ok));
    const overflowUser = await mkUser("limover", "AUTHORIZED_FAMILY");
    const overflow = await record(tempAdmin.id, base({ patientId: full.id, familyUserId: overflowUser.id }));
    check("an eleventh is refused", !overflow.ok && errOf(overflow).includes("at most"), errOf(overflow));
    await revokeConsent(tempAdmin.id, (limitResults[0] as { value: { consentId: string } }).value.consentId);
    const afterFree = await record(tempAdmin.id, base({ patientId: full.id, familyUserId: overflowUser.id }));
    check("withdrawing one makes room for another", afterFree.ok, errOf(afterFree));

    const raceP = await mkPatient("Race");
    const raceU = await mkUser("race", "AUTHORIZED_FAMILY");
    const [r1, r2] = await Promise.all([record(tempAdmin.id, base({ patientId: raceP.id, familyUserId: raceU.id })), record(tempAdmin.id, base({ patientId: raceP.id, familyUserId: raceU.id }))]);
    check("two simultaneous consents for the same person and patient: exactly one succeeds", [r1, r2].filter((r) => r.ok).length === 1);
    check("...and only one is in force", (await prisma.familyConsent.count({ where: { patientId: raceP.id, familyUserId: raceU.id, revokedAt: null } })) === 1);

    const lockP = await mkPatient("Lock");
    const lockU = await mkUser("lock", "AUTHORIZED_FAMILY");
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM patients WHERE id = ${lockP.id} FOR UPDATE`;
        await held;
      },
      { timeout: 20000 },
    );
    await new Promise((r) => setTimeout(r, 300));
    const waiting = record(tempAdmin.id, base({ patientId: lockP.id, familyUserId: lockU.id }));
    const finishedEarly = await Promise.race([waiting.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 1200))]);
    check("recording waits while the patient's row is locked by someone else (the row lock)", finishedEarly === false);
    release();
    await holder;
    check("...and goes through once the lock is released", (await waiting).ok);

    section("5c. Someone whose reach is only some patients records and withdraws only for those");
    const consentPerm = await prisma.permission.findUniqueOrThrow({ where: { key: "consents.manage" } });
    const scopedRole = await prisma.role.create({ data: { organizationId: orgId, key: `VERIFYCM_${runId}`, name: "Verify consent manager" } });
    tempRoleIds.push(scopedRole.id);
    await prisma.rolePermission.create({ data: { roleId: scopedRole.id, permissionId: consentPerm.id } });
    const scoped = await prisma.user.create({ data: { organizationId: orgId, email: `verify-fam-${runId}-scoped@cheliv.test`, passwordHash: "x", name: "Verify scoped" } });
    tempUserIds.push(scoped.id);
    await prisma.userRole.create({ data: { userId: scoped.id, roleId: scopedRole.id } });
    const patA = await mkPatient("ScopeA");
    const patB = await mkPatient("ScopeB");
    const tm = await prisma.careTeamMember.create({ data: { patientId: patA.id, userId: scoped.id, roleOnCase: "primary_nurse" } });
    teamIds.push(tm.id);
    const sa = await mkUser("sa", "AUTHORIZED_FAMILY");
    const sb = await mkUser("sb", "AUTHORIZED_FAMILY");
    const consentB = await record(tempAdmin.id, base({ patientId: patB.id, familyUserId: sb.id }));
    const opts = await getConsentOptions(scoped.id);
    check("the form offers only the patient they reach", opts !== null && opts.patients.length === 1 && opts.patients[0].patientId === patA.id);
    const forB = await record(scoped.id, base({ patientId: patB.id, familyUserId: sa.id }));
    check("cannot record for a patient outside their reach", !forB.ok && errOf(forB).includes("do not have access"), errOf(forB));
    const forA = await record(scoped.id, base({ patientId: patA.id, familyUserId: sa.id }));
    check("CAN record for a patient they reach", forA.ok, errOf(forA));
    const scopedList = (await listConsents(scoped.id)).map((c) => c.id);
    check("their list holds only consents for patients they reach", forA.ok && scopedList.includes(forA.value.consentId) && consentB.ok && !scopedList.includes(consentB.value.consentId));
    const revB = consentB.ok ? await revokeConsent(scoped.id, consentB.value.consentId) : null;
    const revMadeUp = await revokeConsent(scoped.id, anyId);
    check("cannot withdraw a consent outside their reach, and it sounds like a consent that does not exist", revB !== null && !revB.ok && errOf(revB) === errOf(revMadeUp) && errOf(revMadeUp).includes("could not be found"));
    check("...and that consent is still in force", consentB.ok && (await getFamilyCare(sb.id, NOW)).length === 1);
    const revA = forA.ok ? await revokeConsent(scoped.id, forA.value.consentId) : null;
    check("CAN withdraw a consent they reach", revA !== null && revA.ok);

    section("6. Withdrawing ends access at once and deletes nothing");
    const w1 = await mkUser("w1", "AUTHORIZED_FAMILY");
    const wPatient = await mkPatient("Withdraw");
    const wc = await record(tempAdmin.id, base({ patientId: wPatient.id, familyUserId: w1.id }));
    const wcId = wc.ok ? wc.value.consentId : anyId;
    check("before: the family member sees the patient", (await getFamilyCare(w1.id, NOW)).length === 1);
    check("the family member cannot withdraw it themselves", await throwsAuth(() => revokeConsent(w1.id, wcId)));
    check("...and it is still in force", (await getFamilyCare(w1.id, NOW)).length === 1);
    const wForeignRow = await mkRow(f8.id, foreignPatient.id, { organizationId: otherOrg.id });
    const wForeign = await revokeConsent(tempAdmin.id, wForeignRow.id);
    const wMadeUp = await revokeConsent(tempAdmin.id, anyId);
    check("a consent of another organization sounds exactly like one that does not exist", !wForeign.ok && !wMadeUp.ok && errOf(wForeign) === errOf(wMadeUp) && errOf(wMadeUp).includes("could not be found"));
    check("...and it was not withdrawn", (await prisma.familyConsent.findUniqueOrThrow({ where: { id: wForeignRow.id } })).revokedAt === null);
    const wDone = await revokeConsent(tempAdmin.id, wcId);
    check("an administrator CAN withdraw it", wDone.ok, errOf(wDone));
    const wRow = await prisma.familyConsent.findUniqueOrThrow({ where: { id: wcId } });
    check("withdrawing records who and when, and deletes nothing", wRow.revokedById === tempAdmin.id && wRow.revokedAt !== null);
    check("access ends at once", (await getFamilyCare(w1.id, NOW)).length === 0);
    const wAgain = await revokeConsent(tempAdmin.id, wcId);
    check("a consent cannot be withdrawn twice", !wAgain.ok && errOf(wAgain).includes("already withdrawn"), errOf(wAgain));
    check("a withdrawn consent leaves the list of consents in force", !(await listConsents(tempAdmin.id)).some((c) => c.id === wcId));
    const wNew = await record(tempAdmin.id, base({ patientId: wPatient.id, familyUserId: w1.id, scopes: ["care_team"] }));
    check("a new consent CAN be recorded for the same person afterwards (a new row)", wNew.ok && wNew.value.consentId !== wcId && (await prisma.familyConsent.count({ where: { patientId: wPatient.id, familyUserId: w1.id } })) === 2, errOf(wNew));
    const w1View = (await getFamilyCare(w1.id, NOW))[0];
    check("...and it shows only what the new one names", w1View !== undefined && w1View.team !== null && w1View.visits === null && w1View.plan === null);
    const listed = await listConsents(tempAdmin.id);
    const l4 = listed.find((c) => consentIds.includes(c.id) && c.familyName === f4.name);
    check("the office list shows the person, the patient, what is shared and who recorded it", l4 !== undefined && l4.patientName === "FamMe Verify" && sameSet(l4.scopeLabels, ["Visit schedule", "Care team", "Care plan"]) && l4.recordedByName === tempAdmin.name);
    const opts2 = await getConsentOptions(tempAdmin.id);
    check("the form offers active and on hold patients, never a discharged one", opts2 !== null && opts2.patients.some((p) => p.patientId === holdPatient.id) && !opts2.patients.some((p) => p.patientId === gonePatient.id) && !opts2.patients.some((p) => p.patientId === foreignPatient.id));
    check("the form offers only family accounts of this organization", opts2 !== null && opts2.people.some((p) => p.id === f4.id) && !opts2.people.some((p) => p.id === nurse.id || p.id === foreignUser.id));

    section("7. A family account opens no staff screen and changes nothing");
    check("cannot list visits", await throwsAuth(() => listVisits(f4.id)));
    check("cannot change a visit", await throwsAuth(() => changeVisitStatus(f4.id, soon, "cancel")));
    check("cannot list patients", await throwsAuth(() => getAccessiblePatients(f4.id)));
    check("cannot list documents", await throwsAuth(() => listDocuments(f4.id)));
    check("cannot list care plans", await throwsAuth(() => listCarePlans(f4.id)));
    check("cannot list tasks", await throwsAuth(() => listTasks(f4.id)));
    check("cannot create a task", await throwsAuth(() => createTask(f4.id, { title: "x", details: "", dueDate: "", patientId: "", assigneeId: f4.id })));
    check("cannot finish a task", await throwsAuth(() => changeTaskStatus(f4.id, task.id, "complete")));
    check("cannot open the caregiver day", await throwsAuth(() => getCaregiverDay(f4.id, NOW)));
    check("cannot open the patient portal", await throwsAuth(() => getMyCare(f4.id, NOW)));
    check("the patient portal account cannot open the family portal", await throwsAuth(() => getFamilyCare(demoPatientUser.id, NOW)));
    check("the visit and the task are exactly as they were", (await prisma.visit.findUniqueOrThrow({ where: { id: soon } })).status === "scheduled" && (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status === "open");

    section("8. The menu and the dashboard");
    const permsOf = async (id: string) => new Set(await getUserPermissions(id));
    check("the family menu holds the dashboard and Shared with me, nothing else", sameSet(navHrefs(buildNavigation(await permsOf(f4.id))), ["/dashboard", "/family"]));
    check("holding only family.read adds exactly one item", sameSet(navHrefs(buildNavigation(new Set(["family.read"]))), ["/dashboard", "/family"]));
    check("holding only consents.manage adds exactly one item", sameSet(navHrefs(buildNavigation(new Set(["consents.manage"]))), ["/dashboard", "/consents"]));
    const linkless = await Promise.all([nurse, coordinator, supervisor, caregiver].map(async (u) => navHrefs(buildNavigation(await permsOf(u.id))).some((h) => h === "/family" || h === "/consents")));
    check("a nurse, a coordinator, a supervisor and a caregiver get neither link", linkless.every((x) => x === false));
    const adminMenu = navHrefs(buildNavigation(await permsOf(tempAdmin.id)));
    check("an administrator's menu holds Family access but not Shared with me", adminMenu.includes("/consents") && !adminMenu.includes("/family"));
    const dash4 = await getDashboardData(f4.id, await permsOf(f4.id), NOW);
    check("the dashboard has one tile: visits coming up, counting three", dash4.tiles.length === 1 && dash4.tiles[0].key === "shared-upcoming-visits" && dash4.tiles[0].value === 3 && dash4.tiles[0].href === "/family");
    check("no other section exists", dash4.todaysVisits === null && dash4.referrals === null && dash4.needsPrimaryNurse === null && dash4.plansToApprove === null && dash4.recentActivity === null && dash4.attention.length === 0);
    const dash2 = await getDashboardData(f2.id, await permsOf(f2.id), NOW);
    check("when visits are not shared the tile says so and counts nothing", dash2.tiles.length === 1 && dash2.tiles[0].value === 0 && dash2.tiles[0].hint === "Visits are not shared with you");
    const dashNone = await getDashboardData(tempFam.id, await permsOf(tempFam.id), NOW);
    check("an account nobody has shared with gets no tile", dashNone.tiles.length === 0);
    const dashAdmin = await getDashboardData(admin.id, await permsOf(admin.id), NOW);
    check("nobody but someone shared with gets that tile", !dashAdmin.tiles.some((t) => t.key === "shared-upcoming-visits"));

    section("9. The audit log holds no names and no words, and only one file writes consents");
    const recordedCount = await prisma.auditLog.count({ where: { actorUserId: tempAdmin.id, action: "family_consent_recorded", outcome: "allowed" } });
    const withdrawnCount = await prisma.auditLog.count({ where: { actorUserId: tempAdmin.id, action: "family_consent_withdrawn", outcome: "allowed" } });
    check("every consent recorded by the administrator was logged", recordedCount === recordedByAdmin && recordedByAdmin >= 24, `${recordedCount} vs ${recordedByAdmin}`);
    check("every withdrawal by the administrator was logged", withdrawnCount === 2, String(withdrawnCount));
    const logs = await prisma.auditLog.findMany({ where: { OR: [{ actorUserId: { in: tempUserIds } }, { resourceId: { in: consentIds } }] } });
    check("the refusals were recorded", logs.some((l) => l.outcome === "denied"));
    const text = JSON.stringify(logs);
    check("no entry holds a patient's or family member's name, a relationship or what was shared", !text.includes("FamMe") && !text.includes("Whitfield") && !text.includes("Claire") && !text.includes("adult_child") && !text.includes('"care_plan"') && !text.includes('"care_team"') && !text.includes('"visits"') && !text.includes("Verify f"));
    const srcFiles: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) srcFiles.push(full);
      }
    };
    walk(join(process.cwd(), "src"));
    const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, "/");
    const writers = srcFiles.filter((f) => /familyConsent\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b|familyConsent\s*:\s*\{\s*(create|connect)/.test(readFileSync(f, "utf8"))).map(rel);
    check("only src/lib/family-consents.ts writes to the consents table", sameSet(writers, ["src/lib/family-consents.ts"]), writers.join(", "));
    const view = readFileSync(join(process.cwd(), "src/lib/patient-view.ts"), "utf8");
    const fam = readFileSync(join(process.cwd(), "src/lib/family-portal.ts"), "utf8");
    const forbidden = /prisma\.(visitNote|visitNoteAddendum|task|document|documentFile|referral|notification|auditLog)\b/;
    check("the shared view and the family portal never query notes, tasks, documents, referrals or the audit log", !forbidden.test(view) && !forbidden.test(fam));
    check("neither selects an e-mail address or a date of birth", !/\b(email|dateOfBirth|passwordHash)\s*:\s*true/.test(view) && !/\b(email|dateOfBirth|passwordHash)\s*:\s*true/.test(fam));
  } finally {
    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { resourceId: { in: [...visitIds, ...taskIds, ...consentIds] } },
            { actorUserId: { in: tempUserIds } },
            { action: "permission_denied", resourceId: { in: ["family.read", "consents.manage"] }, occurredAt: { gte: startedAt } },
          ],
        },
      });
      await prisma.familyConsent.deleteMany({ where: { OR: [{ id: { in: consentIds } }, { patientId: { in: patientIds } }, { familyUserId: { in: tempUserIds } }, { grantedById: { in: tempUserIds } }] } });
      await prisma.visitNote.deleteMany({ where: { id: { in: noteIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      await prisma.carePlan.deleteMany({ where: { id: { in: planIds } } });
      await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
      await prisma.careTeamMember.deleteMany({ where: { id: { in: teamIds } } });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
      for (const id of tempRoleIds) {
        await prisma.rolePermission.deleteMany({ where: { roleId: id } });
        await prisma.role.delete({ where: { id } });
      }
      await prisma.role.deleteMany({ where: { organizationId: { in: orgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      console.log("\n  removed the temporary patients, family accounts, consents, visits, notes, tasks, plans, team rows, role, organization and audit entries");
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
  console.log("Every family portal rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
