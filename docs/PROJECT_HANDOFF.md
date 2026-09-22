# CHELIV COMPASSIONATE CARE PLUS - PROJECT CONTINUATION BRIEF
## Complete state as of 21 September 2026, written to continue this build perfectly in a new conversation

Paste this whole document as the first message in a new conversation. It replaces the previous docs/PROJECT_HANDOFF.md, which was accurate up through visits but is now out of date (referrals were added on 20 September 2026, which finished Milestone D).

---

## 0. Read this part first

**Who this is for.** A real, already-licensed, currently-operating home health agency in Stafford, Texas. Being built by the owner's nephew, as a surprise, the owner does not know this is being built for him. The owner's name is Charles Obioma; the person building it goes by J.

**Repo:** https://github.com/Justixxprime/compassionate-care-plus.git, public. No real secrets are committed (.env stays git-ignored), but it now holds real login mechanics, real sessions, and an audit trail, even in demo form. Worth reconsidering making it private.

**Local path:** C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus, kept in OneDrive despite sync risk (his choice, flagged once, not revisited).

**Deployed:** compassionate-care-plus.vercel.app, auto-deploys from main.

**A file-integrity lesson that must not be relearned.** src/app/layout.tsx (the ROOT layout, needs html, body, import "./globals.css") and src/app/(public)/layout.tsx (the PUBLIC SITE layout, header/footer wrapper, must NOT have html/body) share the filename layout.tsx and have been repeatedly confused across VS Code tabs, causing a "Missing html and body tags" runtime error or a totally unstyled deployed site, three or four separate times. This is now guarded against automatically, see section 8. Before ever delivering a file again, confirm directly, by name, that src/app/layout.tsx and src/app/(public)/page.tsx are correct in whatever is being shipped. Don't just trust the general process; say so explicitly every time.

**Working across several Claude accounts.** J builds this project across two or more Claude accounts and returns to earlier ones. So: (a) every reply ends with a fresh, self-contained continuation prompt he can paste into another account (the current one is always in docs/CONTINUATION_PROMPT.md); (b) when picking up from an upload, read EVERY code file and EVERY .md file top to end, clone the GitHub repo, and find the exact stopping point before building; (c) explain non-coding things in ultra-simple language.

**Privacy note, flagged once.** The repo is public, and this very file names the owner, his city, and says the site is a surprise for him. Anyone who finds the repo could read that. J's decision whether to make the repo private or trim this file.

---

## 1. Confirmed real facts, safe to use, not placeholders

| Fact | Value |
|---|---|
| Legal name | Cheliv Compassionate Care Plus Inc |
| Brand display | "Cheliv" primary, "Compassionate Care Plus" subtitle |
| Address | 4434 Blue Bonnet Dr, Suite 151, Stafford, TX 77477 |
| Phone (as shown on site) | (281) 903-7551, J confirmed keeping this as-is, will change it himself later. Do not raise this again. |
| Service scope | Confirmed clinical home health (skilled nursing, PT, OT, ST, wound care, medication management), not non-medical home care only |
| Stats (owner-confirmed real) | 10+ counties served, 50+ licensed clinicians, 1,000+ patients/year, 100% home-based recovery focus |
| Owner | Charles Obioma, CEO/Founder/Administrator. Also runs "St. Charles Home health care services Inc." Lives in Houston, TX. |
| License | Texas HHSC license #017743 |

Still genuinely unconfirmed, not urgent: real fax number (none ever evidenced, currently just omitted from the site rather than shown as a placeholder). Real photography of the actual office/team (four Unsplash stock photos are live in the meantime, all named in src/lib/site-images.ts, see docs/IMAGES.md; he does not want to tell the owner yet and will show the site at the last stage).

---

## 2. Standing content and delivery rules, apply every time, no exceptions

