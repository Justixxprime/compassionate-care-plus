# VISITS.md

**Added:** 19 September 2026
**Milestone D, slice 2.** Patients came first. Visits hang off patients, so they came second.

---

## What a visit is

One scheduled home visit: which patient, which clinician, what kind of visit, when, and where it stands.

A visit row says that a visit is happening. It never says what was found there. There are no notes, vitals or clinical documentation in this table on purpose. Those are separate, more sensitive tables that come later (`visit_notes`, `clinical_notes` in `PHASE_0_ARCHITECTURE.md` section 7).

## The one rule, same as patients

Every visit operation needs BOTH of these:

1. **Permission.** Does the person's role hold `visits.read`, `visits.create` or `visits.update`? This is a hard stop (`requirePermission`).
2. **Relationship.** Is the visit's patient one this person is allowed to reach? This comes from `getPatientScope()` in `src/lib/patients.ts`, the same code patients use. There is exactly one copy of that rule. Two copies of an access rule is how one of them slowly becomes more permissive than the other.

## Who can do what

| Action | Administrative roles (SUPER_ADMIN, ADMIN, CLINICAL_SUPERVISOR, CARE_COORDINATOR) | Everyone else (for example a nurse) |
|---|---|---|
| See visits | Every visit in the organization | Visits of patients they are actively on the care team of, including a colleague's visits on the same patient |
| Schedule a visit | For any active patient, assigned to any active care team member of that patient | Only for patients they are on the care team of, and only assigned to themselves |
| Check in, check out, cancel, mark missed | Any visit | Only visits assigned to them |

Two more rules that apply to everyone:

- The clinician on a visit must be on that patient's care team right now. This stops a visit being assigned to someone with no business near the patient.
- A clinician cannot be double-booked. A visit that starts exactly when another ends is fine.

Note: today only SUPER_ADMIN, ADMIN and NURSE hold visit permissions. CARE_COORDINATOR and CLINICAL_SUPERVISOR are treated as administrative for the relationship rule, but they hold no permissions yet, so they cannot do anything until their permission sets are designed. That is a decision for later, not an oversight.

## Statuses

```
scheduled   -> check in   -> in progress -> check out -> completed
scheduled   -> cancel     -> cancelled
scheduled   -> mark missed -> missed
```

`completed`, `cancelled` and `missed` are final. A finished visit is never quietly reopened. If one was recorded wrongly, that is a correction with its own audit trail, which does not exist yet. The whole table lives in `VISIT_TRANSITIONS` in `src/lib/visit-constants.ts`. An action that is not listed for a visit's current status simply cannot happen.

A visit still `scheduled` after its window ended shows an **Overdue** badge, so someone can mark it missed or follow up.

## Time

The office is in Texas. Every time is stored in UTC and shown in office time (`America/Chicago`), no matter where the server runs or where the viewer sits. The form's "Start" field is office time and says so.

Turning a typed wall-clock time into a real moment is the tricky direction, because it depends on daylight saving. `src/lib/time.ts` does it with the built-in `Intl` API, no date library. It is tested around both 2026 clock changes (8 March and 1 November).

## What a refusal looks like

- It is written to the audit log as `access_denied` with outcome `denied`, so the attempt is on record.
- The person gets a plain message that does not reveal whether the thing exists. "That visit does not exist" and "that visit is not yours" are the same answer. Otherwise guessing IDs would tell someone which ones are real.

## New audit actions

`visit_created`, `visit_checked_in`, `visit_checked_out`, `visit_cancelled`, `visit_marked_missed`, plus `access_denied` for relationship refusals. As always, they record that it happened, never content.

## Files

- `prisma/schema.prisma` - the `Visit` model (new migration needed)
- `src/lib/visits.ts` - every rule lives here
- `src/lib/visit-constants.ts` - visit types, statuses, the transition table
- `src/lib/visits-actions.ts` - thin server actions, identity comes from the session only
- `src/lib/time.ts` - office time helpers
- `src/app/visits/page.tsx`, `schedule-visit-form.tsx`, `visit-actions.tsx` - the bare proof page
- `scripts/verify-access.ts` - the test that tries to break all of this

## Proving it, not trusting it: `npm run verify:access`

`scripts/verify-access.ts` calls the same functions the pages call, as different people, and checks that everything that should be refused is refused and everything that should work works. It covers about 70 checks: reading scope, the permission gate, scheduling, colleagues' visits, every status transition, and the audit trail.

It creates a temporary patient and temporary nurses, and deletes them and their audit entries at the end, even when a check fails.

**It only runs when `DATABASE_URL` points at your own machine.** It creates and deletes rows, so it must never run against anything real.

It was also tested the other way: two rules were deliberately broken in a copy of the code, and the script failed on exactly those rules. A test that cannot fail proves nothing.

## Known gaps, written down honestly

- **Double-booking has a tiny race.** Two people scheduling the same clinician at the same instant could both pass the check. The real fix is a database exclusion constraint, which comes with the real scheduling board (Milestone E).
- **Future-dated care team assignments** are not treated specially yet. `activeAssignmentFilter` checks the end date, not the start date. No screen can create a future-dated assignment yet.
- **Reading visits is not audit-logged.** Only changes and refusals are. Viewing a list of visit times is not clinical content. Opening a chart will need view logging, when charts exist.
- **A caregiver can be assigned a visit but cannot see it yet**, because CAREGIVER holds no permissions. That comes with the caregiver portal.
- **Priya Raman has nobody on her care team**, so she cannot be scheduled. That is deliberate: she is the "unassigned patient" a care coordinator will eventually work from.
