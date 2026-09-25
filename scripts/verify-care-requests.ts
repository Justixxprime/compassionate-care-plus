// scripts/verify-care-requests.ts
//
// Proves the care request rules hold, by trying to break them.
//   npm run verify:care-requests
//
// Needs the demo data (npx prisma db seed). Creates temporary care
// requests, one temporary no-permission account and, briefly, a second
// organization to prove scoping - removes all of it, and its audit and
// notification entries, at the end, even when a check fails. Refuses to
// run unless DATABASE_URL points at this machine.

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  changeCareRequestStatus,
  createCareRequest,
  listCareRequests,
  type SubmitCareRequestInput,
} from "@/lib/care-requests";
import { CONTACT_MAX, MESSAGE_MAX, NAME_MAX } from "@/lib/care-request-constants";

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

const BASE: SubmitCareRequestInput = {
  fullName: "Verify Person",
  relationship: "Myself",
  email: "verify.care.request@example.test",
  phone: "555-0100",
  preferredContact: "Phone",
  serviceInterest: "",
  bestTime: "Anytime",
  message: "",
  honeypot: "",
};

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Care request verification");

  const emails = ["admin", "nurse"].map((n) => `demo.${n}@cheliv.test`);
  const users = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (users.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse] = users as NonNullable<(typeof users)[number]>[];
  const orgId = admin.organizationId;

  const requestIds: string[] = [];
  const tempUserIds: string[] = [];
  let secondOrgId: string | null = null;
  const mk = async (input: Partial<SubmitCareRequestInput> = {}) => {
    const r = await createCareRequest({ ...BASE, ...input });
    if (r.ok && r.value.id) requestIds.push(r.value.id);
    return r;
  };

  try {
    section("1. Submitting (no session - anyone on the internet)");
    const first = await mk({ fullName: "Alice Example" });
    check("a plausible submission is accepted", first.ok, err(first));
    if (!first.ok) throw new Error(err(first));
    check("and saved to the database", first.ok && (await prisma.careRequest.findUnique({ where: { id: first.value.id } })) !== null);
    check("empty name refused", !(await mk({ fullName: "  " })).ok);
    check("name over the limit refused", !(await mk({ fullName: "a".repeat(NAME_MAX + 1) })).ok);
    check("made-up relationship refused", !(await mk({ relationship: "Neighbor" })).ok);
    check("not-an-email refused", !(await mk({ email: "not-an-email" })).ok);
    check("email over the limit refused", !(await mk({ email: `${"a".repeat(CONTACT_MAX)}@example.test` })).ok);
    check("empty phone refused", !(await mk({ phone: "  " })).ok);
    check("made-up contact method refused", !(await mk({ preferredContact: "Carrier pigeon" })).ok);
    check("message over the limit refused", !(await mk({ message: "a".repeat(MESSAGE_MAX + 1) })).ok);
    const withMessage = await mk({ fullName: "Bob Example", message: "Please call after 5pm." });
    check("a message within the limit is kept", withMessage.ok && (await prisma.careRequest.findUnique({ where: { id: withMessage.value.id } }))?.message === "Please call after 5pm.");
    if (!withMessage.ok) throw new Error(err(withMessage));

    section("2. The honeypot");
    const before = await prisma.careRequest.count({ where: { organizationId: orgId } });
    const bot = await mk({ fullName: "A Bot", honeypot: "http://spam.example" });
    const after = await prisma.careRequest.count({ where: { organizationId: orgId } });
    check("a filled honeypot looks like success", bot.ok);
    check("but writes nothing", after === before, `${before} -> ${after}`);

    section("3. The office address");
    const stamped = await prisma.careRequest.findUnique({ where: { id: first.value.id } });
    check("the request records the configured notify address", stamped?.notifyEmail === "justixxchiobi@gmail.com", stamped?.notifyEmail);

    section("4. In-app notification, since there is no e-mail service yet");
    const notice = await prisma.notification.findFirst({
      where: { userId: admin.id, kind: "care_request_received", resourceId: first.value.id },
    });
    check("the admin is notified in-app when a request comes in", notice !== null);
    const nurseNotice = await prisma.notification.findFirst({
      where: { userId: nurse.id, kind: "care_request_received", resourceId: first.value.id },
    });
    check("a nurse (no care_requests.manage) is not notified", nurseNotice === null);

    section("5. Reading and acting needs care_requests.manage");
    const temp = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: `verify.nopermissions.${Date.now().toString(36)}@cheliv.test`,
        passwordHash: "not-a-real-hash",
        name: "Verify No Permissions",
      },
    });
    tempUserIds.push(temp.id);
    const noPermRole = await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key: "PATIENT" } });
    await prisma.userRole.create({ data: { userId: temp.id, roleId: noPermRole.id } });
    check("an account with no permission cannot list", await throwsAuth(() => listCareRequests(temp.id)));
    check("or act", await throwsAuth(() => changeCareRequestStatus(temp.id, first.value.id, "contact")));
    check("a nurse (reach is not the point here) cannot list either", await throwsAuth(() => listCareRequests(nurse.id)));
    check("the admin can list", (await listCareRequests(admin.id)).length > 0);

    section("6. Organization scoping");
    const secondOrg = await prisma.organization.create({ data: { name: "Verify Other Org" } });
    secondOrgId = secondOrg.id;
    const otherRequest = await prisma.careRequest.create({
      data: {
        organizationId: secondOrg.id,
        fullName: "Other Org Person",
        relationship: "Myself",
        email: "other@example.test",
        phone: "555-0199",
        preferredContact: "Phone",
        bestTime: "Anytime",
        notifyEmail: "someone@example.test",
      },
    });
    const adminList = await listCareRequests(admin.id);
    check("an admin never sees another organization's request", !adminList.some((r) => r.id === otherRequest.id));
    const crossOrg = await changeCareRequestStatus(admin.id, otherRequest.id, "contact");
    check("and cannot act on it either - same not-found words", err(crossOrg).includes("could not be found"), err(crossOrg));

    section("7. Status transitions");
    const toContact = await changeCareRequestStatus(admin.id, first.value.id, "contact");
    check("mark contacted succeeds", toContact.ok, err(toContact));
    const already = await changeCareRequestStatus(admin.id, first.value.id, "contact");
    check("marking contacted twice is refused", !already.ok);
    const toClose = await changeCareRequestStatus(admin.id, first.value.id, "close");
    check("close succeeds from contacted", toClose.ok, err(toClose));
    check("a closed request cannot be reopened", !(await changeCareRequestStatus(admin.id, first.value.id, "contact")).ok);
    const madeUp = await changeCareRequestStatus(admin.id, "00000000-0000-0000-0000-00000000dead", "contact");
    check("a made-up id gets the same not-found words", err(madeUp).includes("could not be found"));
    const unknownAction = await changeCareRequestStatus(admin.id, withMessage.value.id, "delete");
    check("an unrecognized action is refused", !unknownAction.ok);

    const stampedAfter = await prisma.careRequest.findUnique({ where: { id: first.value.id } });
    check("contactedBy and contactedAt are recorded", stampedAfter?.contactedById === admin.id && stampedAfter?.contactedAt !== null);

    section("8. The audit log records that it happened, never what was said");
    const logs = await prisma.auditLog.findMany({ where: { resourceId: { in: requestIds } } });
    check("received, contacted and closed were all recorded", ["care_request_received", "care_request_contacted", "care_request_closed"].every((a) => logs.some((l) => l.action === a)));
    check("no entry contains a name or the message", !JSON.stringify(logs).includes("Alice Example") && !JSON.stringify(logs).includes("Please call after 5pm"));
  } finally {
    try {
      await prisma.notification.deleteMany({ where: { resourceId: { in: requestIds } } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ resourceId: { in: [...requestIds, secondOrgId ?? ""] } }, { actorUserId: { in: tempUserIds } }] } });
      await prisma.careRequest.deleteMany({ where: { id: { in: requestIds } } });
      if (secondOrgId) {
        await prisma.careRequest.deleteMany({ where: { organizationId: secondOrgId } });
        await prisma.organization.delete({ where: { id: secondOrgId } });
      }
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
      console.log("\n  removed the temporary requests, account, second organization and audit/notification entries");
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
  console.log("Every care request rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
