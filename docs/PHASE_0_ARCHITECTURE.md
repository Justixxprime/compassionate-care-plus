# PHASE 0 COMPLETE
## Compassionate Care Plus Inc. — Digital Platform
### Vision, architecture, and the plan we are going to follow

**Status:** Planning only. No project files created yet.
**Date:** 15 September 2026
**Author of this document:** written for J, to be kept in the repo as `docs/PHASE_0_ARCHITECTURE.md`

---

## 0. Read this part first

Three things before anything else, because they change how we build.

**1. Nothing in this document is a fact about Compassionate Care Plus.** Every service, role, workflow and number below is a *placeholder or a question*. I have not invented staff, certifications, service lines, statistics, partnerships or outcomes, and I won't. Section 17 is a questionnaire for the organization. Until it comes back, everything ships with visible `[TO BE CONFIRMED]` markers.

**2. The phase order in the brief has a problem, and I want to fix it before we start.** The brief builds six portals (Phases 9–14) before the database (Phase 30) and the backend API (Phase 31). You cannot build a patient portal on top of nothing — you would build it twice: once against fake local data, then again against the real database. Section 12 proposes a corrected order that keeps all 40 phases but moves auth, database and API earlier. I recommend it. You decide.

**3. There is a legal point that affects you personally, not just the software.** If this system ever holds real patient information and you are the person building or maintaining it, you are very likely what US healthcare law calls a *business associate* of the organization. That usually means a signed agreement between you and them, and real obligations on your side. I am not a lawyer and this is not legal advice — but do not let this go live with real patients before someone qualified has looked at it. Section 18 has the details. Building the demo on synthetic data, which is what we are doing, carries none of this risk.

---

## 1. What we are building and why

**Plain version:** a home-health organization currently runs on phone calls, paper, spreadsheets and whatever software it already pays for. We are building one system where the public can learn about them and ask for care, and where patients, families, caregivers, nurses, coordinators and administrators each see exactly the slice of information they are allowed to see — and nothing more.

**Two products, one identity:**

| | Public website | Internal application |
|---|---|---|
| Audience | Patients, adult children of patients, referral sources | Staff, clinicians, admins, and portal users |
| Job | Build trust in 8 seconds, make "request care" effortless | Get work done fast without mistakes |
| Feel | Warm, editorial, human, calm | Dense, precise, fast, enterprise |
| Tech emphasis | Server-rendered, fast, accessible, image-heavy | Data-heavy, permission-heavy, audited |

They share tokens, typography and voice. They do **not** share layout language.

**Why it matters:** in home health the product is trust. The website earns it; the application keeps it by never showing the wrong person the wrong record.

---

## 2. Ground rules we are building under

1. Synthetic data only, always, during development. No exceptions, not even "just one real name to test with."
2. No invented company facts. Placeholders are labelled and obvious.
3. No HIPAA compliance claims. We describe the work as *"designed with healthcare security and HIPAA requirements in mind."* That is accurate. "HIPAA compliant" is not ours to say.
4. Authorization is enforced on the server, every time. Hiding a button is a UX decision, never a security control.
5. Nothing costs money without a conversation first. Section 15 lists every point where money could appear.
6. Complete files, every time. Never "add this bit somewhere."
7. Every phase ends with: it runs, it is tested, it is documented, `NEXT_STEP.md` is updated, and you get a ZIP.

---

## 3. User roles

Nine roles. The first eight are people who log in; the ninth is the public.

