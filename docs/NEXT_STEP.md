# NEXT_STEP.md

**Last updated:** 17 September 2026
**Just finished:** Audit logging - Milestone C is now complete

---

## What I just completed

Added the audit log: a database table and a small library that records who did what, when, and whether it was allowed - never the content of what was viewed or changed, only that the event happened. Wired into sign-in, sign-out, and every permission denial automatically.

This finishes Milestone C (database, authentication, RBAC, audit logging). Next is Milestone D - real clinical data.

## IMPORTANT - this phase needs a new migration

I added a new table (`audit_logs`) to `prisma/schema.prisma`. This means the database on your machine needs to be updated to match - the exact command is at the bottom of this file. This is different from previous rounds, which only changed application code.

## What files were created

- `src/lib/audit/log.ts` - `writeAuditLog()`, `getRecentAuditLog()`
- `docs/AUDIT_LOGGING.md`

## What files changed

- `prisma/schema.prisma` - added the `AuditLog` model
- `src/lib/auth/actions.ts` - logs `sign_in`, `sign_in_failed`, `sign_out`
- `src/lib/auth/authorize.ts` - `requirePermission()` now logs `permission_denied` automatically whenever a check fails
- `src/app/dashboard/page.tsx` - added a "Recent activity" section, visible only to an account holding `audit.read`, and one em-dash removed from its copy

## What files were deleted

- `src/components/marketing/development-banner.tsx` - an orphaned, unused file left over from an earlier round. Nothing imported it anymore, but it still contained an em dash and "development preview" wording, both against your standing rules. Caught this while reviewing this round's changes.

## How to test it

```bash
npm install
npx prisma migrate dev --name add_audit_log
npm run dev
```

Sign out, then try signing in with the right email and a WRONG password - you should see the error message. Sign in for real. On `/dashboard`, "Recent activity" should show your sign-in, and if you look closely, the earlier failed attempt too - each with a green "allowed" or red "denied" badge and a timestamp.

```bash
npm run build
npm run lint
npx tsc --noEmit
```

## Known issue in my own build environment, not yours

`npm run build` fails in the sandbox I work in with `@prisma/client did not initialize yet` - I can't reach Prisma's servers to generate a real client there. Lint and the full TypeScript check both pass clean, which is what I actually can verify. Your machine has a real generated client, so `npm run build` should work for you.

## What comes next

Milestone C is done. Milestone D starts next - the real clinical schema: patients, visits, care plans, referrals, documents.