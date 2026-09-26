## Secure messaging hardening - active-care closure, usable notices, verification

Date: 26 September 2026

- Secure conversations now close immediately for a discharged patient, even
  for administrative staff who otherwise have organization-wide reach.
- Message notifications now go only to recipients with `messages.read`.
  A caregiver can remain on the care team without receiving a link they are
  not allowed to open.
- Every send writes a content-free `secure_message_sent` audit event. Denials
  remain content-free and use the existing vague not-found response.
- Staff conversation pages now have the same timestamps and empty state as the
  patient view. The staff inbox also explains an empty active-patient list.
- New `npm run verify:messages` script checks permission, active reach,
  patient ownership, read markers, notice privacy, and discharge closure. No
  schema change or dependency was added.

## Round G1 - Request care, saved and in-app notified; audit log pagination

Date: 25 September 2026

- Round G0 is confirmed: the "Create an account" form on `/staff` works (screenshot: kind of account, Patient selected, Walter Brennan offered).
- **Request care is real (NEXT_STEP.md item b, decided).** `/request-care` used to fake success and throw the answer away. Now every submission is saved (new `care_requests` table) and every Admin/Super Admin is notified in-app the moment it comes in. `justixxchiobi@gmail.com` is wired in as the configured office address (`CARE_REQUEST_NOTIFY_EMAIL`), stored on each request.
- **No real e-mail sending yet, and that's deliberate.** Real SMTP needs a new dependency (Nodemailer) or a third-party API - both need a decision under this project's "no new dependency without asking" rule. Full honest account, and the two ways forward, in `docs/CARE_REQUESTS.md`.
- New permission `care_requests.manage` (ADMIN, SUPER_ADMIN) - 39 total. New `/care-requests` admin screen: list, Mark contacted, Close. New notification kind `care_request_received`.
- A hidden honeypot field (`companyWebsite`) on the public form: filled in, the submission looks like success but nothing is written. Documented as a lightweight, honest filter, not a real defense.
- **Audit log pagination.** It used to hard-cut at 200 rows with no way to see older entries. `src/lib/audit/log.ts` gained `skip` and `countAuditLog`; `src/lib/audit-log.ts`'s `listAuditLog` now returns a page (entries, page, pageCount, total); `/audit-log` has Newer/Older buttons that keep whatever filters are set. Two new audit actions in the filter dropdown for care requests, plus `care_request_contacted`/`care_request_closed`.
- New `src/lib/care-request-constants.ts`, `src/lib/care-requests.ts`, `src/lib/care-requests-actions.ts`, `src/app/(app)/care-requests/`. `src/components/marketing/request-care-form.tsx` rewritten to call the real Server Action instead of a fake timeout.
- New `scripts/verify-care-requests.ts` (`npm run verify:care-requests`, 31 checks). One migration this round: `add_care_requests`. No new dependency.

## Round G0 - real accounts: staff, family and linking a patient

Date: 25 September 2026

- Round F0 is confirmed: the "Who can see my care" click-through (record, withdraw, record again) passed, and after the push and Vercel's redeploy `compassionate-care-plus.vercel.app/sign-in` shows the calm screen and `/design-system` is not found.
- **A real "create account" flow (NEXT_STEP.md item a).** One form on `/staff`: a staff account with a chosen role, a family (AUTHORIZED_FAMILY) account, or linking an existing patient record (one with no account yet) to a new sign-in. No feature depends on the seed script's demo accounts any more.
- No new permission: creating any of the three still requires `staff.manage`, same as the read-only staff directory. New `src/lib/accounts.ts`, `src/lib/account-constants.ts`, `src/lib/accounts-actions.ts`, `src/app/(app)/staff/create-account-form.tsx`. `src/app/(app)/staff/page.tsx` now shows the form above the directory.
- SUPER_ADMIN and REFERRAL_PARTNER cannot be assigned from this form. The office sets the first password directly and tells the person - there is still no e-mail service configured (see the Request care decision below).
- Linking a patient locks the patient's row inside a transaction, the same shape `createConsent` already uses, so two submissions for the same person cannot both win. A made-up patient id and an already-linked patient get the same words.
- New `scripts/verify-accounts.ts` (`npm run verify:accounts`, 46 checks). The nine older scripts are unchanged and pass with the same numbers (`verify:access` 668, `verify:shell` 81, `verify:notes` 93, `verify:tasks` 40, `verify:notifications` 44, `verify:caregiver` 75, `verify:portal` 53, `verify:family` 156, `verify:sharing` 40).
- No migration. No new dependency. See `docs/ACCOUNTS.md`.

## Round F0 - ready to show: portal-closed screen, "Who can see my care", safety guards

Date: 24 September 2026

