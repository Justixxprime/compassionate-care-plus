# REVIEW_MILESTONE_D.md

A review of everything built through Milestone D (patients, care team, visits, care plans, documents, referrals), written on 20 September 2026 when Milestone D finished. It says what I checked, what I found, and what I recommend. Findings marked "verified" were run or read in the code. Findings marked "read only" come from reading and were not run.

## What was checked

- Read every code file and every doc in the zip and compared it to GitHub. They match, except the migration folders (zips leave them out on purpose) and the git-ignored demo accounts doc.
- `tsc --noEmit`, `eslint` and `next build` are clean. (verified)
- `npm audit` reports 0 known vulnerabilities in the installed dependencies. (verified)
- `npm run verify:access`: 407 checks against a real local database, 0 failed. (verified)
- The referral and document server actions were called over real HTTP using React's own request encoder, the exact body a browser sends. They behaved as designed for the admin, the nurse and a signed-out visitor. (verified)
- Root layout and homepage name-checked. (verified)
- The access rules were broken on purpose in a copy: 8 for documents and 13 for referrals. The script failed each time. (verified)

## What is good and should not be weakened

- One door per data area. Pages and actions never decide access; the service files do. Every page and every server action re-checks on the server.
- The three-question pattern (permission, reach, then a slice-specific question) has held across five slices and is proven by tests that can fail.
- Vague not-found answers: a thing that does not exist and a thing you may not reach give the same words.
- Every denial is audited, and the audit log never holds content.
- Final states are final, and nothing clinical is ever hard-deleted.

## Findings, most important first

### Before anything real (blocks going live)

1. **The public `/request-care` form says "Request received" but saves and sends nothing.** (read only, plus documented in its own code comments) A real family using the live site would think they had reached the office. Decision needed: wire it up as its own slice (recommended: a public write to the database needs spam protection and a decision about what a stranger may store), or change the wording on the live site in the meantime.
2. **The whole site is marked `noindex` in the root layout.** (verified in `src/app/layout.tsx`) That is right for a surprise build, and wrong at launch: Google will never list the site. It must be flipped, deliberately, on launch day. It belongs on a written go-live checklist.
3. **Real patient files and real data.** Document bytes live in the database, which is fine for made-up data and wrong for real files. Encrypted object storage, virus scanning and the compliance work in `PHASE_0_ARCHITECTURE.md` section 18 come first. Paid services are your call.
4. **The repository is public.** `PROJECT_HANDOFF.md` names the owner and says the site is a surprise. `README.md` still promises the repo goes private "at the database phase at the latest", and that phase has passed. Your decision: private repo, or trim the file.

### Before Milestone E gets far (design debts that get more expensive over time)

5. **No way to put someone on a care team.** (verified: only the seed creates care-team rows) A patient created by accepting a referral has nobody on the team, exactly like Priya, so nobody can schedule or write for them. This is the first thing the staff screens need.
6. **CARE_COORDINATOR and CLINICAL_SUPERVISOR hold no permissions.** Referrals are the coordinator's job and plan approval is a supervisor's. This needs your decision (listed under decisions).
7. **The same two helpers are copied into four service files** (`loadActor` and `auditDenied` in visits, care plans, documents and referrals). (verified) It works and is tested, but the next fix to one would have to be made four times. Recommendation: extract them to one shared file as the very first change of Milestone E, guarded by the 407 checks.
8. **The audit log is thinner than the plan.** `PHASE_0` section 7 lists organization, patient, IP address, user agent and request id per entry. Today an entry holds actor, email, action, resource type and id, and outcome. (read only) Adding the patient id makes "everything that happened to this patient" answerable, which an investigation will ask for.
9. **Reading is only partly logged.** Document downloads are logged. Lists of visits, plans, documents and referrals are not. Decide before real use which reads must be recorded.
10. **No history of status changes.** A referral row records who decided and when, and the audit log records each event, but nothing stores each step's note. `PHASE_0` names a `referral_events` table.

### Before real users (Milestone F territory)

