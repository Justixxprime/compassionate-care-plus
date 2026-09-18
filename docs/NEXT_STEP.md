# NEXT_STEP.md

**Last updated:** 17 September 2026
**Just finished:** Patients and relationship-based access — the first slice of Milestone D

---

## What I just completed

The first real clinical data: a `patients` table and a `care_team_members` join table, plus the actual access-control logic that makes relationship-based access real rather than theoretical - `src/lib/patients.ts`. An administrative role (admin, clinical supervisor, care coordinator) sees every patient in the organization. A direct-care role (nurse, caregiver) only sees patients they're actually assigned to.

Also filled in real permission sets for ADMIN and NURSE roles (previously only SUPER_ADMIN had any), since the nurse account needed real permissions to actually test this.

## IMPORTANT — another new migration needed

Two new tables this round (`patients`, `care_team_members`). Run the migration command at the bottom of this file.

## What files were created

- `src/lib/patients.ts` - `getAccessiblePatients()`, the real access-control logic
- `src/app/patients/page.tsx` - bare list page proving it works
- `docs/PATIENTS.md`

## What files changed

- `prisma/schema.prisma` - added `Patient` and `CareTeamMember` models
- `prisma/seed.ts` - added a second demo account (`demo.nurse@cheliv.test`), three synthetic demo patients, one active care-team assignment, and real permission sets for ADMIN and NURSE roles
- `src/app/dashboard/page.tsx` - added a "View patients" link
- `docs/DEMO_ACCOUNTS.md` - now documents both demo accounts

## How to test it — this is the actual point of this round

```bash
npm install
npx prisma migrate dev --name add_patients_and_care_team
npx prisma db seed
npm run dev
```

Sign in as `demo.admin@cheliv.test`, visit `/patients` — should show all three: Eleanor Whitfield, Marcus Delgado, Priya Raman.

Sign out, sign in as `demo.nurse@cheliv.test` (same password), visit `/patients` — should show **only** Eleanor Whitfield.

That difference is the whole test. If the nurse account sees all three, or none, something's wrong with the relationship check.

```bash
npm run build
npm run lint
npx tsc --noEmit
```

I hit the same category of type-checking issue as the audit logging round (my sandbox's stub Prisma client can't infer types the way a real generated client would) and fixed each one with an explicit type annotation rather than leaving it to chance on your machine too.

## Known issue in my own build environment, not yours

Same as always: `npm run build` fails in my sandbox specifically with `@prisma/client did not initialize yet`. Lint and the full TypeScript check both pass clean.

## What comes next

Still within Milestone D: visits next, then care plans, then documents and referrals. Each as its own round.

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_patients_and_care_team
npx prisma db seed
npm run dev
```

Test both demo accounts on `/patients` as described above, then:

```bash
git add .
git commit -m "Patients and relationship-based access - first slice of Milestone D"
git push
```