- The family portal (E5 round 3) is confirmed on the owner's machine (the four click-through checks passed) and is on GitHub.
- **Why the live site failed.** The Vercel site has no database (the demo database lives on the owner's laptop, and `.env` is never uploaded), so `/sign-in`, which reads the sessions table, crashed with a raw "This page couldn't load". See `docs/DEPLOYMENT.md`.
- **Fix (option 1, free):** `/sign-in` now shows a calm "The secure portal is not open here yet" screen (`src/components/app/portal-closed.tsx`) when there is no database address, or the database cannot be reached, or its tables do not exist. Any other error is still thrown and logged. It only chooses which screen to draw; it never lets anyone in. New `src/lib/app/portal-availability.ts`. A visitor who opens `/dashboard` and the rest is sent to `/sign-in` and sees the same screen.
- **`/design-system` is a "page not found" in a production build** (still visible with `npm run dev`). Closes REVIEW_MILESTONE_D item 13.
- **The seed refuses to run unless `DATABASE_URL` points at this machine** (it creates demo accounts with a known password). Closes item 12.
- **"Who can see my care" panel** on `/my-care` (item e): the patient sees which family members they have shared with, how they are related, which parts, and until when. Read only (the office still records and withdraws). New `src/lib/patient-sharing.ts` (portal.read AND ownership, no patient id taken), `src/components/app/sharing-panel.tsx`. `src/lib/patient-portal.ts` now exports `PORTAL_STATUSES` (no behaviour change).
- New `scripts/verify-sharing.ts` (`npm run verify:sharing`, 40 checks). The eight older scripts are unchanged and pass with the same numbers.
- No migration. No new permission (38). No new dependency.

## Milestone E5 round 3 - the family portal and consent gating

Date: 24 September 2026

- E5 round 2 (the patient portal) is confirmed on the owner's machine and pushed (commit af6d273).
- Two new permissions (38 in total): `family.read` (see what patients have chosen to share with me; held by AUTHORIZED_FAMILY and SUPER_ADMIN) and `consents.manage` (record, list and withdraw consents; held by ADMIN and SUPER_ADMIN). AUTHORIZED_FAMILY now holds exactly `family.read`. See `docs/FAMILY_PORTAL.md`.
- New table `family_consents` (`FamilyConsent`): patient, family account, relationship, shared parts (`visits`, `care_team`, `care_plan`), who recorded it, end date, who withdrew it. Written once, never edited, never deleted.
- New screen `/family` ("Shared with me"): per patient, only the parts the consent names; a part that is not shared says so plainly. A consent that is withdrawn, run out, for a discharged patient, or from another organization shows nothing.
- New screen `/consents` ("Family access", Office group): record a permission (the office must confirm the patient's signed permission), list permissions in force, withdraw. Rules: one consent per person and patient, at most 10 per patient, inside a transaction that locks the patient row; the family account must be a family account of this organization and not the patient's own; refusals give the same words and are audited.
- New files: `src/lib/family-constants.ts`, `src/lib/family-portal.ts`, `src/lib/family-consents.ts`, `src/lib/family-consents-actions.ts`, `src/lib/patient-view.ts`, `src/components/app/care-view.tsx`, `src/app/(app)/family/page.tsx`, `src/app/(app)/consents/page.tsx`, `src/app/(app)/consents/consent-form.tsx`, `src/app/(app)/consents/revoke-consent-button.tsx`, `scripts/verify-family.ts` (`npm run verify:family`, 156 checks).
- The patient portal now loads its visits, team and plan from `src/lib/patient-view.ts` (shared with the family portal) and draws them with `care-view.tsx`. Behaviour is unchanged (`verify:portal` still 53).
- Dashboard tile "Visits coming up" for a family member someone has shared with. Menu items "Shared with me" (`family.read`) and "Family access" (`consents.manage`).
- New audit actions: `family_consent_recorded`, `family_consent_withdrawn`.
- Seed: the two permissions, the AUTHORIZED_FAMILY set, `consents.manage` for ADMIN, `demo.family@cheliv.test` (Claire Whitfield) and one consent from Eleanor (visit schedule and care team, not the care plan).
- `verify:access` (668), `verify:shell` (81) and `verify:portal` (53) updated: AUTHORIZED_FAMILY is no longer the "holds nothing" account.
- Tested in the build environment against a real Postgres: all eight verify scripts pass, tsc, eslint and next build clean, pages rendered as five accounts, nineteen rules broken on purpose and each caught.
- Migration to run: `add_family_consents`.

## Milestone E5 round 2 - the patient portal

Date: 24 September 2026

- New permission `portal.read` (36 in total): see MY OWN next visits, care team and active care plan. PATIENT holds exactly that (SUPER_ADMIN holds it too and sees "not connected"). See `docs/PATIENT_PORTAL.md`.
- New screen `/my-care` ("My care"): upcoming visits, the active care team, the ACTIVE care plan with goals, up to five recent completed visits. Read only. Never notes, tasks, documents, referrals, drafts or other patients.
- One schema change: `Patient.userId` (optional, unique). One account per patient, one patient per account. Nothing can set it from a screen yet (the seed does it for the demo).
- Seed: `demo.patient@cheliv.test` linked to Eleanor Whitfield, plus two visits ahead for her.
- New `scripts/verify-portal.ts` (`npm run verify:portal`, 53 checks).
- Migration: `add_patient_account_link`.

## Milestone E5 round 1 - the caregiver portal

Date: 24 September 2026

- E3 round 2 (note addenda) and E4 round 2 (notifications) are confirmed on the owner's machine (click-through done 24 September 2026).
- New permission `visits.checkin` (35 in total): see my own visits for today and check in and out. CAREGIVER now holds exactly `visits.checkin` and `tasks.read`. SUPER_ADMIN holds it too (it holds every permission). See `docs/CAREGIVER_PORTAL.md`.
- New screen `/caregiver` ("My day", phone first): own visits for today, big Check in and Check out buttons, a checklist of open tasks with Mark done. A visit still checked in from an earlier day is shown so it can be closed.
- Rules: permission, reach (active care team assignment right now) and ownership (assigned to me, even for an administrator). Check in only on the visit's own office day. One place at a time, decided inside a transaction that locks the caregiver's own row. Cancel and mark missed are refused to a caregiver. Refusals give the same words and are audited.
- New files: `src/lib/caregiver.ts`, `src/lib/caregiver-actions.ts`, `src/app/(app)/caregiver/page.tsx`, `src/app/(app)/caregiver/caregiver-controls.tsx`, `scripts/verify-caregiver.ts` (`npm run verify:caregiver`, 75 checks).
- Menu item "My day" (holders of `visits.checkin`). Dashboard tile "My visits today" for a caregiver. The caregiver's dashboard sentence is now a real sentence.
- Seed: the permission, the CAREGIVER set, and `demo.caregiver@cheliv.test` on Eleanor Whitfield's care team with three visits today and two checklist tasks (created only when she has none for today).
- `changeTaskStatusAction` also refreshes `/caregiver`.
- `verify:access` (663), `verify:shell` (68) and `verify:tasks` (40) updated: CAREGIVER is no longer the "holds nothing" account (`verify:tasks` uses PATIENT now).
- No database change. No migration.

## Milestone E3 round 2 and E4 round 2 - note addenda and notifications

Date: 23 September 2026

- New: note addenda. A reviewed note is never edited; the visit's own clinician adds a correction, an addition or a late entry under it, and a second person reviews it. New table `visit_note_addenda`. See `docs/VISIT_NOTES.md`, section "Addenda".
- New: notifications. A bell with an unread count in the app shell, a page `/notifications`, and notices for task assigned, finished, cancelled, and for a note or addendum reviewed. New table `notifications`. No patient names or titles in a notice. See `docs/NOTIFICATIONS.md`.
- `/visits` review list now also shows addenda waiting for review, marked "Addendum", oldest first.
- New audit actions: `visit_note_addendum_added`, `visit_note_addendum_reviewed`.
- `scripts/verify-notes.ts` grew from 39 to 93 checks. New `scripts/verify-notifications.ts` (`npm run verify:notifications`, 44 checks).
- The documents page file is the correct Documents page again (GitHub commit 25b28d4 had the Sharing page in `src/app/(app)/documents/page.tsx` by mistake).
- Migration to run: `add_addenda_and_notifications`.

## Milestone E3 round 2 and E4 round 1 - note verification and tasks

Date: 23 September 2026

- E3 round 1 is now verified against a real database. New `scripts/verify-notes.ts` (`npm run verify:notes`, 39 checks) covers starting, editing, locking, submitting, four-eyes review, reach, worklists and the audit log. Four rules were deliberately broken one at a time and the script failed each time.
- Fixed a stale expectation in `scripts/verify-access.ts`: the supervisor permission list did not yet include `visits.review`, so `verify:access` would have shown one failure. It now expects the agreed set.
- New: tasks. `Task` model (migration `add_tasks`), `src/lib/tasks.ts`, `src/lib/task-constants.ts`, `src/lib/tasks-actions.ts`, page `/tasks`, menu item "Tasks". See `docs/TASKS.md`.
- Permissions: NURSE, CARE_COORDINATOR and CLINICAL_SUPERVISOR now hold `tasks.manage` (coordinator and supervisor also `tasks.read`).
- New audit actions: `task_created`, `task_completed`, `task_cancelled`.
- `scripts/verify-access.ts` and `scripts/verify-shell.ts` expectations updated for the new permissions and menu item. New `scripts/verify-tasks.ts` (`npm run verify:tasks`, 40 checks).
- Migration to run: `add_tasks`.

## Milestone E3 - clinical portal, round 1: visit notes

Date: 23 September 2026

- The first real clinical-portal slice: a visit note, one per visit, written by the visit's own assigned clinician, submitted, then reviewed by someone else. New table `visit_notes` (migration `add_visit_notes`), new files `src/lib/visit-notes.ts`, `src/lib/visit-note-constants.ts`, `src/lib/visit-notes-actions.ts`. See `docs/VISIT_NOTES.md`.
- New page `/visits/[id]` - a visit's detail plus its note. `/visits` list now links each visit's date/time there, and gained two worklists shown only when non-empty: "Needs your documentation" and "Notes waiting on review".
- `visits.document` and `visits.review` existed in the permission seed since 19 September but were never assigned to a role. NURSE already held `visits.document`; ADMIN and CLINICAL_SUPERVISOR now hold `visits.review` (`prisma/seed.ts`).
- New audit actions: `visit_note_created`, `visit_note_updated`, `visit_note_submitted`, `visit_note_reviewed`.
- Migration to run: `add_visit_notes`.

## Milestone E1 - internal app shell, dashboards, sharing restricted documents, site photos

Date: 21 September 2026

- The signed-in staff frame: route group `src/app/(app)/`, one shared layout (sidebar, phone menu, skip link), menu decided on the server from real permissions, loading, error and not-found screens. The dashboard and the five proof pages moved inside it and were restyled with shared components. Every page still checks who is asking by itself. See `docs/APP_SHELL.md`.
- A real dashboard per permission: needs-attention list, tiles, today's visits, referrals waiting with waiting time, patients without a primary nurse, plans to approve, recent activity.
- New `scripts/verify-shell.ts` (`npm run verify:shell`, 62 checks, read-only).
- `scripts/check-root-layout.mjs` now checks all three layouts and the duplicate screen folders.
- Sharing restricted documents (owner's decision): SUPER_ADMIN and ADMIN see insurance and ID documents by default; a clinical supervisor no longer does. An administrator can share them with one person, for one patient or one document, for 7 days, 30 days or until taken back. New table `document_access_grants` (migration `add_document_access_grants`), new permission `documents.grant` (34 permissions), new screen `/documents/sharing`, new files `src/lib/document-grants.ts`, `src/lib/document-grants-actions.ts`. `npm run verify:access` is 661 checks (108 new).
- Public site photos from Unsplash in one file, `src/lib/site-images.ts`, drawn by `SiteImage`: homepage hero and "Who we serve", About, Who we serve page. The old Pexels photo on About is gone. See `docs/IMAGES.md`.
- Migration to run: `add_document_access_grants`. Folders to delete: six (see `docs/APP_SHELL.md`).

## Milestone E0 - shared helpers, care teams, and the two office roles
**21 September 2026**

Added
- src/lib/auth/actor.ts - loadActor, auditDenied and auditAllowed, once, for every service
- src/lib/care-team.ts, src/lib/care-team-constants.ts - listCareTeam, listPatientsNeedingTeam, getAssignmentOptions, assignToCareTeam, endCareTeamAssignment. No schema change, so NO migration this round.
- Permissions care_team.read and care_team.manage (33 permissions now)
- Demo accounts demo.coordinator@cheliv.test and demo.supervisor@cheliv.test
- docs/CARE_TEAMS.md

Changed
- src/lib/visits.ts, care-plans.ts, documents.ts, referrals.ts - the four private copies of loadActor, auditDenied and auditAllowed removed; they import the shared file
- prisma/seed.ts - CARE_COORDINATOR and CLINICAL_SUPERVISOR now hold real permission sets, ADMIN holds the care team permissions. The seed only ever adds permissions, never removes.
- scripts/verify-access.ts - section 0 (no file may carry its own copy of the helpers), sections 13a to 15c, a second temporary organization, a rewritten cleanup. The old "manager" test account now uses the clinical supervisor role as its base (the coordinator role really holds patients.create now). 553 checks.
- docs: RBAC, AUDIT_LOGGING, FOLDER_STRUCTURE, PHASE_STATUS, NEXT_STEP, PROJECT_HANDOFF, CONTINUATION_PROMPT, DEMO_ACCOUNTS

Decisions taken on my recommendations, because the three Milestone E questions were not answered: Care Command Center first, the permission sets above, the public request-care form later. Also decided by me: CARE_COORDINATOR holds patients.create (not in the reviewed list, needed to accept a referral about someone new) and nurses hold no care team permission.

Verified in the build environment (real Postgres, real generated Prisma client)
- tsc --noEmit clean, eslint clean, `next build` succeeds
- verify:access: 553 passed, 0 failed, database left clean. Fifteen runs in a row were clean after a race in the primary nurse check was fixed with a retry. Eighteen rules broken on purpose, one at a time (14 in the code, 4 in the database permission sets): the script failed on each one. One check was too weak (a worklist reach check that could not fail); it was rewritten and then caught its break.
- Not run here: a real browser (there are no screens for this yet)
- Not confirmed: the exact error name the real Prisma engine gives for two changes colliding. The retry accepts both known forms. `verify:access` on your machine exercises it.

## Referrals - fifth and last slice of Milestone D
**20 September 2026**

Added
- prisma/schema.prisma - Referral model (new migration required: add_referrals). No new permission: referrals.read and referrals.manage already existed.
- src/lib/referrals.ts - listReferrals, canRecordReferrals, createReferral, updateReferral, changeReferralStatus: every referral rule in one file
- src/lib/referral-constants.ts - sources, urgencies, statuses, the REFERRAL_TRANSITIONS state machine, limits
- src/lib/referrals-actions.ts - thin server actions for create, update and status change
- src/app/referrals/ - page.tsx, create-referral-form.tsx, referral-controls.tsx, referral-fields.tsx
- docs/REFERRALS.md, docs/REVIEW_MILESTONE_D.md

Changed
- src/lib/time.ts - parseCalendarDate and formatCalendarDate for dates of birth (a day, not a moment)
- prisma/seed.ts - NURSE now holds referrals.read; six synthetic referrals (three accepted and linked to Eleanor, Marcus and Priya; Walter Brennan in review, Grace Holloway received, Tomas Reyes declined), created only when none exist
- scripts/verify-access.ts - new sections 2d and 12a to 12i, cleanup extended to referrals, patients created by accepting, and a temporary role. 407 checks now.
- src/app/dashboard/page.tsx - "View referrals" link, shown only to accounts holding referrals.read
- docs: RBAC, AUDIT_LOGGING, DATABASE, FOLDER_STRUCTURE, DEMO_ACCOUNTS, PHASE_STATUS, NEXT_STEP, PROJECT_HANDOFF, CONTINUATION_PROMPT

Verified in the build environment (real Postgres, real generated Prisma client)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/referrals is dynamic)
- verify:access: 407 passed, 0 failed, database left clean. With thirteen rules deliberately broken one at a time in a copy it failed on those rules each time.
- Real HTTP against the built app with real sessions: /referrals as admin (all six with office details), nurse one (only Eleanor's, no office details, no other person's name) and nurse two (only Marcus's); signed out is redirected to sign in
- The create, edit and status-change server actions and the document upload action were called over real HTTP with React's own request encoder (the exact body a browser sends). Recording, the duplicate refusal, the impossible birth date refusal, editing and starting a review worked as the admin; the nurse was refused every time and nothing was saved; a signed-out call was refused. The upload action accepted a small real PDF and refused a repeat, a text file renamed .pdf, a 2.5 MB file (past the 2 MB rule but under the 3 MB request cap), no file, a patient off the nurse's team and a restricted category for the nurse.
- Still NOT tested: clicking the forms in a real browser (no browser in the build environment)

## Documents - fourth slice of Milestone D
**19 September 2026**

Added
- prisma/schema.prisma - Document and DocumentFile models (new migration required: add_documents). No new permission: documents.read, documents.upload and documents.delete already existed.
- src/lib/documents.ts - listDocuments, getDocumentUploadOptions, uploadDocument, getDocumentForDownload, archiveDocument: every document rule in one file
- src/lib/document-constants.ts - categories and which are restricted (unknown categories fail closed), size limits, file type detection from the file's own bytes, file name cleaning
- src/lib/documents-actions.ts - thin server actions for upload and archive
- src/app/documents/ - page.tsx, upload-document-form.tsx, archive-button.tsx, and [id]/download/route.ts (the only door the file bytes leave through)
- prisma/demo-pdf.ts - builds small real PDFs by hand, no new dependency
- docs/DOCUMENTS.md

Changed
- prisma/seed.ts - five synthetic documents (Eleanor: consent, physician order, insurance card; Marcus: consent, photo ID), created only when none exist. The insurance card and the photo ID are in restricted categories.
- scripts/verify-access.ts - new sections 2c and 11a to 11f, cleanup extended to documents. 254 checks now.
- next.config.ts - Server Action request limit raised from 1 MB to 3 MB so a 2 MB document can be uploaded
- src/app/dashboard/page.tsx - "View documents" link, shown only to accounts holding documents.read
- docs: RBAC, AUDIT_LOGGING, DATABASE, FOLDER_STRUCTURE, DEMO_ACCOUNTS, PHASE_STATUS, NEXT_STEP, PROJECT_HANDOFF, CONTINUATION_PROMPT

Verified in the build environment (real Postgres, real generated Prisma client)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/documents and /documents/[id]/download are dynamic)
- verify:access: 254 passed, 0 failed. With eight rules deliberately broken one at a time (list filter, category rule everywhere, category check on download, file type from bytes, download audit, archived still downloadable, relationship check on download, duplicate check) it failed on those rules each time, and the database was left clean.
- Real HTTP against the built app with real sessions: admin downloaded all five documents; nurse one got only Eleanor's consent and order; nurse two only Marcus's consent; the insurance card, the photo ID, another patient's document and a made-up id all returned the same 404 with the same words to a nurse; signed out gets 401; headers include attachment, nosniff and no-store; a downloaded file is a valid PDF
- Root layout and homepage name-checked (see NEXT_STEP)
- NOT tested end to end: the upload form's server action over real HTTP (no browser in the build environment). The upload rules underneath it are fully tested.

## Care plans - third slice of Milestone D
**19 September 2026**

Added
- prisma/schema.prisma - CarePlan and CarePlanGoal models (new migration required: add_care_plans)
- src/lib/care-plans.ts - listCarePlans, getPlanCreateOptions, createCarePlan, updateCarePlan, addGoal, removeGoal, markGoalMet, changePlanStatus: every care plan rule in one file
- src/lib/care-plan-constants.ts - statuses, the transition table, size limits
- src/lib/care-plans-actions.ts - thin server actions, identity from the session only
- src/app/care-plans/page.tsx, create-plan-form.tsx, plan-controls.tsx - bare proof page
- docs/CARE_PLANS.md

Changed
- src/lib/patients.ts - added isActiveCareTeamMember(), the "on this patient's team right now" test, built on the same activeAssignmentFilter. Nothing that existed was changed.
- prisma/seed.ts - new permission care_plans.create (31 permissions now), NURSE now holds care_plans.create and care_plans.update, two synthetic care plans (Eleanor active, Marcus draft) created only when none exist
- scripts/verify-access.ts - new sections 2b and 10a to 10i, cleanup extended to care plans. About 175 checks now.
- src/app/dashboard/page.tsx - "View care plans" link, shown only to accounts holding care_plans.read
- src/app/layout.tsx - added suppressHydrationWarning to <body> so browser extensions (Grammarly, ColorZilla) that add attributes to the page no longer raise a development warning. The html, body and globals.css import are all still there and the root layout guard passes.
- docs: RBAC, AUDIT_LOGGING, DATABASE, FOLDER_STRUCTURE, TROUBLESHOOTING, DEMO_ACCOUNTS, PHASE_STATUS, NEXT_STEP, PROJECT_HANDOFF, CONTINUATION_PROMPT
- Em dashes removed from the docs (standing rule: none anywhere)

Removed
- src/components/marketing/coming-soon-page.tsx - unused since every stub page got real content, and it still contained "This page is a placeholder" wording

Verified in the build environment (real Postgres, real generated Prisma client)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/care-plans is dynamic)
- verify:access: 175 passed, 0 failed. With five rules deliberately broken (four-eyes, team requirement on create, locked wording, relationship check, one active plan) it failed on exactly those rules each time, and the database was left clean.
- The rendered /care-plans page fetched with real sessions: admin sees both plans with Approve/Discard on Marcus's draft and Complete on Eleanor's plan, no edit boxes; nurse one sees only Eleanor's plan; nurse two sees only Marcus's draft with edit controls and no Approve; signed-out is redirected to /sign-in
- Root layout and homepage name-checked: src/app/layout.tsx has html, body and the globals.css import; src/app/(public)/page.tsx is the real cinematic homepage and differs from about/page.tsx

## Visits - second slice of Milestone D
**19 September 2026**

Added
- prisma/schema.prisma - Visit model (new migration required: add_visits)
- src/lib/visits.ts - listVisits, getSchedulingOptions, scheduleVisit, changeVisitStatus: every visit rule in one file
- src/lib/visit-constants.ts - visit types, statuses, the status transition table
- src/lib/visits-actions.ts - thin server actions, identity from the session only
- src/lib/time.ts - office time (America/Chicago) helpers, daylight-saving safe, no date library
- src/app/visits/page.tsx, schedule-visit-form.tsx, visit-actions.tsx - bare proof page with a scheduling form and status buttons
- scripts/verify-access.ts and scripts/stubs/server-only.ts, tsconfig.scripts.json - `npm run verify:access`, about 70 checks that try to break the access rules against a real local database, then clean up
- docs/VISITS.md, docs/CONTINUATION_PROMPT.md

Changed
- src/lib/patients.ts - the relationship rule is now shared: getPatientScope(), scopeAllowsPatient(), canAccessPatient(), activeAssignmentFilter(). getAccessiblePatients() behaves exactly as before (re-verified: admin sees 3, nurse sees 1)
- prisma/seed.ts - added demo.nurse2@cheliv.test (assigned to Marcus Delgado) and 6 synthetic visits, created only when no visits exist yet
- src/app/dashboard/page.tsx - "View visits" link, shown only to accounts holding visits.read
- package.json - added the verify:access script
- docs/PATIENTS.md, RBAC.md, AUDIT_LOGGING.md, DATABASE.md, TROUBLESHOOTING.md - short additions
- docs/DEMO_ACCOUNTS.md - restored the missing admin section, added nurse two

Verified in the build environment (a real Postgres and a real generated Prisma client this time, not a stub)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/visits is dynamic)
- verify:access: 69 passed, 0 failed; with two rules deliberately broken it failed on exactly those rules
- The rendered /visits page, fetched with real sessions: admin sees all 6 visits, nurse one sees only Eleanor's 4, nurse two sees only Marcus's 2, signed-out is redirected to /sign-in

