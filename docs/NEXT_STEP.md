# NEXT_STEP.md

**Last updated:** 16 September 2026
**Just finished:** Real logo and icon system, a much fuller header/footer, and the first slice of the real database

---

## Big finding this round: Cheliv is a real, already-operating, licensed agency

Independent of this website project, Cheliv Compassionate Care Plus Inc already exists and is licensed by Texas HHSC (license #017743). Two things came out of checking this:

1. **Confirmed:** it's a clinical home health agency (skilled nursing, PT/OT/ST), not just non-medical home care. The Services page content is correct as-is.
2. **Still open:** every official directory listing shows the phone number **(281) 565-3336**, not the (281) 903-7551 currently on the site (which came from the old Cheliv mock). I have not changed this yet - need you to confirm which one is actually correct before I touch it.

## What I just completed

**A real logo.** No official Cheliv logo exists online, so I designed an original mark (`logo-mark.tsx`) - an open arc in pine green cradling a small marigold point of light. Not a generic medical cross, works at small sizes.

**A redesigned header and footer.** The old header's plain-text brand name was too large and loud. It's now a compact icon-plus-two-line lockup, closer in spirit to how Mayo Clinic keeps its logo small and lets the navigation breathe. The footer went from four thin columns to a full dark, sectioned footer with real contact info and icons - not copying Mayo's exact categories, but matching the comprehensiveness.

**Real icons throughout**, via lucide-react: a distinct icon per service (stethoscope, activity, etc.) on both the homepage and the Services page, and location/phone/hours icons on the Contact page and in the footer.

**Fixed a data duplication** I'd created earlier - the homepage had its own separate, hand-typed copy of the services list instead of using the same one Services page and detail pages pull from. Now there's exactly one source (`services-data.ts`), so a future edit can't accidentally update one page and miss another.

**The database - first slice.** Installed Prisma (hit and fixed two real problems along the way - see below) and wrote the schema for organizations, users, sessions, roles, and permissions, plus a seed script that creates one demo admin account. Not the full clinical schema yet - patients, visits, care plans come in Milestone D, once auth actually works.

## Two real problems I hit and fixed while installing Prisma

1. **A known npm bug** (`Cannot read properties of null (reading 'edgesOut')`) hit repeatedly during install - not caused by anything in this project, a documented npm/arborist issue. Fixed with a clean reinstall.
2. **Prisma's newest version pulls in a lot of unrelated weight** - an embedded studio UI, a MySQL driver we don't need, and real vulnerabilities in transitive dependencies. Pinned to Prisma 6.19.3 instead (mature, stable, lean) and closed the one remaining vulnerability with a package override rather than downgrading further. `npm audit` now reports zero vulnerabilities.

## On the "you keep bringing stale files" problem

I hear this, and here's what actually changed: before packaging this zip, I extracted it fresh into a separate folder and ran a direct file-by-file comparison against my real working files - `page.tsx`, `layout.tsx`, `header.tsx`, `footer.tsx`, the Prisma schema, everything that mattered this round. Every one matched exactly. I'm doing this check every time from now on, not just when reminded.

## What files were created

- `src/components/marketing/logo-mark.tsx`
- `src/lib/service-icons.tsx`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `scripts/check-root-layout.mjs` (from last round, still active)
- `docs/DATABASE.md` - full Windows walkthrough for installing PostgreSQL and running the first migration
- `docs/DEMO_ACCOUNTS.md` - git-ignored, the demo login

## What files changed

- `src/components/marketing/header.tsx`, `footer.tsx` - full redesign
- `src/app/(public)/page.tsx` - services section now pulls from the shared data + icons, no more duplication
- `src/app/(public)/services/page.tsx`, `contact/page.tsx` - icons added
- `package.json` - Prisma, bcryptjs, lucide-react added; pinned versions and override for the vulnerability fix
- `next.config.ts` - unchanged from last round (still allows Pexels images)
- `docs/ENVIRONMENT_VARIABLES.md`, `docs/FOLDER_STRUCTURE.md` - updated for the database

## The database setup is different from everything before it

Every previous phase, I could fully build and verify in my own environment. This one I can't - Prisma needs to reach `binaries.prisma.sh` to download its engine, which isn't reachable from where I work. I wrote `prisma/schema.prisma` and `prisma/seed.ts` by hand, carefully, but **the actual first migration has to run on your machine**. `docs/DATABASE.md` has the complete walkthrough: installing PostgreSQL, creating the database through pgAdmin, building the connection string, and running the migration and seed.

## How to test it

For the design changes:
```bash
npm install
npm run dev
```
Look at the header (should be much smaller now, with the logo mark), the services list on both the homepage and `/services` (icons), and the footer (much fuller, dark).

For the database - this is the real test this phase. Follow `docs/DATABASE.md` start to finish: install PostgreSQL, create the database, set up `.env`, then:
```bash
npx prisma migrate dev --name init
npx prisma db seed
npx prisma studio
```
Confirm you see the organization, nine roles, thirty permissions, and one demo admin user in Prisma Studio.

## Known issues

- Phone number discrepancy still unresolved - see the top of this file
- Fax number, real photos of the actual office/team still outstanding
- Database schema only covers identity/auth so far, not clinical data yet

## What comes next

Once the database is confirmed working on your end, next is actually building sign-in - real authentication using these tables, replacing the current sign-in stub.

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run dev
```

Check the design changes first (fast), then work through `docs/DATABASE.md` for the database (slower, needs a real install). When both are confirmed:

```bash
git add .
git commit -m "Real logo, icon system, fuller header/footer, first database schema"
git push
```
