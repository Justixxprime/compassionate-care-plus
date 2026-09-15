# FOLDER STRUCTURE

How this project is organized, and the reasoning behind it.

## Right now (end of Phase 1)

```
compassionate-care-plus/
├── docs/                   All my documentation
├── public/                 Truly public files only - never patient documents
├── src/
│   ├── app/                Pages and routes
│   ├── components/         Reusable UI pieces (empty until Phase 2)
│   └── lib/                Small helpers (empty until Phase 2)
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

Every permission check lives in the service layer. That means there is exactly one path to patient data, and it is guarded. If pages queried the database directly, every new page would be a new chance to forget a check — and in a healthcare system, forgetting a check is the whole problem.