| Role | Who they are | What they fundamentally need |
|---|---|---|
| `SUPER_ADMIN` | You / platform owner | Everything, plus organization management |
| `ADMIN` | Office manager, owner | Run the operation: staff, patients, referrals, settings |
| `CLINICAL_SUPERVISOR` | Supervising RN | Review and approve clinical documentation, oversee clinicians |
| `NURSE` | RN / LVN / therapist | Their patients, their visits, clinical documentation |
| `CARE_COORDINATOR` | Scheduler / intake | Referrals in, patients assigned, visits scheduled |
| `CAREGIVER` | Home health aide | Today's visits, tasks, check in and out — on a phone |
| `PATIENT` | The person receiving care | Next visit, care team, messages, documents |
| `AUTHORIZED_FAMILY` | A representative the patient authorized | A *consent-limited* view of the patient's information |
| `REFERRAL_PARTNER` | Hospital discharge planner, physician office | Submit a referral, see its status — nothing else |

**The important design decision here:** roles alone are not enough for healthcare. A nurse is not allowed to read *every* patient — only the ones they are assigned to. So access is decided by three things together:

```
CAN THIS PERSON DO THIS?
  1. Role permission      — does the NURSE role hold clinical_records.read ?
  2. Relationship         — is this nurse on THIS patient's care team ?
  3. Consent (family only)— has the patient authorized THIS person, for THIS scope,
                            and has that authorization not expired ?
  → All three must pass. Any one fails → denied, and the denial is logged.
```

Section 8 turns this into code.

---

## 4. Feature map

Grouped by when it is genuinely needed, not by how impressive it sounds.

**Tier 1 — the demo you show your uncle (the real target)**
Public website · request care · authentication with roles · patient list and profile · care plans · visits · scheduling (day/week) · referral pipeline · documents · secure messaging · tasks · notifications · admin Care Command Center · patient portal · caregiver mobile portal · clinical portal · audit log · RBAC · demo mode with seeded synthetic data.

**Tier 2 — needed before anyone real uses it**
Family portal with consent gating · care coordinator portal · executive view · analytics · security center · MFA · document versioning and expiry · global search · full test suite · accessibility audit · production deployment.

**Tier 3 — only once the organization asks for it**
Command palette · drag-and-drop scheduling · EVV integration · EHR/billing integration · SMS · offline caregiver mode · multi-organization onboarding.

Building Tier 3 before Tier 1 is the single most likely way this project dies. We build in order.

---

## 5. Sitemaps

### 5.1 Public website
```
/                         Home
/about                    Who we are            [content TO BE CONFIRMED]
/services                 Services index        [list TO BE CONFIRMED]
/services/[slug]          Individual service
/who-we-serve             Conditions / situations we support
/how-we-care              The care journey, step by step
/for-referral-partners    How to refer a patient
/resources                Guides and FAQs
/resources/[slug]
/contact                  Contact + location    [address TO BE CONFIRMED]
/request-care             The main conversion flow
/careers                  Optional, phase later
/privacy /terms /accessibility /notice-of-privacy-practices
                          ALL placeholders until the organization supplies real documents
/sign-in                  Entry to every portal
```

### 5.2 Patient portal — `/portal`
`Dashboard · Next visit · My care team · My care plan · Visits (upcoming + past) · Messages · Documents · Appointments & requests · Notifications · Account & security`

### 5.3 Family portal — `/family`
`Dashboard (per authorized patient) · Visit schedule · Care team · Approved documents only · Messages · Consent & authorization status · Notifications · Account`
Every screen renders from the consent record. No consent → no data, with a clear explanation rather than an error.

### 5.4 Caregiver portal — `/caregiver` (phone-first)
`Today · Visit detail → Check in → Task checklist → Notes → Check out · My patients · My schedule · Tasks · Messages · Availability · Visit history`

### 5.5 Clinical portal — `/clinical`
`My patients · My schedule · Patient chart · Care plan · Visit documentation · Pending documentation queue · Supervisor review · Tasks · Messages · Alerts`

### 5.6 Coordinator portal — `/coordinate`
`Referral inbox · Eligibility & intake · Patient assignment · Scheduling board · Unassigned patients · Documentation status · Follow-ups · Tasks`

