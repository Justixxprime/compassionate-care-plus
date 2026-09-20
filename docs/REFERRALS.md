# REFERRALS

The fifth and last slice of Milestone D. A referral is a request for the organization to take on someone's care. A hospital discharge planner, a physician's office, a family member or the person themselves asks. This file explains the rules and the reasons for them.

## What is different about a referral

Every table before this one hangs off a patient. A referral usually arrives BEFORE the person is a patient. Until it is accepted there is nobody on a care team, so the usual question ("is this nurse on this patient's team?") has no answer. The rules below are built around that.

## Three questions, all in `src/lib/referrals.ts`

1. **Permission.** `referrals.read` to see a referral. `referrals.manage` to record, edit and decide one. Both permissions already existed. ADMIN and SUPER_ADMIN hold both. NURSE now holds `referrals.read` only. Every other role holds nothing yet.
2. **Reach.** Can this person reach the referral at all?
   - A referral about someone who is NOT yet a patient (unlinked) is reachable by administrative roles only, because nobody has a relationship to that person yet.
   - A referral that has been accepted (linked to a patient) is reachable by whoever `getPatientScope` says can reach that patient. This is the same shared code that patients, visits, care plans and documents use. A nurse sees the referral that brought in a patient she is on the care team of.
3. **Fields.** Which parts of a reachable referral the person sees.
   - Summary (who, date of birth, kind of care, urgency, who sent it, status) and the clinical reason: anyone with reach. A nurse on the linked patient's team needs the reason.
   - Office details: the outside contact's name and phone, the office notes, and the reason a referral was declined or withdrawn. Administrative roles only. For everyone else these columns are never selected from the database, so they cannot leak by mistake.

There is no care-team question for referrals. Like documents, this is office work, so being on a team adds nothing.

## Who can do what

| Action | Needs |
|---|---|
| See referrals | `referrals.read`, then reach and fields as above |
| Record a new referral | `referrals.manage` AND administrative reach |
| Edit an open referral | `referrals.manage` and reach to it |
| Start review, decline, withdraw | `referrals.manage` and reach to it |
| Accept and link to an existing patient | `referrals.manage`, reach, and the patient must match |
| Accept and create a new patient | the above AND `patients.create` |

Someone who holds `referrals.manage` but whose reach is only "my assigned patients" cannot record a referral, and cannot even see an unlinked one. The person being referred is not their patient.

## The status machine

```
received  -> start_review -> in_review -> accept -> accepted
received or in_review -> decline   -> declined   (a written reason is required)
received or in_review -> withdraw  -> withdrawn  (a written reason is required)
```

Accepted, declined and withdrawn are final. A finished referral is never reopened and never edited. If the situation changes, a new referral is recorded. The table `REFERRAL_TRANSITIONS` in `src/lib/referral-constants.ts` IS the state machine: an action not listed for the current status cannot happen. Starting a review is not a decision, so it does not record a decider.

## Accepting a referral

Accepting is what turns a request into a patient. There are two ways:

- **Link to an existing patient.** The patient must be reachable, in this organization, ACTIVE, and have exactly the same first name, last name (capital letters ignored) and date of birth as the referral. Linking a referral to a different person's record is refused.
- **Create a new patient.** Needs `patients.create` as well. It is refused when a patient with that name and date of birth already exists, so one person never becomes two patients. Creating the patient and marking the referral accepted happen in one database transaction with a status guard, so if someone else decides the referral first, the new patient is undone.

The new patient has nobody on the care team yet. Assigning a care team is Milestone E work.

## Other rules

- Only ONE open referral (received or in review) per person at a time, matched by name and date of birth.
- Dates of birth must be real, not in the future, and not before 1900.
- Declining or withdrawing needs a written reason (up to 1000 characters). It is saved as an office detail.
- The kind of care requested is one of the same six kinds a visit can be, so a referral and a visit can never disagree about the vocabulary.
- Referrals are never deleted. Foreign keys to patients and users are `Restrict`.
- A referral that does not exist and a referral the person may not reach give the SAME answer ("That referral could not be found."), so guessing ids reveals nothing. Every denial is audited as `access_denied`.
- The audit log records that something happened, never what the referral said.

## Audit events

`referral_created`, `referral_updated`, `referral_review_started`, `referral_accepted`, `referral_declined`, `referral_withdrawn`, `patient_created` (when accepting creates a patient), and `access_denied` / `permission_denied`. Reading the list is not logged.

## Demo data

Six synthetic referrals, all about fictional people. Phone numbers use the 555-01xx range, which is reserved for fiction.

| Referral | Status | Linked to | Who sees it |
|---|---|---|---|
| Eleanor Whitfield, from a hospital | Accepted | Eleanor | Admin (with office details), demo nurse (without) |
| Marcus Delgado, from a physician's office | Accepted | Marcus | Admin, demo nurse two (without office details) |
| Priya Raman, from family | Accepted | Priya | Admin only (nobody is on Priya's team) |
| Walter Brennan, from a hospital, urgent | In review | nobody | Admin only |
| Grace Holloway, herself | Received | nobody | Admin only |
| Tomas Reyes, from a physician's office | Declined | nobody | Admin only |

## How it is proven

`npm run verify:access` (407 checks now). Section 2d checks the demo accounts: the admin sees all six with office details, each nurse sees exactly the one referral linked to her patient, never an office detail, and the text of every office value and every unlinked person's name is checked to be absent from what the nurse was handed. Sections 12a to 12i use temporary people, including a manager with administrative reach but no `patients.create`, and a manager who holds `referrals.manage` but whose reach is only assigned patients. They cover the permission gate, recording and validation, who sees an unlinked referral, editing, the status machine, linking rules, what a care team sees after linking, creating a patient once, and the audit trail. A temporary role is created for these and deleted at the end.

To prove the checks can fail, thirteen rules were broken one at a time in a copy (assigned reach also matching unlinked referrals, office details handed to everyone, unlinked referrals reachable by anyone, recording without administrative reach, linking without the name and birth date match, creating a patient without the duplicate check, creating a patient without `patients.create`, declining without a reason, accepting straight from received, no open-referral duplicate check, editing a final referral, deciding without the manage permission, listing without the read permission). The script failed on each. In two cases (editing a final referral, accepting from received) it was a message check that caught it, because a second safeguard behind the first still held.

## Known gaps

- No history table of status changes (PHASE_0 section 7 names `referral_events`). Today the referral row keeps who decided and when, and the audit log keeps every event, but not each step's note.
- The public `/request-care` form is NOT connected to referrals. It still shows "Request received" and saves nothing. Wiring it needs spam protection and a decision about what a stranger may write to the database, so it is its own later slice.
- Nobody but administrative roles can record or decide a referral. CARE_COORDINATOR, whose real job this is, holds no permissions yet. The natural next step is to give it `referrals.read` and `referrals.manage` when its permission set is designed in Milestone E.
- No screen to assign a care team after a new patient is created by accepting.
- No overdue or waiting-time indicator on open referrals.
- Reading the referral list is not audit-logged (only changes are), like visits and care plans.
- A referral's outside contact is a name and phone only. No fax, no electronic hand-off.
