# NEXT_STEP.md

**Last updated:** 24 September 2026
**Just finished:** the caregiver portal (E5 round 1) is confirmed on your machine. This round builds the **patient portal** (E5 round 2).

## In plain words

1. **A calm page for the patient.** A patient signs in and sees **My care**: their next visits, the people looking after them, their care plan with its goals, and their last few visits. Read only. To change a visit they call the office.
2. **One new key.** A "permission" is a key. The PATIENT role used to hold none. It now holds exactly one: `portal.read`, meaning "see MY OWN care and nothing else". It opens no staff screen.
3. **How the system knows which patient is "me".** The patient's record now has an optional field `userId` that points at their sign-in account. One account per patient, one patient per account (the database refuses a second). The page never asks the browser "which patient?", so nobody can change a web address to see somebody else.
4. **What a patient never sees here:** visit notes, tasks, documents, referrals, office notes, e-mail addresses, other patients, and any care plan that is a draft or finished.
5. **A demo patient.** The seed creates `demo.patient@cheliv.test` (same demo password), linked to Eleanor Whitfield, and gives her two visits ahead so the page is never empty.

Full explanation in `docs/PATIENT_PORTAL.md`.

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import (unchanged).
- `src/app/(app)/layout.tsx`: has NO html and NO body (unchanged).
- `src/app/(public)/page.tsx`: the real homepage (unchanged).
- New: `src/app/(app)/my-care/page.tsx` asks who is signed in by itself (`verify:shell` checks it).

## Files to remove

None.

## Migration (this round has one)

`npx prisma migrate dev --name add_patient_account_link` adds the one optional, unique column `user_id` to patients. I did not ship any SQL.

## What I need from you (once, after the commands below work)

1. Sign in as `demo.patient@cheliv.test`. The menu shows only Dashboard and My care. My care shows two upcoming visits, the care team and the care plan "Steady recovery at home".
2. As the patient, type `/visits`, `/patients`, `/documents` and `/caregiver` in the address bar. Each shows the "does not have access" screen.
3. Sign in as `demo.caregiver@cheliv.test` and type `/my-care`. It shows the same screen.

If all of that works, say so and I will treat the patient portal as confirmed.

## Next

Your choice: (a) the family portal with consent gating; (b) what an aide may write and read; (c) patient messages or patient-visible documents; (d) the open items (audit log pagination, a real "create staff account" flow that also links a patient account, `/design-system` public, `/request-care` saves nothing, public repo naming the owner, supervisors and restricted documents). Full list in `docs/REVIEW_MILESTONE_D.md`.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_patient_account_link
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run verify:notes
npm run verify:tasks
npm run verify:notifications
npm run verify:caregiver
npm run verify:portal
npm run dev
# when everything works:
git add .
git commit -m "E5 round 2: patient portal (My care), portal.read, Patient.userId, demo patient"
git push
```
