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

**It does not send a real e-mail.** `justixxchiobi@gmail.com` is stored
as the `CARE_REQUEST_NOTIFY_EMAIL` - the address this request was meant
to reach - and shown next to it, but nothing in this round makes an
e-mail land in that inbox.

The reason is the project's own standing rule: **no new dependency
without asking first.** Real SMTP sending needs a mail library (the
architecture doc names Nodemailer) or a third-party HTTP email API - and
either one is a new dependency, or a new account and (eventually) a
cost, exactly the two things `docs/CONTINUATION_PROMPT.md` says to ask
about before adding. So this round deliberately stops at "never lost,
and the office is alerted the moment it comes in" - which needs neither
- and leaves real delivery as a decision, not a guess.

**The next decision, when you want it:**
- add `nodemailer` (free, MIT-licensed) and point it at a local Mailpit
  inbox for development, exactly as `PHASE_0_ARCHITECTURE.md`'s stack
  table always said would happen - real SMTP sending only gets wired at
  deploy time, to whatever provider you pick then; or
- skip Nodemailer entirely and call a transactional e-mail HTTP API
  (for example Resend) with `fetch`, no new npm package at all, but you
  would need to create an account and hand me an API key.

Either is a small, contained change once you pick one - this round's
code does not need to be rebuilt for it, only `createCareRequest`'s one
notification step.

## Spam

The form has one hidden field (`companyWebsite`) that stays empty and
out of the tab order for a real visitor, with a label saying so for
anyone using a screen reader. A script that fills in every input it
finds usually fills this one too; if it's non-empty, the submission is
silently accepted (so the script sees "success" and moves on) but
nothing is written. This is not a defense against a determined attacker
- just a cheap, honest filter against the ordinary automated spam a
public form on the open internet collects. Real rate limiting is later,
production-readiness territory (Milestone F), not this round.

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