## Patients and relationship-based access
**17 September 2026**

Added
- prisma/schema.prisma - Patient, CareTeamMember models (new migration required)
- src/lib/patients.ts - getAccessiblePatients(), real relationship-based access logic
- src/app/patients/page.tsx
- docs/PATIENTS.md

Changed
- prisma/seed.ts - added demo.nurse@cheliv.test, three synthetic demo patients, one care-team assignment, real permission sets for ADMIN and NURSE roles
- src/app/dashboard/page.tsx - added a link to /patients
- docs/DEMO_ACCOUNTS.md - documents both demo accounts now

Milestone D has started. First slice (patients + care team) complete.

## Audit logging - Milestone C complete
**17 September 2026**

Added
- prisma/schema.prisma - AuditLog model (new migration required)
- src/lib/audit/log.ts - writeAuditLog, getRecentAuditLog
- docs/AUDIT_LOGGING.md

Changed
- src/lib/auth/actions.ts - logs sign_in, sign_in_failed, sign_out
- src/lib/auth/authorize.ts - requirePermission() logs permission_denied automatically
- src/app/dashboard/page.tsx - added Recent activity section, gated behind audit.read

Fixed
- getRecentAuditLog's return type wasn't explicit, causing an implicit-any type error - added an explicit AuditLogEntry interface

