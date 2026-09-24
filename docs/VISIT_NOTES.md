# VISIT_NOTES.md

**Added:** 23 September 2026
**E3, slice 1.** The first piece of the clinical portal, and the first table here that holds real clinical CONTENT written about a specific visit - what a visit row itself never says.

---

## What a visit note is

One note per visit: what the assigned clinician found and did. It exists inside the visit it documents (`visitId` is unique on `visit_notes`), not as a separate list of entries.

## The three questions, same shape as care plans

1. **Permission.** `visits.document` to write, `visits.review` to review. Reading needs `visits.read`, the same as the visit itself.
2. **Relationship.** Is the visit's patient one this person can reach? `getPatientScope()` in `src/lib/patients.ts` - the same copy `visits.ts` and `care-plans.ts` use.
3. **Author.** Writing is further narrowed to the visit's own assigned clinician, not just anyone on the patient's care team. A care plan is written by the team; a visit note is a first-person record of what ONE person did at ONE visit, so only that person writes it. An administrative role can read every note and review it, but never writes one for a visit that is not theirs.

## Who can do what

| Action | The visit's assigned clinician | Reviewer (`visits.review`: ADMIN, SUPER_ADMIN, CLINICAL_SUPERVISOR) | Everyone else with `visits.read` |
|---|---|---|---|
| Read the note | Yes | Yes | Yes, if they can reach the patient |
| Write / edit the draft | Yes, while it is a draft | No | No |
| Submit for review | Yes | No | No |
| Mark reviewed | No, never their own note | Yes, once submitted and not their own | No |

## Statuses

```
draft -> submit -> submitted -> review -> reviewed
```

`reviewed` is final. Once reviewed, a note is never reopened - a correction after that point is a new, separately recorded event, the same principle `VISITS.md` and `CARE_PLANS.md` already follow. The whole table lives in `VISIT_NOTE_TRANSITIONS` in `src/lib/visit-note-constants.ts`.

A note can only be started once its visit is `in_progress` or `completed` (`VISIT_STATUSES_ALLOWING_NOTE`) - documenting something that has not happened yet makes no sense, and a cancelled or missed visit has nothing to document.

## Four eyes, same rule as care plan approval

The person who wrote a note can never be the one who reviews it. `changeVisitNoteStatus` checks `note.authorId === userId` before allowing a `review` action, and audits the attempt if it is refused.

## What a refusal looks like

Same as every other clinical table here: written to the audit log as `access_denied`, and the caller gets a message that does not reveal whether the thing they asked about exists. The content of a note is never written to the audit log - only that one was created, submitted or reviewed.

## New permission assignments

`visits.document` and `visits.review` already existed in the permissions seed (see `docs/RBAC.md`, 19 September 2026 update) but were unused until now. This round: NURSE already held `visits.document`. ADMIN and CLINICAL_SUPERVISOR now hold `visits.review`. Nobody else holds either yet.

## New audit actions

`visit_note_created`, `visit_note_updated`, `visit_note_submitted`, `visit_note_reviewed`, plus `access_denied` for every refusal above.

## Addenda (E3 round 2)

In plain words: once a note has been reviewed it is never changed. If it turns out to be wrong or incomplete, the nurse adds an **addendum** underneath it. The old words stay exactly as they were. The addendum is a new, permanent entry that waits for a second person to review it, just like the note did.

Rules, in the order they are asked (all in `src/lib/visit-notes.ts`):

1. **Permission.** `visits.document` to add, `visits.review` to review.
2. **Reach.** Same relationship rule as the note. A made-up visit, an unreachable visit and another organization's visit all get the same "could not be found" words.
3. **Author.** Only the visit's own assigned clinician adds an addendum. A colleague on the care team is refused, and so is an administrator who holds the permission.
4. **Only after review.** A draft or a submitted note cannot get an addendum (edit the draft, or wait for the review).
5. **One waiting at a time.** While an addendum waits for review, no second one can be added.
6. **At most 10 per note.**
7. **Locked row.** These checks run while the note's row is locked in the database, so two clicks at once cannot both get through.
8. **Written once.** There is no edit and no delete for an addendum.
9. **Four eyes.** Reviewing needs `visits.review` and reach, the addendum must belong to the visit in the request, and nobody reviews their own, even holding `visits.review`.

