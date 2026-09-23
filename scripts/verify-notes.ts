// scripts/verify-notes.ts
//
// Proves the visit note rules hold, by trying to break them. Same idea as
// verify-access.ts, kept in its own file so the note rules can be run on
// their own:   npm run verify:notes
//
// Needs the demo data (npx prisma db seed). Creates temporary visits and
// one temporary care team row, and removes them (and their audit entries)
// at the end, even when a check fails. Refuses to run unless DATABASE_URL
// points at this machine.

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  changeVisitNoteStatus,
  createVisitNote,
  getVisitNote,
  listNotesPendingReview,
  listVisitsNeedingDocumentation,
  updateVisitNote,
} from "@/lib/visit-notes";
import { NOTE_CONTENT_MAX } from "@/lib/visit-note-constants";

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
  console.log("Visit note verification");

  const emails = ["admin", "nurse", "nurse2", "supervisor", "coordinator"].map(
    (n) => `demo.${n}@cheliv.test`,
  );
  const users = await Promise.all(emails.map((email) => prisma.user.findUnique({ where: { email } })));
  if (users.some((u) => !u)) {
    console.error("Demo accounts missing. Run: npx prisma db seed");
    process.exit(2);
  }
  const [admin, nurse1, nurse2, supervisor, coordinator] = users as NonNullable<(typeof users)[number]>[];
  const orgId = admin.organizationId;

  const eleanor = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Eleanor" } });
  const marcus = await prisma.patient.findFirstOrThrow({ where: { organizationId: orgId, firstName: "Marcus" } });

  const visitIds: string[] = [];
  let teamRowId: string | null = null;
  const mk = async (patientId: string, clinicianId: string, status: string) => {
    const start = new Date(Date.now() + 86400000 * (visitIds.length + 30));
    const v = await prisma.visit.create({
      data: {
        organizationId: orgId,
        patientId,
        clinicianId,
        scheduledById: admin.id,
        visitType: "skilled_nursing",
        status,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + 2700000),
      },
    });
    visitIds.push(v.id);
    return v.id;
  };

  try {
    const inProg = await mk(eleanor.id, nurse1.id, "in_progress");
    const done = await mk(eleanor.id, nurse1.id, "completed");
    const sched = await mk(eleanor.id, nurse1.id, "scheduled");
    const cancelled = await mk(eleanor.id, nurse1.id, "cancelled");
    const marcusVisit = await mk(marcus.id, nurse2.id, "in_progress");
    const supVisit = await mk(eleanor.id, supervisor.id, "in_progress");

    section("1. Starting a note");
    check("assigned nurse can start a note on an in-progress visit", (await createVisitNote(nurse1.id, inProg, "Found stable.")).ok);
    check("a second note on the same visit is refused", err(await createVisitNote(nurse1.id, inProg, "Again")).includes("already has a note"));
    check("a completed visit can be documented", (await createVisitNote(nurse1.id, done, "Done visit.")).ok);
    check("a scheduled visit cannot be documented", !(await createVisitNote(nurse1.id, sched, "x")).ok);
    check("a cancelled visit cannot be documented", !(await createVisitNote(nurse1.id, cancelled, "x")).ok);
    check("empty text refused", !(await createVisitNote(nurse1.id, inProg, "   ")).ok);
    check("over-long text refused", !(await createVisitNote(nurse1.id, sched, "a".repeat(NOTE_CONTENT_MAX + 1))).ok);

    section("2. Who may write");
    check("a nurse outside the patient's reach gets the not-found words", err(await createVisitNote(nurse2.id, inProg, "x")).includes("could not be found"));
    check("a supervisor is stopped by permission", await throwsAuth(() => createVisitNote(supervisor.id, inProg, "x")));
    check("a coordinator is stopped by permission", await throwsAuth(() => createVisitNote(coordinator.id, inProg, "x")));
    const team = await prisma.careTeamMember.create({ data: { patientId: eleanor.id, userId: nurse2.id, roleOnCase: "nurse" } });
    teamRowId = team.id;
    const extra = await mk(eleanor.id, nurse1.id, "in_progress");
    const r = await createVisitNote(nurse2.id, extra, "Not my visit");
    check("a nurse ON the care team but not the visit's clinician is refused", !r.ok && err(r).includes("assigned clinician"), err(r));
    check("nurse two writing on their own visit works", (await createVisitNote(nurse2.id, marcusVisit, "Marcus ok.")).ok);
    check("nurse one cannot touch nurse two's visit", err(await createVisitNote(nurse1.id, marcusVisit, "x")).includes("could not be found"));

    section("3. Editing and submitting");
    check("author edits own draft", (await updateVisitNote(nurse1.id, inProg, "Updated text")).ok);
    check("another nurse cannot edit it", !(await updateVisitNote(nurse2.id, inProg, "hijack")).ok);
    check("the content really changed", (await prisma.visitNote.findUniqueOrThrow({ where: { visitId: inProg } })).content === "Updated text");
    check("the author can submit", (await changeVisitNoteStatus(nurse1.id, inProg, "submit")).ok);
    check("a submitted note cannot be edited", err(await updateVisitNote(nurse1.id, inProg, "sneaky")).includes("locked"));
    check("submitting twice is refused", !(await changeVisitNoteStatus(nurse1.id, inProg, "submit")).ok);
    check("unknown actions are refused", !(await changeVisitNoteStatus(nurse1.id, inProg, "delete")).ok);

    section("4. Review, four eyes");
    check("the author cannot review their own note (no visits.review)", await throwsAuth(() => changeVisitNoteStatus(nurse1.id, inProg, "review")));
    check("a nurse cannot review", await throwsAuth(() => changeVisitNoteStatus(nurse2.id, inProg, "review")));
    check("a draft cannot be reviewed", !(await changeVisitNoteStatus(supervisor.id, done, "review")).ok);
    const pending = await listNotesPendingReview(supervisor.id);
    check("the supervisor sees the submitted note waiting", pending.some((p) => p.visitId === inProg));
    check("the nurse has no review worklist", (await listNotesPendingReview(nurse1.id)).length === 0);
    // The author holding visits.review must still be refused: give the supervisor
    // authorship of a submitted note directly and try to review it.
    await prisma.visitNote.create({ data: { organizationId: orgId, visitId: supVisit, authorId: supervisor.id, content: "supervisor wrote", status: "submitted", submittedAt: new Date() } });
    const selfReview = await changeVisitNoteStatus(supervisor.id, supVisit, "review");
    check("an author who holds visits.review still cannot review their own note", !selfReview.ok && err(selfReview).includes("cannot review a note you wrote"), err(selfReview));
    check("the supervisor can review", (await changeVisitNoteStatus(supervisor.id, inProg, "review")).ok);
    const reviewed = await prisma.visitNote.findUniqueOrThrow({ where: { visitId: inProg } });
    check("reviewer and time recorded", reviewed.reviewedById === supervisor.id && reviewed.reviewedAt !== null);
    check("a reviewed note stays final", !(await changeVisitNoteStatus(admin.id, inProg, "review")).ok && !(await updateVisitNote(nurse1.id, inProg, "x")).ok);
    check("it leaves the review worklist", !(await listNotesPendingReview(supervisor.id)).some((p) => p.visitId === inProg));

    section("5. Reading and worklists");
    const seen = await getVisitNote(nurse1.id, inProg);
    check("the author reads their note", seen.ok && seen.value.note?.content === "Updated text");
    const other = await getVisitNote(nurse2.id, marcusVisit);
    check("nurse two reads their own note", other.ok && other.value.note !== null);
    await prisma.careTeamMember.update({ where: { id: team.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    check("a nurse whose assignment ended cannot read that visit's note", !(await getVisitNote(nurse2.id, inProg)).ok);
    check("the supervisor (organization reach) reads any note", (await getVisitNote(supervisor.id, inProg)).ok);
    const needs = await listVisitsNeedingDocumentation(nurse1.id);
    check("worklist shows undocumented finished visits only", needs.some((n) => n.visitId === extra) && !needs.some((n) => n.visitId === inProg));
    check("a supervisor has no documentation worklist", (await listVisitsNeedingDocumentation(supervisor.id)).length === 0);

    section("6. The audit log never holds the words");
    const logs = await prisma.auditLog.findMany({ where: { resourceId: { in: visitIds } } });
    check("created, submitted and reviewed were recorded", ["visit_note_created", "visit_note_submitted", "visit_note_reviewed"].every((a) => logs.some((l) => l.action === a)));
    check("denials were recorded", logs.some((l) => l.action === "access_denied"));
    check("no entry contains note text", !JSON.stringify(logs).includes("Updated text"));
  } finally {
    try {
      await prisma.visitNote.deleteMany({ where: { visitId: { in: visitIds } } });
      if (teamRowId) await prisma.careTeamMember.deleteMany({ where: { id: teamRowId } });
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: visitIds } } });
      await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
      console.log("\n  removed the temporary visits, notes, team row and audit entries");
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
  console.log("Every visit note rule held.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