Milestone C (database, auth, RBAC, audit logging) is now complete.

## RBAC enforcement layer
**17 September 2026**

Added
- src/lib/auth/authorize.ts - hasPermission, requirePermission, getUserPermissions
- docs/RBAC.md

Changed
- /dashboard now demonstrates real permission checks: shows the signed-in user's full permission list, conditionally renders two demo elements based on actual hasPermission() results

Notes
- NEXT_STEP.md and PHASE_STATUS.md were out of date (predated the homepage rebuild and full auth flow) - both rewritten to match actual current state

## Real logo, icon system, fuller header/footer, first database schema
**16 September 2026**

Added
- Original logo mark (logo-mark.tsx) - no official Cheliv logo exists online
- lucide-react icon system: services, contact page, footer
- Full sectioned dark footer, compact redesigned header
- Prisma schema (organizations, users, sessions, roles, permissions) and seed script
- docs/DATABASE.md, docs/DEMO_ACCOUNTS.md (git-ignored)

Fixed
- Homepage services list de-duplicated to pull from the single services-data.ts source
- npm arborist bug during Prisma install (clean reinstall)
- Prisma pinned to 6.19.3 after newer versions pulled in unrelated vulnerable dependencies; deepmerge-ts override closes the remaining one - npm audit now clean

