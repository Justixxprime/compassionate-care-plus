# CHELIV COMPASSIONATE CARE PLUS — PROJECT CONTINUATION BRIEF

Paste this whole document as the first message in a new conversation to continue this build exactly where it left off.

---

## What this project is

A digital platform for **Cheliv Compassionate Care Plus Inc.**, a real, already-licensed, currently-operating home health agency in Stafford, Texas (Texas HHSC license #017743). The person building this is the owner's nephew, building it as a **surprise** — the owner does not know this is being built for him. Move fast, minimal hand-holding, no long explanations unless something is genuinely risky or broken.

**Repo:** https://github.com/Justixxprime/compassionate-care-plus.git (public repo — must go private before real secrets/patient data exist)
**Local path:** `C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus` (kept in OneDrive despite sync risk — his choice)
**Deployed:** compassionate-care-plus.vercel.app, auto-deploys from `main`

## Real confirmed facts (safe to use, not placeholders)

- **Legal name:** Cheliv Compassionate Care Plus Inc — use "Cheliv" as the primary brand name, "Compassionate Care Plus" as the subtitle/descriptor
- **Address:** 4434 Blue Bonnet Dr, Suite 151, Stafford, TX 77477
- **Service scope:** confirmed clinical home health (skilled nursing, PT, OT, ST, wound care, medication management) — NOT non-medical home care only. This was genuinely disputed across directory listings; the owner's nephew confirmed clinical home health is correct.
- **Stats (owner-confirmed as real):** 10+ counties served, 50+ licensed clinicians, 1,000+ patients cared for annually, 100% home-based recovery focus
- **Owner:** Charles Obioma, CEO/Founder/Administrator (confirmed via his own Facebook). Also runs a second business, "St. Charles Home health care services Inc." Lives in Houston, TX.
- **License:** Texas HHSC license #017743

## UNRESOLVED — do not guess, ask first

**Phone number conflict.** The site currently shows **(281) 903-7551** (from an old mock the nephew built). Every official directory listing (Medicare.gov-sourced, HHSC-referencing) shows **(281) 565-3336** instead. This has NOT been resolved — ask the user which is correct before changing anything, and don't silently pick one.

**Fax number** — never confirmed real, currently omitted from the site entirely (not shown as a placeholder, just left out).

**Real photography** — currently using 3 hotlinked Pexels stock photos (free license, no attribution required) on the homepage hero, homepage "who we serve" section, and About page. Swap for real photos of the actual office/team whenever the user provides them — see `docs/IMAGES.md`.

## Explicit standing instructions from the user

1. **No em dashes anywhere in copy.** Checked and enforced site-wide already — keep enforcing on all new content.
2. **No visible "placeholder" / "to be confirmed" / dev-banner framing anywhere.** This must read as a real, finished, professional site — it's a surprise reveal, not a work-in-progress demo. The ONE exception: the four footer legal links (privacy policy, terms, accessibility, notice of privacy practices) intentionally lead nowhere real yet, and are NOT flagged as placeholders either — they just read as normal footer text. This is because writing actual legal/HIPAA text wrong is a real liability regardless of how polished everything else looks. Do not write real privacy policy/terms/consent language without the user explicitly providing it or asking for it with full awareness of the risk.
3. **Very cinematic, bold, premium, "alive," high-tech, big, detailed.** Reference points the user gave: Mayo Clinic's site (small restrained logo lockup, huge bold serif headlines, comprehensive multi-section footer, premium editorial feel). The site already has: a dark full-bleed hero with an animated CSS gradient backdrop (`AuroraField` component, no video needed), `clamp()`-based bold responsive type scale, scroll-reveal animations throughout (`Reveal` component), an animated stat counter (`StatCounter`), a real logo mark, and lucide-react icons throughout.
4. **Always verify before shipping.** The user has repeatedly caught stale/incorrect files in delivered zips. Established process now: after packaging any zip, extract it fresh to a separate temp folder and diff every critical changed file against the working directory before presenting it. Never skip this.
5. **Check GitHub directly when diagnosing bugs**, don't just guess from terminal output — `git clone` the actual repo (github.com and codeload.github.com are reachable from the sandbox) and inspect real files directly. This has been essential for catching real bugs (see below).

## The recurring bug that's now permanently guarded against

`src/app/layout.tsx` (the ROOT layout — must have `<html>`, `<body>`, and `import "./globals.css"`) kept getting overwritten with the content of `src/app/(public)/layout.tsx` (the header/footer wrapper — must NOT have `<html>`/`<body>`). Happened three times, always causing either a "Missing html and body tags" runtime error or a completely unstyled deployed site. Root cause was almost certainly confusing the two same-named `layout.tsx` files across VS Code tabs.

**Permanent fix in place:** `scripts/check-root-layout.mjs` runs automatically via `predev`/`prebuild` npm hooks before every `npm run dev` and `npm run build`. It reads the file, checks for the required markers, and refuses to proceed with a clear red terminal error if the bug recurs — pointing to `docs/TROUBLESHOOTING.md` for the fix. Tested and confirmed working both ways (passes correct file, blocks the exact bug pattern).

## Recurring environment quirks worth knowing

- **Zombie dev server processes on Windows.** Port 3000 has repeatedly stayed occupied by an orphaned `npm run dev` process across terminal sessions. If port conflicts happen, `taskkill /F /IM node.exe` then restart cleanly, and confirm the terminal output shows NO "port in use" warning before trusting what's on screen.
- **ZIP extraction never deletes files**, only adds/overwrites. Any file that should be deleted needs an explicit `Remove-Item` instruction, called out clearly every time.
- **npm's arborist has a real, reproducible bug** ("Cannot read properties of null (reading 'edgesOut')") that hits unpredictably on fresh installs in this project — not caused by any specific package. Fix: `rm -rf node_modules package-lock.json && npm install` (clean reinstall), sometimes needs a couple of tries.
- **ColorZilla and other browser extensions cause harmless hydration-mismatch console warnings** (`cz-shortcut-listen`, `data-gr-ext-installed`, etc.) — these are not real bugs, don't chase them.

## Tech stack (all installed and working)

Next.js 16.3.5 (App Router, Turbopack) · React 19.2.8 · TypeScript strict · Tailwind CSS 4 · Prisma 6.19.3 (pinned — newer versions pull in unrelated vulnerable dependencies, do not upgrade without checking `npm audit` first) · bcryptjs for password hashing · lucide-react for icons · self-hosted fonts via @fontsource (Source Serif 4 display, IBM Plex Sans body) — no Google Fonts network dependency.

**A real, environment-specific limitation:** the sandbox this gets built in cannot reach `binaries.prisma.sh`, so Prisma CLI commands (`generate`, `migrate`, `studio`) cannot be run or verified there. The schema and seed script get written carefully by hand and explained, but the actual first migration always has to run on the user's own machine. This isn't a mistake to fix — it's a standing constraint to work around every time the database is touched.

## Current build status

**Public website: essentially complete.** Homepage, About, Services (index + 6 dynamic detail pages), Contact, How We Care, Who We Serve, Resources, Request Care (real form, client-side validated, honestly documented as not yet wired to a backend), Sign In (stub). Full design system (`src/styles/tokens.css`, components in `src/components/ui/`). Motion system (`src/components/motion/`). Real logo mark, icon system, cinematic hero, full footer.

**Database: schema written, NOT yet migrated on the user's machine as of this handoff.** `prisma/schema.prisma` covers organizations, users, sessions, roles, permissions, and the two join tables — identity/auth only, not clinical data yet (that's Milestone D). `prisma/seed.ts` creates the org, 30 permissions, 9 roles, and one demo admin (`demo.admin@cheliv.test` / `ChangeMe123!`, documented in git-ignored `docs/DEMO_ACCOUNTS.md`). Full walkthrough in `docs/DATABASE.md`.

