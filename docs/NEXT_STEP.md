# NEXT_STEP.md

**Last updated:** 26 September 2026
**Just finished:** Secure messaging is hardened and confirmed, and the patient-only
`/my-documents` portal is confirmed on the owner's machine.

## What is now complete

1. **Secure messaging:** patients and staff who currently reach an active or
   on-hold patient can use one private conversation. Read markers, unread
   inbox counts, and generic notifications work. A discharged record closes
   the conversation immediately. Caregivers without message permission do not
   receive unusable message notifications.
2. **My documents:** a patient can now see and download only documents on
   their own active or on-hold record at `/my-documents`. Downloads are
   private, no-cache, and audited. Family document access is still not built.
3. **Request care and accounts:** the public request form saves its request
   and tells office administrators in-app; the office can create staff,
   family, and linked patient accounts.
4. **Referral Partner portal:** the referral-partner role can submit a
   hospital or physician-office referral and see only the status of referrals
   that account submitted. It cannot access patient records or office notes.

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
npm run verify:messages
npm run dev
# when everything works:
git add .
git commit -m "G1: real Request care (saved + in-app notified), audit log pagination"
git push
```

There is no new database migration for secure messaging or My documents. Run
`npx prisma db seed` so your local database receives `portal.documents.read`.

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

## What remains from the master plan

### Still useful for the demo

1. **Family documents.** This needs a new consent scope and a clear rule for
   which documents a patient is willing to share. It is intentionally not
   inferred from the existing visits, care-team, or care-plan consent.
2. **Caregiver documentation choice.** The caregiver portal can check in,
   check out, and complete tasks. Decide later whether aides may write a
   limited visit entry, and who must review it.

### Before real patient information or public launch

1. Make the repository private or remove personal handoff details.
2. Choose encrypted file storage and virus scanning before real documents.
3. Add sign-in rate limiting, session management, password-reset flow, and
   MFA for staff.
4. Choose a real e-mail service if the office wants e-mail delivery.
5. Turn off the public-site `noindex` setting only when the organization is
   ready for search engines and has approved public content.
