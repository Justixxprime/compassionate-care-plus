# NEXT_STEP.md

**Last updated:** 21 September 2026
**Just finished:** Milestone E1, the internal app shell, plus sharing restricted documents and photos for the public site.

---

## What I just completed

1. **The frame for signed-in staff.** One shared layout with a menu on the left (a menu button on a phone). The menu shows only what your account can use, worked out on the server. Loading, error and not-found screens included.
2. **A real dashboard for each account.** It shows what needs attention first, then today's visits, referrals waiting (and for how long), patients without a primary nurse, and care plans to approve. Each part shows only if the account holds the permission for it. So the coordinator, the supervisor, the nurses and the admin each get a different dashboard without a list of roles to keep in step.
3. **The six proof pages moved inside the frame** and restyled: tables that turn into cards on a phone, plain empty states, one title style.
4. **Sharing restricted documents (your decision).** Insurance cards and ID scans are now visible to SUPER_ADMIN and ADMIN only. Your uncle (or any administrator) can let ONE named person see them: for one patient (all restricted documents, including ones filed later) or for one document, for 7 days, 30 days or until he takes it back. Taking it back works at once. The person must already be allowed to open documents and already be assigned to that patient. It lets them look and download only.
5. **Photos on the public site.** Four Unsplash photos (homepage hero, homepage "Who we serve", About, Who we serve page), all named in one file, `src/lib/site-images.ts`, so swapping for real photos later is one edit each. Credits and steps are in `docs/IMAGES.md`.

## IMPORTANT: three things you must do

**1. Delete six old folders.** The screens moved into `src/app/(app)/`. Unzipping never deletes, so the old copies remain and the site will not start. `npm run dev` will tell you exactly which, or run:

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item -Recurse -Force "src\app\dashboard"
Remove-Item -Recurse -Force "src\app\patients"
Remove-Item -Recurse -Force "src\app\visits"
Remove-Item -Recurse -Force "src\app\care-plans"
Remove-Item -Recurse -Force "src\app\documents"
Remove-Item -Recurse -Force "src\app\referrals"
```

Only the ones directly under `src\app`, not the ones inside `src\app\(app)`.

**2. Run one migration** (a new table, `document_access_grants`): `npx prisma migrate dev --name add_document_access_grants`. I did not ship SQL.

**3. Run the seed**, which adds the new permission `documents.grant` (34 in total) to SUPER_ADMIN and ADMIN.

## How to test it on your machine

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_document_access_grants
npx prisma db seed
npm run verify:access
npm run verify:shell
npm run dev
```

**Expect** the seed to say `34 permissions ready`. **Expect** `verify:access` to end with `661 passed, 0 failed` and `verify:shell` with `62 passed, 0 failed`.

Then in the browser (http://localhost:3000):

- Sign in as each demo account and look at the dashboard. Menus differ: the coordinator has no Care plans or Documents, the supervisor has no Referrals.
- Try sharing: as `demo.supervisor@cheliv.test`, open Documents (no Restricted badge). As `demo.admin@cheliv.test`, open Documents, press **Sharing**, share Eleanor Whitfield's restricted documents with Demo Supervisor. As the supervisor, they appear, marked "Shared with you". Take it back as the admin: gone at once.
- Look at the homepage, About and Who we serve for the photos. Tell me which to swap.
- Make the browser narrow (or use your phone) to check the phone menu and the cards.

## What was tested, and what was not

Type check, lint and production build clean. `verify:access` 661 checks (108 new for sharing). `verify:shell` 62 checks. I broke 24 rules on purpose, one at a time, and the tests failed each time. I fetched every page as each demo account over HTTP, checked that signed-out visitors are sent to sign-in, and called the share and take back actions through the real server actions.

**Not tested:** how anything LOOKS. I could not open a browser, and I could not load the Unsplash photos in the build environment, so the picks come from their descriptions. A crop or a choice may need a second look.

## Decisions I made without you (tell me if you disagree)

- **ADMIN holds `documents.grant` as well as SUPER_ADMIN.** If only the owner should share, remove it from the ADMIN list in `prisma/seed.ts` and from the ADMIN role in the database.
- **The person receiving a share must already hold `documents.read` and reach the patient.** A share never widens who can see a patient.
- **A small line "Demonstration data. Every patient here is made up." sits under the menu.** It is honest while everything is synthetic. Say if you want it removed.
- **Sharing screen is reached from Documents, not from the menu.**

## Still open from before

The public `/request-care` form still says "Request received" and saves nothing. The repo is public and `PROJECT_HANDOFF.md` names the owner (you also want the site to stay a surprise, so a private repo or a trimmed file is worth deciding). Where real files will live (paid, I will ask first). Only SUPER_ADMIN can archive documents.

## What comes next

E2, the Care Command Center: referral inbox with waiting time, accept-and-assign, patient list and profile, the care team panel (add, end, and the list of patients who need a primary nurse), staff list, scheduling board, and the audit log page with filters.

## Exact next commands after you have tested

```powershell
git add .
git commit -m "App shell, per-permission dashboards, sharing restricted documents, site photos, 661 access checks"
git push
```
