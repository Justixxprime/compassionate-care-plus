# CHELIV COMPASSIONATE CARE PLUS — PROJECT CONTINUATION BRIEF
## Complete state as of 18 September 2026, written to continue this build perfectly in a new conversation

Paste this whole document as the first message in a new conversation. It replaces the previous docs/PROJECT_HANDOFF.md, which was accurate up through Milestone C but is now out of date.

---

## 0. Read this part first

**Who this is for.** A real, already-licensed, currently-operating home health agency in Stafford, Texas. Being built by the owner's nephew, as a surprise, the owner does not know this is being built for him. The owner's name is Charles Obioma; the person building it goes by J.

**Repo:** https://github.com/Justixxprime/compassionate-care-plus.git, public. No real secrets are committed (.env stays git-ignored), but it now holds real login mechanics, real sessions, and an audit trail, even in demo form. Worth reconsidering making it private.

**Local path:** C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus, kept in OneDrive despite sync risk (his choice, flagged once, not revisited).

**Deployed:** compassionate-care-plus.vercel.app, auto-deploys from main.

**A file-integrity lesson that must not be relearned.** src/app/layout.tsx (the ROOT layout, needs html, body, import "./globals.css") and src/app/(public)/layout.tsx (the PUBLIC SITE layout, header/footer wrapper, must NOT have html/body) share the filename layout.tsx and have been repeatedly confused across VS Code tabs, causing a "Missing html and body tags" runtime error or a totally unstyled deployed site, three or four separate times. This is now guarded against automatically, see section 8. Before ever delivering a file again, confirm directly, by name, that src/app/layout.tsx and src/app/(public)/page.tsx are correct in whatever is being shipped. Don't just trust the general process; say so explicitly every time.

---

## 1. Confirmed real facts, safe to use, not placeholders

| Fact | Value |
|---|---|
| Legal name | Cheliv Compassionate Care Plus Inc |
| Brand display | "Cheliv" primary, "Compassionate Care Plus" subtitle |
| Address | 4434 Blue Bonnet Dr, Suite 151, Stafford, TX 77477 |
| Phone (as shown on site) | (281) 903-7551, J confirmed keeping this as-is, will change it himself later. Do not raise this again. |
| Service scope | Confirmed clinical home health (skilled nursing, PT, OT, ST, wound care, medication management), not non-medical home care only |
| Stats (owner-confirmed real) | 10+ counties served, 50+ licensed clinicians, 1,000+ patients/year, 100% home-based recovery focus |
| Owner | Charles Obioma, CEO/Founder/Administrator. Also runs "St. Charles Home health care services Inc." Lives in Houston, TX. |
| License | Texas HHSC license #017743 |

Still genuinely unconfirmed, not urgent: real fax number (none ever evidenced, currently just omitted from the site rather than shown as a placeholder). Real photography of the actual office/team (three Pexels stock photos are live in the meantime, see section 12).

---

## 2. Standing content and delivery rules, apply every time, no exceptions

1. No em dashes anywhere, not as punctuation, not as list bullets. Checked and enforced across the whole codebase repeatedly; keep enforcing on every new line of copy.
2. No visible "placeholder" / "to be confirmed" / dev-banner framing anywhere on the public site. It must read as a real, finished, professional site, a surprise reveal, not a work-in-progress demo. One deliberate exception: the four footer legal links (privacy policy, terms, accessibility, notice of privacy practices) lead nowhere real and are not flagged either, they just read as normal footer text. Writing real privacy/terms/HIPAA-notice language wrong is a genuine legal liability regardless of how polished everything else is. Never write real legal text without the user explicitly providing it or asking with full awareness of the risk.
3. Very cinematic, bold, premium, "alive," high-tech, big, detailed. Reference point given: Mayo Clinic's site, restrained small logo lockup, huge bold serif headlines, comprehensive multi-section footer. Already built: dark full-bleed hero with an animated CSS gradient backdrop (AuroraField, no video needed), clamp()-based bold responsive type scale, scroll-reveal animations (Reveal), animated stat counters (StatCounter), an original logo mark, lucide-react icons throughout. This is a standing visual bar for every future page, not a one-time request.
4. Every delivery includes a full project zip, not just inline file contents (this superseded an earlier "single consolidated file" preference, the user changed his mind explicitly). Full file contents when shown inline, never diffs or snippets.
5. Always verify before shipping. After packaging any zip: extract it fresh to a separate temp folder and diff every changed file against the actual working files before presenting it. Never skip this. Explicitly name-check src/app/layout.tsx and src/app/(public)/page.tsx every single time, given their history.
6. Check GitHub directly when diagnosing anything uncertain, git clone the real repo (github.com and codeload.github.com are reachable from the sandbox) rather than guessing from terminal output alone.
7. Terminal/git commands go at the end of every delivery, after the files, every time.

