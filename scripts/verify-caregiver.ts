// scripts/verify-caregiver.ts
//
// Proves the caregiver portal rules hold, by trying to break them.
//   npm run verify:caregiver
//
// Needs the demo data (npx prisma db seed). Creates temporary caregivers,
// temporary visits and tasks, and temporary care team rows, and removes
// them (and their audit entries and notices) at the end, even when a check
// fails. Refuses to run unless DATABASE_URL points at this machine.
//
// The clock is passed in (a day in 2030), so "today", "yesterday" and
// "tomorrow" are exact and the script gives the same answer on any day.

import { prisma } from "@/lib/prisma";
import { AuthorizationError, getUserPermissions } from "@/lib/auth/authorize";
import { getCaregiverDay, caregiverVisitAction } from "@/lib/caregiver";
import { changeVisitStatus, listVisits, scheduleVisit } from "@/lib/visits";
import { changeTaskStatus, createTask, listTasks } from "@/lib/tasks";
import { getAccessiblePatients } from "@/lib/patients";
import { listDocuments } from "@/lib/documents";
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
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "" : (r.error ?? ""));
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...b].sort().every((k, i) => [...a].sort()[i] === k);

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Caregiver portal verification");
  const startedAt = new Date();

  const emails = ["admin", "nurse", "supervisor", "coordinator", "caregiver"].map((n) => `demo.${n}@cheliv.test`);
  const found = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (found.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse, supervisor, coordinator, demoCaregiver] = found as NonNullable<(typeof found)[number]>[];
  const orgId = admin.organizationId;
  const eleanor = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Eleanor" } });
  const marcus = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Marcus" } });
  const roleId = async (key: string) => (await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key } })).id;

  const tempUserIds: string[] = [];
  const visitIds: string[] = [];
  const taskIds: string[] = [];
  const teamIds: string[] = [];
  const runId = Date.now().toString(36);
  const mkUser = async (tag: string, role: string) => {
    const u = await prisma.user.create({
      data: { organizationId: orgId, email: `verify-cg-${runId}-${tag}@cheliv.test`, passwordHash: "not-a-real-hash", name: `Verify ${tag}` },
    });
    await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(role) } });
    tempUserIds.push(u.id);
    return u;
  };
  const onTeam = async (patientId: string, userId: string) => {
    const m = await prisma.careTeamMember.create({ data: { patientId, userId, roleOnCase: "caregiver" } });
    teamIds.push(m.id);
    return m;
  };

  // The pretend clock: 10:00 office time on 15 June 2030.
  const NOW = orgLocalToUtc("2030-06-15T10:00")!;
  const at = (localDateTime: string, minutes = 60) => {
    const start = orgLocalToUtc(localDateTime)!;
    return { start, end: new Date(start.getTime() + minutes * 60000) };
  };
  const mkVisit = async (
    clinicianId: string,
    patientId: string,
    localDateTime: string,
    status = "scheduled",
    minutes = 60,
  ) => {
    const { start, end } = at(localDateTime, minutes);
    const v = await prisma.visit.create({
      data: {
        organizationId: orgId,
        patientId,
        clinicianId,
        scheduledById: admin.id,
        visitType: "home_health_aide",
        status,
        scheduledStart: start,
        scheduledEnd: end,
        checkedInAt: status === "in_progress" ? start : null,
      },
    });
    visitIds.push(v.id);
    return v.id;
  };
  const statusOf = async (id: string) => (await prisma.visit.findUniqueOrThrow({ where: { id } })).status;
  const act = (who: string, id: string, action: string) => caregiverVisitAction(who, id, action, NOW);

  try {
    section("0. The seeded demo caregiver and the agreed permission set");
    const perms = await getUserPermissions(demoCaregiver.id);
    check("the demo caregiver holds exactly visits.checkin and tasks.read", sameSet(perms, ["visits.checkin", "tasks.read"]), perms.join(", "));
    const demoTeam = await prisma.careTeamMember.findFirst({ where: { userId: demoCaregiver.id, patientId: eleanor.id, roleOnCase: "caregiver", endsAt: null } });
    check("the demo caregiver is on Eleanor's team in the caregiver place, and only hers", demoTeam !== null && (await prisma.careTeamMember.count({ where: { userId: demoCaregiver.id, endsAt: null } })) === 1);

    section("1. Who is stopped at the door");
    const nobody = await mkUser("nopermissions", "PATIENT");
    const anyId = "00000000-0000-0000-0000-00000000dead";
    for (const [label, who] of [["an account with no permissions", nobody], ["a nurse", nurse], ["a supervisor", supervisor], ["a coordinator", coordinator]] as const) {
      check(`${label} cannot open the caregiver day`, await throwsAuth(() => getCaregiverDay(who.id, NOW)));
      check(`${label} cannot check in or out`, await throwsAuth(() => act(who.id, anyId, "check_in")));
    }
    const deniedRows = await prisma.auditLog.count({ where: { actorUserId: { in: [nobody.id, nurse.id, supervisor.id, coordinator.id] }, action: "permission_denied", resourceId: "visits.checkin", outcome: "denied", occurredAt: { gte: startedAt } } });
    check("those refusals were written to the audit log", deniedRows >= 8, String(deniedRows));

    section("2. A caregiver holds nothing else: the ordinary screens still refuse");
    const cg1 = await mkUser("cg1", "CAREGIVER");
    const cg2 = await mkUser("cg2", "CAREGIVER");
    await onTeam(eleanor.id, cg1.id);
    await onTeam(marcus.id, cg2.id);
    check("cannot list the visits screen", await throwsAuth(() => listVisits(cg1.id)));
    check("cannot use the ordinary status change (which could cancel)", await throwsAuth(() => changeVisitStatus(cg1.id, anyId, "cancel")));
    check("cannot schedule a visit", await throwsAuth(() => scheduleVisit(cg1.id, { patientId: eleanor.id, clinicianId: cg1.id, visitType: "home_health_aide", startLocal: "2030-06-15T12:00", durationMinutes: 60 })));
    check("cannot list patients", await throwsAuth(() => getAccessiblePatients(cg1.id)));
    check("cannot list documents", await throwsAuth(() => listDocuments(cg1.id)));
    check("cannot create a task, even for themselves", await throwsAuth(() => createTask(cg1.id, { title: "x", details: "", assigneeId: cg1.id, patientId: "", dueDate: "" })));

    section("3. The day view: only my own visits, on today's office day");
    const vA = await mkVisit(cg1.id, eleanor.id, "2030-06-15T08:30");
    const vB = await mkVisit(cg1.id, eleanor.id, "2030-06-15T11:00");
    const vC = await mkVisit(cg1.id, eleanor.id, "2030-06-15T15:00");
    const vCancelled = await mkVisit(cg1.id, eleanor.id, "2030-06-15T12:30", "cancelled");
    const vTomorrow = await mkVisit(cg1.id, eleanor.id, "2030-06-16T09:00");
    const vColleague = await mkVisit(nurse.id, eleanor.id, "2030-06-15T10:00");
    const vOther = await mkVisit(cg2.id, marcus.id, "2030-06-15T10:00");
    const vOutOfReach = await mkVisit(cg1.id, marcus.id, "2030-06-15T14:00");
    let day = await getCaregiverDay(cg1.id, NOW);
    check("today holds exactly my three scheduled visits, soonest first", JSON.stringify(day.today.map((v) => v.id)) === JSON.stringify([vA, vB, vC]), day.today.map((v) => v.id).join(","));
    check("a cancelled visit is left out", !day.today.some((v) => v.id === vCancelled));
    check("tomorrow's visit is not on today's list", !day.today.some((v) => v.id === vTomorrow));
    check("a colleague's visit on the same patient is not shown", !day.today.some((v) => v.id === vColleague));
    check("another caregiver's visit is not shown", !day.today.some((v) => v.id === vOther));
    check("my own visit on a patient I no longer or never reached is not shown", !day.today.some((v) => v.id === vOutOfReach));
    check("the past-window visit says it was never checked in", day.today[0].overdue && !day.today[1].overdue);
    check("all three can be checked in and none checked out", day.today.every((v) => v.canCheckIn && !v.canCheckOut));
    check("nothing is carried over yet", day.carriedOver.length === 0);
    const day2 = await getCaregiverDay(cg2.id, NOW);
    check("the other caregiver sees only their own visit", JSON.stringify(day2.today.map((v) => v.id)) === JSON.stringify([vOther]));
    const adminDay = await getCaregiverDay(admin.id, NOW);
    check("an administrator who holds the permission sees only visits assigned to themselves", adminDay.today.length === 0 && adminDay.carriedOver.length === 0);

    section("4. Who may act on which visit");
    const wordsA = err(await act(cg2.id, vA, "check_in"));
    const wordsB = err(await act(cg1.id, anyId, "check_in"));
    const wordsC = err(await act(cg1.id, vColleague, "check_in"));
    const wordsD = err(await act(cg1.id, vOutOfReach, "check_in"));
    const wordsE = err(await act(admin.id, vA, "check_in"));
    check("another caregiver cannot check in to my visit", wordsA.includes("could not be found"), wordsA);
    check("a made-up visit gets the same words", wordsB === wordsA);
    check("a colleague's visit on my own patient gets the same words", wordsC === wordsA);
    check("my own visit on a patient out of my reach gets the same words", wordsD === wordsA);
    check("an administrator cannot check in for someone else, even holding the permission", wordsE === wordsA);
    check("none of those changed a visit", (await Promise.all([vA, vColleague, vOutOfReach].map(statusOf))).every((s) => s === "scheduled"));
    const denied = await prisma.auditLog.count({ where: { actorUserId: { in: [cg1.id, cg2.id, admin.id] }, action: "access_denied", resourceType: "visit", outcome: "denied", occurredAt: { gte: startedAt } } });
    check("those attempts are on record as denied", denied >= 5, String(denied));
    const cancelTry = await act(cg1.id, vA, "cancel");
    const missedTry = await act(cg1.id, vA, "mark_missed");
    check("a caregiver cannot cancel a visit", !cancelTry.ok && err(cancelTry).includes("ask the office"));
    check("a caregiver cannot mark a visit missed", !missedTry.ok && err(missedTry).includes("ask the office"));
    check("an action that does not exist is refused", !(await act(cg1.id, vA, "nonsense")).ok);
    check("the visit is still scheduled", (await statusOf(vA)) === "scheduled");

    section("5. Checking in: the day, and one place at a time");
    const early = await act(cg1.id, vTomorrow, "check_in");
    check("cannot check in to a visit that is not today", !early.ok && err(early).includes("day of the visit"), err(early));
    const race = await Promise.all([act(cg1.id, vB, "check_in"), act(cg1.id, vC, "check_in")]);
    check("two check-ins at the same moment: exactly one wins", race.filter((r) => r.ok).length === 1, JSON.stringify(race));
    const winner = race[0].ok ? vB : vC;
    const loser = race[0].ok ? vC : vB;
    check("the loser is told to check out first", err(race[0].ok ? race[1] : race[0]).includes("out of it first"));
    check("only one visit of mine is in progress", (await prisma.visit.count({ where: { clinicianId: cg1.id, status: "in_progress" } })) === 1);
    const inProgress = await prisma.visit.findUniqueOrThrow({ where: { id: winner } });
    check("the check-in time was recorded", inProgress.status === "in_progress" && inProgress.checkedInAt?.getTime() === NOW.getTime());
    check("checking in twice is refused", !(await act(cg1.id, winner, "check_in")).ok);
    check("while checked in elsewhere, no other visit offers Check in", (await getCaregiverDay(cg1.id, NOW)).today.filter((v) => v.canCheckIn).length === 0);
    check("checking out a visit that was never checked in is refused", !(await act(cg1.id, loser, "check_out")).ok);
    check("another caregiver cannot check out my visit", err(await act(cg2.id, winner, "check_out")).includes("could not be found"));

    section("6. Checking out");
    const out = await act(cg1.id, winner, "check_out");
    check("the caregiver checks out", out.ok);
    const done = await prisma.visit.findUniqueOrThrow({ where: { id: winner } });
    check("completed, with the check-out time", done.status === "completed" && done.checkedOutAt?.getTime() === NOW.getTime());
    check("a completed visit is final: check out again is refused", !(await act(cg1.id, winner, "check_out")).ok);
    check("a completed visit is final: check in is refused", !(await act(cg1.id, winner, "check_in")).ok);
    const canNow = await getCaregiverDay(cg1.id, NOW);
    check("after checking out, the next visit can be checked in", canNow.today.find((v) => v.id === loser)?.canCheckIn === true);

    section("7. A visit left checked in from an earlier day");
    // Three days back: well outside the window used for today, so it is found
    // only because it is still checked in.
    const vOld = await mkVisit(cg1.id, eleanor.id, "2030-06-12T14:00", "in_progress");
    day = await getCaregiverDay(cg1.id, NOW);
    check("it is shown in its own section, never hidden", day.carriedOver.length === 1 && day.carriedOver[0].id === vOld && day.carriedOver[0].canCheckOut);
    check("it is not on today's list", !day.today.some((v) => v.id === vOld));
    check("while it is open, today's visits cannot be checked in", day.today.every((v) => !v.canCheckIn));
    const blocked = await act(cg1.id, loser, "check_in");
    check("and trying anyway is refused", !blocked.ok && err(blocked).includes("out of it first"));
    check("checking out the old visit closes it", (await act(cg1.id, vOld, "check_out")).ok && (await statusOf(vOld)) === "completed");
    check("then today's visit can be checked in", (await act(cg1.id, loser, "check_in")).ok);
    check("and checked out", (await act(cg1.id, loser, "check_out")).ok);

    section("7b. Two taps at once are handled one after the other (the row lock)");
    const vD = await mkVisit(cg1.id, eleanor.id, "2030-06-15T17:00");
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${cg1.id} FOR UPDATE`;
        await held;
      },
      { timeout: 20000 },
    );
    await new Promise((r) => setTimeout(r, 300));
    const waiting = act(cg1.id, vD, "check_in");
    const finishedEarly = await Promise.race([waiting.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 1200))]);
    check("a check-in waits while the caregiver's own row is locked by someone else", finishedEarly === false);
    release();
    await holder;
    check("and goes through once the lock is released", (await waiting).ok && (await statusOf(vD)) === "in_progress");
    check("checking out closes it", (await act(cg1.id, vD, "check_out")).ok);

    section("8. Reach: coming off the care team ends it at once");
    const vLast = await mkVisit(cg2.id, marcus.id, "2030-06-15T16:00");
    check("before: the other caregiver sees and may check in", (await getCaregiverDay(cg2.id, NOW)).today.some((v) => v.id === vLast));
    await prisma.careTeamMember.updateMany({ where: { userId: cg2.id, patientId: marcus.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    check("after the assignment ends, the visit disappears from the day", !(await getCaregiverDay(cg2.id, NOW)).today.some((v) => v.id === vLast));
    check("and cannot be checked in (looks like no visit)", err(await act(cg2.id, vLast, "check_in")).includes("could not be found"));

    section("9. The checklist is the ordinary task list");
    const t1 = await createTask(admin.id, { title: "Verify caregiver task one", details: "", assigneeId: cg1.id, patientId: eleanor.id, dueDate: "" });
    const t2 = await createTask(admin.id, { title: "Verify caregiver task two", details: "", assigneeId: cg2.id, patientId: "", dueDate: "" });
    if (!t1.ok || !t2.ok) throw new Error("setup failed: " + err(t1) + err(t2));
    taskIds.push(t1.value.id, t2.value.id);
    const mine = (await listTasks(cg1.id)).open;
    check("the caregiver sees the task given to them", mine.some((t) => t.id === t1.value.id && t.canComplete));
    check("and not another caregiver's task", !mine.some((t) => t.id === t2.value.id));
    check("cannot finish another caregiver's task (looks like no task)", err(await changeTaskStatus(cg1.id, t2.value.id, "complete")).includes("could not be found"));
    check("cannot cancel a task", await throwsAuth(() => changeTaskStatus(cg1.id, t1.value.id, "cancel")));
    check("the caregiver finishes their own task", (await changeTaskStatus(cg1.id, t1.value.id, "complete")).ok);
    const finished = await prisma.task.findUniqueOrThrow({ where: { id: t1.value.id } });
    check("who finished it and when are recorded", finished.status === "done" && finished.completedById === cg1.id && finished.completedAt !== null);
    check("the person who asked was told", (await prisma.notification.count({ where: { userId: admin.id, kind: "task_completed", resourceId: t1.value.id } })) === 1);

    section("10. The audit log never holds a patient's name");
    const logs = await prisma.auditLog.findMany({ where: { OR: [{ resourceId: { in: visitIds } }, { actorUserId: { in: tempUserIds } }] } });
    check("check in and check out were recorded", ["visit_checked_in", "visit_checked_out"].every((a) => logs.some((l) => l.action === a)));
    const text = JSON.stringify(logs);
    check("no entry holds a patient's name", !text.includes("Whitfield") && !text.includes("Delgado") && !text.includes("Eleanor") && !text.includes("Marcus"));
  } finally {
    try {
      const everyVisit = visitIds;
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { resourceId: { in: [...everyVisit, ...taskIds] } },
            { actorUserId: { in: tempUserIds } },
            { action: "permission_denied", resourceId: "visits.checkin", occurredAt: { gte: startedAt } },
            { action: "access_denied", resourceType: "visit", outcome: "denied", occurredAt: { gte: startedAt }, actorUserId: { in: [admin.id, nurse.id] } },
          ],
        },
      });
      await prisma.notification.deleteMany({ where: { resourceId: { in: taskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      await prisma.visit.deleteMany({ where: { id: { in: everyVisit } } });
      await prisma.careTeamMember.deleteMany({ where: { id: { in: teamIds } } });
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
      console.log("\n  removed the temporary visits, tasks, team rows, accounts, notices and audit entries");
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
  console.log("Every caregiver portal rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