### 5.7 Admin — `/admin` (Care Command Center)
```
Command Center (dashboard)   Executive view          Patients
Referrals                    Scheduling              Visits
Care plans                   Documents               Messages
Staff                        Roles & permissions     Tasks
Consents                     Analytics               Audit log
Security center              Organization settings   Demo data controls
```

---

## 6. Technology stack

Current as of today; versions get pinned for real in Phase 1.

| Layer | Choice | Why this one |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Active LTS. Server Components mean patient data can be fetched and rendered on the server and never reach the browser unless we choose to send it. That is a security feature, not just a performance one. |
| Language | **TypeScript, strict** | On a permissions-heavy system, the compiler catching "you forgot the organization id" is worth the learning curve. |
| Styling | **Tailwind CSS v4** + CSS custom properties for tokens | You already know some Tailwind. Tokens live in CSS variables so the design system is real, not scattered hex codes. |
| Components | **Radix UI primitives**, styled by us | Accessible dialogs, menus and tooltips are genuinely hard to build correctly. Radix gives us keyboard and screen-reader behaviour; we supply 100% of the visual design. |
| Database | **PostgreSQL 17**, local install on Windows | Real relational integrity, row-level security available later, free, and what production will run. |
| DB access | **Prisma** | See the decision below. |
| Validation | **Zod** | One schema validates the form *and* the API route. Server-side validation is non-negotiable. |
| Auth (dev) | **Auth.js v5**, credentials + database sessions, Argon2id hashing | Free, local, no external dependency. |
| Auth (prod) | **AWS Cognito** *or* keep Auth.js — decided in Phase 32 | We write an auth *interface* so this swap is one file, not a rewrite. |
| Forms | React Hook Form + Zod | |
| Tables | TanStack Table | Headless — we design the table, it handles sorting/filtering/pagination. |
| Charts | Recharts | Small, readable, good enough for operational dashboards. |
| Icons | **Lucide** (primary, MIT) | One consistent stroke language. No second library unless something is genuinely missing. |
| Motion | CSS transitions + **Motion** for the 3–4 orchestrated moments only | |
| Testing | Vitest + Testing Library (unit), Playwright (end-to-end), axe-core (accessibility) | All free. |
| Email (dev) | Nodemailer → local Mailpit inbox | Zero cost, real-looking emails, nothing leaves your machine. |
| Files (dev) | Local folder **outside** `public/`, served only through an authorizing route handler | If a file sits in `public/`, anyone with the URL has it forever. |
| Hosting (demo) | Vercel free tier — **synthetic data only, no BAA** | |
| Hosting (prod) | AWS — Section 11 | |

### Two real decisions, both explained

**Prisma vs Drizzle.**
*Prisma:* readable schema file, generated types, migrations that just work, and Prisma Studio — a GUI where you can see your data, which matters a lot when you are learning. Heavier, and raw SQL is less natural.
*Drizzle:* thin, SQL-shaped, tiny runtime, plays better with Postgres row-level security.
**Choosing Prisma**, because you are learning databases while building, and being able to *look at* your data in Studio will save you hours. We keep all database access behind repository functions, so if we ever want Drizzle, we change those files and nothing else.

**Where do we enforce "you can only see your own organization's data"?**
*Option A — application layer:* every query goes through a scoped repository that requires an organization id. Simple, easy to debug, easy to get wrong if someone writes a query outside the repository.
*Option B — Postgres row-level security:* the database itself refuses to return other organizations' rows. Much stronger, more setup, trickier with Prisma.
**Choosing A now, B later (Phase 36).** A is understandable today; B is the belt-and-braces we add before production. I will write the repositories so that switching on RLS later does not mean rewriting them. This is a deliberate trade, not an oversight.

---

## 7. Database architecture

### Rules that apply to every table
- Primary keys are **UUID v7** (sortable, non-guessable — sequential integer ids leak how many patients exist and invite URL-guessing).
- Every tenant-scoped table carries `organization_id`, even though there is one organization today.
- Clinical and document rows are **never hard-deleted** — `deleted_at`, plus an audit entry. Deleting a clinical record is itself an event someone may need to answer for.
- Every table has `created_at`, `updated_at`, `created_by`, `updated_by`.
- Timestamps are `timestamptz`. Store UTC, render in the organization's timezone.

