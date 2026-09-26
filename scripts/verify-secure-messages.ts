// scripts/verify-secure-messages.ts
//
// Proves secure conversation permission, reach, read-state and notification
// rules. It creates one temporary patient and account, then removes every
// row it creates. Run with: npm run verify:messages

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  getSecureMessages,
  listSecureMessagePatients,
  sendSecureMessage,
} from "@/lib/secure-messages";

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
const section = (title: string) => console.log(`\n${title}`);
async function throwsAuth(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch (error) {
    return error instanceof AuthorizationError;
  }
}

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Secure messaging verification");

  const users = await Promise.all(
    ["admin", "nurse", "nurse2", "caregiver"].map((name) =>
      prisma.user.findUnique({ where: { email: `demo.${name}@cheliv.test` } }),
    ),
  );
  if (users.some((user) => !user)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse, nurse2, caregiver] = users as NonNullable<(typeof users)[number]>[];
  const orgId = admin.organizationId;
  const patientRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: orgId, key: "PATIENT" },
  });
  const runId = Date.now().toString(36);
  const secret = `message-private-${runId}`;
  const userIds: string[] = [];
  const patientIds: string[] = [];
  const threadIds: string[] = [];
  const messageIds: string[] = [];
  const teamIds: string[] = [];
  const startedAt = new Date();

  try {
    const patientUser = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: `verify-message-${runId}@cheliv.test`,
        passwordHash: "not-a-real-hash",
        name: "Verify Message Patient",
      },
    });
    userIds.push(patientUser.id);
    await prisma.userRole.create({ data: { userId: patientUser.id, roleId: patientRole.id } });
    const patient = await prisma.patient.create({
      data: {
        organizationId: orgId,
        userId: patientUser.id,
        firstName: "Message",
        lastName: `Verify${runId}`,
        dateOfBirth: new Date("1950-01-01T00:00:00Z"),
        status: "active",
      },
    });
    patientIds.push(patient.id);
    const nurseAssignment = await prisma.careTeamMember.create({
      data: { patientId: patient.id, userId: nurse.id, roleOnCase: "primary_nurse" },
    });
    const caregiverAssignment = await prisma.careTeamMember.create({
      data: { patientId: patient.id, userId: caregiver.id, roleOnCase: "caregiver" },
    });
    teamIds.push(nurseAssignment.id, caregiverAssignment.id);

    section("1. Permission and current reach both apply");
    check("a caregiver cannot read messages", await throwsAuth(() => getSecureMessages(caregiver.id, patient.id)));
    check("a caregiver cannot send messages", await throwsAuth(() => sendSecureMessage(caregiver.id, patient.id, "Hello")));
    const unreachable = await getSecureMessages(nurse2.id, patient.id);
    const unreachableSend = await sendSecureMessage(nurse2.id, patient.id, "Hello");
    check("a nurse off the care team cannot open the conversation", unreachable === null);
    check("and cannot send to it", !unreachableSend.ok && unreachableSend.error?.includes("could not be found") === true);
    const listedForNurse = await listSecureMessagePatients(nurse.id);
    check("the assigned nurse sees the patient in the inbox", listedForNurse.some((row) => row.id === patient.id));
    check("a staff inbox never includes a patient they cannot reach", !(await listSecureMessagePatients(nurse2.id)).some((row) => row.id === patient.id));

    section("2. A patient and the message-enabled care team can converse");
    const fromStaff = await sendSecureMessage(admin.id, patient.id, secret);
    check("staff with access can send", fromStaff.ok, fromStaff.ok ? "" : fromStaff.error);
    if (fromStaff.ok) messageIds.push(fromStaff.value.id);
    const thread = await prisma.messageThread.findUnique({ where: { patientId: patient.id } });
    if (thread) threadIds.push(thread.id);
    const patientView = await getSecureMessages(patientUser.id, patient.id);
    check("the patient sees their own conversation", patientView?.messages.length === 1 && patientView.messages[0]?.body === secret);
    const patientReply = await sendSecureMessage(patientUser.id, patient.id, "Thank you.");
    check("the patient can reply", patientReply.ok, patientReply.ok ? "" : patientReply.error);
    if (patientReply.ok) messageIds.push(patientReply.value.id);
    const nurseView = await getSecureMessages(nurse.id, patient.id);
    check("the assigned nurse sees both messages", nurseView?.messages.length === 2 && nurseView.messages.some((row) => row.body === secret));
    check("the sender label is limited to conversation participants", nurseView?.messages.every((row) => row.senderName.length > 0) === true);

    section("3. Read state and notifications do not disclose content");
    const patientNotice = await prisma.notification.findFirst({
      where: { userId: patientUser.id, kind: "message_received", resourceId: patient.id },
    });
    const nurseNotice = await prisma.notification.findFirst({
      where: { userId: nurse.id, kind: "message_received", resourceId: patient.id },
    });
    const caregiverNotice = await prisma.notification.findFirst({
      where: { userId: caregiver.id, kind: "message_received", resourceId: patient.id },
    });
    check("the patient receives a generic notice for a staff message", patientNotice !== null);
    check("the message-enabled nurse receives a notice for the patient reply", nurseNotice !== null);
    check("a caregiver without messages.read receives no unusable notice", caregiverNotice === null);
    const unread = (await listSecureMessagePatients(nurse.id)).find((row) => row.id === patient.id)?.unreadCount;
    check("opening the conversation marks the nurse's messages read", unread === 0, String(unread));
    const patientUnread = (await prisma.messageReadState.findUnique({
      where: { threadId_userId: { threadId: thread?.id ?? "", userId: patientUser.id } },
    }))?.lastReadAt;
    check("read state holds only a timestamp", patientUnread instanceof Date);
    const privateRows = JSON.stringify({ patientNotice, nurseNotice, caregiverNotice, audit: await prisma.auditLog.findMany({ where: { resourceId: { in: messageIds } } }) });
    check("notifications and audit rows never retain message text", !privateRows.includes(secret));
    check("sending is audited without a patient name", (await prisma.auditLog.count({ where: { actorUserId: { in: [admin.id, patientUser.id] }, action: "secure_message_sent", resourceId: { in: messageIds }, outcome: "allowed" } })) === messageIds.length);

    section("4. A discharged record closes the conversation for everyone");
    await prisma.patient.update({ where: { id: patient.id }, data: { status: "discharged" } });
    check("staff no longer receives a discharged patient's conversation", (await getSecureMessages(admin.id, patient.id)) === null);
    check("the patient no longer receives it either", (await getSecureMessages(patientUser.id, patient.id)) === null);
    check("the staff inbox omits a discharged patient", !(await listSecureMessagePatients(admin.id)).some((row) => row.id === patient.id));
    const dischargedSend = await sendSecureMessage(admin.id, patient.id, "No delivery");
    check("a discharged conversation cannot accept a new message", !dischargedSend.ok && dischargedSend.error?.includes("could not be found") === true);

    section("5. Denials are recorded without message content");
    const denials = await prisma.auditLog.findMany({
      where: { actorUserId: { in: [nurse2.id, admin.id] }, action: "access_denied", resourceType: "message_thread", occurredAt: { gte: startedAt } },
    });
    check("unreachable and discharged attempts are audited", denials.length >= 3, String(denials.length));
    check("denial records contain no message text", !JSON.stringify(denials).includes(secret));
  } finally {
    try {
      await prisma.notification.deleteMany({ where: { resourceId: { in: patientIds } } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { resourceId: { in: [...messageIds, ...patientIds] } },
            { actorUserId: { in: userIds } },
            { action: "access_denied", resourceType: "message_thread", occurredAt: { gte: startedAt } },
          ],
        },
      });
      await prisma.messageThread.deleteMany({ where: { id: { in: threadIds } } });
      await prisma.careTeamMember.deleteMany({ where: { id: { in: teamIds } } });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      console.log("\n  removed the temporary message account, patient, team rows, conversation, notices and audit entries");
    } catch (error) {
      console.error("  CLEANUP FAILED:", error);
      failures.push("cleanup");
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failed:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
  console.log("Every secure messaging rule held.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