11. **Sign-in has no lockout or rate limit.** (verified: failed attempts are logged, never counted) The audit log even records the attempts, but nothing acts on them. `PHASE_0` requires progressive lockout and MFA for staff.
12. **The seed creates known-password accounts and has no guard.** (verified: no localhost check in `prisma/seed.ts`, while `verify-access.ts` has one) If the seed were ever run against a hosted database, a super admin with a documented password would exist. Recommendation: refuse to create demo accounts unless the database is local.
13. **`/design-system` is publicly reachable** on the deployed site. (read only: the page exists and has no sign-in check) It is only an internal style reference. Remove it from production or put it behind sign-in.
14. **The deployed site cannot run the internal screens.** (read only: I cannot see your Vercel settings) The demo database is local, so on Vercel `/sign-in` and `/dashboard` should have nothing to talk to. Worth checking what a visitor sees there before launch.
15. **No session management screens and no MFA yet.** Planned for Milestone F.
16. **Passwords have no rules** beyond what the sign-in form asks. Fine for demo accounts, not for real ones.

### Small things

17. `changePlanStatus` answers "not allowed" instead of "not recognised" when a nurse sends an action name that does not exist. Harmless. (read only)
18. `README.md` is stale (still says Phase 1, still says everything is a placeholder). (verified)
19. The proof pages (`/patients`, `/visits`, `/care-plans`, `/documents`, `/referrals`) are deliberately plain and each has its own link row. Milestone E replaces them with a real shared shell.
20. `verify-access.ts` is one 1,270-line script. It works and is worth its weight, but a future round should split it by area so a failing area is easier to run alone.

## Decisions that are yours (all still open)

- Wire the public request-care form as its own slice, or reword it for now.
- Repo private, or trim `PROJECT_HANDOFF.md`.
- Where real files will live (paid), and when to start the compliance work.
- Permission sets for CARE_COORDINATOR (recommended: `referrals.read`, `referrals.manage`, `patients.read`, `visits.read`, `visits.create`, `visits.update`, and care-team assignment) and CLINICAL_SUPERVISOR (recommended: care plan approval and read access to visits and documents).
- Whether ADMIN may archive documents, and whether consents should be restricted.
- Nurses see colleagues' visits; any team nurse can edit a draft plan; only ADMIN and SUPER_ADMIN approve plans.

## Proposal for Milestone E: the real staff-facing screens

Goal: replace the five plain proof pages with real screens for the people who do the work, one role at a time, each finishing in something you can show. Nothing in Milestone E adds a new access idea without a test that tries to break it first. I would not start this without your answers to the questions at the end.

**E0. Pre-work (about one round).** Extract the shared access helpers. Add care-team assignment as a real service with its own rules (who may assign, active dates, one primary nurse) and tests. Add the permission sets you decide for CARE_COORDINATOR and CLINICAL_SUPERVISOR. No screens yet.

**E1. The internal app shell (one round).** One shared layout for signed-in staff: navigation that shows only what the account may use, a real dashboard per role, consistent tables and empty states, phone-friendly. The five proof pages move into it.

**E2. Care Command Center for administrators and coordinators (two rounds).** Referral inbox with waiting time, the accept-and-assign flow, patient list and profile, staff list, scheduling board, the audit log page with filters. This is what an office manager would actually open every morning.

**E3. Clinical portal for nurses (two rounds).** My patients, my schedule, a patient chart page that brings together plans, visits, documents and referrals, and visit documentation. Needs one new table for visit notes and a rule for who reviews them. That is the first genuinely new clinical content since care plans, so it gets the full treatment.

**E4. Caregiver portal, phone first (one to two rounds).** Today's visits, check in and out, a task checklist. Designed at phone width first.

**E5. Patient and family portals (later, needs new tables).** Consents, messaging and notifications do not exist yet. Family access is consent-limited, which is the hardest access rule in the whole system, so it comes after the staff side is solid.

Honest size: E0 to E4 is roughly nine or ten rounds of the size you have been getting. E5 is bigger. The public request-care wiring and the go-live checklist can slot in whenever you decide.

## Questions for you before Milestone E starts

1. Which portal do you want to see first: the administrator's Care Command Center (my recommendation, it is what the office would use daily), or the nurse's portal?
2. Do you agree with the recommended permission sets for CARE_COORDINATOR and CLINICAL_SUPERVISOR above, or do you want to change them?
3. Should the public request-care form be wired up now (its own slice) or left for later, with the wording changed in the meantime?


## Update, 21 September 2026: decided

- **Supervisor access to restricted documents: DECIDED.** Restricted documents (insurance card, ID scan) are seen by SUPER_ADMIN and ADMIN only by default. An administrator can share them with one person, for one patient or one document, for as long as they choose (`docs/DOCUMENTS.md`, "Sharing restricted documents").
- **New small question:** ADMIN currently holds `documents.grant` as well as SUPER_ADMIN. If only the owner should be able to share, remove it from the ADMIN list in `prisma/seed.ts` (and from the ADMIN role in the database).