### Tables, grouped

**Organization & identity**
`organizations` · `users` · `sessions` · `roles` · `permissions` · `role_permissions` · `user_roles` · `mfa_factors` · `password_reset_tokens` · `login_attempts`

**People**
`staff_profiles` (employment type, credentials `[TO BE CONFIRMED]`, status) · `staff_availability` · `patients` · `patient_contacts` · `authorized_representatives` · `care_team_members` (the join that makes relationship-based access work: patient ↔ staff ↔ role-on-this-case ↔ active dates)

**Care**
`services` · `patient_services` · `referrals` · `referral_events` · `care_plans` · `care_plan_goals` · `care_plan_tasks` · `care_plan_reviews` · `visits` · `visit_tasks` · `visit_notes` · `clinical_notes` · `note_reviews`

**Content & communication**
`documents` · `document_versions` · `document_permissions` · `consents` · `consent_grants` · `message_threads` · `thread_participants` · `messages` · `message_reads` · `notifications` · `notification_preferences` · `tasks` · `task_comments` · `appointments`

**Trust**
`audit_logs` · `security_events` · `access_denials`

### The three joins that carry the whole security model

```
care_team_members     patient_id + staff_user_id + role_on_case + starts_at + ends_at
                      → answers "is this clinician allowed near this chart?"

consent_grants        patient_id + grantee_user_id + scope[] + granted_at + expires_at + revoked_at
                      → answers "can this family member see this, today?"

document_permissions  document_id + (role | user | care_team) + can_view/can_download
                      → answers "may this request have this file?" before a single byte is sent
```

`audit_logs` shape: `actor_user_id, actor_role, action, resource_type, resource_id, patient_id (nullable), organization_id, outcome (allowed|denied), ip, user_agent, request_id, occurred_at, metadata jsonb`. Note what is missing: **the content of what was viewed**. We log that a chart was opened, never what it said.

---

## 8. RBAC and authorization architecture

Permissions are strings, stored in the database, grouped by resource:

```
patients.read  patients.create  patients.update  patients.archive
clinical_records.read  clinical_records.create  clinical_records.update
care_plans.read  care_plans.update  care_plans.approve
visits.read  visits.create  visits.update  visits.document  visits.review
documents.read  documents.upload  documents.delete
messages.read  messages.send
referrals.read  referrals.manage
tasks.read  tasks.manage
staff.manage  roles.manage  settings.manage
reports.read  audit.read  security.read
```

Every protected server operation goes through one function. There is no second path:

```ts
// src/server/authz/authorize.ts  (shape only — real file comes in the RBAC phase)
await authorize(session, 'clinical_records.read', { patientId })
// 1. role holds the permission?          else → deny
// 2. relationship check for this resource? else → deny
// 3. consent check if actor is family?     else → deny
// 4. organization ids match?               else → deny
// every deny writes to access_denials and audit_logs
```

Rules I will hold to for the whole build:
- No page component queries the database directly.
- No route handler trusts `userId`, `patientId`, `role` or `organizationId` from the client. Identity comes from the session, server-side, always.
- Hiding UI is cosmetic. If the button is hidden but the endpoint answers, we have a bug.

---

## 9. Security architecture