Confirmed via official Texas HHSC / Medicare.gov-sourced directory listings
- Cheliv is a real, already-licensed, operating home health (clinical) agency, license #017743
- Service scope confirmed as clinical home health, not non-medical home care only

Still open
- Phone number discrepancy: site shows (281) 903-7551, official listings show (281) 565-3336

## Guard script for the recurring layout bug, real photography
**16 September 2026**

Added
- `scripts/check-root-layout.mjs` - automated check that runs before every `npm run dev` and `npm run build`, catching the root layout bug that has broken the site three times, before Next.js even starts
- Real, free, Pexels-licensed photography wired into the homepage hero, homepage "who we serve" section, and About page
- `docs/IMAGES.md` rewritten to document exactly what's live and how to replace it with real photos later
- `next.config.ts` now allows `images.pexels.com` for a future switch to `next/image`

Fixed
- The root layout bug, again, this time with a permanent automated safeguard rather than a one-time manual fix

## Rebrand, placeholder removal, cinematic overhaul
**15 September 2026**

Changed
- Brand name updated to "Cheliv Compassionate Care Plus" everywhere, driven from one shared constant
- Removed all em dashes from visible copy (bullet markers and mid sentence punctuation)
- Removed the development banner and every "to be confirmed" / "illustrative" label
- How We Care, Who We Serve, Resources and Sign In rewritten from build-phase stubs into real pages
- Homepage, About, Contact, Services rebuilt with a cinematic dark hero treatment, bold clamp() based type scale, and an animated gradient backdrop (AuroraField)
- Added a bold "by the numbers" stat band to the homepage itself