1. No em dashes anywhere, not as punctuation, not as list bullets. Checked and enforced across the whole codebase repeatedly; keep enforcing on every new line of copy.
2. No visible "placeholder" / "to be confirmed" / dev-banner framing anywhere on the public site. It must read as a real, finished, professional site, a surprise reveal, not a work-in-progress demo. One deliberate exception: the four footer legal links (privacy policy, terms, accessibility, notice of privacy practices) lead nowhere real and are not flagged either, they just read as normal footer text. Writing real privacy/terms/HIPAA-notice language wrong is a genuine legal liability regardless of how polished everything else is. Never write real legal text without the user explicitly providing it or asking with full awareness of the risk.
3. Very cinematic, bold, premium, "alive," high-tech, big, detailed. Reference point given: Mayo Clinic's site, restrained small logo lockup, huge bold serif headlines, comprehensive multi-section footer. Already built: dark full-bleed hero with an animated CSS gradient backdrop (AuroraField, no video needed), clamp()-based bold responsive type scale, scroll-reveal animations (Reveal), animated stat counters (StatCounter), an original logo mark, lucide-react icons throughout. This is a standing visual bar for every future page, not a one-time request.
4. Every delivery includes a full project zip, not just inline file contents (this superseded an earlier "single consolidated file" preference, the user changed his mind explicitly). Full file contents when shown inline, never diffs or snippets.
5. Always verify before shipping. After packaging any zip: extract it fresh to a separate temp folder and diff every changed file against the actual working files before presenting it. Never skip this. Explicitly name-check src/app/layout.tsx and src/app/(public)/page.tsx every single time, given their history.
6. Check GitHub directly when diagnosing anything uncertain, git clone the real repo (github.com and codeload.github.com are reachable from the sandbox) rather than guessing from terminal output alone.
7. Terminal/git commands go at the end of every delivery, after the files, every time.

---

## 3. Tech stack, with the real reasoning behind each pinned choice

