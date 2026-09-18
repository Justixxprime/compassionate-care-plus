# RBAC (Role-Based Access Control)

How permissions actually get checked in this app, and why it's built this way.

## The one rule this whole file protects

**Every permission check goes through `src/lib/auth/authorize.ts`.** No page, no server action, no future API route queries the database directly to decide who can see or do something. One path means one place to get it right, and one place to audit later - not five copies of similar-looking logic slowly drifting apart.

## The three functions

- **`hasPermission(userId, key)`** — returns true/false. Use this to decide whether to *render* something (a nav link, a button). A "no" here just means "don't show it."
- **`requirePermission(userId, key)`** — throws `AuthorizationError` if the permission is missing. Use this at the very start of any server action or data-fetching function that does something sensitive. This is the actual security boundary — a hidden button is not one, since a determined user can call the underlying action directly and skip the UI entirely.
- **`getUserPermissions(userId)`** — every permission key a user holds, across every role. Used to render a full permission list, or to check several permissions without a separate database round trip for each.

## Why permission checks live in the database, not in code

The permission list and which roles hold which permissions are real rows (`permissions`, `role_permissions`, `user_roles` — see `docs/DATABASE.md`), not a hardcoded object in a TypeScript file. That means granting a role a new permission later is a data change, not a code change and a redeploy.

## How it's proven working right now

`/dashboard` calls all three functions for real: it shows the signed-in user's actual permission list, and it conditionally renders two demo elements based on whether the account actually holds `staff.manage` and `audit.read`. This isn't decorative — sign in as the demo admin (who holds every permission) and both show up; if a role without those permissions existed and signed in, they wouldn't.

## What's NOT built yet

- No actual admin UI to grant or revoke a role's permissions yet (that's the admin portal, Milestone E)
- No fine-grained per-resource checks yet (e.g., "can this nurse see *this specific* patient" — that needs the care-team relationship data from Milestone D, not just a role permission)
- `requirePermission`'s throw isn't caught anywhere specific yet with a nice error page — that's part of the error-handling phase later