| Area | What we implement |
|---|---|
| Passwords | Argon2id, never stored or logged in plain text, never emailed |
| Sessions | Database-backed, httpOnly + Secure + SameSite cookies, idle and absolute timeouts, visible device/session list with revoke |
| MFA | TOTP (free, no SMS cost), required for staff roles, optional for patients |
| Account safety | Rate limiting on auth routes, progressive lockout, alert on new-device sign-in |
| Transport | HTTPS everywhere; HSTS in production |
| Headers | CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Input | Zod on every server boundary; unknown fields rejected, not ignored |
| Output | React escapes by default; no `dangerouslySetInnerHTML` without a sanitizer and a written reason |
| Files | No direct URLs. Authorization check → short-lived signed access → download logged |
| Secrets | `.env` never committed; `.env.example` documents every variable; production secrets in AWS Secrets Manager |
| Logging | Audit trail of access and change; **PHI never written to application logs** |
| Client storage | No clinical data in localStorage or sessionStorage, ever |
| Email | Notifications say *"You have a new secure message. Please sign in to view it."* and nothing more |

---

## 10. Design direction

This is a proposal for you to react to, not a decision. It gets refined in Phase 2 after I study real references, and it gets overridden the moment the organization supplies actual branding.

### Where the aesthetic comes from
Not "healthcare website." The subject is **someone's home** — a living room in Texas at three in the afternoon, a nurse's bag on the floor, a daughter on the phone from another state. Warm, domestic light. Plain-spoken. Unhurried. That is the feeling the public site should have. The application feels different on purpose: it is a professional instrument, and it should feel like one.

### Color — base palette

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#172420` | Text and deep surfaces. Near-black with green in it, so it never reads as flat charcoal |
| `--paper` | `#FAF9F6` | Page background. Warm white, deliberately *not* the cream that every generated page uses |
| `--pine` | `#1C4A3C` | Primary. Deep, quiet, credible — and it sidesteps the medical-blue default |
| `--sage` | `#E6EDE7` | Muted surfaces, section bands, table headers |
| `--marigold` | `#C98A14` | The single accent. Used for attention, never decoration |
| `--slate` | `#5C6A66` | Secondary text, borders, disabled |

Semantic (application only): `success #2E7D5B` · `warning #B5820C` · `danger #A32E2E` · `info #2C5F87`. Status colors for clinical/availability/priority derive from these, and every status is **color plus text**, never color alone — colorblind users and printed schedules both depend on that.

### Typography — three candidate pairings

1. **Source Serif 4** (display/headlines) + **IBM Plex Sans** (body, UI, application) — *recommended.* The serif carries warmth on the public site; Plex has excellent tabular numerals, which matters enormously in schedules and vitals tables.
2. **Newsreader** + **Geist Sans** — more editorial, slightly cooler.
3. **Instrument Sans** alone, with weight and scale doing all the work — the quietest option, hardest to get wrong.

Scale (both products, one ratio): Display 56/60 · H1 40/44 · H2 30/36 · H3 24/30 · H4 20/26 · Body-lg 18/30 · Body 16/26 · Body-sm 14/22 · Caption 13/18 · Label 13/16 · Button 15/20 · Data 15/20 tabular · Clinical-data 14/20 tabular.
Body line length stays under 75 characters. All self-hosted via `next/font` — no external font requests, which is both a performance and a privacy win.

### Things I am deliberately not doing
No glassmorphism. No gradient washes as decoration. No identical rounded cards in threes down the page. No all-caps eyebrow labels above every heading. No arrow appended to every link. No blob illustrations. The homepage will use varied composition — a full-bleed editorial moment, an asymmetric two-column, a real photograph at scale — because the "three cards in a row, five times" pattern is exactly what makes a site look generated.

### Motion
One orchestrated entrance on the homepage hero. Everything else is response to a user action: a menu opening, a row expanding, a save confirming. `prefers-reduced-motion` respected globally from the first commit, not retrofitted.

### Responsive
Designed at 320 / 360 / 390 / 430 / 768 / 1024 / 1366 / 1440 / 1920. The caregiver portal is designed at 390 **first** and desktop second — that is where it will actually be used, standing in a hallway, one-handed, possibly on bad signal. Complex admin tables become card lists on small screens rather than horizontal scroll.