Kinds: correction, additional information, late entry. Status: submitted, then reviewed. The review list on `/visits` also shows addenda (marked "Addendum", oldest first, never the viewer's own).

When an addendum is reviewed, its author gets a notification. When a note is reviewed, its author gets one too (see `docs/NOTIFICATIONS.md`).

## Where it lives

- **Visit detail page**, `/visits/[id]` - new this round. The `/visits` list links each visit's date/time to it. Composes the same already-checked `listVisits` read, filtered to one id, exactly the way `/patients/[id]` composes existing reads rather than asking a new access question.
- **Two worklists on `/visits`**, shown only when they have something in them: "Needs your documentation" (`listVisitsNeedingDocumentation`, gated on `visits.document`) and "Notes waiting on review" (`listNotesPendingReview`, gated on `visits.review`).

## Files

- `prisma/schema.prisma` - the `VisitNote` model (new migration needed: `add_visit_notes`)
- `src/lib/visit-notes.ts` - every rule lives here
- `src/lib/visit-note-constants.ts` - statuses, the transition table, the content length limit
- `src/lib/visit-notes-actions.ts` - thin server actions, identity comes from the session only
- `src/app/(app)/visits/[id]/page.tsx` - the visit detail page
- `src/app/(app)/visits/[id]/visit-note-panel.tsx` - the write / submit / review UI
- `src/app/(app)/visits/page.tsx` - links to the detail page, plus the two worklists
- `prisma/seed.ts` - `visits.review` added to ADMIN and CLINICAL_SUPERVISOR
- `prisma/schema.prisma` - also the `VisitNoteAddendum` model (table `visit_note_addenda`, migration `add_addenda_and_notifications`)

## Known gaps, written down honestly

- **One note per visit.** A visit with several distinct clinical events (a long shift, more than one clinician involved) has nowhere to put a second entry yet. That is a real limitation, not an oversight - it matches the "who did YOU document" scope this slice was built to prove, and multi-entry notes are a reasonable E3 round 2 ask if it turns out to matter.
- **Amendments are addenda, not edits.** A reviewed note is locked forever. Corrections are added under it (see "Addenda" above). There is still no way to withdraw a note that is submitted and waiting, or to ask the author for a correction from inside the app.
- **No demo notes are seeded.** The demo nurse accounts have real completed visits with no note (`prisma/seed.ts` already creates these), so "Needs your documentation" has something to click through on a fresh seed without needing new seed data written for this feature specifically.
- **Caregiver and patient/family visibility of notes do not exist.** CAREGIVER holds only `visits.checkin` and `tasks.read` (see `CAREGIVER_PORTAL.md`), so no note is reachable from that role. PATIENT and AUTHORIZED_FAMILY hold no permissions at all. Whether an aide writes a note is a separate design.

## Verification (23 September 2026)

`npm run verify:notes` runs 39 checks against the real database: who can start a note, one note per visit, only the assigned clinician writes (even a colleague on the same care team is refused), editing and locking, four-eyes review (even an author who holds `visits.review` cannot review their own note), reach after a care team assignment ends, both worklists, and that the audit log never holds the note text.

`npm run verify:notes` now runs 93 checks (E3 round 2). Sections 7 to 9 cover addenda: only after review, only the visit's own clinician, one waiting at a time, the limit of 10, the original note untouched, four eyes with a real author holding `visits.review`, an addendum id from a different visit, a reviewer whose reach is only assigned patients (temporary role and care team row), two simultaneous adds (exactly one wins), the review list, and that neither the audit log nor a notification holds any of the words. Ten rules were broken on purpose, one at a time, and the script failed each time.

New audit actions: `visit_note_addendum_added`, `visit_note_addendum_reviewed` (resource is the visit, never the words).
