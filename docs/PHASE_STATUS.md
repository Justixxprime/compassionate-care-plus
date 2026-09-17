# PHASE_STATUS.md

Order follows the revised milestone plan in `PHASE_0_ARCHITECTURE.md` section 12.

---

## PHASE 0 through PHASE 7 — Complete (15 September 2026)

Architecture, project setup, design system, public website (homepage, services, about, contact, request-care form).

## MILESTONE C — Spine: database, auth, API, RBAC, audit
- **Status:** Complete
- **Date:** 17 September 2026
- **Database:** organizations, users, sessions, roles, permissions, audit_logs. Migrated and seeded successfully on his machine, demo admin account exists.
- **Authentication:** real sign in/session/sign out, bcrypt password check, database-backed sessions, server-side route protection on `/dashboard`
- **RBAC:** `src/lib/auth/authorize.ts` (hasPermission/requirePermission/getUserPermissions), wired into `/dashboard` as a working demonstration
- **Audit logging:** `src/lib/audit/log.ts`, records sign_in/sign_in_failed/sign_out/permission_denied automatically. Shown on `/dashboard` behind the `audit.read` permission check.
- **API/service layer:** deliberately folded into Milestone D, since there's nothing to serve an API for yet without real clinical data
- **Note:** repository is still public. No real secrets are committed, but worth reconsidering now that real user credentials, sessions, and an audit trail exist, even in demo form.
- **Tests:** lint and `tsc --noEmit` clean; `npm run build` cannot run in the sandbox this gets built in (Prisma client can't be generated there, reachable and working on his machine)
- **Next action:** Milestone D, the real clinical schema (patients, visits, care plans, referrals, documents)

## MILESTONE D, E, F — Not started