### Accessibility — WCAG 2.2 AA, as a build rule
Semantic HTML first, ARIA only when nothing else works · visible focus on everything focusable · 44×44px minimum touch targets · labelled form fields with errors tied to inputs via `aria-describedby` · contrast checked at design time, not audited at the end · keyboard path through every critical flow · tested with a screen reader at each portal phase.

---

## 11. Cloud architecture (production, later)

| Service | Purpose | Needed when |
|---|---|---|
| CloudFront + WAF | Edge delivery, basic attack filtering | Production |
| App compute (App Runner / ECS Fargate / Amplify) | Runs Next.js | Production |
| Cognito | Managed identity, MFA | Only if we move off Auth.js |
| RDS PostgreSQL | The database, encrypted at rest, automated backups, point-in-time recovery | Production |
| S3 + KMS | Documents, encrypted, private, presigned access only | Production |
| Secrets Manager | Credentials | Production |
| CloudWatch | Logs, metrics, alarms | Production |
| Backup | Retention and restore testing | Before PHI |

No service enters this list because it sounds impressive. **Nothing real touches AWS during development**, and no PHI touches anything until the compliance work in Section 18 is genuinely done.

---

## 12. Development phases — proposed order

All 40 phases from the brief survive. Three of them move, for the reason in Section 0.

**Milestone A — Foundations (brief phases 1, 2)**
Project setup, Git, design tokens, component primitives, documentation skeleton.

**Milestone B — Public website (3, 4, 5, 6, 7)**
Layout, homepage, services, about/care approach, contact and request care. End of B, you have something real to show anyone.

**Milestone C — Spine — *moved earlier* (30, 8, 31, 26, 27)**
Database schema and migrations → authentication → API and service layer → RBAC → audit logging. Unglamorous, and everything above it depends on it.
*Why the move:* portals built on mock data get rewritten when the database arrives. Building the spine first costs one week now and saves several later. If you would rather see portals sooner, the alternative is to build Patient Portal against mock data as a visual prototype and accept rebuilding it — I do not recommend it, but it is a legitimate choice if there is a demo deadline.

**Milestone D — Core operations (15, 16, 17, 18, 19, 20, 21, 91/92)**
Patients, clinical records, care plans, visits, scheduling, referrals, documents, demo data and demo accounts.

**Milestone E — Portals (9, 11, 12, 13, 14, 10, 22, 23, 24, 25)**
Patient, caregiver, clinical, coordinator, admin Command Center, then family with consent gating, messaging, notifications, tasks, consents.

**Milestone F — Production readiness (28, 29, 33, 34, 35, 36, 37, 38, 39, 40)**
Security center, analytics, testing, accessibility, performance, hardening, deployment, QA, handover.

Every phase ends the same way: it runs → it is tested in a browser at three screen sizes → docs updated → `NEXT_STEP.md` and `PHASE_STATUS.md` updated → Git commit → ZIP.

**Honest estimate.** This is a large system — realistically several hundred hours of your time end to end, spread over months, not weeks. Milestone B alone is a proper freelance website project. I would rather tell you that now than have you discover it in November.

---

## 13. Folder structure

```
compassionate-care-plus/
├── docs/                      every .md file from the brief lives here
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                synthetic demo data
├── public/                    ONLY truly public assets. Never documents.
├── src/
│   ├── app/
│   │   ├── (public)/          marketing site
│   │   ├── (auth)/            sign in, reset, verify
│   │   ├── portal/            patient
│   │   ├── family/
│   │   ├── caregiver/
│   │   ├── clinical/
│   │   ├── coordinate/
│   │   ├── admin/
│   │   └── api/               route handlers — thin, they only call services
│   ├── components/
│   │   ├── ui/                primitives: button, input, dialog, table…
│   │   ├── marketing/
│   │   └── app/               shared internal components
│   ├── server/
│   │   ├── auth/              session, sign-in, MFA
│   │   ├── authz/             authorize(), permission checks
│   │   ├── services/          business logic — patients, visits, documents…
│   │   ├── repositories/      the ONLY place that talks to Prisma
│   │   ├── audit/
│   │   └── validation/        Zod schemas, shared by forms and APIs
│   ├── lib/                   dates, formatting, small helpers
│   ├── styles/                tokens.css, globals.css
│   └── types/
├── tests/
│   ├── unit/  integration/  e2e/  a11y/
├── .env.example               committed
├── .env                       NEVER committed
└── README.md
```

