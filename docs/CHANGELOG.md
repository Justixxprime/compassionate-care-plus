## Documents - fourth slice of Milestone D
**19 September 2026**

Added
- prisma/schema.prisma - Document and DocumentFile models (new migration required: add_documents). No new permission: documents.read, documents.upload and documents.delete already existed.
- src/lib/documents.ts - listDocuments, getDocumentUploadOptions, uploadDocument, getDocumentForDownload, archiveDocument: every document rule in one file
- src/lib/document-constants.ts - categories and which are restricted (unknown categories fail closed), size limits, file type detection from the file's own bytes, file name cleaning
- src/lib/documents-actions.ts - thin server actions for upload and archive
- src/app/documents/ - page.tsx, upload-document-form.tsx, archive-button.tsx, and [id]/download/route.ts (the only door the file bytes leave through)
- prisma/demo-pdf.ts - builds small real PDFs by hand, no new dependency
- docs/DOCUMENTS.md

Changed
- prisma/seed.ts - five synthetic documents (Eleanor: consent, physician order, insurance card; Marcus: consent, photo ID), created only when none exist. The insurance card and the photo ID are in restricted categories.
- scripts/verify-access.ts - new sections 2c and 11a to 11f, cleanup extended to documents. 254 checks now.
- next.config.ts - Server Action request limit raised from 1 MB to 3 MB so a 2 MB document can be uploaded
- src/app/dashboard/page.tsx - "View documents" link, shown only to accounts holding documents.read
- docs: RBAC, AUDIT_LOGGING, DATABASE, FOLDER_STRUCTURE, DEMO_ACCOUNTS, PHASE_STATUS, NEXT_STEP, PROJECT_HANDOFF, CONTINUATION_PROMPT

Verified in the build environment (real Postgres, real generated Prisma client)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/documents and /documents/[id]/download are dynamic)
- verify:access: 254 passed, 0 failed. With eight rules deliberately broken one at a time (list filter, category rule everywhere, category check on download, file type from bytes, download audit, archived still downloadable, relationship check on download, duplicate check) it failed on those rules each time, and the database was left clean.
- Real HTTP against the built app with real sessions: admin downloaded all five documents; nurse one got only Eleanor's consent and order; nurse two only Marcus's consent; the insurance card, the photo ID, another patient's document and a made-up id all returned the same 404 with the same words to a nurse; signed out gets 401; headers include attachment, nosniff and no-store; a downloaded file is a valid PDF
- Root layout and homepage name-checked (see NEXT_STEP)
- NOT tested end to end: the upload form's server action over real HTTP (no browser in the build environment). The upload rules underneath it are fully tested.

## Care plans - third slice of Milestone D
**19 September 2026**

Added
- prisma/schema.prisma - CarePlan and CarePlanGoal models (new migration required: add_care_plans)
- src/lib/care-plans.ts - listCarePlans, getPlanCreateOptions, createCarePlan, updateCarePlan, addGoal, removeGoal, markGoalMet, changePlanStatus: every care plan rule in one file
- src/lib/care-plan-constants.ts - statuses, the transition table, size limits
- src/lib/care-plans-actions.ts - thin server actions, identity from the session only
- src/app/care-plans/page.tsx, create-plan-form.tsx, plan-controls.tsx - bare proof page
- docs/CARE_PLANS.md

Changed
- src/lib/patients.ts - added isActiveCareTeamMember(), the "on this patient's team right now" test, built on the same activeAssignmentFilter. Nothing that existed was changed.
- prisma/seed.ts - new permission care_plans.create (31 permissions now), NURSE now holds care_plans.create and care_plans.update, two synthetic care plans (Eleanor active, Marcus draft) created only when none exist
- scripts/verify-access.ts - new sections 2b and 10a to 10i, cleanup extended to care plans. About 175 checks now.
- src/app/dashboard/page.tsx - "View care plans" link, shown only to accounts holding care_plans.read
- src/app/layout.tsx - added suppressHydrationWarning to <body> so browser extensions (Grammarly, ColorZilla) that add attributes to the page no longer raise a development warning. The html, body and globals.css import are all still there and the root layout guard passes.
- docs: RBAC, AUDIT_LOGGING, DATABASE, FOLDER_STRUCTURE, TROUBLESHOOTING, DEMO_ACCOUNTS, PHASE_STATUS, NEXT_STEP, PROJECT_HANDOFF, CONTINUATION_PROMPT
- Em dashes removed from the docs (standing rule: none anywhere)

