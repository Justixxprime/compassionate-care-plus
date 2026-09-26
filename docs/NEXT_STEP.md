# NEXT_STEP.md

**Last updated:** 26 September 2026
**Just finished:** Referral Partner, consented family document sharing,
limited caregiver visit updates, sign-in safeguards, and private R2-ready
document storage with a scanner-only release gate are running locally.

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
5. **Caregiver visit updates:** a caregiver can save one short factual update
   for only their own in-progress or completed visit, then submit it. It is
   locked on submission and a different authorized staff reviewer can mark it
   reviewed from that visit's staff page. It never becomes a clinical note.
6. **Sign-in rate limiting:** five failed password attempts for one e-mail
   address within 15 minutes pause further attempts for 15 minutes. The
   limiter stores only a one-way address hash; it never stores a password.
7. **Session controls:** sessions expire after seven days; expired sessions are
   removed on sign-in, and each account is limited to five current sessions.
8. **Document scan gate:** every document now has a storage kind and scan
   state. Only `clean` documents can be listed or downloaded by staff,
   patients, or consented family users. The R2 path uses opaque private object
   keys; it never creates public file links. Only a separately authenticated
   internal scanner callback can release a pending file.

For the full R2 safety boundary, see `docs/R2_DOCUMENT_STORAGE.md`.

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

## Exact next command

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
node .\node_modules\next\dist\bin\next dev
```

The document storage/scan migration is already applied to the local database.
Use the command above only if the local app stops. `npm` itself currently has
a Windows Node installation problem on this computer, so this direct command
starts the project without relying on the broken global npm launcher.

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

1. **Caregiver update verification:** after migrating, check in as
   `demo.caregiver@cheliv.test`, open an active/completed assigned visit in
   My day, save a short draft, submit it, then sign in as an administrator to
   mark it reviewed from the visit page.
2. **Sign-in rate-limit verification:** try a wrong password five times for a
   demo account, then confirm the sixth attempt says to wait. Use the correct
   password after 15 minutes; a successful sign-in clears old failures.
3. **R2 verification:** R2 is configured for synthetic demo files only. A
   record marked pending, rejected, or quarantined must be invisible to every
   portal and download route until a real scanning workflow marks it clean.
   Keep `DOCUMENT_SCANNER_TOKEN` unset until that workflow is ready.

### Before real patient information or public launch

1. Make the repository private or remove personal handoff details.
2. Select and connect a genuine malware-scanning/quarantine service before
   enabling R2 uploads; the protected callback boundary is ready, but it is
   intentionally not a scanner by itself.
3. Create a hosted Neon PostgreSQL database for Vercel; use its pooled URL for
   the app and direct URL for Prisma migrations.
4. Choose a verified e-mail provider so password recovery can be delivered
   safely, then configure staff MFA (authenticator-app TOTP is recommended).
5. Turn off the public-site `noindex` setting only when the organization is
   ready for search engines and has approved public content.
