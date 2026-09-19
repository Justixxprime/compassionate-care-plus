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
