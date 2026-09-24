# CAREGIVER_PORTAL.md

**Built:** 24 September 2026 (Milestone E, caregiver portal, round 1)
**Screen:** `/caregiver`, called "My day" in the menu.
**Code:** `src/lib/caregiver.ts` (every rule), `src/lib/caregiver-actions.ts` (the buttons talk to it), `src/app/(app)/caregiver/page.tsx` and `caregiver-controls.tsx` (the screen), `scripts/verify-caregiver.ts` (the proof).

## In plain words

A caregiver (a home health aide) uses this on a phone, often standing in a hallway with one hand free. So the screen is small and simple:

1. **Visits today.** Only the caregiver's own visits, for today, soonest first. Each card shows the time, the patient's name, the kind of visit and one big button.
2. **Check in** when you arrive. **Check out** when you leave. That is all the caregiver can do to a visit.
3. **My checklist.** The tasks somebody gave to this caregiver that are not finished. One big **Mark done** button on each.

Nothing else is on the screen. A caregiver cannot see other people's visits, cannot open a patient's chart, cannot schedule, cannot cancel a visit and cannot write a note. If a visit has to be cancelled or marked missed, the office does that.

## The permission design (the decision this round was waiting for)

The CAREGIVER role used to hold nothing. It now holds exactly two permissions:

| Permission | New? | What it means |
|---|---|---|
| `visits.checkin` | **New** (35 permissions in total now) | See MY OWN visits for today and check in and out of them. Nothing more. |
| `tasks.read` | Already existed | See tasks given to me and finish them. |

Why a new permission and not `visits.read` plus `visits.update`? Because those two are wide. `visits.read` shows every visit on every patient the person is on, and `visits.update` also allows cancelling and marking a visit missed. Handing a caregiver those would give away far more than the job needs. A narrow permission is safer, and it is easy to widen later. Widening a permission is a decision; narrowing one after people rely on it is a fight.

Who holds `visits.checkin`: CAREGIVER, and SUPER_ADMIN (which holds every permission). ADMIN, coordinator, supervisor and nurse do not. `verify:access` checks that list exactly.

## The three questions every action asks

1. **Permission.** Does this account hold `visits.checkin`? If not, it is a hard stop and the refusal goes in the audit log.
2. **Reach.** Is the visit's patient one this person is on the care team of right now? The moment an assignment ends, the visit disappears from the caregiver's day and cannot be checked in.
3. **Ownership.** Is the visit assigned to THIS person? Even an administrator who holds the permission can only see and act on visits assigned to themselves here. Nobody checks in for someone else.

A visit that does not exist, a visit out of reach and a visit that belongs to a colleague all get the same words ("That visit could not be found."), so nobody can learn which visit ids are real by guessing. Each refusal is written to the audit log. The audit log never holds a patient's name.

## Two rules that exist only for check-in

- **Only on the day.** You can check in to a visit on its own office day (Central time). A visit tomorrow cannot be checked in today. (Check-out has no day rule: a visit left open from yesterday must be closable.)
- **One place at a time.** If you are still checked in to one visit, you cannot check in to another. Check out first. This is decided inside a database transaction that locks the caregiver's own row, so two taps at the same moment are handled one after the other and exactly one wins.

A visit that is still checked in from an earlier day is shown at the top in its own section ("Still checked in") so it can be closed. It is never hidden.

## What the checklist is

The checklist is the ordinary Tasks list (`docs/TASKS.md`), filtered to open tasks given to this person. Finishing one uses the ordinary task rules, unchanged. A caregiver cannot create a task (no `tasks.manage`) and cannot cancel one. The person who asked is told when it is finished (a notice, see `docs/NOTIFICATIONS.md`).

## What else changed

- Menu: a new item **My day** appears for anyone holding `visits.checkin`.
- Dashboard: a caregiver gets one tile, "My visits today", that opens `/caregiver`. The greeting line for the role changed from "still being built" to a real sentence.
- Seed: the permission, the caregiver set, and a demo account `demo.caregiver@cheliv.test` (same demo password as the others). She is on Eleanor Whitfield's care team in the caregiver place, and gets three visits today and two checklist tasks. Running the seed again never duplicates them, and running it on a later day gives her a fresh day.
- `changeTaskStatusAction` also refreshes `/caregiver`, so a finished task leaves the checklist at once.
- No database change, so no migration.

## Two test scripts changed on purpose

- `verify:access` used a CAREGIVER account as "an account that holds no permissions". That was true until today. Every check it used it for still passes (the caregiver still holds none of `visits.read`, care plans, documents, referrals or care teams), but the line that said "caregiver holds none" now says the caregiver holds exactly `visits.checkin` and `tasks.read`, and that only CAREGIVER and SUPER_ADMIN hold `visits.checkin`.
- `verify:tasks` used a CAREGIVER account as the "no task permission" account. It now uses a PATIENT account, which still holds nothing.

## Known gaps (on purpose, for a later round)

- **No notes from a caregiver.** A visit note is written by the visit's own clinician with `visits.document`. Whether an aide writes a note (and what a supervisor does with it) is a separate design. Not built.
- **No patient details for the aide.** She sees the patient's name only, no address, no care plan, no instructions. What an aide should be allowed to read about a patient is a decision to make with the organization.
- **Check-in has no location or device proof.** It records the time only. Real electronic visit verification (Texas Medicaid has rules about it) is Tier 3 and depends on which vendor the organization must use.
- **Not tested in a real phone browser here.** The HTML was fetched and read as the caregiver; the layout is built for a 390 pixel wide screen but nobody has held it in a hand yet.
- **A nurse cannot use My day.** A nurse checks in from the Visits screen (`visits.update`). Giving nurses the phone screen is easy later, one permission.
