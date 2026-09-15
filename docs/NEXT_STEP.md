# NEXT_STEP.md

**Last updated:** 15 September 2026
**Just finished:** Milestone B start — public website layout and homepage (Phases 3 & 4 combined)

---

## What I just completed

Built the real public website shell and homepage: header with desktop and mobile navigation, footer, a persistent development banner, and a homepage with a real hero, a "how we care" process, a services overview, a "who we serve" section, a request-care call to action, and an FAQ accordion. Every other nav destination (About, Services, Who We Serve, How We Care, Resources, Contact, Request Care, Sign In) now goes to a real page instead of a 404 - most of them honest placeholders for now.

## What files were created

**Layout & shared pieces**
- `src/app/(public)/layout.tsx` — wraps every public page in header + footer + banner
- `src/components/marketing/header.tsx`
- `src/components/marketing/footer.tsx`
- `src/components/marketing/development-banner.tsx`
- `src/components/marketing/hero-illustration.tsx` — original SVG, not stock photography
- `src/components/marketing/nav-links.ts` — the single source of truth for navigation
- `src/components/marketing/coming-soon-page.tsx` — the placeholder page template

**Pages**
- `src/app/(public)/page.tsx` — the real homepage
- `src/app/(public)/about/page.tsx`
- `src/app/(public)/services/page.tsx`
- `src/app/(public)/who-we-serve/page.tsx`
- `src/app/(public)/how-we-care/page.tsx`
- `src/app/(public)/resources/page.tsx`
- `src/app/(public)/contact/page.tsx`
- `src/app/(public)/request-care/page.tsx`
- `src/app/sign-in/page.tsx`

**Docs**
- `docs/PUBLIC_WEBSITE.md`

## What changed

- `src/components/ui/button.tsx` — added `buttonVariants()`, a function that returns the Button's classes without rendering a `<button>`. Needed because a `<button>` nested inside a `<Link>`'s `<a>` is invalid HTML; this lets a `<Link>` look exactly like a button instead.
- Deleted `src/app/page.tsx` (the old root page) — the homepage now lives at `src/app/(public)/page.tsx` instead, inside the shared public layout.

## How to test it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and check:
- The development banner appears at the very top
- Desktop nav shows all six links plus Sign in and Request care
- Resize the browser narrow (or use the browser's device toolbar) - the hamburger menu should appear, open on click, and contain the same links
- Click through every nav link and every footer link - nothing should 404
- Click a FAQ question - it should expand with a − replacing the +
- Tab through the page with the keyboard - every link and button should show a visible focus ring

```bash
npm run build
npm run lint
```

Both should finish with no errors. I also checked the compiled CSS directly this phase to confirm the mobile menu and FAQ accordion's utility classes (`group-open:hidden`, etc.) actually generated - they did.

## What should work

- 11 real routes, no 404s from any navigation link
- Mobile menu opens/closes via tap, keyboard-operable by default (native `<details>`)
- FAQ accordion expands/collapses
- Every page shows the development banner
- Homepage layout varies section to section rather than repeating one pattern

## Known issues

- Every page beyond the shell and homepage is a placeholder stub - that's expected at this point, not a bug.
- Request Care and Sign In are stub pages, not working forms - those come in Phase 7 and the auth milestone respectively.
- No real service names, address, or legal text anywhere - all clearly labelled.
- The mobile menu and FAQ are intentionally simple (native HTML, no custom animation). Fine for now; revisit if a more elaborate interaction is wanted later.

## What I should not change

- `nav-links.ts` should stay the single place navigation is defined - don't hardcode a link list separately in the header or footer.
- The development banner should not be removed or hidden until real content actually replaces the placeholders it's warning about - not just some of them.

## What comes next

Phase 5 — public service pages (once services are confirmed, or built as clearly-labelled illustrative content if not). Phase 6 — about, care approach, trust content. Phase 7 — the real request-care form and real contact details.

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npm run dev
```

Click through the whole site at http://localhost:3000, then:

```bash
git add .
git commit -m "Milestone B: public website layout, navigation, and homepage"
git push
```
