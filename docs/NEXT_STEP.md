# NEXT_STEP.md

**Last updated:** 23 September 2026
**Just finished:** E3 round 1 (visit notes) and E4 round 1 (tasks) are
confirmed on your machine. This round adds two things: note addenda and
notifications.

## In plain words

1. **Fixing a note after it is reviewed.** A reviewed note can never be
   changed. If it is wrong, the nurse adds an **addendum** under it. The
   old words stay. A second person (a supervisor or admin) must review the
   addendum. Only the nurse who did the visit can write one, only one can
   wait at a time, and a note can hold at most ten.
2. **A bell.** Next to the app name there is now a bell with a number. The
   number is how many notices you have not read. Click it to open
   Notifications. You get a notice when someone gives you a task, finishes
   a task you asked for, cancels a task given to you, or reviews your note
   or your addendum. A notice never names a patient and never repeats a
   task title.
3. **One file fixed.** On GitHub the file `src/app/(app)/documents/page.tsx`
   held the Sharing page by mistake (commit 25b28d4). This zip has the
   correct Documents page. After you copy the zip over your folder, commit
   and push it so GitHub is right too.

## What was tested this round (in the build environment, real Postgres)

- `verify:access` 661 passed, `verify:shell` 62 passed, `verify:tasks` 40
  passed, `verify:notes` 93 passed (was 39), `verify:notifications` 44
  passed (new). `tsc --noEmit` clean, `eslint` clean, `next build` passed.
- /dashboard, /notifications, /visits, /visits/[id] and /tasks returned
  status 200 for the demo nurse, supervisor and admin. The visit page showed
  the addendum, the nurse's bell said "2 unread", and the supervisor was
  offered "Mark addendum reviewed".
- Ten addendum rules and seven notification rules were broken on purpose,
  one at a time, and the scripts failed each time. This includes two
  addenda added at the same moment: exactly one wins.

**Not tested:** clicking in a browser (add addendum, review addendum, the
bell, Mark read).

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import.
- `src/app/(app)/layout.tsx`: has NO html and NO body (it only gained an
  unread count for the bell).
- `src/app/(public)/page.tsx`: the real homepage, unchanged.

## Files to remove

None.

## What I need from you (once, after the commands below work)

1. As the demo nurse, open a visit that is in progress or completed, write
   a note, save it, submit it. As the demo supervisor (or admin), open the
   same visit and click **Mark reviewed**.
2. Sign back in as the nurse. The bell should show 1. Open it, then click
   the notice: it opens the visit. Click **Mark read**.
3. On that visit, as the nurse, add a **Correction** addendum. As the
   supervisor, click **Mark addendum reviewed**. The nurse's bell should
   show a new notice.
4. As the demo admin, open Tasks and give the nurse a task. As the nurse,
   check the bell shows a notice that opens Tasks.

If all of that works, say so and I will treat E3 round 2 and E4 round 2 as
confirmed.

## Next

Your choice: the caregiver portal (phone first: today's visits, check in
and out, task checklist; the CAREGIVER role holds no permissions today, so
this needs a permission design first), or one of the open items: audit log
pagination past 200 rows, a real "create staff account" flow before
Milestone F, /design-system is publicly reachable, /request-care saves
nothing, the repo is public and PROJECT_HANDOFF.md names the owner and says
the site is a surprise, whether supervisors should be kept away from
restricted documents. Full list in docs/REVIEW_MILESTONE_D.md.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_addenda_and_notifications
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run verify:notes
npm run verify:tasks
npm run verify:notifications
npm run dev
```

Then, once the click-through works:

```powershell
git add .
git commit -m "E3 round 2 and E4 round 2: note addenda, notifications, restore Documents page"
git push
```
