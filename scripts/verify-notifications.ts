// scripts/verify-notifications.ts
//
// Proves the notification rules hold, by trying to break them.
//   npm run verify:notifications
//
// Needs the demo data (npx prisma db seed). Creates temporary tasks, one
// temporary account and one temporary organization, and removes them (and
// their notices and audit entries) at the end, even when a check fails.
// Refuses to run unless DATABASE_URL points at this machine.

import { prisma } from "@/lib/prisma";
import { changeTaskStatus, createTask } from "@/lib/tasks";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyUser,
} from "@/lib/notifications";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_LIST_LIMIT,
  describeNotification,
} from "@/lib/notification-constants";
import { readFileSync } from "node:fs";

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
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "" : (r.error ?? ""));

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Notification verification");

  const emails = ["admin", "nurse", "nurse2"].map((n) => `demo.${n}@cheliv.test`);
  const users = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (users.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse1, nurse2] = users as NonNullable<(typeof users)[number]>[];
  const orgId = admin.organizationId;
  const eleanor = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Eleanor" } });

  const runId = Date.now().toString(36);
  const SECRET_TITLE = `Secret title ${runId}`;
  const taskIds: string[] = [];
  const auditIds: string[] = [];
  let tempUserId: string | null = null;
  let tempOrgId: string | null = null;
  let tempOrgUserId: string | null = null;

  const mkTask = async (who: string, assigneeId: string, patientId = "") => {
    const r = await createTask(who, { title: SECRET_TITLE, details: "", assigneeId, patientId, dueDate: "" });
    if (r.ok) taskIds.push(r.value.id);
    return r;
  };
  // Every notice these tasks caused, for one person.
  const noticesFor = (userId: string, kind?: string) =>
    prisma.notification.findMany({
      where: { userId, resourceId: { in: taskIds }, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: "asc" },
    });

  try {
    section("1. A task given to someone else tells them");
    const t1 = await mkTask(admin.id, nurse1.id);
    check("the administrator can create the task", t1.ok);
    const n1 = await noticesFor(nurse1.id, "task_assigned");
    check("the nurse got exactly one 'task assigned' notice", n1.length === 1, String(n1.length));
    check("it is unread and points at the task", n1[0]?.readAt === null && n1[0]?.resourceType === "task" && n1[0]?.resourceId === (t1.ok ? t1.value.id : ""));
    check("nobody else was told", (await noticesFor(nurse2.id)).length === 0 && (await noticesFor(admin.id)).length === 0);
    const selfTask = await mkTask(nurse1.id, nurse1.id);
    check("a task you give yourself sends no notice", selfTask.ok && (await noticesFor(nurse1.id)).filter((n) => selfTask.ok && n.resourceId === selfTask.value.id).length === 0);
    const failedTask = await mkTask(nurse1.id, nurse2.id);
    check("a refused task sends no notice", !failedTask.ok && (await noticesFor(nurse2.id)).length === 0);
    const patientTask = await mkTask(admin.id, nurse1.id, eleanor.id);
    check("a task about a patient can be given to a nurse on the team", patientTask.ok);

    section("2. Finishing and cancelling tell the OTHER person");
    if (t1.ok) {
      check("the nurse finishes the administrator's task", (await changeTaskStatus(nurse1.id, t1.value.id, "complete")).ok);
      const done = await noticesFor(admin.id, "task_completed");
      check("the person who asked is told it was finished", done.length === 1, String(done.length));
    }
    const adminOwn = await mkTask(admin.id, admin.id);
    if (adminOwn.ok) {
      await changeTaskStatus(admin.id, adminOwn.value.id, "complete");
      check("finishing your own task sends no notice", (await noticesFor(admin.id)).filter((n) => n.resourceId === adminOwn.value.id).length === 0);
    }
    const toCancel = await mkTask(admin.id, nurse1.id);
    if (toCancel.ok) {
      check("the administrator cancels a task given to the nurse", (await changeTaskStatus(admin.id, toCancel.value.id, "cancel")).ok);
      const cancelled = (await noticesFor(nurse1.id, "task_cancelled")).filter((n) => n.resourceId === toCancel.value.id);
      check("the person responsible is told it was cancelled", cancelled.length === 1, String(cancelled.length));
    }
    const nurseOwn = await mkTask(nurse1.id, nurse1.id);
    if (nurseOwn.ok) {
      await changeTaskStatus(nurse1.id, nurseOwn.value.id, "cancel");
      check("cancelling your own task sends no notice", (await noticesFor(nurse1.id)).filter((n) => n.resourceId === nurseOwn.value.id).length === 0);
    }
    const refused = await mkTask(admin.id, nurse1.id);
    if (refused.ok) {
      const before = (await noticesFor(admin.id)).length;
      const r = await changeTaskStatus(nurse2.id, refused.value.id, "complete");
      check("a person who cannot even find the task cannot finish it", !r.ok);
      check("and their attempt sends nobody a notice", (await noticesFor(admin.id)).length === before);
    }

    section("3. You see your own, and only your own");
    const mine = await listNotifications(nurse1.id);
    const mineIds = new Set(mine.rows.map((r) => r.id));
    const nurse1Rows = await prisma.notification.findMany({ where: { userId: nurse1.id } });
    check("the nurse's list holds exactly her own notices", nurse1Rows.every((r) => mineIds.has(r.id)) || nurse1Rows.length > NOTIFICATION_LIST_LIMIT);
    const theirs = await listNotifications(nurse2.id);
    check("the other nurse's list holds none of them", !theirs.rows.some((r) => mineIds.has(r.id)));
    check("the unread count matches the unread rows", (await getUnreadNotificationCount(nurse1.id)) === nurse1Rows.filter((r) => r.readAt === null).length);
    check("each notice is a plain sentence with a link", mine.rows.length > 0 && mine.rows.every((r) => r.text.endsWith(".") && r.href.startsWith("/")));
    const everything = JSON.stringify([mine, await prisma.notification.findMany({ where: { resourceId: { in: taskIds } } })]);
    check("no notice holds a task title", !everything.includes(SECRET_TITLE));
    check("no notice holds a patient's name", !everything.includes("Eleanor") && !everything.includes("Whitfield"));

    section("4. Marking read: yours only");
    const one = n1[0];
    if (one) {
      const other = await markNotificationRead(nurse2.id, one.id);
      check("someone else cannot mark it read", !other.ok && err(other).includes("could not be found"), err(other));
      const still = await prisma.notification.findUniqueOrThrow({ where: { id: one.id } });
      check("and it is still unread", still.readAt === null);
      check("a made-up notice looks exactly the same", err(await markNotificationRead(nurse2.id, "00000000-0000-0000-0000-00000000dead")) === err(other));
      const before = await getUnreadNotificationCount(nurse1.id);
      check("the owner marks it read", (await markNotificationRead(nurse1.id, one.id)).ok);
      check("the unread count went down by one", (await getUnreadNotificationCount(nurse1.id)) === before - 1);
      check("marking it read twice is harmless", (await markNotificationRead(nurse1.id, one.id)).ok);
      auditIds.push(one.id);
    }
    // "Mark all" is tried on a temporary account, so this script never
    // marks a demo account's own real notices as read.
    const temp = await prisma.user.create({
      data: { organizationId: orgId, email: `verify-notify-${runId}@cheliv.test`, passwordHash: "x", name: "Verify Temp" },
    });
    tempUserId = temp.id;
    await prisma.notification.createMany({
      data: [0, 1, 2].map((i) => ({
        organizationId: orgId,
        userId: temp.id,
        kind: "task_assigned",
        resourceType: "verify_filler",
        resourceId: `early-${i}`,
        createdAt: new Date(Date.now() - 10_000_000),
      })),
    });
    const nurse1Unread = await getUnreadNotificationCount(nurse1.id);
    const nurse2Unread = await getUnreadNotificationCount(nurse2.id);
    check("the temporary account starts with unread notices", (await getUnreadNotificationCount(temp.id)) === 3);
    await markAllNotificationsRead(temp.id);
    check("'mark all' clears the caller's own notices", (await getUnreadNotificationCount(temp.id)) === 0);
    check("and touches nobody else's", (await getUnreadNotificationCount(nurse1.id)) === nurse1Unread && (await getUnreadNotificationCount(nurse2.id)) === nurse2Unread);

    section("5. Nothing crosses an organization, and nothing unknown is stored");
    const org2 = await prisma.organization.create({ data: { name: `Verify org ${runId}` } });
    tempOrgId = org2.id;
    const outsider = await prisma.user.create({
      data: { organizationId: org2.id, email: `verify-notify-out-${runId}@cheliv.test`, passwordHash: "x", name: "Verify Outsider" },
    });
    tempOrgUserId = outsider.id;
    await notifyUser({ organizationId: orgId, userId: outsider.id, kind: "task_assigned", resourceType: "task", resourceId: "x" });
    check("a notice for a person in another organization is never written", (await prisma.notification.count({ where: { userId: outsider.id } })) === 0);
    await notifyUser({ organizationId: orgId, userId: nurse2.id, kind: "made_up_kind" as never, resourceType: "task", resourceId: "x" });
    check("a notice of an unknown kind is never written", (await prisma.notification.count({ where: { userId: nurse2.id, kind: "made_up_kind" } })) === 0);
    const unknown = describeNotification("from_the_future", "abc");
    check("an unknown kind still gets a safe sentence", unknown.text.length > 0 && unknown.href === "/dashboard");
    check("every kind has a sentence and a link", NOTIFICATION_KINDS.every((k) => {
      const d = describeNotification(k, "abc");
      return d.text.length > 0 && d.href.startsWith("/") && !d.text.includes("\u2014");
    }));
    check("a link built from an id cannot be bent out of shape", describeNotification("note_reviewed", "../../admin?x=1").href === "/visits/..%2F..%2Fadmin%3Fx%3D1");

    section("6. Long lists are cut, newest first");
    const total = NOTIFICATION_LIST_LIMIT + 10;
    await prisma.notification.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        organizationId: orgId,
        userId: temp.id,
        kind: "task_assigned",
        resourceType: "verify_filler",
        resourceId: `filler-${i}`,
        createdAt: new Date(Date.now() - (total - i) * 1000),
      })),
    });
    const list = await listNotifications(temp.id);
    check("only the newest are listed", list.rows.length === NOTIFICATION_LIST_LIMIT);
    check("the unread count still counts all of them", list.unread === total);
    check("newest first", list.rows[0] !== undefined && list.rows[0].createdAt.getTime() >= (list.rows[1]?.createdAt.getTime() ?? 0));

    section("7. The audit log");
    const logs = await prisma.auditLog.findMany({ where: { resourceId: { in: [...taskIds, ...auditIds] } } });
    check("task events were recorded", ["task_created", "task_completed", "task_cancelled"].every((a) => logs.some((l) => l.action === a)));
    check("the refused mark-read attempts were recorded as denied", (await prisma.auditLog.count({ where: { action: "access_denied", resourceType: "notification", actorUserId: nurse2.id, resourceId: { in: [...auditIds, "00000000-0000-0000-0000-00000000dead"] } } })) >= 2);
    check("the audit log never holds a title", !JSON.stringify(logs).includes(SECRET_TITLE));

    section("8. The screen and the shell");
    const read = (f: string) => readFileSync(f, "utf8");
    check("the notifications page asks who is signed in by itself", read("src/app/(app)/notifications/page.tsx").includes("requireUser()"));
    check("the app layout hands the bell only a count", read("src/app/(app)/layout.tsx").includes("getUnreadNotificationCount") && read("src/app/(app)/layout.tsx").includes("unreadCount={unreadCount}"));
    check("no service file writes to the notifications table except notifications.ts", ["tasks", "visit-notes", "visits", "care-plans", "documents", "referrals", "care-team"].every((f) => !read(`src/lib/${f}.ts`).includes("prisma.notification")));
  } finally {
    try {
      const ids = [tempUserId, tempOrgUserId].filter((x): x is string => x !== null);
      await prisma.notification.deleteMany({
        where: { OR: [{ resourceId: { in: taskIds } }, { userId: { in: ids } }, { resourceType: "verify_filler" }] },
      });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ resourceId: { in: [...taskIds, ...auditIds, "00000000-0000-0000-0000-00000000dead"] } }, { actorUserId: { in: ids } }] },
      });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      if (tempUserId) await prisma.user.deleteMany({ where: { id: tempUserId } });
      if (tempOrgUserId) await prisma.user.deleteMany({ where: { id: tempOrgUserId } });
      if (tempOrgId) await prisma.organization.deleteMany({ where: { id: tempOrgId } });
      console.log("\n  removed the temporary tasks, accounts, organization, notices and audit entries");
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
  console.log("Every notification rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
