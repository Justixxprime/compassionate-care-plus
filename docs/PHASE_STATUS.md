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
- **Status:** In progress
- **Patients & care team:** Complete (17 September 2026) - patients table, care_team_members join table, real relationship-based access logic in src/lib/patients.ts, tested via two demo accounts seeing different patient lists
- **Visits:** Complete (19 September 2026) - visits table, src/lib/visits.ts, /visits proof page, second demo nurse, `npm run verify:access`. Running on his machine: scheduling and the visit list confirmed by his screenshots on 19 September. Not yet confirmed from him: the `verify:access` result and the nurse and nurse two click-throughs.
- **Care plans:** Written and verified in the build environment (19 September 2026) - care_plans and care_plan_goals tables, src/lib/care-plans.ts, /care-plans proof page, four-eyes approval, locked wording once approved, `verify:access` extended to about 175 checks. **Waiting on:** his machine (migration `add_care_plans`, seed, `npm run verify:access`, click through /care-plans as all three demo accounts)
- **Next:** documents, then referrals

## MILESTONE E - Portals
- **Status:** Not started

## MILESTONE F - Production readiness
- **Status:** Not started
