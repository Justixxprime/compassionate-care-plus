# NEXT_STEP.md

**Last updated:** 24 September 2026
**Just finished:** the family portal (E5 round 3) is confirmed on your machine. This round, "F0", makes the project ready to show: the live site no longer crashes at sign-in, two small safety guards, and a "Who can see my care" panel for the patient.

## In plain words

1. **The live site no longer shows an error at sign-in.** The Vercel site has no database (yours lives on your laptop), so sign-in used to crash. Now it shows a calm screen: "The secure portal is not open here yet", with buttons for Request care and Back to the website. To show the internal app, screen-share your laptop. Full story in `docs/DEPLOYMENT.md`.
2. **`/design-system` is hidden on the live site** (it says "page not found" there; it still opens on your laptop with `npm run dev`).
3. **The seed refuses to run on a hosted database.** It creates accounts with a known password, so it now only runs when `DATABASE_URL` points at your own machine.
4. **"Who can see my care".** At the bottom of My care, the patient sees which family members they have shared with, how they are related, which parts, and until when. Read only: the office still records and withdraws.
5. No migration, no new permission (still 38), no new dependency.

## One thing to know before your uncle sees the live site

The **Request care** form says "Request received", but nothing is sent or saved anywhere. It needs a decision from you (save requests to a hosted database, or e-mail them to an office address). Tell me which and I will build it next round. Details in `docs/DEPLOYMENT.md`.

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import (unchanged).
- `src/app/(app)/layout.tsx`: has NO html and NO body (unchanged).
- `src/app/(public)/page.tsx`: the real homepage (unchanged).
- `src/app/sign-in/page.tsx` is not in a route group, so it has no site header: the closed screen carries its own logo and buttons.

## Files to remove

None.

## What I need from you (once, after the commands below work)

1. Sign in as `demo.patient@cheliv.test`, open My care: at the bottom, "Who can see my care" lists Claire Whitfield (Son or daughter; Visit schedule, Care team; until withdrawn).
2. As `demo.admin@cheliv.test`, withdraw Claire's permission on Family access. As the patient reload My care: it says you have not shared with anyone. Record it again (tick the box) and check it comes back.
3. After the push and Vercel's automatic redeploy, open `compassionate-care-plus.vercel.app/sign-in`: the calm screen, no error. `/design-system` says not found.

## Next

Your choice (fastest path to something impressive for your uncle): (a) a real "create staff account" flow (also creates family accounts and links a patient account); (b) the Request care decision; (c) what an aide may write and read; (d) patient messages or patient-visible and family-visible documents; (e) audit log pagination, the repo being public while the handoff file names the owner, supervisors and restricted documents. Full list in `docs/REVIEW_MILESTONE_D.md`.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run verify:notes
npm run verify:tasks
npm run verify:notifications
npm run verify:caregiver
npm run verify:portal
npm run verify:family
npm run verify:sharing
npm run dev
# when everything works:
git add .
git commit -m "F0: portal-closed screen for the live site, who can see my care, design-system hidden in production, seed guard"
git push
```

Expected numbers: verify:access 668, verify:shell 81, verify:notes 93, verify:tasks 40, verify:notifications 44, verify:caregiver 75, verify:portal 53, verify:family 156, verify:sharing 40. There is no migration this round, so `npx prisma migrate dev` is not needed.