Removed
- src/components/marketing/coming-soon-page.tsx - unused since every stub page got real content, and it still contained "This page is a placeholder" wording

Verified in the build environment (real Postgres, real generated Prisma client)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/care-plans is dynamic)
- verify:access: 175 passed, 0 failed. With five rules deliberately broken (four-eyes, team requirement on create, locked wording, relationship check, one active plan) it failed on exactly those rules each time, and the database was left clean.
- The rendered /care-plans page fetched with real sessions: admin sees both plans with Approve/Discard on Marcus's draft and Complete on Eleanor's plan, no edit boxes; nurse one sees only Eleanor's plan; nurse two sees only Marcus's draft with edit controls and no Approve; signed-out is redirected to /sign-in
- Root layout and homepage name-checked: src/app/layout.tsx has html, body and the globals.css import; src/app/(public)/page.tsx is the real cinematic homepage and differs from about/page.tsx

## Visits - second slice of Milestone D
**19 September 2026**

Added
- prisma/schema.prisma - Visit model (new migration required: add_visits)
- src/lib/visits.ts - listVisits, getSchedulingOptions, scheduleVisit, changeVisitStatus: every visit rule in one file
- src/lib/visit-constants.ts - visit types, statuses, the status transition table
- src/lib/visits-actions.ts - thin server actions, identity from the session only
- src/lib/time.ts - office time (America/Chicago) helpers, daylight-saving safe, no date library
- src/app/visits/page.tsx, schedule-visit-form.tsx, visit-actions.tsx - bare proof page with a scheduling form and status buttons
- scripts/verify-access.ts and scripts/stubs/server-only.ts, tsconfig.scripts.json - `npm run verify:access`, about 70 checks that try to break the access rules against a real local database, then clean up
- docs/VISITS.md, docs/CONTINUATION_PROMPT.md

Changed
- src/lib/patients.ts - the relationship rule is now shared: getPatientScope(), scopeAllowsPatient(), canAccessPatient(), activeAssignmentFilter(). getAccessiblePatients() behaves exactly as before (re-verified: admin sees 3, nurse sees 1)
- prisma/seed.ts - added demo.nurse2@cheliv.test (assigned to Marcus Delgado) and 6 synthetic visits, created only when no visits exist yet
- src/app/dashboard/page.tsx - "View visits" link, shown only to accounts holding visits.read
- package.json - added the verify:access script
- docs/PATIENTS.md, RBAC.md, AUDIT_LOGGING.md, DATABASE.md, TROUBLESHOOTING.md - short additions
- docs/DEMO_ACCOUNTS.md - restored the missing admin section, added nurse two

Verified in the build environment (a real Postgres and a real generated Prisma client this time, not a stub)
- tsc --noEmit clean, eslint clean, `next build` succeeds (/visits is dynamic)
- verify:access: 69 passed, 0 failed; with two rules deliberately broken it failed on exactly those rules
- The rendered /visits page, fetched with real sessions: admin sees all 6 visits, nurse one sees only Eleanor's 4, nurse two sees only Marcus's 2, signed-out is redirected to /sign-in

## Patients and relationship-based access
**17 September 2026**

Added
- prisma/schema.prisma - Patient, CareTeamMember models (new migration required)
- src/lib/patients.ts - getAccessiblePatients(), real relationship-based access logic
- src/app/patients/page.tsx
- docs/PATIENTS.md

Changed
- prisma/seed.ts - added demo.nurse@cheliv.test, three synthetic demo patients, one care-team assignment, real permission sets for ADMIN and NURSE roles
- src/app/dashboard/page.tsx - added a link to /patients
- docs/DEMO_ACCOUNTS.md - documents both demo accounts now

Milestone D has started. First slice (patients + care team) complete.

## Audit logging - Milestone C complete
**17 September 2026**