Removed
- `development-banner.tsx` and `coming-soon-page.tsx` (no longer needed)

Kept, intentionally
- The four footer legal links still lead nowhere real, since writing actual legal text is a genuine liability regardless of the rest of the site's tone

## Phase 7 - Real request-care form
**15 September 2026**

Added
- `src/components/marketing/request-care-form.tsx` - real client-side form: name, email, phone, relationship, preferred contact method, service interest, best time, optional message
- Real `/request-care` page with the real office phone as an urgent-need fallback

Notes
- Confirmed via the project owner's uncle's own Facebook profile that the real legal name is "Cheliv Compassionate Care Plus INC" - a site-wide rename decision is pending
- Form has no backend to submit to yet (Milestone C not built) - documented clearly rather than faked

## Root layout fix, real content, motion system
**15 September 2026**

Fixed
- `src/app/layout.tsx` had been overwritten with duplicate `(public)/layout.tsx` content - missing html/body/metadata/CSS import. This caused both a local runtime error and a completely unstyled Vercel deployment. Restored correct content.

Added
- Motion system: scroll-reveal (`Reveal`), animated stat count-up (`StatCounter`), hero entrance animation, sticky header with scroll shadow - all respecting prefers-reduced-motion, with a noscript fallback for reveal content
- Real confirmed content: office address, phone, and About page stats (previously placeholders, now confirmed real by the project owner)

