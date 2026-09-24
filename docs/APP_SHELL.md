# APP_SHELL.md

The frame around every signed-in staff screen, and the rules that keep it safe. Built in Milestone E1.

## In plain words

When a staff member signs in they land inside one shared frame: a menu on the left (a menu button on a phone), and the screen in the middle. The menu shows only the screens that person's account can use. The dashboard on the first screen shows only what that person's account can see.

None of that is the lock. Hiding a menu link protects nothing. The lock is that every screen, and every action behind every button, asks the server again: who is this, and are they allowed?

## The three files called layout.tsx

| File | Job | Must contain |
|---|---|---|
| `src/app/layout.tsx` | The ROOT layout | the html and body tags, the `./globals.css` import |
| `src/app/(public)/layout.tsx` | Public website header and footer | `<Header`, no html or body |
| `src/app/(app)/layout.tsx` | The staff shell | `AppShell`, no html or body |

`scripts/check-root-layout.mjs` checks all three every time you run `npm run dev` or `npm run build`. It also stops with the exact `Remove-Item` commands if a screen folder exists twice (see below).

## Why the shell is not the lock

Next.js keeps a layout on screen while you move between pages inside it, so a layout does NOT run again on every click. If the shell were the only place that checked who you are, a session that expired would still be able to open a page. So:

- `src/lib/app/access.ts` gives every page `requireUser()` (redirects to `/sign-in` when nobody is signed in). React's `cache()` makes the shell and the page share one database lookup per request.
- Every `page.tsx` under `src/app/(app)` calls `await requireUser()` itself. `npm run verify:shell` reads every page file and fails if one forgets.
- Every service (`visits.ts`, `care-plans.ts` and so on) still checks permission and reach on every call.

## The menu

`src/lib/app/navigation.ts` (pure code, no database). Each menu item names the permission its page needs:

| Item | Needs |
|---|---|
| Dashboard | nothing (any signed-in account) |
| Patients | `patients.read` |
| Visits | `visits.read` |
| Care plans | `care_plans.read` |
| Referrals | `referrals.read` |
| Documents | `documents.read` |

An empty group is left out. The server sends the browser only the finished list.

The sharing screen (`/documents/sharing`) is not in the menu. It is reached from a button on Documents that only accounts holding `documents.grant` see.

## The dashboard

`src/lib/app/dashboard.ts` builds it only from the same service functions the other screens use, so it cannot show anyone something their own screens would refuse. Each section belongs to a permission, not a role name:

| Section | Appears when the account holds |
|---|---|
| Today's visits, overdue visits | `visits.read` |
| Referrals waiting (with how long each has waited) | `referrals.manage`, and reach over people who are not patients yet |
| Patients without a primary nurse | `care_team.read` |
| Care plans to approve | `care_plans.read` and `care_plans.approve` |
| Patient count | `patients.read` |
| Recent activity | `audit.read` |

A section the person cannot see is never computed and never sent. The "Needs attention" list at the top ranks what matters: urgent referrals, referrals waiting over two days, visits past their time and never checked in, patients with no primary nurse, plans waiting for approval. "Today" means today in office time (Central), not UTC.

The small decisions (waiting time, what counts as today, the attention wording) live in `src/lib/app/dashboard-logic.ts` so they are tested with made-up rows.

## Shared building blocks (`src/components/app`)

- `app-shell.tsx`: sidebar, phone top bar, skip link, sign out, the "Demonstration data" caption.
- `app-nav.tsx`: the only client component; highlights the current page, opens the phone menu, Escape closes it.
- `page-header.tsx`, `section.tsx`: one title style and one section style everywhere.
- `data-table.tsx`: a real table on wide screens, one card per row on phones.
- `empty-state.tsx`, `no-access.tsx`, `stat-tile.tsx`.
- `src/app/(app)/loading.tsx`, `error.tsx`, `not-found.tsx`. The error screen shows no message, only a short reference code (`error.digest`). In this version of Next.js it is given `retry()`, not `reset()`.

## Moving the screens (you must delete six folders once)

The dashboard, patients, visits, care-plans, documents and referrals folders moved from `src/app/` into `src/app/(app)/`. The web addresses did not change. Unzipping never deletes, so the old folders stay behind and Next.js will refuse to start. Delete the OLD ones:

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item -Recurse -Force "src\app\dashboard"
Remove-Item -Recurse -Force "src\app\patients"
Remove-Item -Recurse -Force "src\app\visits"
Remove-Item -Recurse -Force "src\app\care-plans"
Remove-Item -Recurse -Force "src\app\documents"
Remove-Item -Recurse -Force "src\app\referrals"
```

If you forget, `npm run dev` stops before starting and prints exactly which ones remain.

## Testing

`npm run verify:shell` (read-only, uses the demo accounts, changes nothing): the file layout, the menu each demo account gets, the dashboard each account gets, and the small decisions with made-up rows. 62 checks. Nine rules were broken on purpose and each was caught.

## Not built yet

No screens for care teams, staff, scheduling board or audit log (E2). No patient profile page. No notifications. Not checked in a real browser at phone size in the build environment (the HTML was fetched and checked, not looked at).

## Update, 24 September 2026: My day

A new menu item, **My day** (`/caregiver`), appears for anyone holding `visits.checkin`, at the top of the Care group. A caregiver's dashboard has one tile, "My visits today", that opens it. The menu still only decides what is drawn; `/caregiver` asks who is signed in by itself and the service checks permission, reach and ownership. See `CAREGIVER_PORTAL.md`.
