# NEXT_STEP.md

**Last updated:** 19 September 2026
**Just finished:** Care plans, the third slice of Milestone D

---

## What I just completed

Care plans: what the care team is trying to achieve for one patient, as a title, a summary and a list of goals. This is the first table that holds real clinical CONTENT, so it asks three questions instead of two. The role must hold the permission, the person must be able to reach the patient, AND to WRITE a plan the person must be on that patient's care team. The demo admin can read every plan and approve them, but cannot write one for Eleanor, because the admin is not on her team.

Two more rules worth knowing. The person who wrote a plan can never approve it. And once a plan is approved its wording is locked, so what was approved is never quietly changed. Only a goal can still be marked met.

Like the visits round, this was really TESTED before it reached you: type check clean, lint clean, production build clean, and `npm run verify:access` passed 175 checks. I broke five rules on purpose in a copy and the test failed on exactly those rules each time. I also fetched the real rendered `/care-plans` page as each demo account.

What I could NOT do is run it on your machine. That is your part below.

I also cleaned up two small things from your screenshots and my read-through: the red "1 Issue" badge is most likely a browser extension (details below), and an unused leftover file still had the words "This page is a placeholder" in it.

## IMPORTANT - one new migration, and one file to delete

One new pair of tables this round: `care_plans` and `care_plan_goals`. Run the migration command below.

Delete this leftover file yourself (zip files never delete anything):

```powershell
Remove-Item src\components\marketing\coming-soon-page.tsx
```

## What files were created

- `src/lib/care-plans.ts` - every care plan rule, in one place
- `src/lib/care-plan-constants.ts` - statuses, the status rules, size limits
- `src/lib/care-plans-actions.ts` - thin server actions
- `src/app/care-plans/page.tsx`, `create-plan-form.tsx`, `plan-controls.tsx`
- `docs/CARE_PLANS.md`

## What files changed

- `prisma/schema.prisma` - added `CarePlan` and `CarePlanGoal`
- `prisma/seed.ts` - new permission `care_plans.create`, nurses can create and update plans, two synthetic plans
- `src/lib/patients.ts` - added `isActiveCareTeamMember()`. Nothing that existed was changed.
- `scripts/verify-access.ts` - new sections for care plans
- `src/app/dashboard/page.tsx` - "View care plans" link
- `src/app/layout.tsx` - one attribute added to `<body>` (`suppressHydrationWarning`). It still has html, body and the globals.css import, and the guard script passes.
- Docs: `CHANGELOG`, `PHASE_STATUS`, `PROJECT_HANDOFF`, `CONTINUATION_PROMPT`, `RBAC`, `AUDIT_LOGGING`, `DATABASE`, `FOLDER_STRUCTURE`, `TROUBLESHOOTING`, `DEMO_ACCOUNTS`. Also every em dash in the docs was replaced, to follow your no em dashes rule.

## How to test it on your machine

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item src\components\marketing\coming-soon-page.tsx
npm install
npx prisma migrate dev --name add_care_plans
npx prisma db seed
npm run verify:access
```

**Expect** the seed to say "31 permissions ready" and "2 synthetic demo care plans ready". **Expect** `verify:access` to end with `175 passed, 0 failed` and `Every access rule held.` If anything FAILs, send me the FAIL lines.

Then the browser test:

```powershell
npm run dev
```

1. Sign in as `demo.admin@cheliv.test`, open `/care-plans`. You should see both plans. Marcus's draft has Approve plan and Discard draft. Eleanor's plan has Complete plan. There are no edit boxes and no "Start a care plan" form, because the admin is not on anyone's care team. Press Approve plan on Marcus's draft and confirm. It becomes Active, with "approved by Demo Admin" on it.
2. Sign out. Sign in as `demo.nurse2@cheliv.test`. You should see ONLY Marcus's plan, now Active and locked: no edit boxes, no add or remove goal. Goals now have Mark met. Press Mark met on one. Then use "Start a care plan" to write a new draft for Marcus (this is allowed while the old plan is active), and add a goal to it. There is no Approve button anywhere, because a nurse does not hold that permission.
3. Sign out. Sign in as the admin again. Press Approve plan on Marcus's new draft. It should be REFUSED with "This patient already has an active care plan". That is the one-active-plan rule. Press Complete plan on Marcus's first plan, then Approve plan on the new draft. Now it works.
4. Sign out. Sign in as `demo.nurse@cheliv.test`. You should see ONLY Eleanor's plan and nothing of Marcus's. The start form offers only Eleanor. Start a draft for her, add a goal, then discard it.

Running step 1 changes the demo data. To get the starting point back later, delete the two plans in Prisma Studio, then run `npx prisma db seed` again.

```powershell
npm run build
npm run lint
npx tsc --noEmit
```

## About the red "1 Issue" badge in your screenshots

I cannot see what it says. The most likely cause is a browser extension (Grammarly or ColorZilla) adding attributes to the page. I added `suppressHydrationWarning` to `<body>`, which silences exactly that. If the badge is still there after `npm run dev` restarts, click it, read what it says, and send me the text.

## Decisions that are yours

- A nurse can SEE a colleague's visit on a shared patient but cannot change it (from the visits round, still open).
- Any nurse on a patient's team can edit that patient's draft plan, not only the author. Say so if you want it stricter (author only).
- Only ADMIN and SUPER_ADMIN can approve. A clinical supervisor is the natural real-world approver, but CLINICAL_SUPERVISOR and CARE_COORDINATOR still hold no permissions. Their permission sets are their own piece of design work.
- The repo is public and `docs/PROJECT_HANDOFF.md` names the owner and says this is a surprise. Your call whether to make the repo private or trim that file.

## What comes next

Still within Milestone D: documents, then referrals. Each its own round, each with a check added to `verify-access.ts` that tries to break it.

## Exact next commands after you have tested

```powershell
git add .
git commit -m "Care plans with team-based writing, four-eyes approval and access verification"
git push
```