## Phase 6 - About and contact content
**15 September 2026**

Added
- Real `/about` page - "treat, then teach" positioning, beliefs list, stats bar (placeholder values), mission statement
- Real `/contact` page - placeholder address, phone/fax, example office hours

Notes
- Structure and copy style informed by a mock site built while learning (Cheliv Compassionate Care Plus) - specific facts (address, phone, stats) kept as placeholders pending confirmation they belong to this organization

## Phase 5 - Public service pages
**15 September 2026**

Added
- `src/lib/services-data.ts` - single source of truth for all service content
- Real `/services` index page (replacing the placeholder stub)
- `/services/[slug]` dynamic detail pages, statically generated per service

Fixed
- Documented and instructed removal of a leftover `src/app/page.tsx` that a prior ZIP delivery didn't clean up on the user's machine, which was causing the old Phase 2 placeholder to display instead of the real homepage

## Phases 3 & 4 - Public website foundation and homepage
**15 September 2026**

Added
- Public site layout: header (desktop + mobile nav), footer, persistent development banner
- Original SVG hero illustration - no stock photography
- Real homepage: hero, "how we care" process, services overview, who-we-serve, request-care CTA, FAQ accordion
- Placeholder pages for About, Services, Who We Serve, How We Care, Resources, Contact, Request Care, Sign In - so no nav link 404s
- `buttonVariants()` helper so links can look like buttons without invalid nested-button HTML
- `docs/PUBLIC_WEBSITE.md`

