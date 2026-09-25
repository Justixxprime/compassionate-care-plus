# NEXT_STEP.md

**Last updated:** 25 September 2026
**Just finished:** Round G0 is confirmed (the real "Create an account" flow on `/staff` - screenshot showed it working). This round, "G1", closes the Request care gap and adds audit log pagination.

## In plain words

1. **`/request-care` on the public site is now real.** It used to fake a
   "Request received" message and throw the answer away. Now it actually
   saves the request (new `care_requests` table - see
   `docs/CARE_REQUESTS.md`) and notifies every Admin/Super Admin in-app
   (the bell) the moment it comes in.
2. **`justixxchiobi@gmail.com` is wired in as the office address**, via
   `CARE_REQUEST_NOTIFY_EMAIL`, stored on every request as a record of
   where it was meant to go.
3. **Honest gap, on purpose:** no real e-mail is sent yet. That needs
   either a new dependency (Nodemailer) or a third-party e-mail API,
   and this project's rule is "no new dependency without asking" - so
   this round stops at "never lost, and the office is alerted
   instantly," which needs neither. Full explanation in
   `docs/CARE_REQUESTS.md`, including the two options for real sending
   whenever you want to pick one.
4. **New `/care-requests` screen** (Office section) lists every
   request, newest first, with Mark contacted / Close buttons.
   `care_requests.manage`, Admin and Super Admin only.
5. **Audit log now paginates.** It used to hard-cut at 200 rows with no
   way to see anything older. Now it shows 200 at a time with Newer /
   Older buttons that keep your filters.
6. One migration this round (`care_requests` table), one new permission
   (`care_requests.manage` - 39 total now), no new dependency.

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
npx prisma migrate dev --name add_care_requests
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
npm run verify:accounts
npm run verify:care-requests
npm run dev
# when everything works:
git add .
git commit -m "G1: real Request care (saved + in-app notified), audit log pagination"
git push
```

Expected numbers: verify:access 668, verify:shell 81, verify:notes 93,
verify:tasks 40, verify:notifications 44, verify:caregiver 75,
verify:portal 53, verify:family 156, verify:sharing 40, verify:accounts
46, new verify:care-requests 31. Say y at the migration prompt, one at a
time, same as always.

## What I need from you (once, after the commands above work)

1. Open `/request-care` on the public site (signed out), fill it in with
   a made-up name and a real-shaped email/phone, and submit. You should
   see "Request received."
2. Sign in as `demo.admin@cheliv.test`: the bell should show a new
   notification. Click it - it should take you to `/care-requests` and
   your test request should be there.
3. On `/care-requests`, click "Mark contacted" on your test request,
   then "Close." Both should work with no error.
4. Open `/audit-log`, scroll to the bottom: you should see Older/Newer
   buttons instead of the list just stopping at 200.

## Next

Your choice: (c) what an aide may write (a short visit note) and read
about a patient - already partly true (`visits.document`), so this is
really about widening who reviews and what the caregiver portal itself
surfaces; (d) patient messages, or patient-visible and family-visible
documents (each needs its own permission and consent scope design);
(e) the repo being public while `PROJECT_HANDOFF.md` names the owner;
whether supervisors should be kept away from restricted documents; and
whenever you're ready, the real-email decision from
`docs/CARE_REQUESTS.md`. Full list in `docs/REVIEW_MILESTONE_D.md`.
