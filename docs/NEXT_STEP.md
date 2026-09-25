# NEXT_STEP.md

**Last updated:** 25 September 2026
**Just finished:** Round F0 is confirmed (the "Who can see my care" round-trip and the live site's calm screen both checked out). This round, "G0", is the first item from last round's list: a real "create account" flow.

## In plain words

1. **`/staff` now has a "Create an account" form above the directory.** It makes three kinds of account:
   - **Staff** - pick a role (Administrator, Clinical Supervisor, Nurse, Care Coordinator, Caregiver), and it is created with exactly that role. Super Admin is deliberately not offered here - that one is still created by hand.
   - **Family member** - creates an AUTHORIZED_FAMILY account. This does **not** share anyone's care by itself - you still go to Family access afterwards to record which patient and which parts.
   - **Patient (link an existing patient record)** - pick a patient who has no sign-in yet, and it gives them one.
2. **You set the first password yourself, right in the form**, and tell the person directly. There is still no e-mail service wired up, so nothing is sent automatically - that is the separate Request care decision below.
3. **No feature depends on the seed script's demo accounts any more.** You can make a real nurse, a real family member, or give a real patient a sign-in, all from the screen.
4. No migration, no new permission (still 38), no new dependency.

## One thing to know before your uncle sees this

Same as last round: the **Request care** form still says "Request received" but sends and saves nothing. Still needs your decision (save to a hosted database, or e-mail an office address) - tell me which and I will build it next round.

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import (unchanged).
- `src/app/(app)/layout.tsx`: has NO html and NO body (unchanged).
- `src/app/(public)/page.tsx`: the real homepage (unchanged).

## Files to remove

None.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npm run verify:access
npm run verify:shell
npm run verify:notes
npm run verify:tasks
npm run verify:notifications
npm run verify:caregiver
npm run verify:portal
npm run verify:family
npm run verify:sharing
npm run verify:accounts
npm run dev
# when everything works:
git add .
git commit -m "G0: real staff, family and patient-link account creation on /staff"
git push
```

Expected numbers: verify:access 668, verify:shell 81, verify:notes 93, verify:tasks 40, verify:notifications 44, verify:caregiver 75, verify:portal 53, verify:family 156, verify:sharing 40, verify:accounts 46. There is no migration this round, so `npx prisma db seed` and `npx prisma migrate dev` are not needed unless you want fresh demo data.

## What I need from you (once, after the commands above work)

1. Sign in as `demo.admin@cheliv.test`, open Staff. Create a staff account: role Nurse, any name, any e-mail ending in `@cheliv.test` (so it stays inside the demo pattern), a password of at least 10 characters. It should appear in the directory below with exactly the Nurse role.
2. On the same screen, switch the "Kind of account" dropdown to "Patient (link an existing patient record)". Priya Raman should be offered (she has no account yet in the seed). Create it, then sign out and sign in as that new account with the password you set: it should land on `/my-care` and show Priya's own information only.
3. Try creating a second account with the same e-mail as one you just made: it should be refused with a plain "already exists" message.

## Next

Your choice (fastest path to something impressive for your uncle): (b) the Request care decision (save to a hosted database, or e-mail an office address); (c) what an aide may write (a short visit note) and read about a patient - already partly true (visits.document), so this is really about widening who reviews and what the caregiver portal itself surfaces; (d) patient messages, or patient-visible and family-visible documents (each needs its own permission and consent scope design); (e) audit log pagination past 200 rows, the repo being public while `PROJECT_HANDOFF.md` names the owner, and whether supervisors should be kept away from restricted documents. Full list in `docs/REVIEW_MILESTONE_D.md`.
