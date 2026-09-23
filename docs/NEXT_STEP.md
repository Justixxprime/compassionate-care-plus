# NEXT_STEP.md

**Last updated:** 23 September 2026
**Just finished:** E3 round 1 (visit notes) is now checked against a real
database, and a new feature is built: tasks.

## In plain words

1. **The visit notes were never tested by a script before.** Last round I
   could not run the tests. This round I could. I wrote a new test
   (`npm run verify:notes`) and it passes. To be sure the test really
   bites, I broke three rules on purpose, one at a time, and the test
   failed each time. Then I put the rules back.
2. **I found one small mistake in an old test.** `verify:access` still
   expected the supervisor to have the old list of permissions. It would
   have shown one red failure on your machine. Fixed.
3. **New feature: Tasks.** A to-do list for the office. A nurse can note
   a task for themselves, an administrator can give a task to a colleague,
   and a task about a patient disappears from a nurse's list if that
   nurse comes off the patient's care team.

## What was tested this round (in the build environment, real Postgres)

- `verify:access` 661 passed, 0 failed.
- `verify:shell` 62 passed, 0 failed.
- `verify:notes` 39 passed, 0 failed (new).
- `verify:tasks` 40 passed, 0 failed (new), four rules broken on purpose
  and caught.
- `tsc --noEmit` clean, `eslint` clean, `next build` passed.
- /tasks, /visits and /visits/[id] returned status 200 for the demo nurse
  and the demo admin, and the nurse saw only her own task.

**Not tested:** clicking the buttons in a browser (the create form, Mark
done, Cancel, and the note buttons). That is what I ask you to do below.

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import.
- `src/app/(app)/layout.tsx`: has NO html and NO body.
- `src/app/(public)/page.tsx`: the real homepage, unchanged.

## Files to remove

None.

## What I need from you (once, after the commands below work)

1. Sign in as the demo nurse. Open **Tasks** in the menu. You should see
   one task, "Confirm the medication list with the family". Click
   **Mark done**. It should move to "Recently closed".
2. Still as the nurse, create a task for yourself. Then try to cancel it.
   It should cancel.
3. Sign in as the demo admin. Open Tasks. You should see every task. Create
   a task for the demo nurse about Eleanor Whitfield. Then sign back in as
   the nurse and check it is there.
4. Finish the visit note test you already started: on the visit page write
   a note, save the draft, submit it, then sign in as the demo supervisor
   or admin, open the same visit and click **Mark reviewed**.

If all of that works, say so and I will treat E3 round 1 and E4 round 1
as confirmed.

## Decision made for you

One note per visit is enough for the demo. The realistic gap is
correcting a note after it is reviewed (an addendum). That is the next
clinical slice if you want it.

## Next

E4 round 2 or E3 round 2, your choice: task notifications, or note
addenda, or the caregiver portal. Still open, none of it touched: audit
log pagination past 200 rows, a real "create staff account" flow,
/design-system is publicly reachable, /request-care saves nothing, the
repo is public and PROJECT_HANDOFF.md names the owner and says the site
is a surprise, whether supervisors should be kept away from restricted
documents. Full list in docs/REVIEW_MILESTONE_D.md.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_tasks
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run verify:notes
npm run verify:tasks
npm run dev
```

Then, once the click-through works:

```powershell
git add .
git commit -m "E3 round 2 and E4 round 1: visit note verification, tasks"
git push
```
