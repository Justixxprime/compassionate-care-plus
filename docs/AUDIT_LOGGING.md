# AUDIT LOGGING

Who did what, when, and whether it was allowed - and just as importantly, what does NOT get recorded.

## The one rule this file protects

**Never log the content of what was viewed or changed.** "Clinical record viewed" is a valid audit entry. What that record said is never one - see PHASE_0_ARCHITECTURE.md section 56.

## What gets logged right now

- `sign_in` - a successful sign-in, tied to the real user
- `sign_in_failed` - a failed attempt, tied to the EMAIL that was tried (there's no real user row to attach it to when the email doesn't exist)
- `sign_out`
- `permission_denied` - written automatically by `requirePermission()` whenever a permission check fails

## Where it lives

`src/lib/audit/log.ts` - one function to write (`writeAuditLog`), one to read the most recent entries (`getRecentAuditLog`).

## A deliberate design choice: it never throws

If writing an audit entry fails, that gets logged to the server console, not thrown back at whoever's signing in or out.

## How it's proven working right now

`/dashboard` shows a "Recent activity" section, visible only to an account holding `audit.read`.

## What's NOT built yet

- No dedicated audit log page with real filtering/search yet - Milestone F
- Doesn't log clinical events yet - the clinical schema is Milestone D
- No retention policy decided yet