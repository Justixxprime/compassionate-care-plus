// scripts/verify-tasks.ts
//
// Proves the task rules hold, by trying to break them.
//   npm run verify:tasks
//
// Needs the demo data (npx prisma db seed). Creates temporary tasks, one
// temporary care team row and one temporary account with no permissions,
// and removes them (and their audit entries) at the end, even when a
// check fails. Refuses to run unless DATABASE_URL points at this machine.

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import { changeTaskStatus, createTask, getTaskCreateOptions, listTasks } from "@/lib/tasks";
import { TASK_DETAILS_MAX, TASK_TITLE_MAX } from "@/lib/task-constants";

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

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Task verification");

  const emails = ["admin", "nurse", "nurse2", "supervisor", "coordinator"].map((n) => `demo.${n}@cheliv.test`);
  const users = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (users.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse1, nurse2, supervisor, coordinator] = users as NonNullable<(typeof users)[number]>[];
  const orgId = admin.organizationId;
  const eleanor = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Eleanor" } });
  const marcus = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Marcus" } });

  const taskIds: string[] = [];
  const tempUserIds: string[] = [];
  let teamRowId: string | null = null;
  const mk = async (
    who: string,
    input: Partial<{ title: string; details: string; assigneeId: string; patientId: string; dueDate: string }>,
  ) => {
    const r = await createTask(who, { title: "Verify task", details: "", assigneeId: who, patientId: "", dueDate: "", ...input });
    if (r.ok) taskIds.push(r.value.id);
    return r;
  };

  try {
    section("1. Creating");
    check("a nurse can create a task for themselves", (await mk(nurse1.id, {})).ok);
    check("with a patient they reach", (await mk(nurse1.id, { patientId: eleanor.id })).ok);
    check("with a due date", (await mk(nurse1.id, { dueDate: "2030-01-15" })).ok);
    check("a patient out of reach gets the not-found words", err(await mk(nurse1.id, { patientId: marcus.id })).includes("could not be found"));
    check("a nurse cannot give a task to someone else", err(await mk(nurse1.id, { assigneeId: nurse2.id })).includes("only create tasks for yourself"));
    check("empty title refused", !(await mk(nurse1.id, { title: "  " })).ok);
    check("long title refused", !(await mk(nurse1.id, { title: "a".repeat(TASK_TITLE_MAX + 1) })).ok);
    check("long details refused", !(await mk(nurse1.id, { details: "a".repeat(TASK_DETAILS_MAX + 1) })).ok);
    check("February 30 refused", !(await mk(nurse1.id, { dueDate: "2030-02-30" })).ok);
    check("a made-up assignee is refused", !(await mk(admin.id, { assigneeId: "00000000-0000-0000-0000-00000000dead" })).ok);
    check("an administrative role can give a task to a nurse", (await mk(admin.id, { assigneeId: nurse1.id })).ok);
    check("about a patient the nurse is on", (await mk(admin.id, { assigneeId: nurse1.id, patientId: eleanor.id })).ok);
    const offTeam = await mk(admin.id, { assigneeId: nurse2.id, patientId: eleanor.id });
    check("but not to someone off that patient's care team", err(offTeam).includes("not on this patient"), err(offTeam));
    check("a coordinator (organization reach) can assign", (await mk(coordinator.id, { assigneeId: nurse2.id, patientId: marcus.id })).ok);

    section("2. Permission");
    const temp = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: `verify.caregiver.${Date.now().toString(36)}@cheliv.test`,
        passwordHash: "not-a-real-hash",
        name: "Verify Caregiver",
      },
    });
    tempUserIds.push(temp.id);
    const cgRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "CAREGIVER" } });
    await prisma.userRole.create({ data: { userId: temp.id, roleId: cgRole.id } });
    check("an account with no task permission cannot list", await throwsAuth(() => listTasks(temp.id)));
    check("or create", await throwsAuth(() => mk(temp.id, {}).then((r) => r)));
    check("or see the create options", await throwsAuth(() => getTaskCreateOptions(temp.id)));

    section("3. Who sees which tasks");
    const all = await prisma.task.count({ where: { organizationId: orgId } });
    const adminL = await listTasks(admin.id);
    check("admin sees every task in the organization", adminL.open.length + adminL.closed.length === all, `${adminL.open.length + adminL.closed.length} of ${all}`);
    const coordL = await listTasks(coordinator.id);
    check("coordinator (organization reach) sees every task too", coordL.open.length + coordL.closed.length === all);
    const n1 = await listTasks(nurse1.id);
    const n1All = [...n1.open, ...n1.closed];
    check("nurse one sees only tasks given to or created by them", n1All.length > 0);
    const mineOnly = await prisma.task.findMany({ where: { organizationId: orgId, OR: [{ assigneeId: nurse1.id }, { createdById: nurse1.id }], AND: [{ OR: [{ patientId: null }, { patientId: eleanor.id }] }] }, select: { id: true } });
    check("nurse one sees exactly that set", n1All.length === mineOnly.length && n1All.every((t) => mineOnly.some((m) => m.id === t.id)), `${n1All.length} vs ${mineOnly.length}`);
    const n2 = await listTasks(nurse2.id);
    check("nurse two does not see nurse one's tasks", [...n2.open, ...n2.closed].every((t) => t.assigneeId === nurse2.id || t.patientId !== eleanor.id));
    check("nurse two sees the task the coordinator gave them", [...n2.open].some((t) => t.patientId === marcus.id));

    const team = await prisma.careTeamMember.create({ data: { patientId: eleanor.id, userId: nurse2.id, roleOnCase: "nurse" } });
    teamRowId = team.id;
    const onTeam = await mk(admin.id, { assigneeId: nurse2.id, patientId: eleanor.id, title: "Team task" });
    check("once on the care team, the task can be given to nurse two", onTeam.ok);
    const seenOnTeam = (await listTasks(nurse2.id)).open.some((t) => onTeam.ok && t.id === onTeam.value.id);
    check("and nurse two sees it", seenOnTeam);
    await prisma.careTeamMember.update({ where: { id: team.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const seenAfter = (await listTasks(nurse2.id)).open.some((t) => onTeam.ok && t.id === onTeam.value.id);
    check("after the assignment ends the patient's task disappears from nurse two", !seenAfter);
    if (onTeam.ok) {
      const closeAfter = await changeTaskStatus(nurse2.id, onTeam.value.id, "complete");
      check("and cannot be finished either (looks like no task)", !closeAfter.ok && err(closeAfter).includes("could not be found"), err(closeAfter));
    }

    section("4. Finishing and cancelling");
    const forNurse = await mk(admin.id, { assigneeId: nurse1.id, title: "Admin asked nurse" });
    if (!forNurse.ok) throw new Error("setup failed");
    const tid = forNurse.value.id;
    check("another nurse cannot even find it", err(await changeTaskStatus(nurse2.id, tid, "complete")).includes("could not be found"));
    check("the assignee cannot cancel a task they did not create", err(await changeTaskStatus(nurse1.id, tid, "cancel")).includes("created this task"));
    check("an unknown action is refused", !(await changeTaskStatus(supervisor.id, tid, "nonsense")).ok);
    check("the assignee finishes it", (await changeTaskStatus(nurse1.id, tid, "complete")).ok);
    const done = await prisma.task.findUniqueOrThrow({ where: { id: tid } });
    check("who finished it and when are recorded", done.status === "done" && done.completedById === nurse1.id && done.completedAt !== null);
    check("finishing twice is refused", !(await changeTaskStatus(nurse1.id, tid, "complete")).ok);
    check("a done task cannot be cancelled", !(await changeTaskStatus(admin.id, tid, "cancel")).ok);

    const own = await mk(nurse1.id, { title: "Own to cancel" });
    if (!own.ok) throw new Error("setup failed");
    check("the creator can cancel their own task", (await changeTaskStatus(nurse1.id, own.value.id, "cancel")).ok);
    check("a cancelled task cannot be finished", !(await changeTaskStatus(nurse1.id, own.value.id, "complete")).ok);
    const askedByNurse = await mk(nurse1.id, { title: "Nurse task admin finishes" });
    if (!askedByNurse.ok) throw new Error("setup failed");
    check("an administrative role can finish anyone's task", (await changeTaskStatus(admin.id, askedByNurse.value.id, "complete")).ok);
    check("an account with no permission cannot finish", await throwsAuth(() => changeTaskStatus(temp.id, tid, "complete")));

    section("5. The audit log never holds the words");
    const logs = await prisma.auditLog.findMany({ where: { resourceId: { in: taskIds } } });
    check("created, completed and cancelled were recorded", ["task_created", "task_completed", "task_cancelled"].every((a) => logs.some((l) => l.action === a)));
    check("no entry contains a task title", !JSON.stringify(logs).includes("Admin asked nurse") && !JSON.stringify(logs).includes("Own to cancel"));
  } finally {
    try {
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      if (teamRowId) await prisma.careTeamMember.deleteMany({ where: { id: teamRowId } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ resourceId: { in: taskIds } }, { actorUserId: { in: tempUserIds } }] } });
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
      console.log("\n  removed the temporary tasks, team row, account and audit entries");
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
  console.log("Every task rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
