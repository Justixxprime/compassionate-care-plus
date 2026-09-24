// scripts/verify-sharing.ts
//
// Proves two things hold, by trying to break them.
//   npm run verify:sharing
//
//   A. "Who can see my care": the patient's own list of family members they
//      have shared with (src/lib/patient-sharing.ts).
//   B. The demo-safety changes: the portal-closed screen, the /design-system
//      page hidden on the live site, and the seed refusing to run on a
//      hosted database.
//
// Needs the demo data (npx prisma db seed). Creates temporary patients,
// accounts, consents and one temporary organization, and removes them (and
// their audit entries) at the end, even when a check fails. Refuses to run
// unless DATABASE_URL points at this machine.
//
// The clock is passed in (a day in 2030), so "run out" is exact and the
// script gives the same answer on any day.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getWhoCanSeeMyCare } from "@/lib/patient-sharing";
import {
  isPortalUnavailableError,
  portalDatabaseConfigured,
} from "@/lib/app/portal-availability";

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
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    console.error("Refusing to run: DATABASE_URL does not point at localhost.");
    process.exit(2);
  }
  console.log("Who can see my care, and the demo safety changes: verification");
  const startedAt = new Date();

  const emails = ["admin", "nurse", "supervisor", "coordinator", "caregiver", "patient", "family"].map((n) => `demo.${n}@cheliv.test`);
  const found = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (found.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse, supervisor, coordinator, caregiver, demoPatientUser, demoFamily] = found as NonNullable<(typeof found)[number]>[];
  const orgId = admin.organizationId;
  const roleId = async (key: string) => (await prisma.role.findFirstOrThrow({ where: { organizationId: orgId, key } })).id;

  const tempUserIds: string[] = [];
  const patientIds: string[] = [];
  const orgIds: string[] = [];
  const runId = Date.now().toString(36);
  const mkUser = async (tag: string, role: string) => {
    const u = await prisma.user.create({
      data: { organizationId: orgId, email: `verify-shr-${runId}-${tag}@cheliv.test`, passwordHash: "not-a-real-hash", name: `Verify ${tag}` },
    });
    await prisma.userRole.create({ data: { userId: u.id, roleId: await roleId(role) } });
    tempUserIds.push(u.id);
    return u;
  };
  const mkPatient = async (tag: string, over: Partial<{ userId: string; status: string }> = {}) => {
    const p = await prisma.patient.create({
      data: { organizationId: orgId, firstName: `Shr${tag}`, lastName: "Verify", dateOfBirth: new Date("1950-01-01T00:00:00Z"), status: over.status ?? "active", userId: over.userId ?? null },
    });
    patientIds.push(p.id);
    return p;
  };
  const NOW = new Date("2030-06-15T15:00:00.000Z");
  const day = 86400000;

  try {
    section("A1. Who is stopped at the door");
    for (const [label, who] of [
      ["a nurse", nurse],
      ["a supervisor", supervisor],
      ["a coordinator", coordinator],
      ["a caregiver", caregiver],
      ["a family account", demoFamily],
    ] as const) {
      check(`${label} cannot ask who can see a patient's care`, await throwsAuth(() => getWhoCanSeeMyCare(who.id, NOW)));
    }
    let adminOutcome = "other";
    try {
      const r = await getWhoCanSeeMyCare(admin.id, NOW);
      adminOutcome = r === null ? "null" : "list";
    } catch (e) {
      adminOutcome = e instanceof AuthorizationError ? "refused" : "other";
    }
    check("an administrator is refused or gets nothing (never someone's list)", adminOutcome === "refused" || adminOutcome === "null", adminOutcome);

    const unlinked = await mkUser("unlinked", "PATIENT");
    check("a patient account linked to no record gets null, not a list", (await getWhoCanSeeMyCare(unlinked.id, NOW)) === null);

    section("A2. What a patient sees");
    const ptUser = await mkUser("pt", "PATIENT");
    const mine = await mkPatient("mine", { userId: ptUser.id });
    const other = await mkPatient("other");
    const f1 = await mkUser("f1", "AUTHORIZED_FAMILY");
    const f2 = await mkUser("f2", "AUTHORIZED_FAMILY");
    const f3 = await mkUser("f3", "AUTHORIZED_FAMILY");
    const f4 = await mkUser("f4", "AUTHORIZED_FAMILY");
    const f5 = await mkUser("f5", "AUTHORIZED_FAMILY");
    const foreignOrg = await prisma.organization.create({ data: { name: `Verify org ${runId}` } });
    orgIds.push(foreignOrg.id);
    const mkConsent = (patientId: string, familyUserId: string, rel: string, scopes: string[], over: Partial<{ expiresAt: Date | null; revokedAt: Date | null; organizationId: string }> = {}) =>
      prisma.familyConsent.create({
        data: {
          organizationId: over.organizationId ?? orgId,
          patientId,
          familyUserId,
          relationship: rel,
          scopes,
          grantedById: admin.id,
          expiresAt: over.expiresAt === undefined ? null : over.expiresAt,
          revokedAt: over.revokedAt ?? null,
        },
      });
    const c1 = await mkConsent(mine.id, f1.id, "adult_child", ["visits", "care_team"], { expiresAt: new Date(NOW.getTime() + 30 * day) });
    await mkConsent(mine.id, f2.id, "spouse_partner", ["care_plan", "visits", "care_team"]);
    await mkConsent(mine.id, f3.id, "friend", ["visits"], { revokedAt: new Date(NOW.getTime() - day) });
    await mkConsent(mine.id, f4.id, "sibling", ["visits"], { expiresAt: new Date(NOW.getTime() - day) });
    await mkConsent(other.id, f5.id, "friend", ["visits"]);
    await mkConsent(mine.id, f5.id, "friend", ["visits"], { organizationId: foreignOrg.id });

    const list = (await getWhoCanSeeMyCare(ptUser.id, NOW))!;
    check("the patient sees exactly the two permissions in force", !!list && list.length === 2 && sameSet(list.map((p) => p.name), ["Verify f1", "Verify f2"]), JSON.stringify(list?.map((p) => p.name)));
    const p1 = list.find((p) => p.name === "Verify f1");
    const p2 = list.find((p) => p.name === "Verify f2");
    check("each shows how they are related, in plain words", p1?.relationshipLabel === "Son or daughter" && p2?.relationshipLabel === "Spouse or partner");
    check("each shows which parts are shared, in the fixed order", !!p1 && !!p2 && sameSet(p1.scopeLabels, ["Visit schedule", "Care team"]) && p2.scopeLabels.join("|") === "Visit schedule|Care team|Care plan", `${p1?.scopeLabels.join("|")} / ${p2?.scopeLabels.join("|")}`);
    check("a permission with an end shows it, an open one shows none", p1?.sharedUntil?.getTime() === new Date(NOW.getTime() + 30 * day).getTime() && p2?.sharedUntil === null);
    check("a withdrawn permission is not listed", !list.some((p) => p.name === "Verify f3"));
    check("a permission that has run out is not listed", !list.some((p) => p.name === "Verify f4"));
    check("another patient's permission is not listed", !list.some((p) => p.name === "Verify f5"));
    check("nothing but four plain fields comes back (no e-mail, no ids, no who recorded it)", list.every((p) => sameSet(Object.keys(p), ["name", "relationshipLabel", "scopeLabels", "sharedUntil"])) && !JSON.stringify(list).includes("@cheliv.test"));

    section("A3. It follows the office at once");
    await prisma.familyConsent.update({ where: { id: c1.id }, data: { revokedAt: new Date(NOW.getTime() - 1000) } });
    const after = (await getWhoCanSeeMyCare(ptUser.id, NOW))!;
    check("after the office withdraws one, the patient's list no longer shows it", after.length === 1 && after[0].name === "Verify f2");
    const lateNow = new Date(NOW.getTime() + 400 * day);
    check("the clock matters: with no end set, it still shows a year later", (await getWhoCanSeeMyCare(ptUser.id, lateNow))!.length === 1);

    section("A4. Whose record is it");
    const heldUser = await mkUser("held", "PATIENT");
    const held = await mkPatient("held", { userId: heldUser.id, status: "on_hold" });
    await mkConsent(held.id, f1.id, "friend", ["visits"]);
    check("a patient on hold still sees their list", ((await getWhoCanSeeMyCare(heldUser.id, NOW)) ?? []).length === 1);
    const goneUser = await mkUser("gone", "PATIENT");
    const gone = await mkPatient("gone", { userId: goneUser.id, status: "discharged" });
    await mkConsent(gone.id, f1.id, "friend", ["visits"]);
    check("a discharged patient has no portal: null, not a list", (await getWhoCanSeeMyCare(goneUser.id, NOW)) === null);
    check("the demo patient account can be asked without error", (await getWhoCanSeeMyCare(demoPatientUser.id, NOW)) !== undefined);

    section("A5. The code says what it should");
    const sharing = read("src/lib/patient-sharing.ts");
    check("it takes no patient id (only the account and a clock)", /getWhoCanSeeMyCare\(\s*userId: string,\s*now: Date = new Date\(\),?\s*\)/.test(sharing));
    check("it asks for portal.read first", /requirePermission\(userId, "portal\.read"\)/.test(sharing));
    check("it only reads the consents table (no create, update or delete)", !/familyConsent\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(sharing));
    check("it never selects an e-mail address, a date of birth or a password", !/\b(email|dateOfBirth|passwordHash|grantedBy)\s*:\s*true/.test(sharing));
    check("it never queries notes, tasks, documents, referrals or the audit log", !/prisma\.(visitNote|visitNoteAddendum|task|document|documentFile|referral|notification|auditLog)\b/.test(sharing));
    const page = read("src/app/(app)/my-care/page.tsx");
    check("the My care page shows the panel and still asks who is signed in by itself", /getWhoCanSeeMyCare/.test(page) && /SharingPanel/.test(page) && /requireUser\(\)/.test(page));

    section("B1. The portal-closed screen");
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    check("no database address means the portal is closed", portalDatabaseConfigured() === false);
    process.env.DATABASE_URL = "   ";
    check("a blank database address also means closed", portalDatabaseConfigured() === false);
    process.env.DATABASE_URL = saved;
    check("a database address means open", portalDatabaseConfigured() === true);
    check("an unreachable database counts as unavailable", isPortalUnavailableError(new Prisma.PrismaClientInitializationError("cannot reach", "6.19.3")));
    check("a server that cannot be reached or timed out counts as unavailable, whichever way Prisma reports it", ["P1001", "P1002", "P1003", "P1008", "P1017"].every((code) => isPortalUnavailableError(new Prisma.PrismaClientKnownRequestError("down", { code, clientVersion: "6.19.3" }))));
    check("a missing table or column counts as unavailable", isPortalUnavailableError(new Prisma.PrismaClientKnownRequestError("no table", { code: "P2021", clientVersion: "6.19.3" })) && isPortalUnavailableError(new Prisma.PrismaClientKnownRequestError("no column", { code: "P2022", clientVersion: "6.19.3" })));
    check("a real bug is NOT hidden (other Prisma errors and plain errors are not unavailable)", !isPortalUnavailableError(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6.19.3" })) && !isPortalUnavailableError(new Error("boom")) && !isPortalUnavailableError(null));
    const signIn = read("src/app/sign-in/page.tsx");
    check("the sign-in page shows the closed screen when there is no database address", /if \(!portalDatabaseConfigured\(\)\)\s*\{\s*return <PortalClosed \/>/.test(signIn));
    check("the sign-in page hides only unavailable errors and re-throws the rest", /isPortalUnavailableError\(err\)/.test(signIn) && /throw err;/.test(signIn));
    check("the sign-in page still sends a signed-in person to the dashboard", /redirect\("\/dashboard"\)/.test(signIn));
    const closed = read("src/components/app/portal-closed.tsx");
    check("the closed screen offers a way forward and shows no error code or technical words", /href="\/request-care"/.test(closed) && /href="\/"/.test(closed) && !/(error|digest|database|server)/i.test(closed.replace(/\/\*[\s\S]*?\*\//g, "")));
    check("the closed screen reads nothing and lets nobody in (no database, no session)", !/prisma|session|cookies/i.test(closed.replace(/\/\*[\s\S]*?\*\//g, "")));

    section("B2. The internal style page and the seed");
    const ds = read("src/app/design-system/page.tsx");
    check("/design-system answers 'not found' in a production build", /process\.env\.NODE_ENV === "production"\s*\)\s*\{\s*notFound\(\)/.test(ds));
    const seed = read("prisma/seed.ts");
    check("the seed refuses to run unless the database is on this machine", /Refusing to seed/.test(seed) && /process\.exit\(2\)/.test(seed) && seed.indexOf("Refusing to seed") < seed.indexOf("Seeding database"));
  } finally {
    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: tempUserIds } },
            { action: "permission_denied", resourceId: "portal.read", occurredAt: { gte: startedAt } },
          ],
        },
      });
      await prisma.familyConsent.deleteMany({ where: { OR: [{ patientId: { in: patientIds } }, { familyUserId: { in: tempUserIds } }, { organizationId: { in: orgIds } }] } });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: tempUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      console.log("\n  removed the temporary patients, accounts, consents, organization and audit entries");
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
  console.log("Every rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