| Layer | Choice | Why pinned this way |
|---|---|---|
| Framework | Next.js 16.3.5, App Router, Turbopack | |
| Language | TypeScript, strict | |
| Styling | Tailwind CSS 4 | |
| Database | PostgreSQL, local install on the user's Windows machine | |
| ORM | Prisma 6.19.3, pinned exactly | Prisma 7.x pulls in an embedded studio UI, a MySQL driver never used, and real vulnerabilities in transitive dependencies (confirmed via npm audit). 6.19.3 is lean and stable. Do not upgrade without re-checking npm audit first. |
| Password hashing | bcryptjs | Chosen over Argon2id (the original architecture doc's pick) specifically because Argon2 needs native compilation, which is fragile on Windows for a beginner without build tools. bcryptjs is pure JS, no native step, still a legitimate, OWASP-acceptable choice. |
| Icons | lucide-react | |
| Fonts | Self-hosted via fontsource, Source Serif 4 display, IBM Plex Sans body | No Google Fonts network dependency at all |
| A package override worth knowing about | deepmerge-ts forced to ^8.0.2 via package.json overrides | Prisma 6.19.3's config loader depends on a vulnerable version; overriding closes it without downgrading Prisma further. npm audit currently reports zero vulnerabilities. |

**Real testing in the sandbox is now possible (learned 19 September 2026).** The sandbox still cannot reach binaries.prisma.sh, so the normal `prisma generate` and `migrate` fail there. But this recipe works, and gives a REAL generated client and a REAL Postgres, far better than the old "lint and tsc only" approach. Do it in a COPY of the project, never in the shipped source:

1. `apt-get install postgresql`; start it with `pg_ctlcluster 16 main start` (it stops between tool calls, so start it inside every command that needs it); set a postgres password and create a scratch database.
2. In the copy: add `engineType = "client"` to the generator block in schema.prisma; `npm i @prisma/adapter-pg@6.19.3 pg@8`; pass `adapter: new PrismaPg({ connectionString })` to `new PrismaClient(...)` in src/lib/prisma.ts and prisma/seed.ts.
3. Create a dummy executable and set `PRISMA_SCHEMA_ENGINE_BINARY` and `PRISMA_QUERY_ENGINE_LIBRARY` to it, plus `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`. Then `npx prisma generate` works.
4. `migrate dev` still cannot run, so apply the migration SQL folders with psql (for a NEW model, hand-write equivalent SQL for the sandbox only; J generates the real migration on his machine with `npx prisma migrate dev --name <name>`, and it is never shipped from the sandbox).
5. `npx next typegen` before `tsc --noEmit` (LayoutProps is generated). `npx next build` then works too.
6. Standalone scripts (like scripts/verify-access.ts) run with `tsx --tsconfig tsconfig.scripts.json`, which stubs the Next-only "server-only" import.
7. To render real pages: insert a row into the sessions table with psql for a demo user, `next start`, and `curl -b "ccp_session=<id>"`.

Also: test the tests. Deliberately break a rule in the copy and confirm verify-access fails on exactly that rule.

---

## 4. Full current file structure

compassionate-care-plus/
- docs/ (23 files, see section 15)
- prisma/
  - schema.prisma (16 models, see section 5)
  - seed.ts (org, 34 permissions, 9 roles with 5 having real permission sets, 5 demo accounts, 3 synthetic patients, 2 care-team assignments, 6 synthetic visits, 2 synthetic care plans, 5 synthetic documents (2 in restricted categories) and 6 synthetic referrals, each set created only if none exist)
- scripts/
  - check-root-layout.mjs (runs automatically via predev/prebuild hooks)
  - verify-access.ts (`npm run verify:access`, 407 checks against a real LOCAL database, refuses to run otherwise)
  - stubs/server-only.ts (lets standalone scripts import server code)
- tsconfig.scripts.json (used only by scripts)
- public/images/ (empty, real photos go here eventually, see docs/IMAGES.md)
- src/app/
  - layout.tsx (ROOT layout, html/body/metadata/globals.css import)
  - globals.css
  - (public)/ route group, no URL segment
    - layout.tsx (header + footer wrapper, NOT html/body)
    - page.tsx (real homepage, cinematic hero, stats band, services, FAQ)
    - about/page.tsx, contact/page.tsx, how-we-care/page.tsx, who-we-serve/page.tsx
    - request-care/page.tsx (real form, not yet wired to send anywhere)
    - resources/page.tsx
    - services/page.tsx (index, pulls from services-data.ts) and services/[slug]/page.tsx (6 real services, generateStaticParams)
  - sign-in/page.tsx and sign-in/sign-in-form.tsx (client component, useActionState + signInAction)
  - dashboard/page.tsx (bare proof page, session, permissions, recent activity)
  - patients/page.tsx (bare proof page, relationship-based access)
  - visits/page.tsx, schedule-visit-form.tsx, visit-actions.tsx (bare proof page: list, schedule form, status buttons)
  - care-plans/page.tsx, create-plan-form.tsx, plan-controls.tsx (bare proof page: plan cards, start form, approve/complete/discard, goal controls)
  - documents/page.tsx, upload-document-form.tsx, archive-button.tsx, [id]/download/route.ts (bare proof page: list, upload form, archive, and the download route, the only door file bytes leave through)
  - referrals/page.tsx, create-referral-form.tsx, referral-controls.tsx, referral-fields.tsx (bare proof page: open and closed referral cards, record form, edit, start review, accept, decline, withdraw)
  - design-system/page.tsx (internal reference, not linked from nav)
- src/components/
  - ui/ Button, Input, Label, Card, Badge
  - marketing/ Header, Footer, LogoMark, AuroraField, HeroIllustration, RequestCareForm, nav-links.ts (brandName lives here)
  - motion/ Reveal, StatCounter
- src/lib/
  - prisma.ts (the shared PrismaClient instance)
  - cn.ts (class-merging utility)
  - services-data.ts (single source of truth for all 6 services)
  - service-icons.tsx (slug to lucide icon mapping)
  - patients.ts (getAccessiblePatients plus the SHARED relationship rule: getPatientScope, scopeAllowsPatient, canAccessPatient, activeAssignmentFilter, and isActiveCareTeamMember for the stricter "on this patient's team" test)
  - visits.ts (listVisits, getSchedulingOptions, scheduleVisit, changeVisitStatus: every visit rule lives here)
  - visit-constants.ts (types, statuses, VISIT_TRANSITIONS state machine)
  - visits-actions.ts (thin server actions)
  - care-plans.ts (listCarePlans, getPlanCreateOptions, createCarePlan, updateCarePlan, addGoal, removeGoal, markGoalMet, changePlanStatus: every care plan rule lives here)
  - care-plan-constants.ts (statuses, PLAN_TRANSITIONS state machine, size limits)
  - care-plans-actions.ts (thin server actions)
  - documents.ts (listDocuments, getDocumentUploadOptions, uploadDocument, getDocumentForDownload, archiveDocument: every document rule lives here)
  - document-constants.ts (categories and which are restricted, size limits, file type detection from bytes, file name cleaning)
  - documents-actions.ts (thin server actions for upload and archive)
  - referrals.ts (listReferrals, canRecordReferrals, createReferral, updateReferral, changeReferralStatus: every referral rule lives here)
  - referral-constants.ts (sources, urgencies, statuses, REFERRAL_TRANSITIONS state machine, limits)
  - referrals-actions.ts (thin server actions)
  - time.ts (office time America/Chicago, DST-safe, no date library; also parseCalendarDate and formatCalendarDate for dates of birth)
  - auth/session.ts, auth/actions.ts, auth/authorize.ts
  - audit/log.ts
- package.json, next.config.ts (allows images.pexels.com as a remote pattern)
- .env (real DATABASE_URL, never committed), .env.example

The orphaned src/components/marketing/coming-soon-page.tsx was deleted on 19 September 2026 (it still said "This page is a placeholder"). Because zips never delete files, J has to Remove-Item his own copy once. If it ever reappears in a zip diff, delete it again.

---

## 5. Database schema, exactly as it stands

Sixteen models, in prisma/schema.prisma:

Identity/auth (Milestone C): Organization, User, Session, Role, Permission, RolePermission (join), UserRole (join), AuditLog

Clinical (Milestone D): Patient, CareTeamMember (join, this is what makes relationship-based access real), Visit (patient, clinician, scheduledBy, type, status, scheduled start/end, actual check in/out; NO clinical content; never hard-deleted; Restrict foreign keys), CarePlan (patient, author, approvedBy, title, summary, status draft/active/completed/archived, approvedAt, completedAt; the first table with real clinical content; never hard-deleted; Restrict foreign keys) and CarePlanGoal (belongs to a plan, cascades with it; open or met), Document (patient, uploader, category, title, cleaned file name, type detected from the bytes, size, sha256, active or archived; never hard-deleted; Restrict foreign keys) and DocumentFile (just the bytes, one row per document, cascades with it), Referral (who is referred, who sent it, kind of care, urgency, clinical reason, three office-only columns, status; patientId is EMPTY until accepted; never hard-deleted; Restrict foreign keys)

Every table uses @id @default(uuid()) for primary keys, @map("snake_case") throughout so the actual Postgres columns are snake_case while Prisma's TypeScript side stays camelCase. AuditLog.actorUserId is nullable specifically because a failed sign-in attempt against a nonexistent email has no real user row to attach to, logging the attempted email is still the point.

Not built yet, deliberately: clinical notes, consents, messaging, notifications, tasks. Each is meant to come as its own round, not all at once, see the original architecture doc's "do not build everything at once."

---

## 6. Authentication, how it actually works

src/lib/auth/session.ts: sessions are real rows in the sessions table, not JWT-only, this is what would let a real "revoke this session" admin feature work later, and what lets every session for a compromised account be invalidated immediately.

src/lib/auth/actions.ts: signInAction compares the submitted password against a dummy bcrypt hash whenever the email doesn't match a real user, so a login attempt for a nonexistent email takes the same amount of time as one for a real email with a wrong password, otherwise response timing itself would quietly leak which emails have accounts.

Both /dashboard and /patients call getCurrentUser() and redirect to /sign-in server-side if there's no session, this is a real security boundary, not a hidden button.

---

## 7. RBAC, how permission checks actually work

src/lib/auth/authorize.ts, the single path every permission check goes through:

- hasPermission(userId, key), true/false, for deciding what to render
- requirePermission(userId, key), throws AuthorizationError if missing, for actually blocking a sensitive action, also writes a permission_denied audit log entry automatically
- getUserPermissions(userId), the full list for one user

Permissions live in the database (permissions, role_permissions, user_roles tables), not hardcoded in TypeScript, granting a role a new permission later is a data change, not a redeploy.

Real permission sets defined so far: SUPER_ADMIN (all 34), ADMIN (broad administrative set, includes care_plans.read and care_plans.approve but not create or update, and both care team permissions), NURSE (16 permissions, clinical-focused, includes care_plans.read/create/update but not approve, no care team permissions), CARE_COORDINATOR and CLINICAL_SUPERVISOR (added 21 September 2026, listed in section 10f and docs/CARE_TEAMS.md). The remaining four roles (CAREGIVER, PATIENT, AUTHORIZED_FAMILY, REFERRAL_PARTNER) intentionally hold zero permissions still, each one's real set is designed with its own portal.

---

## 8. The recurring layout bug, now permanently guarded

scripts/check-root-layout.mjs runs automatically via predev/prebuild npm hooks before every npm run dev and npm run build. It reads src/app/layout.tsx, checks for html, body, and the globals.css import, and refuses to proceed with a clear red terminal error if the file has been swapped with the public layout's content again, pointing at docs/TROUBLESHOOTING.md. Tested directly: confirmed it passes the correct file and blocks the exact bug pattern.

This does not mean the bug can never resurface on the user's local disk, it means it gets caught immediately with a clear message the moment dev or build runs, instead of silently shipping broken. See section 0 for the standing practice this demands.

---

## 9. Audit logging, what's recorded and what never is

src/lib/audit/log.ts. Logged automatically: sign_in, sign_in_failed (tied to the attempted email, not a user row), sign_out, permission_denied. Since 19 September also: visit_created, visit_checked_in, visit_checked_out, visit_cancelled, visit_marked_missed, and access_denied (outcome denied) for relationship refusals. Since the care plans round also: care_plan_created, care_plan_updated, care_plan_goal_added, care_plan_goal_removed, care_plan_goal_met, care_plan_approved, care_plan_completed, care_plan_discarded. Never logged: the content of what was viewed or changed, only that the event happened. writeAuditLog swallows its own errors (logs to server console) rather than throwing, so a broken audit write is never the reason a real sign-in fails for someone.

Shown on /dashboard as "Recent activity," visible only to an account holding audit.read.

---

## 10. Patients and relationship-based access, proven working, not just built

src/lib/patients.ts: getAccessiblePatients(userId) calls requirePermission first (hard stop), then checks whether the user holds an administrative role (SUPER_ADMIN, ADMIN, CLINICAL_SUPERVISOR, CARE_COORDINATOR), if so, every patient in their organization. Otherwise, only patients they have an active CareTeamMember row for.

This was verified working on the user's actual machine, not just reviewed as code: the demo admin sees all three synthetic patients on /patients; the demo nurse, holding the same patients.read permission, sees only Eleanor Whitfield, the one patient they're actually assigned to. Screenshots confirmed this on 18 September 2026.

---

## 10b. Visits, built and verified in the build environment on 19 September 2026

Full detail in docs/VISITS.md. Summary of the rules, all in src/lib/visits.ts: every operation needs the role permission (visits.read/create/update) AND a relationship to the patient via getPatientScope. Administrative roles (SUPER_ADMIN, ADMIN, CLINICAL_SUPERVISOR, CARE_COORDINATOR) see every visit and can schedule for any active care-team member of an active patient. Everyone else sees visits of patients they are actively assigned to (including colleagues' visits on the same patient), schedules only for themselves, and changes only their own visits. Statuses: scheduled to in_progress to completed via check in / check out; cancel and mark missed from scheduled only; completed, cancelled and missed are final. No double-booking; visit start must be within 1 day past to 365 days ahead; lengths 30/45/60/90/120. Denials are audited and answered vaguely (nonexistent and off-limits look identical).

Evidence: tsc, eslint, next build clean; verify:access 69 passed, 0 failed, and it fails on exactly the rules deliberately broken; rendered /visits fetched with real sessions showed admin 6 visits, nurse one 4 (Eleanor), nurse two 2 (Marcus). NOT YET verified on J's own machine (needs migration add_visits, seed, verify:access, browser click-through).

Known gaps (also in VISITS.md): double-booking has a tiny race (real fix is a DB exclusion constraint, Milestone E); activeAssignmentFilter ignores startsAt; reading visits is not audit-logged; CAREGIVER cannot see visits yet.

---

## 10c. Care plans, built and verified in the build environment on 19 September 2026

Full detail in docs/CARE_PLANS.md. Every rule lives in src/lib/care-plans.ts. THREE questions, not two: role permission (care_plans.read/create/update/approve), relationship to the patient via getPatientScope, and, for WRITING, being on THAT patient's care team right now (isActiveCareTeamMember). Reading needs the first two. Administrative roles read every plan and can approve and complete them, but do not write clinical content for patients they are not on the team of (SUPER_ADMIN holds every permission and is still refused). Any team member can edit a patient's draft (a plan belongs to the team). Approving: needs care_plans.approve, never the author (four eyes, even for someone holding every permission), needs at least one goal, refused if the patient already has an active plan. Statuses: draft to active (approve), active to completed (complete), draft to archived (discard, by the team or an approver); completed and archived are final. A patient has at most one draft and one active plan; a new draft may be written while one is active. Once active, wording and goals are LOCKED, only marking a goal met still works. Denials are audited (access_denied) and a plan that does not exist looks identical to one the person may not reach. Limits: title 120, summary 2000, goal 300, 15 goals.

Demo data: Eleanor Whitfield has an active plan (written by Demo Nurse, approved by Demo Admin, one goal met). Marcus Delgado has a draft written by Demo Nurse Two. Priya Raman has none.

Evidence: tsc, eslint, next build clean; verify:access 175 passed, 0 failed; five rules deliberately broken in a copy (four-eyes, team requirement on create, locked wording, the relationship check, one active plan) and the script failed on exactly those rules each time; rendered /care-plans fetched with real sessions showed admin both plans with Approve/Discard on Marcus's draft and Complete on Eleanor's, nurse one only Eleanor's, nurse two only Marcus's with edit controls and no Approve. CONFIRMED on J's own machine on 19 September 2026: migration add_care_plans applied, seed ran, verify:access 175 passed 0 failed, /care-plans rendered as expected.

Known gaps (also in CARE_PLANS.md): the one-active-plan rule is enforced in code with a tiny race, the real fix is a hand-written partial unique index migration step later; no revision history; reading plans is not audit-logged; goals are plain text; CLINICAL_SUPERVISOR now holds care_plans.approve (since 21 September); patients and families cannot see plans yet.

Also changed in that round: src/app/layout.tsx now has suppressHydrationWarning on <body> (a browser extension such as Grammarly or ColorZilla adding attributes had probably caused a red "1 Issue" badge in J's screenshot; confirmed gone in his next screenshot).

---

## 10d. Documents, built and verified in the build environment on 19 September 2026

Full detail in docs/DOCUMENTS.md. Every rule lives in src/lib/documents.ts. THREE questions: role permission (documents.read/upload/delete, all three already existed so no new permission), relationship to the patient via getPatientScope, and CATEGORY: insurance and identification documents are RESTRICTED, only administrative roles (organization scope) can see, download or file them, and to a nurse they do not exist at all (missing from lists, and a direct request gets the same 404 words as a made-up id). Unknown categories fail closed as restricted. No care-team question, on purpose: filing paperwork is an office job; the team question was for writing clinical judgment. Files: PDF, PNG or JPEG only, type read from the file's own bytes never from its name, 2 MB max, never empty, cleaned file name with a matching extension, no duplicate of the same bytes for a patient (sha256), active patients only. Archive needs documents.delete (SUPER_ADMIN only today), hides the document everywhere and keeps the row and bytes. Documents are never hard-deleted. Downloading is a plain GET route (src/app/documents/[id]/download/route.ts): 401 signed out, 403 no permission, 404 for anything missing, off-limits, archived or restricted; sent as attachment with nosniff and private no-store. Downloads are audited (document_downloaded), the first place reading is logged; also document_uploaded, document_archived, access_denied. File bytes sit in their own table (document_files) and live in the database for the demo; real deployment needs encrypted object storage (a paid-service decision, ask J first).

Demo data: Eleanor has a consent form, a physician order (filed by Demo Nurse) and an insurance card (restricted). Marcus has a consent form and a photo ID (restricted). Priya has none. All are tiny real PDFs built by prisma/demo-pdf.ts.

Evidence: tsc, eslint, next build clean; verify:access 254 passed, 0 failed; eight rules deliberately broken in a copy and the script failed on those rules each time; real HTTP against the built app with real sessions showed each demo account got exactly its documents and every refusal used identical words. NOT tested end to end: the upload form's server action over real HTTP (no browser in the build environment); the rules under it are fully tested. NOT YET verified on J's machine (needs migration add_documents, seed, verify:access expecting 254, click-through, and one hand test of the upload form with a small PDF).

Known gaps (also in DOCUMENTS.md): bytes in the database not encrypted object storage; no virus scan; no archived-document viewer or restore; listing not audit-logged, only downloads; no CLINICAL_SUPERVISOR or CARE_COORDINATOR permissions yet.

Also changed in that round: next.config.ts raises the Server Action body limit to 3 MB (experimental.serverActions.bodySizeLimit) so a 2 MB upload can travel.

---

## 10e. Referrals, built and verified in the build environment on 20 September 2026

Full detail in docs/REFERRALS.md. Every rule lives in src/lib/referrals.ts. THREE questions: permission (referrals.read to see, referrals.manage to record, edit and decide; both already existed), REACH (a referral about someone who is not yet a patient is reachable by administrative roles only; an accepted one by whoever getPatientScope says can reach that patient), and FIELDS (summary and clinical reason for anyone with reach; office details = outside contact name and phone, office notes, decision note, administrative scope only, and the columns are never even selected for anyone else). No care-team question. Recording a referral needs administrative scope, so a role holding referrals.manage with only "assigned patients" reach cannot record or see an unlinked referral. NURSE now holds referrals.read. State machine (REFERRAL_TRANSITIONS): received to in_review (start_review), in_review to accepted (accept), received or in_review to declined or withdrawn (both need a written reason up to 1000 characters); accepted, declined, withdrawn are final; only open referrals are editable; one open referral per person (name case-insensitive plus date of birth). Accept either links an existing patient (reachable, same organization, ACTIVE, exact name and DOB match) or creates a new patient (needs patients.create; refused if a patient with that name and DOB already exists; done in a transaction with a status guard). A new patient has no care team. Dates of birth are real, not future, not before 1900, stored as midnight UTC and shown in UTC. Vague not-found for missing and unreachable, denials audited as access_denied. Audit events: referral_created, referral_updated, referral_review_started, referral_accepted, referral_declined, referral_withdrawn, patient_created.

Demo data: six referrals. Eleanor, Marcus and Priya each have their accepted referral linked to their patient record. Walter Brennan (in review, urgent), Grace Holloway (received) and Tomas Reyes (declined) are not patients. Nurse one sees only Eleanor's, nurse two only Marcus's, both without office details. Priya's is admin-only because nobody is on her team.

Evidence: tsc, eslint, next build clean; verify:access 407 passed, 0 failed (sections 2d and 12a to 12i, with a temporary role and temporary managers); thirteen rules deliberately broken one at a time in a copy and the script failed each time; real HTTP against the built app with real sessions for pages and for the create, edit and status-change server actions, called with React's own request encoder (the exact browser body): admin succeeded, nurse and signed-out were refused, nothing was saved for refused calls. The document upload action was tested the same way and behaved as designed. NOT tested: clicking the forms in a real browser. NOT YET verified on J's machine (migration add_referrals, seed, verify:access expecting 407, click-through, one hand test of the Record a referral form).

Known gaps (also in REFERRALS.md): no history table of status changes; the public /request-care form is not connected to referrals; CARE_COORDINATOR and CLINICAL_SUPERVISOR now hold real permission sets (21 September); the care team rules exist but no care-team screen yet; no waiting-time indicator; reading the list is not audit-logged.

Testing tip: a server action can be called over HTTP from a script by taking its id from .next/server/server-reference-manifest.json and building the body with encodeReply from next/dist/compiled/react-server-dom-turbopack/client.edge, then POSTing with a Next-Action header. A hand-built curl multipart body does NOT work (field names are prefixed _1_ and the root part 0 must come last).

---

## 10f. Care teams and the office roles, built and verified in the build environment on 21 September 2026 (Milestone E0)

Full detail in docs/CARE_TEAMS.md. Summary: src/lib/auth/actor.ts holds the shared loadActor, auditDenied and auditAllowed (verify:access section 0 fails if a private copy reappears). src/lib/care-team.ts adds and ends care team assignments (permissions care_team.read and care_team.manage; active patient only; the person must really hold a nurse or caregiver role; one primary nurse, enforced in a serializable transaction that retries; ending sets an end date and deletes nothing; vague not-found wording; audit events care_team_assigned and care_team_ended). CARE_COORDINATOR holds patients.read/create, referrals.read/manage, visits.read/create/update, care_team.read/manage. CLINICAL_SUPERVISOR holds patients.read, care_plans.read/approve, visits.read, documents.read, care_team.read. ADMIN holds both care team permissions. No schema change. verify:access is 553 checks. Open: a supervisor sees restricted documents (administrative role); the real Prisma engine's collision error name is unconfirmed until it runs on J's machine.

---

## 11. Demo accounts, all real and working

Documented in git-ignored docs/DEMO_ACCOUNTS.md. Password for all five: ChangeMe123! (see also the /care-plans column in docs/DEMO_ACCOUNTS.md)

| Account | Role | Sees on /patients |
|---|---|---|
| demo.admin@cheliv.test | SUPER_ADMIN | All three synthetic patients |
| demo.nurse@cheliv.test | NURSE | Only Eleanor Whitfield |
| demo.nurse2@cheliv.test | NURSE | Only Marcus Delgado |
| demo.coordinator@cheliv.test | CARE_COORDINATOR | Every patient (added 21 September) |
| demo.supervisor@cheliv.test | CLINICAL_SUPERVISOR | Every patient (added 21 September) |

Three synthetic demo patients exist: Eleanor Whitfield, Marcus Delgado, Priya Raman, all clearly fictional. Priya has nobody on her care team on purpose (the future unassigned-patient case), so she cannot be scheduled.

---

## 12. Public website, complete, real content

Homepage, About, Services (index + 6 real detail pages via generateStaticParams), Contact, How We Care, Who We Serve, Resources, Request Care (real client-side-validated form, honestly documented in its own code comments as not yet wired to send anywhere real, no backend endpoint exists for it yet). Sign In is real (not a stub anymore).

Three real, free-licensed Pexels photos are hotlinked (not scraped, not downloaded illegally, Pexels' own CDN, meant for exactly this) into the homepage hero, homepage "who we serve," and About page. Swap for real photos of the actual office/team whenever available, see docs/IMAGES.md.

---

## 13. Milestone/phase status, honestly

- Milestone A (Foundations): Complete
- Milestone B (Public website): Complete
- Milestone C (Database, auth, RBAC, audit logging): Complete
- Milestone D (Core clinical operations): Complete. Patients, care team, visits, care plans, documents and referrals all confirmed on J's machine (referrals confirmed 21 September 2026).
- Milestone E (The real staff-facing screens): In progress. E0 (shared helpers, care team rules, office role permissions) confirmed on J's machine (553 passed). E1 (internal app shell, dashboards, sharing restricted documents, site photos) written and verified in the build environment 21 September 2026, waiting on J's machine. E2 (the Care Command Center) is next.
- Milestone F (Production readiness): Not started

Full detail and reasoning in docs/PHASE_0_ARCHITECTURE.md (the original plan) and docs/PHASE_STATUS.md (the live tracker), read both if anything here is ambiguous.

---

## 14. Recurring environment quirks worth knowing before they cause confusion again

- Zombie dev server processes on Windows have repeatedly held port 3000 across terminal sessions. If a port conflict shows up, taskkill /F /IM node.exe then restart clean, and confirm the terminal shows no "port in use" warning before trusting anything on screen.
- ZIP extraction never deletes files, only adds/overwrites, and has at least once silently skipped overwriting a specific file on a conflict prompt. Any file that needs deleting gets an explicit Remove-Item instruction, every time.
- A real, reproducible npm arborist bug (Cannot read properties of null, reading edgesOut) hits unpredictably in this project on fresh installs, not caused by any specific package. Fix: delete node_modules and package-lock.json, then npm install, sometimes needs a couple of tries.
- Browser extensions cause harmless hydration-mismatch warnings (cz-shortcut-listen from ColorZilla, data-gr-ext-installed from Grammarly, etc.), not real bugs. Since 19 September the root layout's <body> has suppressHydrationWarning, which silences those. The red "1 Issue" badge J saw disappeared after that change.
- The sandbox can now build and test for real using the recipe in section 3 (a scratch Postgres plus a Rust-free Prisma client). The old "build always fails there" note is obsolete.
- Postgres in the sandbox stops between tool calls: start it inside every command that needs it.

---

## 15. Full docs folder, for reference

AUDIT_LOGGING.md, CHANGELOG.md, DATABASE.md, DEMO_ACCOUNTS.md (git-ignored), DESIGN_SYSTEM.md, ENVIRONMENT_VARIABLES.md, FOLDER_STRUCTURE.md, IMAGES.md, NEXT_STEP.md, CARE_PLANS.md, DOCUMENTS.md, PATIENTS.md, REFERRALS.md, REVIEW_MILESTONE_D.md, PHASE_0_ARCHITECTURE.md, PHASE_STATUS.md, PROJECT_HANDOFF.md (this file), PUBLIC_WEBSITE.md, RBAC.md, TROUBLESHOOTING.md, ULTRA_BABY_STEPS.md, VISITS.md, CONTINUATION_PROMPT.md.

---

## 16. What to do first in the new conversation

Ask J whether the E1 round has run on his machine: delete the six old folders under `src/app` (docs/APP_SHELL.md), `npm install`, `npx prisma migrate dev --name add_document_access_grants`, `npx prisma db seed` (expect 34 permissions), `npm run verify:access` (expect 661 passed, 0 failed), `npm run verify:shell` (expect 62 passed, 0 failed), `npm run dev`, then look at the dashboards for each demo account, the Documents Sharing screen, and the four photos. Then start E2, the Care Command Center: referral inbox with waiting time, accept-and-assign flow, patient list and profile, the care team panel with add and end and the worklist, staff list, scheduling board, and the audit log page with filters (scope the audit log by organization first).

The photos are stand-ins. J does not want to tell his uncle yet and will show the site at the last stage.

Real photography has not arrived. The phone number is settled and should not be raised again.


## 10g. Milestone E1 (21 September 2026): the app shell, dashboards, sharing restricted documents, site photos

Built and verified in the build environment (tsc, eslint and build clean; verify:access 661 passed; verify:shell 62 passed; 24 rules broken on purpose and caught; pages fetched over HTTP as each demo account; share and take back tested through the real server actions). Waiting on his machine. Read `docs/APP_SHELL.md`, the "Sharing restricted documents" section of `docs/DOCUMENTS.md`, and `docs/IMAGES.md`. He must delete six old folders under `src/app` and run the migration `add_document_access_grants`.

Decision made by him: restricted documents are seen by SUPER_ADMIN and ADMIN by default; an administrator (his uncle, the CEO) can share them with one named person for one patient or one document, for 7 days, 30 days or until taken back. Permission `documents.grant` (34 permissions), table `document_access_grants`.
