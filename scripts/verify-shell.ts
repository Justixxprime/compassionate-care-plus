// scripts/verify-shell.ts
//
// Checks the internal app's shell: the menu, the dashboards and the rules
// that keep every screen locked on its own. Run with:  npm run verify:shell
//
// READ-ONLY. It uses the demo accounts that `npx prisma db seed` creates
// and changes nothing in the database. (npm run verify:access is the one
// that builds and removes temporary test people; this one never does.)
//
// WHAT IT PROVES
//   0. The files are laid out safely: every screen under src/app/(app)
//      asks who is signed in by itself, the (app) layout has no html or
//      body tags, no screen exists in two places, and every menu link has a
//      real page behind it.
//   1. The menu each demo account gets, decided from real permissions.
//   2. The dashboard each demo account gets: a section exists only for
//      someone who holds its permission.
//   3. The small decisions behind the dashboard (waiting time, "today",
//      what needs attention), with made-up rows.

import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/auth/authorize";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  NAV_DEFINITION,
  buildNavigation,
  isCurrentPath,
  navHrefs,
} from "@/lib/app/navigation";
import {
  firstNameOf,
  greetingForHour,
  primaryRoleKey,
  roleIntro,
} from "@/lib/app/roles";
import {
  LONG_WAIT_HOURS,
  buildAttention,
  summarizeReferralQueue,
  visitsOnOfficeDay,
} from "@/lib/app/dashboard-logic";
import { getDashboardData } from "@/lib/app/dashboard";
import { formatWaiting, orgDateKey, orgHour } from "@/lib/time";

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

const sameSet = (got: string[], want: string[]) =>
  got.length === want.length && [...want].sort().every((k, i) => [...got].sort()[i] === k);

