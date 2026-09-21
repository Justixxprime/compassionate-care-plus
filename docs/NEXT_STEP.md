# NEXT_STEP.md

**Last updated:** 21 September 2026
**Just finished:** Milestone E0, the first step of the real staff-facing screens. Referrals is confirmed working on your machine, so Milestone D is closed.

---

## What I just completed

No screens this round. This is the groundwork the screens stand on.

1. **One copy of the shared safety helpers.** Four service files each carried their own copy of the same three helpers (who is asking, write a "refused" entry, write an "it happened" entry). They now live once in `src/lib/auth/actor.ts`. The test script fails if anyone pastes a private copy back.
2. **A way to put someone on a care team, and take them off.** Until now only the seed script could. A patient made by accepting a referral (like chibueze obioma in your test) had nobody on the team, so nobody could see or schedule them. `src/lib/care-team.ts` fixes that with strict rules, explained in plain words in `docs/CARE_TEAMS.md`.
3. **Real permissions for the two office roles.** The care coordinator and the clinical supervisor held nothing before. Now the coordinator can run intake (referrals, visits, care teams) and the supervisor can approve care plans and read visits and documents.
4. **Two new demo accounts:** `demo.coordinator@cheliv.test` and `demo.supervisor@cheliv.test`, same password as the others.

This was TESTED before it reached you: type check clean, lint clean, production build clean, and `npm run verify:access` passed 553 checks (it was 407). I broke 18 rules on purpose, one at a time, and the test failed on each. What I could NOT test is a browser, because there are no screens yet.

## IMPORTANT - no migration, no new dependency, no file to delete

The database structure did not change. `npm install` will say up to date. No file needs deleting. You only need to run the seed, so the new permissions and the two new accounts get added (the seed only ever adds, it never removes anything).

## What files were created

- `src/lib/auth/actor.ts`
- `src/lib/care-team.ts`, `src/lib/care-team-constants.ts`
- `docs/CARE_TEAMS.md`

## What files changed

- `src/lib/visits.ts`, `care-plans.ts`, `documents.ts`, `referrals.ts` (the private helper copies removed, they import the shared file)
- `prisma/seed.ts` (two new permissions, real permission sets for the two office roles, two new demo accounts)
- `scripts/verify-access.ts` (553 checks now)
- Docs: `CHANGELOG`, `PHASE_STATUS`, `PROJECT_HANDOFF`, `CONTINUATION_PROMPT`, `RBAC`, `AUDIT_LOGGING`, `FOLDER_STRUCTURE`, `DEMO_ACCOUNTS`

`src/app/layout.tsx` and the homepage were not touched. I name-checked both anyway (see the end of my reply).

## How to test it on your machine

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma db seed
npm run verify:access
```

**Expect** the seed to say "Demo coordinator ready" and "Demo supervisor ready", and then "Referrals already exist ... leaving them alone". **Expect** `verify:access` to end with `553 passed, 0 failed` and `Every access rule held.` If anything FAILs, send me the FAIL lines. Then:

```powershell
npm run dev
```

Nothing new to click yet, but sign in as `demo.coordinator@cheliv.test` and `demo.supervisor@cheliv.test` on `/dashboard`: both should work, and the dashboard's permission list should show what each holds. Only the two roles' permissions are new; the pages look the same.

## Decisions I made without you (tell me if you disagree)

You said to continue without answering the three review questions, so I used my own recommendations: Care Command Center first, the permission sets above, and the public request-care form left for later.

- **The coordinator holds `patients.create`.** It was not in the reviewed list. Without it a coordinator can start a review but cannot accept a referral about someone new.
- **Nurses hold no care team permission.**
- **Open, and yours:** a clinical supervisor can read documents, and "restricted" documents (insurance card, ID scan) are restricted to administrative ROLES, which includes the supervisor. So a supervisor sees them. Do you want supervisors kept out of those two kinds?

## Still open from before

The public `/request-care` form still says "Request received" and saves nothing. The repo is still public and `PROJECT_HANDOFF.md` names the owner. Where real files will live (paid, I will ask first). Only SUPER_ADMIN can archive documents.

## What comes next

E1: the internal app shell. One shared layout for signed-in staff, navigation that shows only what each account may use, a real dashboard per role, and the five plain proof pages moved inside it. Then E2, the Care Command Center, which includes the screens for care teams.

## Exact next commands after you have tested

```powershell
git add .
git commit -m "Shared access helpers, care team rules, coordinator and supervisor permissions, 553 access checks"
git push
```
