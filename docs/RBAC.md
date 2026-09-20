# RBAC (Role-Based Access Control)

How permissions actually get checked in this app, and why it's built this way.

## The one rule this whole file protects

**Every permission check goes through `src/lib/auth/authorize.ts`.** No page, no server action, no future API route queries the database directly to decide who can see or do something. One path means one place to get it right, and one place to audit later - not five copies of similar-looking logic slowly drifting apart.

## The three functions

- **`hasPermission(userId, key)`** - returns true/false. Use this to decide whether to *render* something (a nav link, a button). A "no" here just means "don't show it."
- **`requirePermission(userId, key)`** - throws `AuthorizationError` if the permission is missing. Use this at the very start of any server action or data-fetching function that does something sensitive. This is the actual security boundary - a hidden button is not one, since a determined user can call the underlying action directly and skip the UI entirely.
- **`getUserPermissions(userId)`** - every permission key a user holds, across every role. Used to render a full permission list, or to check several permissions without a separate database round trip for each.

## Why permission checks live in the database, not in code

The permission list and which roles hold which permissions are real rows (`permissions`, `role_permissions`, `user_roles` - see `docs/DATABASE.md`), not a hardcoded object in a TypeScript file. That means granting a role a new permission later is a data change, not a code change and a redeploy.

## How it's proven working right now

`/dashboard` calls all three functions for real: it shows the signed-in user's actual permission list, and it conditionally renders two demo elements based on whether the account actually holds `staff.manage` and `audit.read`. This isn't decorative - sign in as the demo admin (who holds every permission) and both show up; if a role without those permissions existed and signed in, they wouldn't.

## What's NOT built yet

- No actual admin UI to grant or revoke a role's permissions yet (that's the admin portal, Milestone E)
- No fine-grained per-resource checks yet (e.g., "can this nurse see *this specific* patient" - that needs the care-team relationship data from Milestone D, not just a role permission)
- `requirePermission`'s throw isn't caught anywhere specific yet with a nice error page - that's part of the error-handling phase later

## Update, 19 September 2026: relationship checks now exist for visits

The "no fine-grained per-resource checks yet" gap above is closing. Visits (see `docs/VISITS.md`) check permission AND relationship on every operation: `requirePermission` first, then `getPatientScope` from `src/lib/patients.ts`. Permissions in use for visits: `visits.read`, `visits.create`, `visits.update`. Still true: CARE_COORDINATOR, CLINICAL_SUPERVISOR and the other roles hold no permissions yet.

## Update, 19 September 2026: a third question for clinical content

Care plans (see `docs/CARE_PLANS.md`) add a third check on top of permission and relationship: to WRITE clinical content, the person must also be on that patient's care team right now (`isActiveCareTeamMember` in `src/lib/patients.ts`). A role with every permission, like SUPER_ADMIN, can read every plan but cannot write one for a patient it is not assigned to. Approving adds one more rule: the author of a plan can never approve it. New permission `care_plans.create`; permissions in use for care plans: `care_plans.read`, `.create`, `.update`, `.approve`. NURSE holds read, create and update. ADMIN holds read and approve.

## Update, 19 September 2026: a category question for documents

Documents (see `docs/DOCUMENTS.md`) ask permission, relationship, and a third question that is about the KIND of document: insurance and identification are restricted to administrative roles, so a nurse on the care team sees consents and orders but never the ID or insurance scan. No new permission was needed: `documents.read`, `documents.upload` and `documents.delete` already existed. NURSE holds read and upload. ADMIN holds read and upload. Only SUPER_ADMIN holds delete (archive).

## Update, 20 September 2026: reach and fields for referrals

Referrals (see `docs/REFERRALS.md`) ask permission, REACH and FIELDS. Reach differs for the two shapes of referral: one about someone who is not yet a patient is reachable by administrative roles only, and an accepted one is reachable by whoever can reach that patient. Fields: office details (outside contact, office notes, the reason for a decline) are administrative only and are never selected from the database for anyone else. No new permission was needed: `referrals.read` and `referrals.manage` already existed. ADMIN and SUPER_ADMIN hold both. NURSE now holds `referrals.read`. Recording a referral also needs administrative reach, so a role that holds `referrals.manage` with only "assigned patients" reach cannot record or see an unlinked referral. Accepting a referral into a NEW patient record also needs `patients.create`.
