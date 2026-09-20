# NEXT_STEP.md

**Last updated:** 20 September 2026
**Just finished:** Referrals, the fifth and last slice of Milestone D. Milestone D is now finished, and I did the review pass.

---

## What I just completed

Referrals: a request for the office to take on someone's care. A hospital, a doctor's office, a family member or the person themselves asks. A referral has a name, a date of birth, who sent it, the kind of care, how urgent, and why care is needed.

This slice asks a new question. A referral usually arrives BEFORE the person is a patient, so nobody has a relationship to them yet. So:

- A referral about someone who is not a patient yet can be seen by administrative roles only. A nurse cannot see that it exists.
- After a referral is accepted and linked to a patient, the nurses on that patient's care team can see it, including the reason for care.
- Some parts are office-only: the outside contact's name and phone, the office notes, and the reason a referral was turned down. Only administrative roles see these. For everyone else the system does not even read them from the database.
- Only administrative roles can record or decide a referral.
- Accepting a referral either links it to the patient who already has that exact name and birth date, or creates a new patient record. It refuses to create a second record for someone who is already a patient.
- Declining or withdrawing needs a written reason. Accepted, declined and withdrawn are final.

This was really TESTED before it reached you: type check clean, lint clean, production build clean, and `npm run verify:access` passed 407 checks. I broke thirteen rules on purpose in a copy and the test failed on those rules each time. I also called the real forms over real HTTP, the same request a browser sends. The admin could record, edit and start a review. The nurse was refused every time and nothing was saved. The same test also covered the document upload form, which was the untested gap from last round: it filed a small PDF and refused a repeat, a fake PDF, a file over 2 MB, a missing file, a patient off the nurse's team and a restricted kind.

What I could NOT test is clicking the forms in a real browser, because there is no browser here. Please try the "Record a referral" form once (step 3 below).

I also wrote `docs/REVIEW_MILESTONE_D.md`, the review of everything built so far, with a proposal for Milestone E and three questions. Please read it and answer the three questions at the end.

## IMPORTANT - one new migration, and no file to delete

One new table this round: `referrals`. Run the migration command below. No new dependencies, so `npm install` will just say up to date. No file needs deleting.

## What files were created

- `src/lib/referrals.ts` - every referral rule, in one place
- `src/lib/referral-constants.ts` - the kinds of sender, urgency, statuses and the status machine
- `src/lib/referrals-actions.ts` - thin server actions
- `src/app/referrals/page.tsx`, `create-referral-form.tsx`, `referral-controls.tsx`, `referral-fields.tsx`
- `docs/REFERRALS.md`, `docs/REVIEW_MILESTONE_D.md`

## What files changed

- `prisma/schema.prisma` - added `Referral`
- `prisma/seed.ts` - nurses can now read referrals, and six synthetic referrals
- `scripts/verify-access.ts` - new sections for referrals (407 checks now)
- `src/lib/time.ts` - two small date helpers for dates of birth
- `src/app/dashboard/page.tsx` - "View referrals" link
- Docs: `CHANGELOG`, `PHASE_STATUS`, `PROJECT_HANDOFF`, `CONTINUATION_PROMPT`, `RBAC`, `AUDIT_LOGGING`, `DATABASE`, `FOLDER_STRUCTURE`, `DEMO_ACCOUNTS`

`src/app/layout.tsx` and the homepage were not touched this round. I still name-checked both (see the end of my reply).

## How to test it on your machine

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_referrals
npx prisma db seed
npm run verify:access
```

**Expect** the seed to say "Documents already exist (5), leaving them alone" and then "6 synthetic demo referrals ready". **Expect** `verify:access` to end with `407 passed, 0 failed` and `Every access rule held.` If anything FAILs, send me the FAIL lines.

Then the browser test:

```powershell
npm run dev
```

1. Sign in as `demo.admin@cheliv.test`. On the dashboard press "View referrals" (or open `/referrals`). You should see SIX referrals: three open (Walter Brennan in review and urgent, Grace Holloway received) and the rest closed (Eleanor, Marcus and Priya accepted, Tomas Reyes declined). Each shows an "Office details" box with a contact and notes.
2. Sign out. Sign in as `demo.nurse@cheliv.test` and open `/referrals`. You should see only ONE referral, Eleanor Whitfield's, accepted. You can read why care was requested. You should see no "Office details" box, no buttons, no form, and none of Walter, Grace, Tomas, Marcus or Priya. Then `demo.nurse2@cheliv.test`: only Marcus Delgado's.
3. Sign in as the admin again. Use "Record a referral" to add a made-up person. Try to break it: leave the first name empty, put an impossible date such as 30 February, a future birth date, a phone number of "abc", and record the same person twice. Each should be refused with a plain message, and what you typed should stay in the form. Then record a real one and check it appears under Open referrals as Received.
4. Try the buttons on it: "Edit this referral" then save. "Start review". Then on the same referral, "Decline..." with an empty reason should be refused. With a reason it should close the referral. On Walter Brennan (in review) press "Accept and create patient", confirm, and then open `/patients`: Walter should now be a patient with nobody on his care team.
5. On the dashboard's audit list you should see `referral_created`, `referral_review_started`, `referral_declined` and `patient_created` entries, and no names or reasons anywhere.

Steps 3 and 4 change the demo data. That is fine. To get the starting point back, delete the extra referral and Walter's new patient record in Prisma Studio.

```powershell
npm run build
npm run lint
npx tsc --noEmit
```

## Decisions that are yours

The full list, with my recommendations, is in `docs/REVIEW_MILESTONE_D.md`. The ones that decide what happens next:

- **Milestone E.** Which portal first, whether you agree with the permissions I recommend for CARE_COORDINATOR and CLINICAL_SUPERVISOR, and whether the public request-care form gets wired up now or later. Three short questions at the end of the review.
- **The public request-care form** still says "Request received" and saves nothing. That is wrong to leave on a live site.
- **Where real files will live.** Still file contents inside the database, fine for made-up data only. Encrypted storage is a paid decision, and I will not choose or sign up for anything without asking.
- The repo is public and `docs/PROJECT_HANDOFF.md` names the owner and says this is a surprise (still open).
- Only SUPER_ADMIN can archive documents, and which document kinds are restricted (still open).
- Nurses see colleagues' visits, any team nurse can edit a draft plan, and only ADMIN and SUPER_ADMIN approve plans (still open).

## What comes next

Milestone E, the real staff-facing screens, once you answer the questions in the review. I will not start it before you do.

## Exact next commands after you have tested

```powershell
git add .
git commit -m "Referrals with reach and office-only fields, accept links or creates a patient, access verification"
git push
```
