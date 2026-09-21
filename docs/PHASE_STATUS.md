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
- **E1 (internal app shell):** Next
- **E2 (Care Command Center, including the care team screens):** After E1
- **E3 clinical portal, E4 caregiver portal (phone first), E5 patient and family portals:** Later

## MILESTONE F - Production readiness
- **Status:** Not started