One rule holds this together: **`app/` never imports Prisma.** Pages call services, services call repositories, repositories call the database. Every authorization check happens in services, so there is no way to reach data by finding a different page.

---

## 14. Documentation, environment and demo strategy

**Documentation.** All files from the brief get written, in your voice — "Now I am going to…", "The reason I am doing this is…" — as a learning journal, not corporate prose. Written *during* each phase, never bolted on at the end. `NEXT_STEP.md` and `PHASE_STATUS.md` are updated every single phase, so you are never left wondering what to do next.

**Environments.** `development` (your laptop, synthetic data) → `demo` (deployed, synthetic data, watermarked as a demo) → `production` (does not exist until Section 18 is satisfied). Every variable documented in `ENVIRONMENT_VARIABLES.md` with: what it does, where it comes from, is it secret, is it safe in the browser.

**Demo data.** A seed script creating ~25 synthetic patients, ~12 staff, ~200 visits across six weeks, referrals at every pipeline stage, sample documents, message threads and audit entries. Names come from an obviously fictional generator. Every demo record carries `is_demo = true`, and the interface shows a persistent "Demonstration data" indicator. Demo accounts: `demo.admin` / `demo.nurse` / `demo.caregiver` / `demo.patient` / `demo.family`, with local-only passwords documented in `docs/DEMO_ACCOUNTS.md`, which is git-ignored.

**Production transition.** A written checklist covering: compliance sign-off, risk analysis, AWS BAA, security review, penetration test, backup and restore rehearsal, staff training, data migration plan, incident response plan, and a full purge of demo data. The system stays in demo mode until every line is ticked.

---

## 15. Where money could appear

| Thing | Cost | Free alternative | Needed when |
|---|---|---|---|
| Domain name | ~$12–15/year | none | When you go live |
| Vercel hosting | Free tier is enough for the demo | — | Now, free |
| AWS production | Realistically $60–200/month for encrypted RDS + compute + backups | none — this is the real number | Only at production |
| AWS BAA | Free to sign | — | Before any PHI |
| Transactional email (Resend/SES) | ~$0–20/month | Mailpit locally | Only in production |
| SMS | Per message | Skip entirely for now | Tier 3, if ever |
| Fonts, icons, libraries | $0 | already free | — |
| Stock photography | $0 via Unsplash/Pexels licenses | — | — |
| Compliance consultant / legal review | Varies, not small | none, and this is not a place to economize | Before production |

Development, start to finish, costs **$0**. I will stop and ask before anything changes that.

---

## 16. Testing and performance strategy

**Testing.** Unit tests for validation schemas, permission logic and date/scheduling maths. Integration tests for services — *especially* a suite that asserts every role is **denied** on every resource it should not reach; that suite is the most valuable code in the project. End-to-end Playwright tests for the critical flows: request care, sign in, caregiver visit check-in/out, clinician documents a visit, admin views audit log. Automated axe scans per portal. Plus manual browser testing at three widths after every UI phase — code that compiles is not code that works.

**Performance.** Server Components by default, `"use client"` only where interaction demands it. Self-hosted fonts, `next/image` with modern formats, route-level code splitting, indexed and paginated database queries (never `findMany` unbounded on patients), skeleton loading states, and a Lighthouse budget checked each public-site phase.

---

## 17. Questionnaire for the organization

Nothing below is guessable. Getting these answers is what separates this from a template.

