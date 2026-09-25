# ACCOUNTS.md

**Added:** 25 September 2026
**Round G0.** The first item from NEXT_STEP.md's list: a real "create account" flow, so no feature depends on the seed script any more.

---

## What this is

One form, on `/staff`, that creates a real sign-in account. It covers the three kinds of account the seed script used to be the only way to get:

- **Staff** - a new person who works here, with one of the office or clinical roles.
- **Family** - a new AUTHORIZED_FAMILY account. Creating one does **not** share any patient's care with them - that is still the separate, deliberate step on `/consents` (`src/lib/family-consents.ts`). A family account with no consent still sees nobody.
- **Patient** - gives an EXISTING patient record, one with no account yet, a sign-in and the PATIENT role. It never creates a new patient - patients are only created by accepting a referral (`src/lib/referrals.ts`).

No new permission. Creating any of the three requires `staff.manage`, the same permission the read-only staff directory already required - and, like that directory's own notes explain, both roles that hold it (SUPER_ADMIN, ADMIN) already reach every patient in the organization, so there is no second, relationship-shaped question to ask for the PATIENT case.

No migration this round either. Every column this needed already existed.

## Why the office sets the password directly

There is no e-mail service wired up yet (see the Request care decision in NEXT_STEP.md). Rather than invent a paid dependency to solve that here, the office types a temporary password into the form and tells the person directly - the same way a workplace hands over a first password today. It is hashed with bcrypt, the same as every other password in this project, and it is never written to the audit log. A "must change password at first sign-in" flag is a reasonable next step, once the wider password-reset story exists, but it is a schema change and was left out of this round on purpose to keep it migration-free.

## Roles this form will not hand out

`STAFF_ROLE_OPTIONS` in `src/lib/account-constants.ts` deliberately leaves off:

- **SUPER_ADMIN** - not something a form should be able to hand out, even to another administrator. Created by hand only (the seed, or a direct database change).
- **REFERRAL_PARTNER** - holds no permissions yet, and its own portal has not been designed (see `prisma/seed.ts`).

`AUTHORIZED_FAMILY` and `PATIENT` are not on the staff list either - they are their own account types on the same form, not a "role" a staff account can be given.

## Linking a patient account

The same locking pattern `createConsent` already uses: the patient's row is locked (`SELECT ... FOR UPDATE`) inside a transaction before checking it is still active-or-on-hold and still has no account, so two submissions for the same person at the same moment cannot both win. If the link step somehow fails after the account was created (a race lost between the lock and the update), the whole transaction rolls back - no orphaned account is left behind.

A made-up patient id and a patient who already has an account get the exact same words (`"That patient could not be found, or already has an account."`), for the same reason every other service in this project answers that way: the difference between "does not exist" and "you may not have it" is not something to reveal.

## E-mail rules

- One account per e-mail address, across the whole system - not just this organization. Checked case-insensitively (`DEMO.NURSE@cheliv.test` collides with `demo.nurse@cheliv.test`).
- The same generic words either way, so this never confirms whether an address belongs to another organization.

## What's audited

`account_created_<role>` (for example `account_created_nurse`, `account_created_authorized_family`, `account_created_patient`), with the new account's id as the resource. Never the name, e-mail or password - the same "what happened, never what it said" rule every other table in this project follows.

## Testing

`npm run verify:accounts` (46 checks): every role is refused the ability to create an account except ADMIN and SUPER_ADMIN; a staff account gets exactly the chosen role and a hashed password; SUPER_ADMIN, REFERRAL_PARTNER, PATIENT and AUTHORIZED_FAMILY are all refused as a "staff" role; a family account holds exactly AUTHORIZED_FAMILY; duplicate and case-different e-mails are refused; short and mismatched passwords are refused; a made-up account type, a blank name and an implausible e-mail are all refused; linking a patient succeeds once and is refused a second time, refused for a discharged patient, and refused for a patient who already has an account (same words as a made-up id); the audit trail names the role and the account id and nothing else; the row-locking and the excluded-roles list are both confirmed by reading the file's own source.

## Still open (see NEXT_STEP.md)

- No "must change password" flag yet (needs a migration; noted above).
- No way to edit a name, e-mail, or deactivate an account once created - only the seed's demo accounts could be changed before, and now new ones can be made but not yet changed. A reasonable next slice.
- No self-service password reset - the office still has to hand over the first password directly.
