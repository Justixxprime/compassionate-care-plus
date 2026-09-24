# PATIENT_PORTAL.md

**Built:** 24 September 2026 (Milestone E, patient portal, round 1)
**Screen:** `/my-care`, called "My care" in the menu.
**Code:** `src/lib/patient-portal.ts` (every rule), `src/app/(app)/my-care/page.tsx` (the screen), `scripts/verify-portal.ts` (the proof).

## In plain words

A patient signs in and sees one calm page about THEIR OWN care:

1. **Your next visits.** The visits still to come (and one happening right now), with the date, the time, the kind of visit and the name of the person coming.
2. **The people looking after you.** The names and jobs of the care team as it is today.
3. **Your care plan.** The plan the nurse wrote and a supervisor or administrator approved, with its goals and which ones are done.
4. **Recent visits.** The last few completed visits.

It is read only. The patient cannot change, cancel or write anything here. To change a visit they call the office.

## What is deliberately NOT here

Visit notes and their corrections, tasks, documents, referrals, office notes, e-mail addresses, other patients, and any care plan that is not active (drafts, finished and discarded plans stay hidden). Documents and messages come later, each with its own permission design.

## The permission design

The PATIENT role used to hold nothing. It now holds exactly one permission:

| Permission | New? | What it means |
|---|---|---|
| `portal.read` | **New** (36 permissions in total now) | See MY OWN next visits, care team and active care plan. Nothing more. |

Held by PATIENT and SUPER_ADMIN (SUPER_ADMIN holds everything, but has no patient record linked, so sees "not connected").

Two things must both be true:

1. **Permission.** The account holds `portal.read`. A hard stop: a nurse, a supervisor, a coordinator, a caregiver or a family account is refused and the refusal is written to the audit log.
2. **Ownership.** Which record is mine? The ONE patient record whose `user_id` is my account, in my own organization, still active or on hold. The link lives on the patient record. `getMyCare` takes no patient id at all, so there is nothing in the browser to change to see somebody else.

An account linked to no record gets a plain "not connected yet" screen, never "everybody". A discharged patient has no portal. A link to a record of another organization shows nothing.

## The one schema change

`Patient.userId` (optional, unique). One account per patient and one patient per account, enforced by the database. Nobody can set it from a screen yet: today the seed does it for the demo, and a proper "create the patient's account" step belongs with the staff account flow (open item in `REVIEW_MILESTONE_D.md`).

**Migration:** `npx prisma migrate dev --name add_patient_account_link` (you run it; nothing is shipped as SQL).

## Demo account

`demo.patient@cheliv.test` (same demo password) is linked to Eleanor Whitfield. The seed also gives her two visits ahead (tomorrow with the demo nurse, the day after with the demo caregiver) so the page is never empty. She already has an active care plan and a team (nurse, caregiver).

## How it is proved

`npm run verify:portal` tries to break each rule against a real database. See `NEXT_STEP.md` for the expected numbers.