---

## 3. Tech stack, with the real reasoning behind each pinned choice

| Layer | Choice | Why pinned this way |
|---|---|---|
| Framework | Next.js 16.3.5, App Router, Turbopack | |
| Language | TypeScript, strict | |
| Styling | Tailwind CSS 4 | |
| Database | PostgreSQL, local install on the user's Windows machine | |
| ORM | Prisma 6.19.3, pinned exactly | Prisma 7.x pulls in an embedded studio UI, a MySQL driver never used, and real vulnerabilities in transitive dependencies (confirmed via npm audit). 6.19.3 is lean and stable. Do not upgrade without re-checking npm audit first. |
| Password hashing | bcryptjs | Chosen over Argon2id (the original architecture doc's pick) specifically because Argon2 needs native compilation, which is fragile on Windows for a beginner without build tools. bcryptjs is pure JS, no native step, still a legitimate, OWASP-acceptable choice. |
| Icons | lucide-react | |
| Fonts | Self-hosted via fontsource, Source Serif 4 display, IBM Plex Sans body | No Google Fonts network dependency at all |
| A package override worth knowing about | deepmerge-ts forced to ^8.0.2 via package.json overrides | Prisma 6.19.3's config loader depends on a vulnerable version; overriding closes it without downgrading Prisma further. npm audit currently reports zero vulnerabilities. |

A standing environment constraint, not a bug to fix: the sandbox this gets built in cannot reach binaries.prisma.sh, so npm run build always fails there specifically with "@prisma/client did not initialize yet". This is expected every single round. Lint and npx tsc --noEmit are what actually get verified in that environment; the user's own machine has a real generated Prisma client and builds fine.

---

## 4. Full current file structure

compassionate-care-plus/
- docs/ (16 files, see section 15)
- prisma/
  - schema.prisma (10 models, see section 5)
  - seed.ts (org, 30 permissions, 9 roles with 3 having real permission sets, 2 demo accounts, 3 synthetic patients, 1 care-team assignment)
- scripts/
  - check-root-layout.mjs (runs automatically via predev/prebuild hooks)
- public/images/ (empty, real photos go here eventually, see docs/IMAGES.md)
- src/app/
  - layout.tsx (ROOT layout, html/body/metadata/globals.css import)
  - globals.css
  - (public)/ route group, no URL segment
    - layout.tsx (header + footer wrapper, NOT html/body)
    - page.tsx (real homepage, cinematic hero, stats band, services, FAQ)
    - about/page.tsx, contact/page.tsx, how-we-care/page.tsx, who-we-serve/page.tsx
    - request-care/page.tsx (real form, not yet wired to send anywhere)
    - resources/page.tsx
    - services/page.tsx (index, pulls from services-data.ts) and services/[slug]/page.tsx (6 real services, generateStaticParams)
  - sign-in/page.tsx and sign-in/sign-in-form.tsx (client component, useActionState + signInAction)
  - dashboard/page.tsx (bare proof page, session, permissions, recent activity)
  - patients/page.tsx (bare proof page, relationship-based access)
  - design-system/page.tsx (internal reference, not linked from nav)
- src/components/
  - ui/ Button, Input, Label, Card, Badge
  - marketing/ Header, Footer, LogoMark, AuroraField, HeroIllustration, RequestCareForm, nav-links.ts (brandName lives here)
  - motion/ Reveal, StatCounter
- src/lib/
  - prisma.ts (the shared PrismaClient instance)
  - cn.ts (class-merging utility)
  - services-data.ts (single source of truth for all 6 services)
  - service-icons.tsx (slug to lucide icon mapping)
  - patients.ts (getAccessiblePatients, the real access-control logic)
  - auth/session.ts, auth/actions.ts, auth/authorize.ts
  - audit/log.ts
- package.json, next.config.ts (allows images.pexels.com as a remote pattern)
- .env (real DATABASE_URL, never committed), .env.example

One file that's still present but genuinely orphaned/unused: src/components/marketing/coming-soon-page.tsx, nothing imports it anymore since every stub page got real content. Safe to delete whenever noticed; not urgent.

---

## 5. Database schema, exactly as it stands

Ten models, in prisma/schema.prisma:

Identity/auth (Milestone C): Organization, User, Session, Role, Permission, RolePermission (join), UserRole (join), AuditLog

Clinical, first slice (Milestone D, just started): Patient, CareTeamMember (join, this is what makes relationship-based access real)

Every table uses @id @default(uuid()) for primary keys, @map("snake_case") throughout so the actual Postgres columns are snake_case while Prisma's TypeScript side stays camelCase. AuditLog.actorUserId is nullable specifically because a failed sign-in attempt against a nonexistent email has no real user row to attach to, logging the attempted email is still the point.

Not built yet, deliberately: visits, care plans, clinical notes, documents, referrals, consents, messaging, notifications, tasks. Each is meant to come as its own round, not all at once, see the original architecture doc's "do not build everything at once."

---

## 6. Authentication, how it actually works

src/lib/auth/session.ts: sessions are real rows in the sessions table, not JWT-only, this is what would let a real "revoke this session" admin feature work later, and what lets every session for a compromised account be invalidated immediately.

src/lib/auth/actions.ts: signInAction compares the submitted password against a dummy bcrypt hash whenever the email doesn't match a real user, so a login attempt for a nonexistent email takes the same amount of time as one for a real email with a wrong password, otherwise response timing itself would quietly leak which emails have accounts.

Both /dashboard and /patients call getCurrentUser() and redirect to /sign-in server-side if there's no session, this is a real security boundary, not a hidden button.

---

## 7. RBAC, how permission checks actually work

src/lib/auth/authorize.ts, the single path every permission check goes through:

- hasPermission(userId, key), true/false, for deciding what to render
- requirePermission(userId, key), throws AuthorizationError if missing, for actually blocking a sensitive action, also writes a permission_denied audit log entry automatically
- getUserPermissions(userId), the full list for one user

Permissions live in the database (permissions, role_permissions, user_roles tables), not hardcoded in TypeScript, granting a role a new permission later is a data change, not a redeploy.

Real permission sets defined so far: SUPER_ADMIN (all 30), ADMIN (broad administrative set), NURSE (14 permissions, clinical-focused). The remaining six roles (CAREGIVER, CARE_COORDINATOR, CLINICAL_SUPERVISOR, PATIENT, AUTHORIZED_FAMILY, REFERRAL_PARTNER) intentionally hold zero permissions still, each one's real set is its own piece of design work, not something to rush.

---

## 8. The recurring layout bug, now permanently guarded

scripts/check-root-layout.mjs runs automatically via predev/prebuild npm hooks before every npm run dev and npm run build. It reads src/app/layout.tsx, checks for html, body, and the globals.css import, and refuses to proceed with a clear red terminal error if the file has been swapped with the public layout's content again, pointing at docs/TROUBLESHOOTING.md. Tested directly: confirmed it passes the correct file and blocks the exact bug pattern.

This does not mean the bug can never resurface on the user's local disk, it means it gets caught immediately with a clear message the moment dev or build runs, instead of silently shipping broken. See section 0 for the standing practice this demands.

---

## 9. Audit logging, what's recorded and what never is

src/lib/audit/log.ts. Logged automatically: sign_in, sign_in_failed (tied to the attempted email, not a user row), sign_out, permission_denied. Never logged: the content of what was viewed or changed, only that the event happened. writeAuditLog swallows its own errors (logs to server console) rather than throwing, so a broken audit write is never the reason a real sign-in fails for someone.

Shown on /dashboard as "Recent activity," visible only to an account holding audit.read.

---

## 10. Patients and relationship-based access, proven working, not just built

src/lib/patients.ts: getAccessiblePatients(userId) calls requirePermission first (hard stop), then checks whether the user holds an administrative role (SUPER_ADMIN, ADMIN, CLINICAL_SUPERVISOR, CARE_COORDINATOR), if so, every patient in their organization. Otherwise, only patients they have an active CareTeamMember row for.

This was verified working on the user's actual machine, not just reviewed as code: the demo admin sees all three synthetic patients on /patients; the demo nurse, holding the same patients.read permission, sees only Eleanor Whitfield, the one patient they're actually assigned to. Screenshots confirmed this on 18 September 2026.

---

## 11. Demo accounts, both real and working

Documented in git-ignored docs/DEMO_ACCOUNTS.md. Password for both: ChangeMe123!

| Account | Role | Sees on /patients |
|---|---|---|
| demo.admin@cheliv.test | SUPER_ADMIN | All three synthetic patients |
| demo.nurse@cheliv.test | NURSE | Only Eleanor Whitfield |

Three synthetic demo patients exist: Eleanor Whitfield, Marcus Delgado, Priya Raman, all clearly fictional.

---

## 12. Public website, complete, real content

Homepage, About, Services (index + 6 real detail pages via generateStaticParams), Contact, How We Care, Who We Serve, Resources, Request Care (real client-side-validated form, honestly documented in its own code comments as not yet wired to send anywhere real, no backend endpoint exists for it yet). Sign In is real (not a stub anymore).

Three real, free-licensed Pexels photos are hotlinked (not scraped, not downloaded illegally, Pexels' own CDN, meant for exactly this) into the homepage hero, homepage "who we serve," and About page. Swap for real photos of the actual office/team whenever available, see docs/IMAGES.md.

---

## 13. Milestone/phase status, honestly

- Milestone A (Foundations): Complete
- Milestone B (Public website): Complete
- Milestone C (Database, auth, RBAC, audit logging): Complete
- Milestone D (Core clinical operations): In progress. Patients and care team relationships done and proven working. Next, in order: visits, then care plans, then documents and referrals, each its own round.
- Milestone E (Portals): Not started
- Milestone F (Production readiness): Not started

Full detail and reasoning in docs/PHASE_0_ARCHITECTURE.md (the original plan) and docs/PHASE_STATUS.md (the live tracker), read both if anything here is ambiguous.

---

## 14. Recurring environment quirks worth knowing before they cause confusion again

- Zombie dev server processes on Windows have repeatedly held port 3000 across terminal sessions. If a port conflict shows up, taskkill /F /IM node.exe then restart clean, and confirm the terminal shows no "port in use" warning before trusting anything on screen.
- ZIP extraction never deletes files, only adds/overwrites, and has at least once silently skipped overwriting a specific file on a conflict prompt. Any file that needs deleting gets an explicit Remove-Item instruction, every time.
- A real, reproducible npm arborist bug (Cannot read properties of null, reading edgesOut) hits unpredictably in this project on fresh installs, not caused by any specific package. Fix: delete node_modules and package-lock.json, then npm install, sometimes needs a couple of tries.
- Browser extensions cause harmless hydration-mismatch console warnings (cz-shortcut-listen from ColorZilla, data-gr-ext-installed from Grammarly, etc.), not real bugs, don't chase them.
- My own sandbox's npm run build always fails with a Prisma client initialization error, expected, not a signal anything is actually wrong. Lint and tsc --noEmit are the real verification there.

---

## 15. Full docs folder, for reference

AUDIT_LOGGING.md, CHANGELOG.md, DATABASE.md, DEMO_ACCOUNTS.md (git-ignored), DESIGN_SYSTEM.md, ENVIRONMENT_VARIABLES.md, FOLDER_STRUCTURE.md, IMAGES.md, NEXT_STEP.md, PATIENTS.md, PHASE_0_ARCHITECTURE.md, PHASE_STATUS.md, PROJECT_HANDOFF.md (this file), PUBLIC_WEBSITE.md, RBAC.md, TROUBLESHOOTING.md, ULTRA_BABY_STEPS.md.

---

## 16. What to do first in the new conversation

Ask: has the latest migration (add_patients_and_care_team) actually run, and did both demo accounts show the expected, different patient lists on /patients? The screenshots from 18 September already confirm yes, if that's still true, move straight into visits, the next slice of Milestone D. Design it the same way patients were: a real schema addition, a real access-control question (who can see/create/edit a visit), a seed update that makes the answer testable with the existing demo accounts, not just trusted.

Also confirm whether real photography has arrived yet. The phone number is settled and should not be raised again.