Added
- prisma/schema.prisma - AuditLog model (new migration required)
- src/lib/audit/log.ts - writeAuditLog, getRecentAuditLog
- docs/AUDIT_LOGGING.md

Changed
- src/lib/auth/actions.ts - logs sign_in, sign_in_failed, sign_out
- src/lib/auth/authorize.ts - requirePermission() logs permission_denied automatically
- src/app/dashboard/page.tsx - added Recent activity section, gated behind audit.read

Fixed
- getRecentAuditLog's return type wasn't explicit, causing an implicit-any type error - added an explicit AuditLogEntry interface

Milestone C (database, auth, RBAC, audit logging) is now complete.

## RBAC enforcement layer
**17 September 2026**

Added
- src/lib/auth/authorize.ts - hasPermission, requirePermission, getUserPermissions
- docs/RBAC.md

Changed
- /dashboard now demonstrates real permission checks: shows the signed-in user's full permission list, conditionally renders two demo elements based on actual hasPermission() results

Notes
- NEXT_STEP.md and PHASE_STATUS.md were out of date (predated the homepage rebuild and full auth flow) - both rewritten to match actual current state

## Real logo, icon system, fuller header/footer, first database schema
**16 September 2026**

Added
- Original logo mark (logo-mark.tsx) - no official Cheliv logo exists online
- lucide-react icon system: services, contact page, footer
- Full sectioned dark footer, compact redesigned header
- Prisma schema (organizations, users, sessions, roles, permissions) and seed script
- docs/DATABASE.md, docs/DEMO_ACCOUNTS.md (git-ignored)

Fixed
- Homepage services list de-duplicated to pull from the single services-data.ts source
- npm arborist bug during Prisma install (clean reinstall)
- Prisma pinned to 6.19.3 after newer versions pulled in unrelated vulnerable dependencies; deepmerge-ts override closes the remaining one - npm audit now clean

Confirmed via official Texas HHSC / Medicare.gov-sourced directory listings
- Cheliv is a real, already-licensed, operating home health (clinical) agency, license #017743
- Service scope confirmed as clinical home health, not non-medical home care only

Still open
- Phone number discrepancy: site shows (281) 903-7551, official listings show (281) 565-3336

## Guard script for the recurring layout bug, real photography
**16 September 2026**

Added
- `scripts/check-root-layout.mjs` - automated check that runs before every `npm run dev` and `npm run build`, catching the root layout bug that has broken the site three times, before Next.js even starts
- Real, free, Pexels-licensed photography wired into the homepage hero, homepage "who we serve" section, and About page
- `docs/IMAGES.md` rewritten to document exactly what's live and how to replace it with real photos later
- `next.config.ts` now allows `images.pexels.com` for a future switch to `next/image`

Fixed
- The root layout bug, again, this time with a permanent automated safeguard rather than a one-time manual fix

## Rebrand, placeholder removal, cinematic overhaul
**15 September 2026**

Changed
- Brand name updated to "Cheliv Compassionate Care Plus" everywhere, driven from one shared constant
- Removed all em dashes from visible copy (bullet markers and mid sentence punctuation)
- Removed the development banner and every "to be confirmed" / "illustrative" label
- How We Care, Who We Serve, Resources and Sign In rewritten from build-phase stubs into real pages
- Homepage, About, Contact, Services rebuilt with a cinematic dark hero treatment, bold clamp() based type scale, and an animated gradient backdrop (AuroraField)
- Added a bold "by the numbers" stat band to the homepage itself

Removed
- `development-banner.tsx` and `coming-soon-page.tsx` (no longer needed)

Kept, intentionally
- The four footer legal links still lead nowhere real, since writing actual legal text is a genuine liability regardless of the rest of the site's tone

## Phase 7 - Real request-care form
**15 September 2026**

Added
- `src/components/marketing/request-care-form.tsx` - real client-side form: name, email, phone, relationship, preferred contact method, service interest, best time, optional message
- Real `/request-care` page with the real office phone as an urgent-need fallback