async function main() {
  console.log(`Shell verification, run ${Date.now().toString(36)}`);
  const root = process.cwd();
  const appDir = join(root, "src", "app");
  const groupDir = join(appDir, "(app)");

  // ----- 0. Layout and lock guards, read from the source -----
  section("0. The screens are laid out safely");
  const pages: string[] = [];
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") pages.push(full);
      else if (name === "route.ts") routes.push(full);
    }
  };
  walk(groupDir);
  const rel = (f: string) => relative(root, f).replace(/\\/g, "/");

  check("the internal app has screens", pages.length >= 7, String(pages.length));
  const pagesMissingLock = pages.filter((f) => !readFileSync(f, "utf8").includes("await requireUser()")).map(rel);
  check("EVERY screen under (app) asks who is signed in by itself (the shell is not the lock)", pagesMissingLock.length === 0, pagesMissingLock.join(", "));
  const routesMissingLock = routes
    .filter((f) => {
      const src = readFileSync(f, "utf8");
      return !src.includes("getCurrentUser") && !src.includes("requireUser");
    })
    .map(rel);
  check("every route handler under (app) checks the session itself", routesMissingLock.length === 0, routesMissingLock.join(", "));

  const layoutSrc = readFileSync(join(groupDir, "layout.tsx"), "utf8");
  check("the (app) layout draws the shell", layoutSrc.includes("AppShell"));
  check("the (app) layout has no html or body tag (only the root layout may)", !layoutSrc.includes("<html") && !layoutSrc.includes("<body"));
  const rootSrc = readFileSync(join(appDir, "layout.tsx"), "utf8");
  check("the root layout still has html, body and the css import", rootSrc.includes("<html") && rootSrc.includes("<body") && rootSrc.includes('"./globals.css"'));
  const movedScreens = ["dashboard", "patients", "visits", "care-plans", "documents", "referrals"];
  const doubled = movedScreens.filter((n) => existsSync(join(appDir, n)) && existsSync(join(groupDir, n)));
  check("no screen exists in two places", doubled.length === 0, doubled.join(", "));

  const menuHrefs = NAV_DEFINITION.flatMap((g) => g.items.map((i) => i.href));
  const missingPages = menuHrefs.filter((h) => !existsSync(join(groupDir, h.slice(1), "page.tsx")));
  check("every menu link has a real page behind it", missingPages.length === 0, missingPages.join(", "));
  const noPermissionAsked = NAV_DEFINITION.flatMap((g) => g.items).filter((i) => i.requires === null).map((i) => i.href);
  check("only the dashboard is open to any signed-in account", sameSet(noPermissionAsked, ["/dashboard"]), noPermissionAsked.join(", "));
  check("the sharing screen exists and is not in the menu (it is reached from Documents)", existsSync(join(groupDir, "documents", "sharing", "page.tsx")) && !menuHrefs.includes("/documents/sharing"));

  // ----- 1. The menu, per demo account -----
  section("1. The menu each demo account gets");
  const emails = {
    admin: "demo.admin@cheliv.test",
    coordinator: "demo.coordinator@cheliv.test",
    supervisor: "demo.supervisor@cheliv.test",
    nurse: "demo.nurse@cheliv.test",
    nurse2: "demo.nurse2@cheliv.test",
  } as const;
  const users: Record<string, { id: string }> = {};
  for (const [key, email] of Object.entries(emails)) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    check(`demo account exists: ${email}`, u !== null, "run: npx prisma db seed");
    if (u) users[key] = u;
  }
  if (Object.keys(users).length !== Object.keys(emails).length) {
    throw new Error("A demo account is missing. Run: npx prisma db seed");
  }

  const permsOf = async (key: string) => new Set(await getUserPermissions(users[key].id));
  const menuOf = async (key: string) => navHrefs(buildNavigation(await permsOf(key)));
  const everything = ["/dashboard", "/patients", "/visits", "/care-plans", "/referrals", "/documents"];
  check("admin sees every menu item", sameSet(await menuOf("admin"), everything), (await menuOf("admin")).join(" "));
  check("coordinator sees dashboard, patients, visits, referrals (no clinical content)", sameSet(await menuOf("coordinator"), ["/dashboard", "/patients", "/visits", "/referrals"]), (await menuOf("coordinator")).join(" "));
  check("supervisor sees dashboard, patients, visits, care plans, documents (no referrals)", sameSet(await menuOf("supervisor"), ["/dashboard", "/patients", "/visits", "/care-plans", "/documents"]), (await menuOf("supervisor")).join(" "));
  check("nurse one sees the clinical menu", sameSet(await menuOf("nurse"), everything), (await menuOf("nurse")).join(" "));
  check("nurse two sees the same menu as nurse one", sameSet(await menuOf("nurse2"), await menuOf("nurse")));
  check("an account with no permissions gets the dashboard and nothing else", sameSet(navHrefs(buildNavigation(new Set())), ["/dashboard"]));
  check("a group with nothing in it is left out", buildNavigation(new Set()).every((g) => g.items.length > 0));
  check("holding one permission adds exactly that item", sameSet(navHrefs(buildNavigation(new Set(["visits.read"]))), ["/dashboard", "/visits"]));
  check("an unrelated permission adds no item", sameSet(navHrefs(buildNavigation(new Set(["documents.grant", "care_team.read"]))), ["/dashboard"]));
  check("the current page is recognised, including pages below it", isCurrentPath("/visits", "/visits") && isCurrentPath("/documents/sharing", "/documents") && !isCurrentPath("/visitsx", "/visits") && !isCurrentPath("/patients", "/visits"));

  // ----- 2. The dashboard, per demo account -----
  section("2. The dashboard each demo account gets");
  const now = new Date();
  const dash = async (key: string) => getDashboardData(users[key].id, await permsOf(key), now);
  const admin = await dash("admin");
  check("admin: referrals, patients without a nurse, plans to approve, visits, activity", admin.referrals !== null && admin.needsPrimaryNurse !== null && admin.plansToApprove !== null && admin.todaysVisits !== null && admin.recentActivity !== null);
  const coord = await dash("coordinator");
  check("coordinator: referrals, patients without a nurse, visits", coord.referrals !== null && coord.needsPrimaryNurse !== null && coord.todaysVisits !== null);
  check("coordinator: no plans to approve, no activity log", coord.plansToApprove === null && coord.recentActivity === null);
  const sup = await dash("supervisor");
  check("supervisor: plans to approve, patients without a nurse, visits", sup.plansToApprove !== null && sup.needsPrimaryNurse !== null && sup.todaysVisits !== null);
  check("supervisor: no referral queue, no activity log", sup.referrals === null && sup.recentActivity === null);
  const nurse = await dash("nurse");
  check("nurse: today's visits only", nurse.todaysVisits !== null && nurse.referrals === null && nurse.needsPrimaryNurse === null && nurse.plansToApprove === null && nurse.recentActivity === null);
  const none = await getDashboardData(users.admin.id, new Set(), now);
  check("a person holding no permissions gets no section at all, even on an administrator's data", none.tiles.length === 0 && none.attention.length === 0 && none.todaysVisits === null && none.referrals === null && none.needsPrimaryNurse === null && none.plansToApprove === null && none.recentActivity === null);
  const patientCount = await prisma.patient.count({ where: { organizationId: (await prisma.user.findUniqueOrThrow({ where: { id: users.admin.id }, select: { organizationId: true } })).organizationId } });
  const adminPatientsTile = admin.tiles.find((t) => t.key === "patients");
  check("admin's patient tile counts every patient", adminPatientsTile?.value === patientCount, `${adminPatientsTile?.value} vs ${patientCount}`);
  const nursePatientsTile = nurse.tiles.find((t) => t.key === "patients");
  check("a nurse's patient tile counts only assigned patients", nursePatientsTile !== undefined && nursePatientsTile.value < patientCount && nursePatientsTile.value >= 1, `${nursePatientsTile?.value} vs ${patientCount}`);
  check("every dashboard link points at a real screen", [admin, coord, sup, nurse].every((d) => [...d.tiles.map((t) => t.href), ...d.attention.map((a) => a.href)].every((h) => menuHrefs.includes(h))));
  // Reading the menu of each account against its tiles: a tile that links
  // to a screen missing from that account's own menu would be a dead end.
  for (const [key, d] of [["admin", admin], ["coordinator", coord], ["supervisor", sup], ["nurse", nurse]] as const) {
    const menu = await menuOf(key);
    const dead = d.tiles.filter((t) => !menu.includes(t.href)).map((t) => t.href);
    check(`${key}: no tile leads to a screen missing from their own menu`, dead.length === 0, dead.join(", "));
  }

  // ----- 3. The small decisions, with made-up rows -----
  section("3. Waiting time, today, and what needs attention");
  const t0 = new Date("2026-09-21T15:00:00.000Z");
  const ago = (ms: number) => new Date(t0.getTime() - ms);
  const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR;
  check("under a minute reads Just now", formatWaiting(ago(20_000), t0) === "Just now");
  check("minutes", formatWaiting(ago(12 * MIN), t0) === "12 min");
  check("hours", formatWaiting(ago(5 * HR + 40 * MIN), t0) === "5 hr");
  check("47 hours rounds DOWN to 1 day, never up", formatWaiting(ago(47 * HR), t0) === "1 day");
  check("days", formatWaiting(ago(3 * DAY + 2 * HR), t0) === "3 days");
  check("a moment in the future reads Just now", formatWaiting(new Date(t0.getTime() + HR), t0) === "Just now");

  check("office day: 11:30 pm Central is still that day (though it is tomorrow in UTC)", orgDateKey(new Date("2026-09-22T04:30:00.000Z")) === "2026-09-21");
  check("office day: just after midnight Central is the new day", orgDateKey(new Date("2026-09-21T05:30:00.000Z")) === "2026-09-21" && orgDateKey(new Date("2026-09-21T04:30:00.000Z")) === "2026-09-20");
  check("office hour follows Central time (10:00 UTC in September is 5)", orgHour(new Date("2026-09-21T10:00:00.000Z")) === 5);
  check("greetings by hour", greetingForHour(6) === "Good morning" && greetingForHour(12) === "Good afternoon" && greetingForHour(16) === "Good afternoon" && greetingForHour(17) === "Good evening");
  check("first name of a full name", firstNameOf("Demo Coordinator") === "Demo" && firstNameOf("  Ada  ") === "Ada");

  const q = summarizeReferralQueue(
    [
      { status: "received", urgency: "urgent", createdAt: ago(3 * DAY) },
      { status: "in_review", urgency: "routine", createdAt: ago(10 * HR) },
      { status: "received", urgency: "routine", createdAt: ago(LONG_WAIT_HOURS * HR + MIN) },
      { status: "accepted", urgency: "urgent", createdAt: ago(9 * DAY) },
      { status: "declined", urgency: "routine", createdAt: ago(20 * DAY) },
    ],
    t0,
  );
  check("only open referrals count", q.open === 3);
  check("an accepted urgent referral is not urgent any more", q.urgent === 1);
  check("waiting long means over the limit", q.waitingLong === 2);
  check("the oldest open referral is found (closed ones ignored)", q.oldestWaitingSince?.getTime() === ago(3 * DAY).getTime());
  check("an empty queue has no oldest", summarizeReferralQueue([], t0).oldestWaitingSince === null);

  const visitRows = [
    { id: "a", scheduledStart: new Date("2026-09-21T20:00:00.000Z"), status: "scheduled" },
    { id: "b", scheduledStart: new Date("2026-09-21T15:00:00.000Z"), status: "completed" },
    { id: "c", scheduledStart: new Date("2026-09-21T16:00:00.000Z"), status: "cancelled" },
    { id: "d", scheduledStart: new Date("2026-09-22T15:00:00.000Z"), status: "scheduled" },
    { id: "e", scheduledStart: new Date("2026-09-22T04:30:00.000Z"), status: "scheduled" },
  ];
  const today = visitsOnOfficeDay(visitRows, t0).map((v) => v.id);
  check("today's visits: same office day, cancelled left out, soonest first", today.join(",") === "b,a,e", today.join(","));

  const attention = buildAttention({ urgentReferrals: 2, longWaitReferrals: 1, overdueVisits: 1, patientsWithoutPrimaryNurse: 3, plansToApprove: 1 });
  check("attention lists the most serious first", attention.map((a) => a.key).join(",") === "urgent-referrals,long-wait-referrals,overdue-visits,no-primary-nurse,plans-to-approve");
  check("attention uses plain, correct words", attention[0].text === "2 urgent referrals are waiting for an answer." && attention[2].text === "1 visit is past its time and never checked in.");
  check("zero and no-access items never appear", buildAttention({ urgentReferrals: 0, longWaitReferrals: null, overdueVisits: 0, patientsWithoutPrimaryNurse: null, plansToApprove: null }).length === 0);
  check("every attention item links to a screen in the menu", attention.every((a) => menuHrefs.includes(a.href)));
  check("role words: the supervisor and nurse get their own sentence, others get the plain default", roleIntro(["CLINICAL_SUPERVISOR"]).includes("approval") && roleIntro(["NURSE"]).includes("visits") && roleIntro(["CAREGIVER"]).includes("still being built"));
  check("the most senior role describes a person with two roles", primaryRoleKey(["NURSE", "ADMIN"]) === "ADMIN" && primaryRoleKey([]) === null);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("The shell held.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
