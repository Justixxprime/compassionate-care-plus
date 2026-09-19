# AUDIT LOGGING

Who did what, when, and whether it was allowed - and just as importantly, what does NOT get recorded.

## The one rule this file protects

**Never log the content of what was viewed or changed.** "Clinical record viewed" is a valid audit entry. What that record said is never one - see PHASE_0_ARCHITECTURE.md section 56. This matters more than almost anything else in this system: an audit log that leaks the sensitive content it's supposed to be protecting has failed at its one job.

## What gets logged right now

- `sign_in` - a successful sign-in, tied to the real user
- `sign_in_failed` - a failed attempt, tied to the EMAIL that was tried (there's no real user row to attach it to when the email doesn't exist - the attempt itself is still worth recording, since repeated failures against one email is exactly what a future lockout policy would watch for)
- `sign_out`
- `permission_denied` - written automatically by `requirePermission()` in `src/lib/auth/authorize.ts` whenever a permission check fails. This is the single most useful entry type for catching something going wrong.

## Where it lives

`src/lib/audit/log.ts` - one function to write (`writeAuditLog`), one to read the most recent entries (`getRecentAuditLog`). Same principle as RBAC: one path in, so nothing writes a slightly different shape of entry from a different file.

## A deliberate design choice: it never throws

If writing an audit entry itself fails for some reason, that failure gets logged to the server console, not thrown back at whoever's signing in or out. A broken audit log should never be the reason a real person can't sign in - it should be visible to a developer, not experienced as a broken app by an actual user.

## How it's proven working right now

`/dashboard` shows a "Recent activity" section, visible only to an account holding `audit.read` (this is `hasPermission()` from the RBAC layer, doing exactly what it's for). Sign in, sign out, sign in with a wrong password - each shows up in the list with its outcome (allowed or denied) and when it happened.

## What's NOT built yet

- No dedicated audit log PAGE yet with real filtering/search - that's the Security Center, Milestone F
- Doesn't log clinical events yet (patient viewed, document downloaded, etc.) - those events don't exist yet, since the clinical schema itself is Milestone D
- No retention policy decided yet (how long entries are kept)

## Update, 19 September 2026: visit events

Now logged: `visit_created`, `visit_checked_in`, `visit_checked_out`, `visit_cancelled`, `visit_marked_missed`, and `access_denied` (outcome `denied`) when someone reaches for a patient or visit their relationship does not allow. As before, only that it happened is recorded, never content. Reading a list of visits is not logged. See `docs/VISITS.md` for why.

## Update, 19 September 2026: care plan events

Now logged: `care_plan_created`, `care_plan_updated`, `care_plan_goal_added`, `care_plan_goal_removed`, `care_plan_goal_met`, `care_plan_approved`, `care_plan_completed`, `care_plan_discarded`, and `access_denied` (outcome `denied`) when someone reaches for a plan their relationship does not allow, writes to a patient they are not on the team of, or tries to approve their own plan. The plan's title, summary and goals are never written to the log. Reading plans is not logged. See `docs/CARE_PLANS.md`.