Notes
- Confirmed via the project owner's uncle's own Facebook profile that the real legal name is "Cheliv Compassionate Care Plus INC" - a site-wide rename decision is pending
- Form has no backend to submit to yet (Milestone C not built) - documented clearly rather than faked

## Root layout fix, real content, motion system
**15 September 2026**

Fixed
- `src/app/layout.tsx` had been overwritten with duplicate `(public)/layout.tsx` content - missing html/body/metadata/CSS import. This caused both a local runtime error and a completely unstyled Vercel deployment. Restored correct content.

Added
- Motion system: scroll-reveal (`Reveal`), animated stat count-up (`StatCounter`), hero entrance animation, sticky header with scroll shadow - all respecting prefers-reduced-motion, with a noscript fallback for reveal content
- Real confirmed content: office address, phone, and About page stats (previously placeholders, now confirmed real by the project owner)

## Phase 6 - About and contact content
**15 September 2026**

Added
- Real `/about` page - "treat, then teach" positioning, beliefs list, stats bar (placeholder values), mission statement
- Real `/contact` page - placeholder address, phone/fax, example office hours

Notes
- Structure and copy style informed by a mock site built while learning (Cheliv Compassionate Care Plus) - specific facts (address, phone, stats) kept as placeholders pending confirmation they belong to this organization

## Phase 5 - Public service pages
**15 September 2026**

Added
- `src/lib/services-data.ts` - single source of truth for all service content
- Real `/services` index page (replacing the placeholder stub)
- `/services/[slug]` dynamic detail pages, statically generated per service

Fixed
- Documented and instructed removal of a leftover `src/app/page.tsx` that a prior ZIP delivery didn't clean up on the user's machine, which was causing the old Phase 2 placeholder to display instead of the real homepage

## Phases 3 & 4 - Public website foundation and homepage
**15 September 2026**

Added
- Public site layout: header (desktop + mobile nav), footer, persistent development banner
- Original SVG hero illustration - no stock photography
- Real homepage: hero, "how we care" process, services overview, who-we-serve, request-care CTA, FAQ accordion
- Placeholder pages for About, Services, Who We Serve, How We Care, Resources, Contact, Request Care, Sign In - so no nav link 404s
- `buttonVariants()` helper so links can look like buttons without invalid nested-button HTML
- `docs/PUBLIC_WEBSITE.md`

Changed
- Removed the old root `page.tsx` - homepage now lives inside the `(public)` route group

# CHANGELOG

## Phase 2 - Design system
**15 September 2026**

Added
- `src/styles/tokens.css` - color, type scale, spacing, radius and shadow tokens
- Self-hosted fonts: Source Serif 4 (display) and IBM Plex Sans (body/UI), via @fontsource - no runtime request to Google Fonts
- First five components: Button, Input, Label, Card, Badge
- `cn()` utility for merging Tailwind classes (clsx + tailwind-merge)
- `/design-system` reference page showing every token and component rendered
- `docs/DESIGN_SYSTEM.md`

Changed
- `globals.css` rewritten to wire tokens into Tailwind's theme
- Homepage updated to use real tokens instead of Phase 1 placeholder grays

## Phase 1 - Project initialization
**15 September 2026**

Added
- Next.js 16.3.5 project with React 19, TypeScript (strict) and Tailwind CSS 4
- Placeholder homepage at `/` stating clearly that no content is confirmed yet
- Root layout with project metadata and `robots: noindex` for the development build
- `prefers-reduced-motion` support in global styles, from the first commit
- `.env.example` template and documentation of every planned variable
- Documentation set: README, ULTRA_BABY_STEPS, PHASE_0_ARCHITECTURE, ENVIRONMENT_VARIABLES, FOLDER_STRUCTURE, TROUBLESHOOTING, NEXT_STEP, PHASE_STATUS

Changed
- Replaced the generator's default demo page and default dark-mode styles
- Extended `.gitignore` so `.env.example` is committed while all other env files are blocked

Removed
- Generator extras `AGENTS.md` and `CLAUDE.md`

## Phase 0 - Architecture
**15 September 2026**

- Planned the whole platform: roles, feature tiers, sitemaps, database, RBAC, security, design direction, cloud, phases, risks
- Reordered the build so database, authentication and API come before the portals