**Not started:** actual authentication (sign-in flow, sessions, password verification), RBAC enforcement, audit logging, API layer, any portal (patient/family/caregiver/clinical/admin), any clinical data model (patients, visits, care plans, referrals, documents, messaging).

## The phase plan (from the original Phase 0 architecture doc)

Milestones, in order: **A** Foundations (done) → **B** Public website (done) → **C** Spine: database, auth, API, RBAC, audit logging (database schema written, everything else in C not started) → **D** Core operations: patients, clinical records, care plans, visits, scheduling, referrals, documents, demo data → **E** Portals: patient, family, caregiver, clinical, coordinator, admin Command Center → **F** Production readiness: security center, analytics, testing, accessibility, performance, hardening, deployment.

Full detail is in `docs/PHASE_0_ARCHITECTURE.md` — read that first if anything here is ambiguous.

## What to do first in the new conversation

Ask the user: has `docs/DATABASE.md` been completed on their machine (PostgreSQL installed, first migration run, seed run, confirmed in Prisma Studio)? If yes, move to building real authentication (sign-in page, session handling, wiring the existing sign-in stub to actually check credentials against the seeded demo admin). If no, help them finish that first — nothing after it can be tested otherwise.

Also ask: has the phone number discrepancy been resolved? Don't let it sit unresolved indefinitely.