Changed
- Removed the old root `page.tsx` - homepage now lives inside the `(public)` route group

# CHANGELOG

## Phase 2 - Design system
**15 September 2026**

Added
- `src/styles/tokens.css` - color, type scale, spacing, radius and shadow tokens
- Self-hosted fonts: Source Serif 4 (display) and IBM Plex Sans (body/UI), via @fontsource - no runtime request to Google Fonts
- First five components: Button, Input, Label, Card, Badge
- `cn()` utility for merging Tailwind classes (clsx + tailwind-merge)
- `/design-system` reference page showing every token and component rendered
- `docs/DESIGN_SYSTEM.md`

Changed
- `globals.css` rewritten to wire tokens into Tailwind's theme
- Homepage updated to use real tokens instead of Phase 1 placeholder grays

## Phase 1 - Project initialization
**15 September 2026**

Added
- Next.js 16.3.5 project with React 19, TypeScript (strict) and Tailwind CSS 4
- Placeholder homepage at `/` stating clearly that no content is confirmed yet
- Root layout with project metadata and `robots: noindex` for the development build
- `prefers-reduced-motion` support in global styles, from the first commit
- `.env.example` template and documentation of every planned variable
- Documentation set: README, ULTRA_BABY_STEPS, PHASE_0_ARCHITECTURE, ENVIRONMENT_VARIABLES, FOLDER_STRUCTURE, TROUBLESHOOTING, NEXT_STEP, PHASE_STATUS

Changed
- Replaced the generator's default demo page and default dark-mode styles
- Extended `.gitignore` so `.env.example` is committed while all other env files are blocked

Removed
- Generator extras `AGENTS.md` and `CLAUDE.md`

## Phase 0 - Architecture
**15 September 2026**

- Planned the whole platform: roles, feature tiers, sitemaps, database, RBAC, security, design direction, cloud, phases, risks
- Reordered the build so database, authentication and API come before the portals
