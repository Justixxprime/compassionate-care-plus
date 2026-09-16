## Rebrand, placeholder removal, cinematic overhaul
**15 September 2026**

Changed
- Brand name updated to "Cheliv Compassionate Care Plus" everywhere, driven from one shared constant
- Removed all em dashes from visible copy (bullet markers and mid sentence punctuation)
- Removed the development banner and every "to be confirmed" / "illustrative" label
- How We Care, Who We Serve, Resources and Sign In rewritten from build-phase stubs into real pages
- Homepage, About, Contact, Services rebuilt with a cinematic dark hero treatment, bold clamp() based type scale, and an animated gradient backdrop (AuroraField)
- Added a bold "by the numbers" stat band to the homepage itself

Removed
- `development-banner.tsx` and `coming-soon-page.tsx` (no longer needed)

Kept, intentionally
- The four footer legal links still lead nowhere real, since writing actual legal text is a genuine liability regardless of the rest of the site's tone

## Phase 7 — Real request-care form
**15 September 2026**

Added
- `src/components/marketing/request-care-form.tsx` - real client-side form: name, email, phone, relationship, preferred contact method, service interest, best time, optional message
- Real `/request-care` page with the real office phone as an urgent-need fallback

Notes
- Confirmed via the project owner's uncle's own Facebook profile that the real legal name is "Cheliv Compassionate Care Plus INC" - a site-wide rename decision is pending
- Form has no backend to submit to yet (Milestone C not built) - documented clearly rather than faked

## Root layout fix, real content, motion system
**15 September 2026**

Fixed
- `src/app/layout.tsx` had been overwritten with duplicate `(public)/layout.tsx` content - missing html/body/metadata/CSS import. This caused both a local runtime error and a completely unstyled Vercel deployment. Restored correct content.

Added
- Motion system: scroll-reveal (`Reveal`), animated stat count-up (`StatCounter`), hero entrance animation, sticky header with scroll shadow - all respecting prefers-reduced-motion, with a noscript fallback for reveal content
- Real confirmed content: office address, phone, and About page stats (previously placeholders, now confirmed real by the project owner)

## Phase 6 — About and contact content
**15 September 2026**

Added
- Real `/about` page - "treat, then teach" positioning, beliefs list, stats bar (placeholder values), mission statement
- Real `/contact` page - placeholder address, phone/fax, example office hours

Notes
- Structure and copy style informed by a mock site built while learning (Cheliv Compassionate Care Plus) - specific facts (address, phone, stats) kept as placeholders pending confirmation they belong to this organization

## Phase 5 — Public service pages
**15 September 2026**

Added
- `src/lib/services-data.ts` - single source of truth for all service content
- Real `/services` index page (replacing the placeholder stub)
- `/services/[slug]` dynamic detail pages, statically generated per service

Fixed
- Documented and instructed removal of a leftover `src/app/page.tsx` that a prior ZIP delivery didn't clean up on the user's machine, which was causing the old Phase 2 placeholder to display instead of the real homepage

## Phases 3 & 4 — Public website foundation and homepage
**15 September 2026**

Added
- Public site layout: header (desktop + mobile nav), footer, persistent development banner
- Original SVG hero illustration - no stock photography
- Real homepage: hero, "how we care" process, services overview, who-we-serve, request-care CTA, FAQ accordion
- Placeholder pages for About, Services, Who We Serve, How We Care, Resources, Contact, Request Care, Sign In - so no nav link 404s
- `buttonVariants()` helper so links can look like buttons without invalid nested-button HTML
- `docs/PUBLIC_WEBSITE.md`

Changed
- Removed the old root `page.tsx` - homepage now lives inside the `(public)` route group

# CHANGELOG

## Phase 2 — Design system
**15 September 2026**

Added
- `src/styles/tokens.css` - color, type scale, spacing, radius and shadow tokens
- Self-hosted fonts: Source Serif 4 (display) and IBM Plex Sans (body/UI), via @fontsource - no runtime request to Google Fonts
- First five components: Button, Input, Label, Card, Badge
- `cn()` utility for merging Tailwind classes (clsx + tailwind-merge)
- `/design-system` reference page showing every token and component rendered
- `docs/DESIGN_SYSTEM.md`

Changed
- `globals.css` rewritten to wire tokens into Tailwind's theme
- Homepage updated to use real tokens instead of Phase 1 placeholder grays

## Phase 1 — Project initialization
**15 September 2026**

Added
- Next.js 16.3.5 project with React 19, TypeScript (strict) and Tailwind CSS 4
- Placeholder homepage at `/` stating clearly that no content is confirmed yet
- Root layout with project metadata and `robots: noindex` for the development build
- `prefers-reduced-motion` support in global styles, from the first commit
- `.env.example` template and documentation of every planned variable
- Documentation set: README, ULTRA_BABY_STEPS, PHASE_0_ARCHITECTURE, ENVIRONMENT_VARIABLES, FOLDER_STRUCTURE, TROUBLESHOOTING, NEXT_STEP, PHASE_STATUS

Changed
- Replaced the generator's default demo page and default dark-mode styles
- Extended `.gitignore` so `.env.example` is committed while all other env files are blocked

Removed
- Generator extras `AGENTS.md` and `CLAUDE.md`

## Phase 0 — Architecture
**15 September 2026**

- Planned the whole platform: roles, feature tiers, sitemaps, database, RBAC, security, design direction, cloud, phases, risks
- Reordered the build so database, authentication and API come before the portals
