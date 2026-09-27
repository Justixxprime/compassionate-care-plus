# CARE REQUESTS (Round G1)

## What this closes

Before this round, `/request-care` on the public site was a real-looking
form that validated input and showed a genuine success message, and then
threw the answer away. Nothing was saved. Nothing was sent anywhere.
`docs/CONTINUATION_PROMPT.md` called this out by name as the known gap
for the uncle demo. This round closes it, honestly, within the rules
this project runs under.

## What happens now, step by step

1. Someone fills in the form at `/request-care` and submits it.
2. `submitCareRequestAction` (`src/lib/care-requests-actions.ts`) calls
   `createCareRequest` (`src/lib/care-requests.ts`) with what they typed.
3. The input is checked (name present, a plausible e-mail, a phone
   number, a real relationship and contact-method choice, nothing over
   the length limits) and a hidden honeypot field is checked - see
   "Spam" below.
4. A row is written to the new `care_requests` table. **This is the row
   that used to not exist.** The request is never lost from this point
   on, no matter what happens to e-mail.
5. Every `ADMIN` / `SUPER_ADMIN` in the organization gets an in-app
   notification (the bell in the top bar) linking to `/care-requests`.
6. Staff with `care_requests.manage` (ADMIN, SUPER_ADMIN) open
   `/care-requests`, see the request, and mark it **Contacted** once
   someone has followed up, or **Close** it once it's done with.

## What this does NOT do yet, and why

When Resend is configured, the office also receives an email alert at
`CARE_REQUEST_NOTIFY_EMAIL`. It says only that a request is waiting and
links to the protected staff page. It never includes the submitter's name,
contact details, message, or health information. If email delivery is not
configured or temporarily fails, the request is still saved and staff still
receive their in-app notification.

## Spam

The form has one hidden field (`companyWebsite`) that stays empty and
out of the tab order for a real visitor, with a label saying so for
anyone using a screen reader. A script that fills in every input it
finds usually fills this one too; if it's non-empty, the submission is
silently accepted (so the script sees "success" and moves on) but
nothing is written. This is not a defense against a determined attacker
- just a cheap, honest filter against the ordinary automated spam a
public form on the open internet collects.

### Cloudflare Turnstile

When both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are
configured, the form also uses Cloudflare Turnstile. The browser supplies a
short-lived proof and the server verifies it with Cloudflare before a request
is saved. Verification is fail-closed: a missing, expired, reused, invalid, or
wrong-site proof saves nothing. The site key is public by design; the secret
key is server-only.

Until both values are set, local development remains usable and the honeypot
continues to apply. Before enabling this in production, create a Turnstile
widget limited to the exact Vercel hostname and add both values in Vercel's
Production environment. See `docs/PRODUCTION_COMPLIANCE_GATE.md`.

## Access rules

- Submitting: no permission needed, no session needed - by definition,
  since a stranger asking for care has neither.
- Reading the list, and marking a request contacted or closed:
  `care_requests.manage` (ADMIN, SUPER_ADMIN only). No relationship or
  consent check applies - a care request has no patient yet, so there is
  nothing to check a relationship against, the same reasoning an
  unlinked referral already uses.
- The audit log records that a request came in, and that it was marked
  contacted or closed - never the name, message, or contact details.

## Files

- `prisma/schema.prisma` - `CareRequest` model (migration name suggestion:
  `add_care_requests`)
- `src/lib/care-request-constants.ts` - shared vocabulary and validation
- `src/lib/care-requests.ts` - `createCareRequest`, `listCareRequests`,
  `changeCareRequestStatus`
- `src/lib/care-requests-actions.ts` - the two Server Actions
- `src/components/marketing/request-care-form.tsx` - the public form,
  now real
- `src/app/(app)/care-requests/` - the admin screen
- `scripts/verify-care-requests.ts` - `npm run verify:care-requests`