**Identity** — Legal name and any trading name? Existing logo, brand colors, fonts? Licensure and certification details you want shown, and proof? Service area? Physical address(es) and public phone for the website? Social accounts?

**Services** — Which services are actually offered today? Which are licensed? Which do you want on the site? Who do you serve (conditions, age ranges, payer types)?

**People** — What staff roles exist? Who supervises whom? Who approves clinical documentation? Roughly how many staff and active patients?

**Systems currently in use** — EHR? Billing system? EVV system (Texas Medicaid has specific requirements here — which vendor are you required to use)? Scheduling tool? Where do documents live now? Which of these must this platform integrate with, and which does it replace?

**Workflow** — How does a referral arrive (fax, phone, portal, hospital system)? What happens in the first 24 hours? How is a patient onboarded? How are visits scheduled and changed? What does a caregiver record during a visit? What does a nurse record? Who reviews it, and how fast? How are care plans created and updated?

**Access** — Exactly what should a patient see? A family member? A caregiver? A nurse? An administrator? What must never appear publicly? Who currently has access to patient records, and how is that controlled?

**Compliance** — Do you have a privacy officer? A security officer? Existing HIPAA policies? Existing consent forms and a notice of privacy practices? Has a risk analysis been done? Do you have a lawyer for this?

**Operations** — What reports do you need? What alerts would actually be useful? What breaks most often today? If you could fix one thing about how the office runs, what would it be?

That last question usually produces the most useful answer in the whole list.

---

## 18. Risks and unknowns

| Risk | Reality | What we do |
|---|---|---|
| **Scope** | This is a multi-hundred-hour build for one person | Milestones A–B produce something showable early; everything after is optional progress, not a failed project |
| **No verified organization facts** | The site cannot launch on placeholders | Questionnaire now; placeholders stay visible until answered |
| **Compliance** | Real PHI triggers real legal obligations for the organization *and* likely for you as a business associate | Synthetic data only; Section 14 checklist; professional review before production. Not optional, not something I can sign off |
| **Production cost** | Someone has to pay AWS monthly, forever | Flagged up front; demo runs free |
| **Existing systems** | The org may be contractually tied to an EVV or EHR vendor that changes the design | Questionnaire before the clinical phases |
| **Building in a vacuum** | Guessed clinical workflows get rebuilt | No clinical workflow is implemented before Section 17 answers land |
| **Liability** | If this touches patients and something goes wrong, "I was learning" is not a defence | Contract and insurance conversation before go-live |
| **Motivation** | Long projects die in the middle | Phases end in something that runs and can be shown |

---

## 19. The exact next step

**Do not create any files yet.**

Here is what happens next, in order:

1. **You read this document and react to four things:**
   - the phase reorder in Section 12 (spine before portals) — yes or no?
   - the color palette in Section 10 — does it feel like Compassionate Care Plus, or is it the wrong temperature?
   - the typography shortlist — 1, 2 or 3?
   - the scope tiers in Section 4 — is Tier 1 the right target for the demo to your uncle?

2. **You send the questionnaire in Section 17 to the organization.** Even partial answers unblock the public website. If nothing comes back this week, we still start — Phase 1 does not depend on it.

3. **You answer three things I need before Phase 1:**
   - Do you have Node.js installed on your Windows machine? (Run `node -v` in a terminal — if it errors, that is fine, Phase 1 starts with installing it.)
   - Is this going in a **private** GitHub repository? It must be.
   - Has the organization given you anything real yet — logo, photos, service list, existing website?

4. **Then we run Phase 1:** install and verify Node.js, create the project folder, scaffold Next.js with TypeScript and Tailwind, walk through every generated file and what it does, start the dev server, confirm the first page renders, initialize Git, make the first commit, write `README.md` and `ULTRA_BABY_STEPS.md`, and produce ZIP `ccp-phase-01.zip`.

**Your exact next action:** read Sections 4, 10 and 12, and reply with your answers to step 1 and step 3. That is all — no typing in a terminal yet.
