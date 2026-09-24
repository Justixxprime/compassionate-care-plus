# NEXT_STEP.md

**Last updated:** 24 September 2026
**Just finished:** the patient portal (E5 round 2) is confirmed on your machine and pushed (commit af6d273). This round builds the **family portal with consent gating** (E5 round 3).

## In plain words

1. **A patient chooses who sees what.** The office records the patient's permission for one family member: which parts of their care (visit schedule, care team, care plan), for how long (90 days, 1 year, until withdrawn), and how they are related. Nothing else can be shared.
2. **The family member sees only that.** They sign in and open **Shared with me**. If the patient did not share a part, the screen says so plainly. Withdraw the permission and access ends at once.
3. **Two new keys** ("permissions"): `family.read` (family role: see what was shared with ME) and `consents.manage` (administrators: record and withdraw). 38 permissions now.
4. **One new table**, `family_consents`. A consent is written once and never edited: to change it, withdraw it and record a new one. Nothing is deleted.
5. **A small tidy-up.** The patient portal and the family portal now load their four shared things (visits, team, plan) from one file, so they cannot drift apart.
6. **A demo family member.** The seed creates `demo.family@cheliv.test` (same demo password), Claire Whitfield, Eleanor's daughter. Eleanor shares her visit schedule and care team with Claire, but NOT her care plan, so you can see both cases.

Full explanation in `docs/FAMILY_PORTAL.md`.

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import (unchanged).
- `src/app/(app)/layout.tsx`: has NO html and NO body (unchanged).
- `src/app/(public)/page.tsx`: the real homepage (unchanged).
- New: `src/app/(app)/family/page.tsx` and `src/app/(app)/consents/page.tsx` both ask who is signed in by themselves (`verify:shell` checks).

## Files to remove

None.

## Migration (this round has one)

`npx prisma migrate dev --name add_family_consents` adds the table `family_consents`. I did not ship any SQL. Answer `y` at the prompt if it asks.

## What I need from you (once, after the commands below work)

1. Sign in as `demo.family@cheliv.test`. The menu shows only Dashboard and Shared with me. The page shows Eleanor Whitfield, with her visits and care team, and a plain line saying she has not shared her care plan.
2. As Claire, type `/visits`, `/patients`, `/documents`, `/my-care` and `/consents` in the address bar. Each shows the no-access screen.
3. Sign in as `demo.admin@cheliv.test`, open **Family access** (Office group). You see Claire's permission. Click Withdraw, then sign in as Claire again: "Nobody has shared their care with you yet." Then, as admin, record it again (tick the confirmation box) and check Claire sees it again.
4. As `demo.patient@cheliv.test`, type `/family`: the no-access screen.

If all of that works, say so and I will treat the family portal as confirmed.

## Next

Your choice: (b) what an aide may WRITE (a short visit note and who reviews it) and READ about a patient; (c) patient messages or patient-visible documents (and family-visible ones, each with its own consent scope); (d) the open items: audit log pagination past 200 rows, a real "create staff account" flow (which also creates family accounts and links a patient account) before Milestone F, `/design-system` publicly reachable, `/request-care` saves nothing, the public repo naming the owner in `PROJECT_HANDOFF.md`, whether supervisors should be kept away from restricted documents (decided 21 September, see `DOCUMENTS.md`); (e) a small "who can see my care" panel on the patient's own My care screen. Full list in `docs/REVIEW_MILESTONE_D.md`.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_family_consents
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run verify:notes
npm run verify:tasks
npm run verify:notifications
npm run verify:caregiver
npm run verify:portal
npm run verify:family
npm run dev
# when everything works:
git add .
git commit -m "E5 round 3: family portal with consent gating, family.read, consents.manage, demo family account"
git push
```

Expected numbers: verify:access 668, verify:shell 81, verify:notes 93, verify:tasks 40, verify:notifications 44, verify:caregiver 75, verify:portal 53, verify:family 156.
