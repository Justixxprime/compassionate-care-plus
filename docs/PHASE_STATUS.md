# PHASE_STATUS.md

Order follows the revised milestone plan in `PHASE_0_ARCHITECTURE.md` section 12.

---

## PHASE 0 - Research, requirements and architecture
- **Status:** Complete - 15 September 2026

## PHASE 1 - Project initialization
- **Status:** Complete - 15 September 2026

## PHASE 2 - Design system
- **Status:** Complete - 15 September 2026

## PHASES 3 & 4 - Public website foundation + homepage
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** public layout, header, footer, nav data, hero illustration, homepage, 8 pages (7 placeholder stubs + sign-in stub)
- **Tests:** `npm run build` (11 routes, no errors), `npm run lint` clean, compiled CSS checked for mobile menu / FAQ utilities
- **Known issues:** all content beyond the shell is placeholder, clearly labelled; request-care and sign-in are stubs
- **Next action:** Phase 5 - service pages

## PHASE 5 - Public service pages
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** `src/lib/services-data.ts`, real `/services` index, `/services/[slug]` dynamic detail pages
- **Tests:** `npm run build` shows all 6 services statically generated; lint clean
- **Known issues:** content is illustrative, clearly labelled
- **Next action:** Phase 6 - about, care approach and trust content

## PHASE 6 - About, care approach and trust content
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** real `/about` and `/contact` pages
- **Tests:** build (19 routes) and lint both clean
- **Known issues:** address/phone/stats still placeholder pending confirmation
- **Next action:** Phase 7 - request care form

## PHASE 7 - Contact and request care
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** real `/request-care` page and form component
- **Tests:** build (19 routes), lint, and tsc --noEmit all clean
- **Known issues:** form doesn't send/save anywhere yet - no backend exists; "Cheliv" naming question still open
- **Next action:** Phase 8 - authentication architecture (starts Milestone C)

