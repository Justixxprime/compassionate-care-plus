# NEXT_STEP.md

**Last updated:** 24 September 2026
**Just finished:** E3 round 2 (note addenda) and E4 round 2 (notifications) are confirmed on your machine. This round builds the **caregiver portal** (Milestone E5, round 1).

## In plain words

1. **A phone screen for caregivers.** A home health aide signs in and sees one simple page called **My day**. It lists only HER visits for today. Each visit has a big **Check in** button for when she arrives, and a big **Check out** button for when she leaves. Under the visits is a **checklist**: the small jobs somebody gave her, each with a big **Mark done** button.
2. **She can do only that.** She cannot see other people's visits, patient charts, the schedule or documents. She cannot cancel a visit or mark it missed (the office does that). She cannot write a note yet.
3. **A new key on the ring.** In this system a "permission" is a key. The caregiver used to hold no keys at all. She now holds exactly two: `visits.checkin` (new) and `tasks.read` (already existed). The new key is deliberately small: it means "see MY visits, check in and out". Why not just hand her the bigger visit keys? Because the bigger keys also open every visit on every patient and allow cancelling. A small key is safer, and it is easy to make bigger later.
4. **Rules that protect people.** She can check in only on the day of the visit. She can be checked in to only one visit at a time. She loses the visit the moment she comes off the patient's care team. Nobody, not even an administrator, checks in for her.
5. **A demo caregiver.** Running the seed adds `demo.caregiver@cheliv.test` (same demo password as the others) on Eleanor Whitfield's care team, with three visits today and two checklist tasks.

Full explanation in `docs/CAREGIVER_PORTAL.md`.

## What was tested this round (in the build environment, real Postgres)

- `verify:access` 663, `verify:shell` 68, `verify:notes` 93, `verify:tasks` 40, `verify:notifications` 44, and the new `verify:caregiver` 75. `tsc --noEmit` clean, `eslint` clean, `next build` passed.
- `/caregiver`, `/dashboard`, `/tasks`, `/notifications`, `/visits`, `/patients` returned status 200 as the demo caregiver, nurse, admin and supervisor. The caregiver saw three visits with Check in buttons and two tasks with Mark done. The caregiver got the no-access screen on `/visits` and `/patients`. The nurse and supervisor got the no-access screen on `/caregiver`.
- Eleven rules were broken on purpose, one at a time, and the script failed each time: ownership, reach, one place at a time, the day rule, cancel refused, the permission gate, the row lock, the carried-over visit, the own-visits filter, the denied audit entry, and an extra permission on the caregiver role. Two of the first eleven passed by accident (the lock and the carried-over visit), so two tests were rewritten to be exact, and both are now caught.

**Not tested:** clicking in a real browser, and holding it on a real phone.

## Layout name-check

- `src/app/layout.tsx`: has html, body and the globals.css import (unchanged).
- `src/app/(app)/layout.tsx`: has NO html and NO body (unchanged).
- `src/app/(public)/page.tsx`: the real homepage (unchanged).
- New: `src/app/(app)/caregiver/page.tsx` asks who is signed in by itself (`verify:shell` checks it).

## Files to remove

None.

## Migration

None this round. No table changed. You run `npx prisma db seed` instead (it adds the permission, gives the caregiver her keys and creates the demo caregiver).

## What I need from you (once, after the commands below work)

1. Open the app in a narrow browser window (about phone width). Sign in as `demo.caregiver@cheliv.test`. The menu should show only Dashboard, My day and Tasks. On My day, tap **Check in** on the first visit. The other Check in buttons should disappear. Tap **Check out**. Then **Check in** on the second visit works again.
2. On My day, tap **Mark done** on a checklist task. Then sign in as the demo admin: the bell should show "A task you asked for was finished."
3. As the caregiver, type `/visits` and then `/patients` in the address bar. Both should show the "does not have access" screen.

If all of that works, say so and I will treat the caregiver portal round 1 as confirmed.

## Next

Your choice. Options I can design next: (a) what an aide may WRITE (a short visit note, and who reviews it) and what she may READ about a patient (today she sees a name only); (b) the patient portal (the PATIENT role holds no permissions, so it needs a permission design like this one); (c) the family portal with consent gating; (d) one of the open items: audit log pagination past 200 rows, a real "create staff account" flow before Milestone F, /design-system is publicly reachable, /request-care saves nothing, the repo is public and PROJECT_HANDOFF.md names the owner and says the site is a surprise, whether supervisors should be kept away from restricted documents. Full list in docs/REVIEW_MILESTONE_D.md.

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
npm run dev
```

Then, once the click-through works:

```powershell
git add .
git commit -m "E5 round 1: caregiver portal (My day), visits.checkin permission, demo caregiver"
git push
```
