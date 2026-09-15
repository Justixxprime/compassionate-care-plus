# NEXT_STEP.md

**Last updated:** 15 September 2026
**Just finished:** Phase 5 — public service pages

---

## IMPORTANT — a leftover file needs deleting on your machine

The previous ZIP delivery left an old `src/app/page.tsx` on your disk (a ZIP extraction only adds/overwrites files, it never deletes ones the archive doesn't include). That old file was the Phase 2 placeholder homepage, and Next.js was serving it instead of the real one. Run this once:

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item "src\app\page.tsx"
Remove-Item -Recurse -Force .next
```

Then continue with the install/build steps below as normal.

## What I just completed

Built real service pages: a `/services` index listing all six categories, and an individual detail page for each one (`/services/skilled-nursing`, `/services/physical-therapy`, etc.) with who it may serve, what to expect, a care process sequence, common questions where relevant, related services, and a request-care call to action.

## What files were created

- `src/lib/services-data.ts` — every service's content, in one place
- `src/app/(public)/services/page.tsx` — rewritten from a placeholder stub into the real index
- `src/app/(public)/services/[slug]/page.tsx` — the dynamic detail page template, one per service

## What changed

- `docs/PUBLIC_WEBSITE.md` — added a section explaining how the service pages work

## How to test it

```bash
npm install
npm run dev
```

Visit `/services` — six services should be listed, each linking to its own page. Click into a couple of them. Click "All services" to go back. Click "Request care" at the bottom of a service page.

```bash
npm run build
```

Should show all six services under `/services/[slug]` as statically generated pages.

## What should work

- `/services` lists all six categories with working links
- Each service detail page shows its own content, not a shared placeholder
- "Related services" links between pages that make sense together
- Visiting a nonsense URL like `/services/not-a-real-service` shows a proper 404, not a broken page

## Known issues

- Content is still illustrative, labelled as such on every page - not confirmed services from the organization
- No images on service pages yet

## What comes next

Phase 6 — about, care approach and trust content.

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item "src\app\page.tsx" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run dev
```

Check `/services`, then:

```bash
git add .
git commit -m "Phase 5: public service pages"
git push
```
