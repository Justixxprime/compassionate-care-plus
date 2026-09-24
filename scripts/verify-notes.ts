// scripts/verify-notes.ts
//
// Proves the visit note rules hold, by trying to break them. Same idea as
// verify-access.ts, kept in its own file so the note rules can be run on
// their own:   npm run verify:notes
//
// Covers the note itself (sections 1 to 6) and the addenda written under a
// reviewed note (sections 7 to 9).
//
// Needs the demo data (npx prisma db seed). Creates temporary visits and
// one temporary care team row, and removes them (and their notes, addenda,
// notifications and audit entries) at the end, even when a check fails. Refuses to run unless DATABASE_URL
// points at this machine.

import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  addVisitNoteAddendum,
  changeVisitNoteStatus,
  createVisitNote,
  getVisitNote,
  listNotesPendingReview,
  listVisitsNeedingDocumentation,
  reviewVisitNoteAddendum,
  updateVisitNote,
} from "@/lib/visit-notes";
import {
  ADDENDA_MAX_PER_NOTE,
  ADDENDUM_CONTENT_MAX,
  NOTE_CONTENT_MAX,
} from "@/lib/visit-note-constants";

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
  const runId = Date.now().toString(36);
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
  let limitedTeamId: string | null = null;
  let tempUserId: string | null = null;
  let tempRoleId: string | null = null;
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

    section("7. Addenda: who may add one, and when");
    const inProgNote = await prisma.visitNote.findUniqueOrThrow({ where: { visitId: inProg } });
    const addendaOn = (noteId: string) => prisma.visitNoteAddendum.count({ where: { noteId } });
    const doseText = "Correction: the dose was five milligrams";
    const nurse2Back = await prisma.careTeamMember.update({ where: { id: team.id }, data: { endsAt: null } });
    void nurse2Back;

    const marcusNoteDraft = await addVisitNoteAddendum(nurse2.id, marcusVisit, "correction", "too early");
    check("an addendum cannot be added while the note is a draft", !marcusNoteDraft.ok && err(marcusNoteDraft).includes("has been reviewed"), err(marcusNoteDraft));
    await changeVisitNoteStatus(nurse2.id, marcusVisit, "submit");
    const marcusNoteSubmitted = await addVisitNoteAddendum(nurse2.id, marcusVisit, "correction", "too early");
    check("nor while the note is submitted and waiting for review", !marcusNoteSubmitted.ok && err(marcusNoteSubmitted).includes("has been reviewed"), err(marcusNoteSubmitted));
    check("a visit with no note has nothing to add to", err(await addVisitNoteAddendum(nurse1.id, sched, "correction", "x")).includes("no note"));

    const notClinician = await addVisitNoteAddendum(nurse2.id, inProg, "correction", "not mine");
    check("a nurse ON the care team but not the visit's clinician is refused", !notClinician.ok && err(notClinician).includes("assigned clinician"), err(notClinician));
    check("a supervisor is stopped by permission", await throwsAuth(() => addVisitNoteAddendum(supervisor.id, inProg, "correction", "x")));
    check("a coordinator is stopped by permission", await throwsAuth(() => addVisitNoteAddendum(coordinator.id, inProg, "correction", "x")));
    const adminTry = await addVisitNoteAddendum(admin.id, inProg, "correction", "x");
    check("an administrator holds the permission but never writes for a visit that is not theirs", !adminTry.ok && err(adminTry).includes("assigned clinician"), err(adminTry));
    check("a nurse outside the patient's reach gets the not-found words", err(await addVisitNoteAddendum(nurse1.id, marcusVisit, "correction", "x")).includes("could not be found"));
    check("a made-up visit looks the same", err(await addVisitNoteAddendum(nurse1.id, "00000000-0000-0000-0000-00000000dead", "correction", "x")).includes("could not be found"));
    check("an unknown kind is refused", !(await addVisitNoteAddendum(nurse1.id, inProg, "rewrite_history", "x")).ok);
    check("empty text is refused", !(await addVisitNoteAddendum(nurse1.id, inProg, "correction", "   ")).ok);
    check("over-long text is refused", !(await addVisitNoteAddendum(nurse1.id, inProg, "correction", "a".repeat(ADDENDUM_CONTENT_MAX + 1))).ok);
    check("none of those attempts left an addendum behind", (await addendaOn(inProgNote.id)) === 0);

    const first = await addVisitNoteAddendum(nurse1.id, inProg, "correction", doseText);
    check("the visit's own clinician CAN add a correction to a reviewed note", first.ok, err(first));
    const second = await addVisitNoteAddendum(nurse1.id, inProg, "late_entry", "second one");
    check("only one addendum may wait for review at a time", !second.ok && err(second).includes("still waiting"), err(second));
    const untouched = await prisma.visitNote.findUniqueOrThrow({ where: { visitId: inProg } });
    check("the original note is exactly as it was reviewed", untouched.content === "Updated text" && untouched.status === "reviewed" && untouched.reviewedAt !== null);
    const seenBy1 = await getVisitNote(nurse1.id, inProg);
    check("the author sees the addendum, cannot add another yet and cannot review it", seenBy1.ok && seenBy1.value.note?.addenda.length === 1 && seenBy1.value.note.canAddAddendum === false && seenBy1.value.note.addenda[0]?.canReview === false);

    section("8. Addenda: review, four eyes and the worklist");
    const firstRow = await prisma.visitNoteAddendum.findFirstOrThrow({ where: { noteId: inProgNote.id } });
    const supersOwn = await prisma.visitNoteAddendum.create({
      data: { organizationId: orgId, noteId: inProgNote.id, authorId: supervisor.id, kind: "late_entry", content: "supervisor wrote", status: "submitted" },
    });
    check("the author cannot review their own addendum (no visits.review)", await throwsAuth(() => reviewVisitNoteAddendum(nurse1.id, inProg, firstRow.id)));
    check("a nurse cannot review", await throwsAuth(() => reviewVisitNoteAddendum(nurse2.id, inProg, firstRow.id)));
    const selfAddendum = await reviewVisitNoteAddendum(supervisor.id, inProg, supersOwn.id);
    check("an author who holds visits.review still cannot review their own addendum", !selfAddendum.ok && err(selfAddendum).includes("cannot review an addendum you wrote"), err(selfAddendum));
    const wrongVisit = await reviewVisitNoteAddendum(supervisor.id, done, firstRow.id);
    check("an addendum cannot be reviewed through a different visit", !wrongVisit.ok && err(wrongVisit).includes("could not be found"), err(wrongVisit));
    check("a made-up addendum id looks the same", err(await reviewVisitNoteAddendum(supervisor.id, inProg, "00000000-0000-0000-0000-00000000dead")).includes("could not be found"));
    check("a made-up visit id is refused", err(await reviewVisitNoteAddendum(supervisor.id, "00000000-0000-0000-0000-00000000dead", firstRow.id)).includes("could not be found"));

    const supPending = await listNotesPendingReview(supervisor.id);
    check("the supervisor's review list holds the nurse's addendum, marked as an addendum", supPending.some((p) => p.visitId === inProg && p.kind === "addendum"));
    check("...but not the addendum the supervisor wrote", supPending.filter((p) => p.visitId === inProg && p.kind === "addendum").length === 1);
    const adminPending = await listNotesPendingReview(admin.id);
    check("an administrator sees both addenda waiting", adminPending.filter((p) => p.visitId === inProg && p.kind === "addendum").length === 2);
    check("the nurse has no review list", (await listNotesPendingReview(nurse1.id)).length === 0);
    const asViewer = await getVisitNote(supervisor.id, inProg);
    check("the supervisor is offered review on the nurse's addendum only", asViewer.ok && asViewer.value.note !== null && asViewer.value.note.addenda.filter((a) => a.canReview).length === 1);

    check("the supervisor CAN review the nurse's addendum", (await reviewVisitNoteAddendum(supervisor.id, inProg, firstRow.id)).ok);
    const reviewedRow = await prisma.visitNoteAddendum.findUniqueOrThrow({ where: { id: firstRow.id } });
    check("reviewer and time are recorded", reviewedRow.status === "reviewed" && reviewedRow.reviewedById === supervisor.id && reviewedRow.reviewedAt !== null);
    check("an addendum cannot be reviewed twice", err(await reviewVisitNoteAddendum(supervisor.id, inProg, firstRow.id)).includes("already been reviewed"));
    check("another reviewer CAN review the supervisor's row", (await reviewVisitNoteAddendum(admin.id, inProg, supersOwn.id)).ok);
    check("it leaves the review list", !(await listNotesPendingReview(supervisor.id)).some((p) => p.visitId === inProg && p.kind === "addendum"));

    const third = await addVisitNoteAddendum(nurse1.id, inProg, "additional_information", "Also noted the family was present");
    check("once nothing is waiting, another addendum CAN be added", third.ok, err(third));
    const secondRow = await prisma.visitNoteAddendum.findFirstOrThrow({ where: { noteId: inProgNote.id, authorId: nurse1.id, status: "submitted" } });
    check("an addendum can never be edited (no way to change one exists, and the text is as written)", secondRow.content === "Also noted the family was present");
    await reviewVisitNoteAddendum(admin.id, inProg, secondRow.id);
    const now = new Date();
    const fillers = ADDENDA_MAX_PER_NOTE - (await addendaOn(inProgNote.id));
    for (let i = 0; i < fillers; i++) {
      await prisma.visitNoteAddendum.create({
        data: { organizationId: orgId, noteId: inProgNote.id, authorId: nurse1.id, kind: "late_entry", content: `filler ${i}`, status: "reviewed", reviewedById: admin.id, reviewedAt: now },
      });
    }
    const capped = await addVisitNoteAddendum(nurse1.id, inProg, "correction", "one too many");
    check("a note holds at most the limit of addenda", !capped.ok && err(capped).includes(`at most ${ADDENDA_MAX_PER_NOTE}`), err(capped));
    const cappedView = await getVisitNote(nurse1.id, inProg);
    check("and the form is no longer offered", cappedView.ok && cappedView.value.note?.canAddAddendum === false);

    section("8b. Addenda: two people at the same moment, and reach");
    await changeVisitNoteStatus(nurse1.id, done, "submit");
    await changeVisitNoteStatus(supervisor.id, done, "review");
    const both = await Promise.all([
      addVisitNoteAddendum(nurse1.id, done, "correction", "Concurrent A"),
      addVisitNoteAddendum(nurse1.id, done, "late_entry", "Concurrent B"),
    ]);
    check("exactly one of two simultaneous addenda succeeded", both.filter((r) => r.ok).length === 1, JSON.stringify(both));
    const doneNote = await prisma.visitNote.findUniqueOrThrow({ where: { visitId: done } });
    check("and exactly one is waiting", (await prisma.visitNoteAddendum.count({ where: { noteId: doneNote.id, status: "submitted" } })) === 1);
    await prisma.careTeamMember.update({ where: { id: team.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    check("a nurse whose assignment ended cannot read the addenda", !(await getVisitNote(nurse2.id, inProg)).ok);
    check("nor review one", await throwsAuth(() => reviewVisitNoteAddendum(nurse2.id, inProg, firstRow.id)));

    // A reviewer who holds visits.review but whose reach is only the
    // patients they are assigned to. Reach is the second question, and the
    // demo accounts cannot ask it: every demo reviewer sees the whole
    // organization.
    const waiting = await prisma.visitNoteAddendum.findFirstOrThrow({ where: { noteId: doneNote.id, status: "submitted" } });
    const reviewPerms = await prisma.permission.findMany({ where: { key: { in: ["visits.read", "visits.review"] } } });
    const limitedRole = await prisma.role.create({ data: { organizationId: orgId, key: `VERIFYNOTE_${runId}`, name: "Verify limited reviewer" } });
    tempRoleId = limitedRole.id;
    await prisma.rolePermission.createMany({ data: reviewPerms.map((p) => ({ roleId: limitedRole.id, permissionId: p.id })) });
    const limited = await prisma.user.create({
      data: { organizationId: orgId, email: `verify-note-${runId}@cheliv.test`, passwordHash: "x", name: "Verify Limited Reviewer" },
    });
    tempUserId = limited.id;
    await prisma.userRole.create({ data: { userId: limited.id, roleId: limitedRole.id } });
    const outOfReach = await reviewVisitNoteAddendum(limited.id, done, waiting.id);
    check("a reviewer with no reach to the patient hears 'not found'", !outOfReach.ok && err(outOfReach).includes("could not be found"), err(outOfReach));
    check("...and the addendum is still waiting", (await prisma.visitNoteAddendum.findUniqueOrThrow({ where: { id: waiting.id } })).status === "submitted");
    check("...and it is not on their review list", !(await listNotesPendingReview(limited.id)).some((p) => p.visitId === done));
    check("...and the refusal is on record as denied", (await prisma.auditLog.count({ where: { actorUserId: limited.id, action: "access_denied", resourceId: done } })) >= 1);
    const limitedTeam = await prisma.careTeamMember.create({ data: { patientId: eleanor.id, userId: limited.id, roleOnCase: "nurse" } });
    limitedTeamId = limitedTeam.id;
    check("the same reviewer sees it on their list once they reach the patient", (await listNotesPendingReview(limited.id)).some((p) => p.visitId === done && p.kind === "addendum"));
    check("...and can then review it", (await reviewVisitNoteAddendum(limited.id, done, waiting.id)).ok);

    section("9. Addenda and notifications: the audit log and the notices hold no words");
    const logs2 = await prisma.auditLog.findMany({ where: { resourceId: { in: visitIds } } });
    check("addendum added and reviewed were recorded", ["visit_note_addendum_added", "visit_note_addendum_reviewed"].every((a) => logs2.some((l) => l.action === a)));
    check("the attempts by the wrong people were recorded as denied", logs2.filter((l) => l.action === "access_denied").length >= 3);
    check("no audit entry contains an addendum's words", !JSON.stringify(logs2).includes("five milligrams") && !JSON.stringify(logs2).includes("family was present"));
    const noticeNote = await prisma.notification.count({ where: { userId: nurse1.id, kind: "note_reviewed", resourceId: inProg } });
    check("the note's author was told it was reviewed", noticeNote === 1, String(noticeNote));
    const noticeAddendum = await prisma.notification.count({ where: { userId: nurse1.id, kind: "addendum_reviewed", resourceId: inProg } });
    check("the addendum's author was told each addendum they wrote was reviewed", noticeAddendum >= 2, String(noticeAddendum));
    const supNotices = await prisma.notification.findMany({ where: { userId: supervisor.id, resourceId: { in: visitIds } } });
    check("a reviewer is never told about a review they did themselves (only that another person reviewed THEIR addendum)", supNotices.length === 1 && supNotices[0]?.kind === "addendum_reviewed", JSON.stringify(supNotices.map((n) => n.kind)));
    const noticeRows = await prisma.notification.findMany({ where: { resourceId: { in: visitIds } } });
    check("no notice holds any of the words", !JSON.stringify(noticeRows).includes("five milligrams") && !JSON.stringify(noticeRows).includes("Updated text"));
  } finally {
    try {
      if (limitedTeamId) await prisma.careTeamMember.deleteMany({ where: { id: limitedTeamId } });
      if (tempUserId) {
        await prisma.auditLog.deleteMany({ where: { actorUserId: tempUserId } });
        await prisma.userRole.deleteMany({ where: { userId: tempUserId } });
      }
      await prisma.notification.deleteMany({ where: { resourceId: { in: visitIds } } });
      await prisma.visitNoteAddendum.deleteMany({ where: { note: { is: { visitId: { in: visitIds } } } } });
      await prisma.visitNote.deleteMany({ where: { visitId: { in: visitIds } } });
      if (teamRowId) await prisma.careTeamMember.deleteMany({ where: { id: teamRowId } });
      await prisma.auditLog.deleteMany({ where: { resourceId: { in: visitIds } } });
      await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
      if (tempUserId) await prisma.user.deleteMany({ where: { id: tempUserId } });
      if (tempRoleId) await prisma.role.deleteMany({ where: { id: tempRoleId } });
      console.log("\n  removed the temporary visits, notes, addenda, notices, team row and audit entries");
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
