// scripts/verify-portal.ts
//
// Proves the patient portal rules hold, by trying to break them.
//   npm run verify:portal
//
// Needs the demo data (npx prisma db seed). Creates temporary patients,
// staff, visits, notes, tasks, care plans and one temporary organization,
// and removes them (and their audit entries) at the end, even when a check
// fails. Refuses to run unless DATABASE_URL points at this machine.
//
// The clock is passed in (a day in 2030), so "upcoming" and "recent" are
// exact and the script gives the same answer on any day.

import { prisma } from "@/lib/prisma";
import { AuthorizationError, getUserPermissions } from "@/lib/auth/authorize";
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

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Patient portal verification");
  const startedAt = new Date();

  const emails = ["admin", "nurse", "supervisor", "coordinator", "caregiver", "patient"].map((n) => `demo.${n}@cheliv.test`);
  const found = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (found.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse, supervisor, coordinator, caregiver, demoPatientUser] = found as NonNullable<(typeof found)[number]>[];
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
  const runId = Date.now().toString(36);
  const mkUser = async (tag: string, role: string) => {
    const u = await prisma.user.create({
      data: { organizationId: orgId, email: `verify-pp-${runId}-${tag}@cheliv.test`, passwordHash: "not-a-real-hash", name: `Verify ${tag}` },
    });
    await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(role) } });
    tempUserIds.push(u.id);
    return u;
  };
  const mkPatient = async (tag: string, over: Partial<{ userId: string; status: string; organizationId: string }> = {}) => {
    const p = await prisma.patient.create({
      data: { organizationId: over.organizationId ?? orgId, firstName: `Portal${tag}`, lastName: "Verify", dateOfBirth: new Date("1950-01-01T00:00:00Z"), status: over.status ?? "active", userId: over.userId ?? null },
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
    section("0. The agreed permission set and the seeded demo patient");
    const perms = await getUserPermissions(demoPatientUser.id);
    check("the demo patient account holds exactly portal.read", sameSet(perms, ["portal.read"]), perms.join(", "));
    const linked = await prisma.patient.findFirst({ where: { userId: demoPatientUser.id } });
    check("the demo patient account is linked to Eleanor's record, and only hers", linked?.id === eleanor.id);
    const eleanorNow = await getMyCare(demoPatientUser.id);
    check("the demo patient sees her own first name", eleanorNow?.firstName === "Eleanor");
    const dupUser = await mkUser("dup", "PATIENT");
    let dupRefused = false;
    try {
      await prisma.patient.update({ where: { id: eleanor.id }, data: { userId: dupUser.id } });
      await prisma.patient.update({ where: { id: eleanor.id }, data: { userId: demoPatientUser.id } });
    } catch {
      dupRefused = true;
    }
    const another = await mkPatient("Two");
    let secondRefused = false;
    try {
      await prisma.patient.update({ where: { id: another.id }, data: { userId: demoPatientUser.id } });
    } catch {
      secondRefused = true;
    }
    check("one account can be linked to only one patient record (the database refuses a second)", secondRefused);
    void dupRefused;

    section("1. Who is stopped at the door");
    const family = await mkUser("family", "AUTHORIZED_FAMILY");
    for (const [label, who] of [
      ["a family account", family],
      ["a nurse", nurse],
      ["a supervisor", supervisor],
      ["a coordinator", coordinator],
      ["a caregiver", caregiver],
    ] as const) {
      check(`${label} cannot open the patient portal`, await throwsAuth(() => getMyCare(who.id, NOW)));
    }
    const deniedRows = await prisma.auditLog.count({ where: { actorUserId: { in: [family.id, nurse.id, supervisor.id, coordinator.id, caregiver.id] }, action: "permission_denied", resourceId: "portal.read", outcome: "denied", occurredAt: { gte: startedAt } } });
    check("those refusals were written to the audit log", deniedRows >= 5, String(deniedRows));

    section("2. An account linked to no record gets nothing, never everybody");
    const unlinked = await mkUser("unlinked", "PATIENT");
    check("a patient account linked to no record gets null", (await getMyCare(unlinked.id, NOW)) === null);
    check("an administrator holds the permission but has no record, so gets null", (await getMyCare(admin.id, NOW)) === null);

    section("3. A linked patient sees exactly their own care");
    const ptUser = await mkUser("pt", "PATIENT");
    const other = await mkUser("other", "PATIENT");
    const me = await mkPatient("Me", { userId: ptUser.id });
    const them = await mkPatient("Them", { userId: other.id });
    const stranger = await mkPatient("Stranger");
    // visits of mine
    const soon = await mkVisit(me.id, nurse.id, "2030-06-16T09:00");
    const later = await mkVisit(me.id, caregiver.id, "2030-06-20T14:00");
    const hereNow = await mkVisit(me.id, nurse.id, "2030-06-15T09:00", "in_progress");
    const endedToday = await mkVisit(me.id, nurse.id, "2030-06-15T07:00", "scheduled", 60); // window over, never checked in
    const cancelled = await mkVisit(me.id, nurse.id, "2030-06-17T09:00", "cancelled");
    const missed = await mkVisit(me.id, nurse.id, "2030-06-18T09:00", "missed");
    const done1 = await mkVisit(me.id, nurse.id, "2030-06-10T09:00", "completed");
    const done2 = await mkVisit(me.id, nurse.id, "2030-06-12T09:00", "completed");
    const oldDone: string[] = [];
    for (let d = 1; d <= 5; d++) oldDone.push(await mkVisit(me.id, nurse.id, `2030-05-0${d}T09:00`, "completed"));
    // visits of other people
    const theirVisit = await mkVisit(them.id, nurse.id, "2030-06-16T11:00");
    const strangerVisit = await mkVisit(stranger.id, nurse.id, "2030-06-16T12:00");

    const care = (await getMyCare(ptUser.id, NOW))!;
    const upIds = care.upcoming.map((v) => v.id);
    check("upcoming holds the visit happening now, then the scheduled ones, soonest first", JSON.stringify(upIds) === JSON.stringify([hereNow, soon, later]), upIds.join(","));
    check("a scheduled visit whose window is over is not upcoming", !upIds.includes(endedToday));
    check("cancelled and missed visits are not shown as upcoming", !upIds.includes(cancelled) && !upIds.includes(missed));
    check("another patient's visits are never shown", ![theirVisit, strangerVisit].some((id) => [...upIds, ...care.recent.map((v) => v.id)].includes(id)));
    check("recent holds completed visits only, newest first, at most five", care.recent.length === 5 && care.recent[0].id === done2 && care.recent[1].id === done1 && care.recent.every((v) => v.status === "completed"), care.recent.map((v) => v.id).join(","));
    check("each visit carries the staff member's name, not an e-mail address", care.upcoming[0].clinicianName === nurse.name && !JSON.stringify(care).includes("@"));
    void oldDone;
    const theirs = (await getMyCare(other.id, NOW))!;
    check("the other patient sees only their own visit", theirs.upcoming.length === 1 && theirs.upcoming[0].id === theirVisit && theirs.recent.length === 0);
    check("each account sees its own first name", care.firstName === "PortalMe" && theirs.firstName === "PortalThem");

    section("4. The care team: people looking after me, right now");
    const m1 = await prisma.careTeamMember.create({ data: { patientId: me.id, userId: nurse.id, roleOnCase: "primary_nurse" } });
    const m2 = await prisma.careTeamMember.create({ data: { patientId: me.id, userId: caregiver.id, roleOnCase: "caregiver" } });
    const m3 = await prisma.careTeamMember.create({ data: { patientId: me.id, userId: supervisor.id, roleOnCase: "caregiver", endsAt: new Date(NOW.getTime() - 86400000) } });
    const m4 = await prisma.careTeamMember.create({ data: { patientId: stranger.id, userId: coordinator.id, roleOnCase: "caregiver" } });
    teamIds.push(m1.id, m2.id, m3.id, m4.id);
    const withTeam = (await getMyCare(ptUser.id, NOW))!;
    const names = withTeam.team.map((t) => t.name).sort();
    check("the team lists the two people on it now", sameSet(names, [nurse.name, caregiver.name]), names.join(","));
    check("a person whose assignment ended is not listed", !names.includes(supervisor.name));
    check("another patient's team member is not listed", !names.includes(coordinator.name));
    check("each member has a plain role label", withTeam.team.every((t) => t.roleLabel.length > 0 && !t.roleLabel.includes("_")));

    section("5. The care plan: only an active one, only in words meant for the patient");
    const planBase = { organizationId: orgId, patientId: me.id, authorId: nurse.id };
    const draft = await prisma.carePlan.create({ data: { ...planBase, status: "draft", title: "SECRETDRAFTTITLE", summary: "SECRETDRAFTSUMMARY", goals: { create: [{ position: 0, description: "SECRETDRAFTGOAL" }] } } });
    planIds.push(draft.id);
    check("a draft plan is not shown", (await getMyCare(ptUser.id, NOW))!.plan === null);
    const oldPlan = await prisma.carePlan.create({ data: { ...planBase, status: "completed", title: "SECRETOLDTITLE", summary: "SECRETOLDSUMMARY" } });
    planIds.push(oldPlan.id);
    check("a finished plan is not shown", (await getMyCare(ptUser.id, NOW))!.plan === null);
    const active = await prisma.carePlan.create({
      data: {
        ...planBase,
        approvedById: admin.id,
        approvedAt: NOW,
        status: "active",
        title: "Walking steadily",
        summary: "A plan for steady walking.",
        goals: { create: [{ position: 1, description: "Second goal", status: "met", metAt: NOW }, { position: 0, description: "First goal" }] },
      },
    });
    planIds.push(active.id);
    const strangerPlan = await prisma.carePlan.create({ data: { organizationId: orgId, patientId: stranger.id, authorId: nurse.id, approvedById: admin.id, approvedAt: NOW, status: "active", title: "STRANGERPLAN", summary: "STRANGERSUMMARY" } });
    planIds.push(strangerPlan.id);
    const withPlan = (await getMyCare(ptUser.id, NOW))!;
    check("the active plan is shown", withPlan.plan?.title === "Walking steadily" && withPlan.plan.summary === "A plan for steady walking.");
    check("its goals come in order, with done marked", withPlan.plan?.goals.map((g) => `${g.description}:${g.met}`).join("|") === "First goal:false|Second goal:true");
    check("another patient's plan is never shown", !JSON.stringify(withPlan).includes("STRANGER"));

    section("6. Nothing clinical leaks: notes, tasks, drafts and staff details");
    const note = await prisma.visitNote.create({ data: { organizationId: orgId, visitId: done1, authorId: nurse.id, content: "SECRETNOTEWORDS", status: "reviewed", reviewedById: supervisor.id, reviewedAt: NOW } });
    noteIds.push(note.id);
    const task = await prisma.task.create({ data: { organizationId: orgId, patientId: me.id, assigneeId: nurse.id, createdById: admin.id, title: "SECRETTASKTITLE" } });
    taskIds.push(task.id);
    const everything = JSON.stringify(await getMyCare(ptUser.id, NOW));
    check("no visit note words appear", !everything.includes("SECRETNOTEWORDS"));
    check("no task title appears", !everything.includes("SECRETTASKTITLE"));
    check("no draft or finished plan words appear", !everything.includes("SECRETDRAFT") && !everything.includes("SECRETOLD"));
    check("no e-mail address and no internal id of a person appears", !everything.includes("@cheliv.test") && !everything.includes(nurse.id) && !everything.includes(admin.id));
    check("nothing about the patient's own record id or date of birth appears", !everything.includes(me.id) && !everything.includes("1950"));

    section("7. Status of the record, and organization");
    const onHold = await mkUser("hold", "PATIENT");
    await mkPatient("Hold", { userId: onHold.id, status: "on_hold" });
    check("a patient on hold still has a portal", (await getMyCare(onHold.id, NOW)) !== null);
    const gone = await mkUser("gone", "PATIENT");
    await mkPatient("Gone", { userId: gone.id, status: "discharged" });
    check("a discharged patient has no portal", (await getMyCare(gone.id, NOW)) === null);
    const otherOrg = await prisma.organization.create({ data: { name: `Verify org ${runId}` } });
    orgIds.push(otherOrg.id);
    const foreign = await mkUser("foreign", "PATIENT");
    await mkPatient("Foreign", { userId: foreign.id, organizationId: otherOrg.id });
    check("a link to a record of another organization gives nothing", (await getMyCare(foreign.id, NOW)) === null);

    section("8. A patient account opens no staff screen and changes nothing");
    const anyId = "00000000-0000-0000-0000-00000000dead";
    check("cannot list visits", await throwsAuth(() => listVisits(ptUser.id)));
    check("cannot change a visit", await throwsAuth(() => changeVisitStatus(ptUser.id, soon, "cancel")));
    check("cannot list patients", await throwsAuth(() => getAccessiblePatients(ptUser.id)));
    check("cannot list documents", await throwsAuth(() => listDocuments(ptUser.id)));
    check("cannot list care plans", await throwsAuth(() => listCarePlans(ptUser.id)));
    check("cannot list tasks", await throwsAuth(() => listTasks(ptUser.id)));
    check("cannot create a task", await throwsAuth(() => createTask(ptUser.id, { title: "x", details: "", dueDate: "", patientId: "", assigneeId: ptUser.id })));
    check("cannot finish a task", await throwsAuth(() => changeTaskStatus(ptUser.id, task.id, "complete")));
    check("cannot open the caregiver day", await throwsAuth(() => getCaregiverDay(ptUser.id, NOW)));
    void anyId;
    check("the visit and the task are exactly as they were", (await prisma.visit.findUniqueOrThrow({ where: { id: soon } })).status === "scheduled" && (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status === "open");

    section("9. The menu and the dashboard");
    const myPerms = new Set(await getUserPermissions(ptUser.id));
    check("the menu holds the dashboard and My care, nothing else", sameSet(navHrefs(buildNavigation(myPerms)), ["/dashboard", "/my-care"]));
    const dash = await getDashboardData(ptUser.id, myPerms, NOW);
    check("the dashboard has one tile: my upcoming visits, counting three", dash.tiles.length === 1 && dash.tiles[0].key === "my-upcoming-visits" && dash.tiles[0].value === 3 && dash.tiles[0].href === "/my-care");
    check("no other section exists", dash.todaysVisits === null && dash.referrals === null && dash.needsPrimaryNurse === null && dash.plansToApprove === null && dash.recentActivity === null && dash.attention.length === 0);
    const dashUnlinked = await getDashboardData(unlinked.id, new Set(await getUserPermissions(unlinked.id)), NOW);
    check("an account linked to no record gets no tile", dashUnlinked.tiles.length === 0);

    section("10. The audit log never holds a patient's name");
    const logs = await prisma.auditLog.findMany({ where: { OR: [{ resourceId: { in: [...visitIds, ...taskIds] } }, { actorUserId: { in: tempUserIds } }] } });
    check("the refusals were recorded", logs.some((l) => l.outcome === "denied"));
    const text = JSON.stringify(logs);
    check("no entry holds a patient's name or a plan's words", !text.includes("Portal") && !text.includes("Whitfield") && !text.includes("SECRET") && !text.includes("STRANGER"));
  } finally {
    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { resourceId: { in: [...visitIds, ...taskIds] } },
            { actorUserId: { in: tempUserIds } },
            { action: "permission_denied", resourceId: "portal.read", occurredAt: { gte: startedAt } },
            { action: "permission_denied", occurredAt: { gte: startedAt }, actorUserId: { in: [demoPatientUser.id] } },
          ],
        },
      });
      await prisma.visitNote.deleteMany({ where: { id: { in: noteIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      await prisma.carePlan.deleteMany({ where: { id: { in: planIds } } });
      await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
      await prisma.careTeamMember.deleteMany({ where: { id: { in: teamIds } } });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      // Put the demo link back exactly as the seed leaves it.
      await prisma.patient.updateMany({ where: { id: eleanor.id, userId: null }, data: { userId: demoPatientUser.id } });
      console.log("\n  removed the temporary patients, visits, notes, tasks, plans, team rows, accounts, organization and audit entries");
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
  console.log("Every patient portal rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
