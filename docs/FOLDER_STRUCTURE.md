# FOLDER STRUCTURE

How this project is organized, and the reasoning behind it.

## Right now (end of Phase 1)

```
compassionate-care-plus/
├── docs/                   All my documentation
├── prisma/
│   ├── schema.prisma       The database's blueprint - every table, described
│   ├── migrations/         Created by Prisma the first time I run a migration
│   └── seed.ts             Populates a fresh database with the org, roles, one demo admin
├── scripts/
│   └── check-root-layout.mjs   Guards against the root layout bug - runs automatically
├── public/
│   └── images/             Real photos, once I have them - see docs/IMAGES.md
├── src/
│   ├── app/                Pages and routes
│   ├── components/
│   │   ├── ui/              Design system primitives (Button, Input, Card, Badge)
│   │   └── marketing/       Public site pieces (Header, Footer, LogoMark, forms)
│   └── lib/                 Small helpers, service data, icon mappings
├── .env                     My real database connection string - NEVER committed
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Where it is heading

```
src/
├── app/
│   ├── (public)/           The marketing website
│   ├── (auth)/             Sign in, password reset, verification
│   ├── portal/             Patient portal
│   ├── family/             Authorized family portal
│   ├── caregiver/          Caregiver portal (designed for phones first)
│   ├── clinical/           Nurse and clinician portal
│   ├── coordinate/         Care coordinator portal
│   ├── admin/              Care Command Center
│   └── api/                Route handlers - thin, they only call services
├── components/
│   ├── ui/                 Primitives: button, input, dialog, table
│   ├── marketing/          Public website sections
│   └── app/                Shared internal components
├── server/
│   ├── auth/               Sessions, sign in, MFA
│   ├── authz/              The single authorize() function
│   ├── services/           Business logic
│   ├── repositories/       The ONLY place that talks to the database
│   ├── audit/              Audit logging
│   └── validation/         Zod schemas shared by forms and APIs
├── lib/
├── styles/
└── types/
```

Brackets like `(public)` mean a "route group": it organizes files without adding anything to the URL. So `app/(public)/about/page.tsx` is still just `/about`.

## The one rule that holds it together

**Nothing in `app/` talks to the database.**

```
page  →  service  →  repository  →  database
         (checks permission here)
```

Every permission check lives in the service layer. That means there is exactly one path to patient data, and it is guarded. If pages queried the database directly, every new page would be a new chance to forget a check - and in a healthcare system, forgetting a check is the whole problem.

## Added 19 September 2026 (visits)

- `src/lib/visits.ts`, `visit-constants.ts`, `visits-actions.ts`, `time.ts`
- `src/app/visits/` - `page.tsx`, `schedule-visit-form.tsx`, `visit-actions.tsx`
- `scripts/verify-access.ts`, `scripts/stubs/server-only.ts`
- `tsconfig.scripts.json` - used only by scripts, never by the app

## Update, 19 September 2026: care plans

- `src/app/care-plans/` - `page.tsx`, `create-plan-form.tsx`, `plan-controls.tsx`
- `src/lib/care-plans.ts`, `care-plan-constants.ts`, `care-plans-actions.ts`
- `docs/CARE_PLANS.md`

## Update, 19 September 2026: documents

- `src/app/documents/` - `page.tsx`, `upload-document-form.tsx`, `archive-button.tsx`, `[id]/download/route.ts`
- `src/lib/documents.ts`, `document-constants.ts`, `documents-actions.ts`
- `prisma/demo-pdf.ts`
- `docs/DOCUMENTS.md`

## Update, 20 September 2026: referrals

- `src/app/referrals/` - `page.tsx`, `create-referral-form.tsx`, `referral-controls.tsx`, `referral-fields.tsx`
- `src/lib/referrals.ts`, `referral-constants.ts`, `referrals-actions.ts`
- `docs/REFERRALS.md`, `docs/REVIEW_MILESTONE_D.md`

## Update, 21 September 2026: care teams

- `src/lib/auth/actor.ts` - the shared loadActor, auditDenied and auditAllowed
- `src/lib/care-team.ts`, `care-team-constants.ts` - who is on a patient's team, and the only code that changes it
- `docs/CARE_TEAMS.md`


## Update, 21 September 2026 (Milestone E1)

```
src/app/
  layout.tsx            ROOT layout (html, body, globals.css)
  (public)/             the public website, with its own header and footer layout
  (app)/                the signed-in staff screens, with the staff shell layout
    layout.tsx  loading.tsx  error.tsx  not-found.tsx
    dashboard/  patients/  visits/  care-plans/  referrals/
    documents/  (with [id]/download and sharing/)
  sign-in/  design-system/
src/components/app/     the staff shell and shared screen pieces
src/lib/app/            menu, roles, dashboard, and requireUser (access.ts)
src/lib/site-images.ts  every public photograph
src/lib/document-grants.ts  sharing restricted documents
scripts/verify-access.ts    661 access checks (builds and removes temporary people)
scripts/verify-shell.ts     62 shell checks (read-only)
```
