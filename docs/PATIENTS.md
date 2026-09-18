# PATIENTS

The first slice of Milestone D's clinical schema, and the real mechanism behind relationship-based access.

## Why this is more than "a patients table"

A permission alone is not enough in a healthcare system. `patients.read` says a nurse is *allowed to read patient data in general* - it says nothing about *which* patients. A nurse holding `patients.read` should still only see the patients actually assigned to them, not every patient in the organization. See PHASE_0_ARCHITECTURE.md section 3.

That's what `src/lib/patients.ts` and the `care_team_members` table actually do together:

1. `requirePermission(userId, "patients.read")` runs first. No permission, no query, hard stop.
2. Then: does this user hold an administrative role (SUPER_ADMIN, ADMIN, CLINICAL_SUPERVISOR, CARE_COORDINATOR)? If so, they see every patient in their organization - these are legitimately office-side roles that need the whole roster.
3. Otherwise (NURSE, CAREGIVER, etc.): they only see patients they have an active row for in `care_team_members`.

## How to actually see this working, not just trust it

The seed script creates two demo accounts specifically to make this testable:

- `demo.admin@cheliv.test` - sees all three synthetic demo patients
- `demo.nurse@cheliv.test` - assigned to exactly one of them (Eleanor Whitfield), should see only that one

Same password for both, in `docs/DEMO_ACCOUNTS.md` (git-ignored). Sign in as each and visit `/patients` - the difference in what shows up IS the test.

## What's in the schema so far

- `patients` - name, date of birth, status. Deliberately minimal - no address, no contacts, no clinical detail yet.
- `care_team_members` - the join table. Who's assigned to which patient, in what role on that case, and whether the assignment is still active (`ends_at` null means still active).

## What's NOT built yet

Everything that actually hangs off a patient: visits, care plans, clinical notes, documents, referrals, consents, messaging. Those come as their own rounds, not all folded into this one - see PHASE_0_ARCHITECTURE.md's "do not build everything at once."

Also not built: a real patient management UI (create, edit, search, filter). `/patients` right now is a bare list proving the access model works, the same way `/dashboard` proved authentication works before any real portal existed.
