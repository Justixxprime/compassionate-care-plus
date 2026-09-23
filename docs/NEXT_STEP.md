# NEXT_STEP.md

**Last updated:** 23 September 2026
**Just finished:** you confirmed the drawer fix held, so E2 (the Care
Command Center) started right away, as promised. This is round 1 of E2:
the audit log organization bug is fixed, and four things are built -
the patient profile with a working care team panel (add and end), the
staff directory, the scheduling board, and the audit log page with
filters.

---

## The bug you named, fixed

`audit_logs` had no `organization_id` column, and `getRecentAuditLog`
had no organization filter at all - it returned every organization's
entries. With one organization in the database that was invisible, but
it is exactly the kind of gap that becomes a real cross-tenant leak the
moment a second organization exists.

**The fix:** added `organizationId` to the `AuditLog` model
(`prisma/schema.prisma`), and threaded it through every place an entry
gets written - `auditAllowed` and `auditDenied` in
`src/lib/auth/actor.ts` (the one place every service already calls
through, so this single edit fixed care-team, care-plans, documents,
referrals and visits all at once), plus the three call sites that write
directly (`src/lib/auth/authorize.ts`, `src/lib/auth/actions.ts`,
`src/lib/visits.ts`). `src/lib/audit/log.ts` stays foundational (no
dependency on `authorize.ts`, which would have created an import
cycle); the new permission-gated, organization-scoped reader for the
Audit log page lives one layer up, in `src/lib/audit-log.ts`.

**This needs a real migration** - see the exact command at the bottom.
There is no way to backfill `organizationId` on rows written before this
column existed; they simply have a null value and will not appear in
any organization's scoped view. That is fine for the demo data (nothing
important was riding on old audit rows) but worth knowing.

## What E2 round 1 built

**Patient profile - `/patients/[id]`.** One patient, everything your
own reach already allows: care team (with working add and end
controls), visits, care plans, documents, and the referral that brought
them in if there is one. This is six existing, already-checked reads
composed together (`getPatientDetail` is the one new read function;
everything else - `listCareTeam`, `listVisits`, `listCarePlans`,
`listDocuments`, `listReferrals` - already existed and is just filtered
down to this one patient). A section whose permission your account
lacks is simply left out, the same pattern the dashboard uses - a nurse
without `care_team.read`, for instance, sees everything except the
"Care team" section, and that was confirmed against a real nurse
account this round, not assumed.

Patient names on `/patients` now link here. `/patients` also gained a
"Need a primary nurse" worklist at the top, using
`listPatientsNeedingTeam`, which already existed but had nowhere to
live.

**Accept-and-assign, one flow.** Accepting a referral now sends you
straight to the new patient's profile, where the care team panel is
right there waiting. `changeReferralStatusAction` returns the
`patientId` `changeReferralStatus` already gave back; the referral
card's Accept button reads it and navigates. Open referrals also now
show a "Waiting X" badge, computed from `createdAt` with the
`formatWaiting` helper that already existed but was not used anywhere
visible yet.

**Staff directory - `/staff`.** Read-only: everyone with an account in
the organization, their roles, and how many active patients they are
currently on the care team for. Gated on `staff.manage`, same as
everyone else with that permission (`ADMIN`, `SUPER_ADMIN`). Creating or
editing a staff account is real user provisioning and is deliberately
not part of this round.

**Scheduling board - `/schedule`.** A Monday-through-Sunday week view of
every visit your account can see, with the existing schedule form
embedded and week navigation. No new database query: it is built
entirely on `listVisits` and `getSchedulingOptions`, both already
permission- and reach-checked. The day-grouping math is pure functions
in `src/lib/app/schedule-logic.ts`, kept apart from the database the
same way `dashboard-logic.ts` is, so it can be tested the same way.

**Audit log - `/audit-log`.** Filtered by action, outcome and who,
gated on `audit.read`, and - the point of this round - scoped to your
own organization. `src/lib/audit-log.ts` is the one door onto it.

## Nav

Four new links: Scheduling board (next to Visits, needs `visits.read`),
Staff and Audit log (in Office, need `staff.manage` and `audit.read`).
`src/lib/app/navigation.ts` and `src/components/app/app-nav.tsx` both
touched (new `NavIconKey` values, new icons).

## What was tested this round

Everything above was checked against a real, seeded Postgres database
in the sandbox, not just read back:

- `npx tsc --noEmit` and `npx eslint` - clean.
- Full 8-migration history from GitHub applied, plus this round's new
  column, by hand with `psql` (sandbox only - see the recipe note at
  the bottom of the standing prompt for why).
- `npm run verify:access` - **661 passed, 0 failed.** Every existing
  access rule still holds; the audit-scoping change touched a lot of
  files but broke nothing.
- `npm run verify:shell` - failed on 5 checks at first, all of them the
  test file's own hardcoded menu lists, which did not yet know about
  the four new nav items. Updated those five expectations in
  `scripts/verify-shell.ts` to match the real new menu (worth a look:
  `admin`/`nurse` used to share one `everything` list, and now they do
  not, since only `ADMIN`/`SUPER_ADMIN` hold `staff.manage` and
  `audit.read`). **62 passed, 0 failed** after that.
- `npx next build` - compiled clean, all four new routes show up as
  server-rendered.
- A live smoke test: `next start` plus real session cookies for the
  demo admin and a demo nurse, `curl`-ing `/patients/[id]`, `/staff`,
  `/audit-log` and `/schedule`. Confirmed real content renders (care
  team panel, staff emails, audit entries with allowed/denied, the week
  grid with real patient names), confirmed the nurse gets "does not
  have access" on `/staff` and `/audit-log`, and confirmed the nurse's
  own patient profile correctly hides the Care team section (no
  `care_team.read`) while still showing visits, care plans, documents
  and the referral.

**Not tested this round:** the "add to care team" and "end assignment"
buttons on the patient profile page were not clicked through a real
browser session (the smoke test above was read-only `curl`, which
cannot submit a form). The service functions underneath them
(`assignToCareTeam`, `endCareTeamAssignment`) are the same ones the
661-test `verify:access` suite already exercises directly and
thoroughly, so the rule logic is well covered - what is not covered is
the click-through UI wiring itself. Worth being the thing you try first.

## Still open, deliberately not touched this round

`/design-system` still publicly reachable. `/request-care` still says
"Request received" and saves nothing. The repo is still public. Full
list in `docs/REVIEW_MILESTONE_D.md`, unchanged.

## Next (E2 round 2, once you have tried this round)

Referral inbox and worklist are done. Still open from the original E2
list: the audit log page could use pagination past 200 rows if that
ever matters for the demo; a real "create staff account" flow if you
want one before Milestone F. Otherwise E2 is essentially complete -
tell me what you find, and E3 (the clinical portal, which needs a visit
notes table) is next.

## Exact next commands

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_organization_to_audit_log
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run dev
```

Then, once you have clicked through the care team add/end buttons and
they look right:

```powershell
git add .
git commit -m "E2 round 1: patient profile with care team panel, staff directory, scheduling board, audit log page scoped to organization"
git push
```
