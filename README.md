# Compassionate Care Plus — Digital Platform

A healthcare digital platform I am building for Compassionate Care Plus Inc., a home health organization based in Texas.

> **Development build. Synthetic data only.**
> This repository contains no real patient information, and it never will. Everything company-specific is a clearly labelled placeholder until the organization confirms it.

---

## What this is going to be

Two things that share one identity:

1. **A public website** — so people can understand what the organization does and ask for care without filling in a wall of forms.
2. **An internal application** — patient, family, caregiver, nurse, coordinator and admin portals, where each person sees exactly the information they are allowed to see and nothing else.

The full plan is in [`docs/PHASE_0_ARCHITECTURE.md`](docs/PHASE_0_ARCHITECTURE.md). If you only read one file, read that one.

## Where the project is right now

**Phase 1 complete — project initialization.** The Next.js project exists, it runs, and the documentation system is in place. There is one placeholder page. No design system yet, no database yet, no authentication yet.

Progress is tracked in [`docs/PHASE_STATUS.md`](docs/PHASE_STATUS.md).
What to do next is always in [`docs/NEXT_STEP.md`](docs/NEXT_STEP.md).

## Technology

| What | Why it is here |
|---|---|
| Next.js 16 (App Router) | Renders pages on the server, so patient data never has to reach the browser unless I choose to send it |
| React 19 | The UI library Next.js is built on |
| TypeScript (strict) | Catches mistakes before they run — valuable in a permissions-heavy system |
| Tailwind CSS 4 | Styling. I already know some Tailwind, and design tokens live in CSS variables |
| ESLint | Catches sloppy code as I go |

Coming in later phases: PostgreSQL, Prisma, Zod, Auth.js, Radix UI, Vitest, Playwright.

## Running it on my computer

I need Node.js 20.9 or newer. To check:

```bash
node -v
```

Then, from inside the project folder:

```bash
npm install
npm run dev
```

Then I open **http://localhost:3000** in my browser.

Other commands I will use:

```bash
npm run build   # makes the production version - this must succeed before I ship anything
npm run start   # runs the production version locally
npm run lint    # checks my code for problems
```

## Environment variables

I copy `.env.example` to `.env.local` and fill in the values. `.env.local` is never committed. Every variable is explained in [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md).

## Folder structure

Explained in [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md).

## Rules I am building under

1. Synthetic data only. No real patient information touches this project during development.
2. No invented company facts — no services, staff, certifications, statistics, testimonials or legal text that the organization has not confirmed.
3. **This system is not HIPAA compliant.** It is *designed with healthcare security and HIPAA requirements in mind*. Those are different sentences and only the second one is mine to say. Before any real patient data exists, the organization must complete its own compliance, legal and security work.
4. Authorization is enforced on the server, every time. A hidden button is not a security control.
5. Secrets never go into this repository.

## This repository is public

That is a deliberate choice for now, and it is safe **only because** this project contains nothing but placeholder content and synthetic data. It means:

- No `.env` file, ever. No database URLs, no API keys, no passwords, not even temporarily.
- No real patient, staff or client information in seed data, screenshots, comments or commit messages.
- The repository must be made **private** before the first real environment variable or any real organizational data exists. That happens at the database phase at the latest.

## Roadmap

Six milestones: foundations → public website → database/auth/API spine → core operations → portals → production readiness. The detailed phase list is in [`docs/PHASE_0_ARCHITECTURE.md`](docs/PHASE_0_ARCHITECTURE.md), section 12.

## License / ownership

Work in progress for Compassionate Care Plus Inc. Not licensed for reuse.
