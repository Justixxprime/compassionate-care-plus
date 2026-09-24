# TASKS.md

**Milestone E4, round 1. 23 September 2026.**

## What a task is, in plain words

A task is a small piece of work somebody owes. "Confirm the medication
list with the family." "Call back the two referral sources." It has one
person responsible, one person who asked, an optional patient, and an
optional due date. It is either open, done or cancelled. Done and
cancelled are final.

## Who can do what

Three questions, asked in this order every time (`src/lib/tasks.ts`):

1. **Permission.** `tasks.read` lets you see tasks and finish the ones
   given to you. `tasks.manage` lets you create tasks and cancel the ones
   you created. Without the permission the page shows a plain "no
   access" message and the refusal goes in the audit log.
2. **Reach.** A task about a patient is only visible to someone who can
   still reach that patient. If a nurse comes off a patient's care team,
   that patient's tasks vanish from the nurse's list and cannot be
   finished.
3. **Ownership.** Administrative roles (Super Admin, Admin, Clinical
   Supervisor, Care Coordinator) see every task in the organization.
   Everyone else sees only tasks given to them or created by them.

**Creating.** An administrative role may give a task to any person in
the organization who holds `tasks.read`. Everyone else may only give
tasks to themselves. A task about a patient may only go to someone who
can reach that patient, so a task can never hand a patient's name to
someone with no business seeing it. Made-up people, made-up patients and
patients outside your reach all get the same plain words.

**Finishing.** The person responsible, or an administrative role.

**Cancelling.** The person who created it, or an administrative role.

## Permissions this round

`tasks.read` and `tasks.manage` already existed in the seed. Now:

- ADMIN and SUPER_ADMIN: both (unchanged).
- NURSE: `tasks.read` (unchanged) plus `tasks.manage` (new), so a nurse
  can note a to-do for themselves.
- CARE_COORDINATOR and CLINICAL_SUPERVISOR: both (new).

## Audit

`task_created`, `task_completed`, `task_cancelled`. The log records that
it happened, never the title or the details, because a title can name a
patient's need.

## Files

- `prisma/schema.prisma`: the `Task` model (table `tasks`).
- `src/lib/task-constants.ts`, `src/lib/tasks.ts`, `src/lib/tasks-actions.ts`.
- `src/app/(app)/tasks/page.tsx`, `task-form.tsx`, `task-actions.tsx`.
- `src/lib/app/navigation.ts` and `src/components/app/app-nav.tsx`: the
  "Tasks" menu item, shown to anyone holding `tasks.read`.
- `scripts/verify-tasks.ts`: `npm run verify:tasks`, 40 checks.
- `prisma/seed.ts`: three synthetic demo tasks, only when there are none.

## Not built yet

Recurring tasks, comments on a task, and a task widget on the dashboard.
Notifications (assigned, finished, cancelled) now exist: see
`docs/NOTIFICATIONS.md`.

## Update, 24 September 2026: the caregiver checklist

A caregiver holds `tasks.read` only. The caregiver portal (`/caregiver`) shows her open tasks as a checklist with one big **Mark done** button each, using the same `listTasks` and `changeTaskStatus` as the Tasks screen, so the same rules apply: she can finish a task given to her, cannot create one, cannot cancel one and cannot see anyone else's. See `CAREGIVER_PORTAL.md`.