## MILESTONE C - Spine: database, auth, API, RBAC, audit
- **Status:** Complete
- **Date:** 17 September 2026
- **Database:** organizations, users, sessions, roles, permissions, audit_logs. Migrated and seeded successfully on his machine, demo admin account exists.
- **Authentication:** real sign in/session/sign out, bcrypt password check, database-backed sessions, server-side route protection on `/dashboard`
- **RBAC:** `src/lib/auth/authorize.ts` (hasPermission/requirePermission/getUserPermissions), wired into `/dashboard` as a working demonstration
- **Audit logging:** `src/lib/audit/log.ts`, records sign_in/sign_in_failed/sign_out/permission_denied automatically. Shown on `/dashboard` behind the `audit.read` permission check.
- **API/service layer:** deliberately folded into Milestone D, since there's nothing to serve an API for yet without real clinical data
- **Note:** repository is still public. No real secrets are committed (`.env` stays git-ignored), but worth reconsidering now that real user credentials, sessions, and an audit trail exist in the system, even in demo form.
- **Tests:** lint and `tsc --noEmit` clean; `npm run build` cannot run in the sandbox this gets built in (Prisma client can't be generated there - reachable and working on his machine)
- **Next action:** Milestone D - the real clinical schema (patients, visits, care plans, referrals, documents)

## MILESTONE D - Core operations
- **Status:** Complete (21 September 2026). Review in docs/REVIEW_MILESTONE_D.md.
- **Patients & care team:** Complete (17 September 2026) - patients table, care_team_members join table, real relationship-based access logic in src/lib/patients.ts, tested via two demo accounts seeing different patient lists
- **Visits:** Complete and confirmed on his machine (19 September 2026) - visits table, src/lib/visits.ts, /visits proof page, second demo nurse, `npm run verify:access`.
- **Care plans:** Complete and confirmed on his machine (19 September 2026): migration applied, seed ran, `verify:access` 175 passed and 0 failed, /care-plans rendered, the red "1 Issue" badge gone. Care team writing, four-eyes approval, locked wording once approved.
- **Documents:** Written and verified in the build environment (19 September 2026), committed by him with migration add_documents - documents and document_files tables, src/lib/documents.ts, /documents proof page and download route, restricted categories, `verify:access` extended to 254 checks. **Waiting on:** his machine (migration `add_documents`, seed, `npm run verify:access`, click through /documents as all three demo accounts, and one hand test of the upload form with a small PDF)
- **Referrals:** Complete and confirmed on his machine (21 September 2026): migration add_referrals applied, admin recorded and accepted a referral (a new patient was created), nurse two saw only Marcus Delgado's referral, no office details for nurses.

## MILESTONE E - The real staff-facing screens
- **Status:** In progress
- **E0 (shared helpers, care teams, office role permissions):** Written and verified in the build environment (21 September 2026): 553 access checks, 18 deliberate rule breaks all caught, tsc, eslint and build clean. No migration. **Waiting on:** his machine (`npx prisma db seed`, `npm run verify:access` expecting 553 passed).
- **E1 (internal app shell, dashboards, sharing restricted documents, site photos):** Written and verified in the build environment (21 September 2026): 661 access checks, 62 shell checks, 24 deliberate rule breaks all caught, tsc, eslint and build clean, pages fetched over HTTP. **Waiting on:** his machine (six old folders deleted, migration `add_document_access_grants`, seed, both verify scripts, a look at the pages and the four photos).
- **E1.3 (phone drawer fix):** Confirmed on his machine (23 September 2026) after one earlier round that did not fully fix it. Root cause: `flex`/`flex-col` on the `<dialog>` element itself always beat the browser's own `display: none` default. Two files, no migration.
- **E2 round 1 (Care Command Center, patient profile and care team panel, staff directory, scheduling board, audit log page, referral accept-and-assign):** Written and verified in the build environment (23 September 2026): 661 access checks and 62 shell checks both still pass (five shell expectations updated for the four new nav items), tsc/eslint/build all clean, a live smoke test over HTTP with real session cookies for an admin and a nurse. **Needs a real migration** (`add_organization_to_audit_log` - see docs/NEXT_STEP.md). **Waiting on:** his machine (migration, seed, both verify scripts, and clicking through the "add to care team" / "end assignment" buttons for real - the one thing the HTTP smoke test could not exercise).
- **E2 round 2 and beyond:** open items in docs/NEXT_STEP.md. Care team add/end confirmed by hand on his machine (23 September 2026) - E2 round 1 is fully confirmed.
- **E3 round 1 (visit notes):** Written and verified in the build environment (23 September 2026): the VisitNote model, src/lib/visit-notes.ts (permission, relationship, author-only writing, four-eyes review), the visit detail page at /visits/[id], and the two worklists on /visits. tsc/eslint clean by inspection against the existing codebase's own patterns (see docs/NEXT_STEP.md for exactly what live-sandbox testing was and was not done this round - it differs from prior rounds). **Needs a real migration** (`add_visit_notes`). **Waiting on:** his machine (migration, seed, both verify scripts, and clicking through write note / submit / review as the demo nurse and demo supervisor accounts).
- **E5 round 1 (caregiver portal, phone first):** Written and tested in the build environment against a real Postgres (24 September 2026): new permission `visits.checkin`, CAREGIVER set (`visits.checkin`, `tasks.read`), `/caregiver` (My day: own visits today, check in and out, task checklist), demo caregiver in the seed. `verify:access` 663, `verify:shell` 68, `verify:notes` 93, `verify:tasks` 40, `verify:notifications` 44, new `verify:caregiver` 75. Eleven rules broken on purpose, each caught. No migration. Not yet run on his machine. See `docs/CAREGIVER_PORTAL.md`.
- **E5 round 2 (patient portal):** Written 24 September 2026: new permission `portal.read`, PATIENT set (`portal.read` only), one schema change (`Patient.userId`, optional and unique), `/my-care` (next visits, care team, active care plan, recent visits; read only), demo patient in the seed, new `verify:portal`. E5 round 1 (caregiver portal) confirmed on his machine the same day. See `docs/PATIENT_PORTAL.md`.
- **Family portal:** Later (needs consent gating)

## MILESTONE F - Production readiness
- **Status:** Not started
- **E3 round 2 and E4 round 1 (note verification and tasks):** Verified in the build environment against a real Postgres (23 September 2026): the E3 note rules (`verify:notes`, 39 passed, rule breaks caught), `verify:access` 661 passed, `verify:shell` 62 passed, `verify:tasks` 40 passed with four rule breaks caught, tsc and eslint clean, `next build` passed, and /tasks, /visits and /visits/[id] rendered with status 200 as nurse and admin. Tasks: permission, reach and ownership rules, `/tasks` page, menu item. **Needs a real migration** (`add_tasks`). **Waiting on:** his machine (migration, seed, four verify scripts, click-through).
- **E3 round 2 and E4 round 2 (note addenda and notifications):** Written and tested in the build environment against a real Postgres (23 September 2026): `verify:access` 661, `verify:shell` 62, `verify:tasks` 40, `verify:notes` 93, `verify:notifications` 44, all passed; tsc, eslint and next build clean; pages rendered 200 as nurse, supervisor and admin; ten addendum rules and seven notification rules broken on purpose and each caught. **Needs a real migration** (`add_addenda_and_notifications`). **Waiting on:** his machine (migration, seed, five verify scripts, click-through of addendum add and review, and the bell).

- **E5 round 2 (patient portal) is confirmed** on his machine and pushed (24 September 2026, commit af6d273).
- **E5 round 3 (family portal with consent gating):** Written and tested in the build environment against a real Postgres (24 September 2026): new permissions `family.read` and `consents.manage` (38 in total), AUTHORIZED_FAMILY set (`family.read` only), new table `family_consents`, `/family` (Shared with me) and `/consents` (Family access), shared loaders `patient-view.ts`, demo family account with one consent from Eleanor. `verify:access` 668, `verify:shell` 81, `verify:notes` 93, `verify:tasks` 40, `verify:notifications` 44, `verify:caregiver` 75, `verify:portal` 53, new `verify:family` 156; tsc, eslint and next build clean; pages rendered 200 as family, admin, patient, nurse and caregiver; nineteen rules broken on purpose and each caught. **Needs a real migration** (`add_family_consents`). **Waiting on:** his machine. See `docs/FAMILY_PORTAL.md`.
- **E5 round 3 (family portal) is confirmed** on his machine (24 September 2026): all four click-through checks passed.
- **Round F0 (ready to show):** Written and tested in the build environment against a real Postgres (24 September 2026): the portal-closed screen for a site with no database, `/design-system` hidden in production, the seed refusing to run on a hosted database, and the "Who can see my care" panel on `/my-care`. `verify:access` 668, `verify:shell` 81, `verify:notes` 93, `verify:tasks` 40, `verify:notifications` 44, `verify:caregiver` 75, `verify:portal` 53, `verify:family` 156, new `verify:sharing` 40. No migration. See `docs/DEPLOYMENT.md`.
- **Round F0 is confirmed** on his machine (25 September 2026): all three click-through checks passed (the "Who can see my care" record/withdraw/record-again round-trip, and the live site's calm screen with `/design-system` not found after the redeploy).
- **Round G0 (real accounts):** Written and tested in the build environment against a real Postgres, using a full clone of the live migration history (25 September 2026): `src/lib/accounts.ts` (staff, family and patient-link account creation, gated by `staff.manage`), `src/lib/account-constants.ts`, `src/lib/accounts-actions.ts`, the create-account form on `/staff`. `verify:access` 668, `verify:shell` 81, `verify:notes` 93, `verify:tasks` 40, `verify:notifications` 44, `verify:caregiver` 75, `verify:portal` 53, `verify:family` 156, `verify:sharing` 40, new `verify:accounts` 46; tsc, eslint and `next build` all clean; `/staff` fetched over real HTTP with a real session cookie as admin (form present) and as a nurse (refused, form absent). No migration, no new dependency, no new permission. **Waiting on:** his machine. See `docs/ACCOUNTS.md`.
- **Round G0 is confirmed** by screenshot (25 September 2026): `/staff` showing the working "Create an account" form, "Kind of account: Patient", Walter Brennan selectable.
- **Round G1 (Request care, saved and in-app notified; audit log pagination):** Written this round: new `CareRequest` model and `care_requests.manage` permission (39 total), `src/lib/care-request-constants.ts`, `src/lib/care-requests.ts`, `src/lib/care-requests-actions.ts`, the real `/request-care` form, `/care-requests` admin screen, in-app notification kind `care_request_received`, and `src/lib/audit-log.ts` / `src/lib/audit/log.ts` / `/audit-log` updated for page-by-200 pagination with Newer/Older controls. New `verify:care-requests`, 31 checks. **No real e-mail sending yet, on purpose** - see `docs/CARE_REQUESTS.md` for exactly why and the two options going forward. Not yet run against a live Postgres this round (packaged fast per standing instruction); needs his normal commands, including a fresh migration `add_care_requests`.
