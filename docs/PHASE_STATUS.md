# PHASE_STATUS.md

Order follows the revised milestone plan in `PHASE_0_ARCHITECTURE.md` section 12.

---

## PHASE 0 — Research, requirements and architecture
- **Status:** Complete — 15 September 2026

## PHASE 1 — Project initialization
- **Status:** Complete — 15 September 2026

## PHASE 2 — Design system
- **Status:** Complete — 15 September 2026

## PHASES 3 & 4 — Public website foundation + homepage
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** public layout, header, footer, nav data, hero illustration, homepage, 8 pages (7 placeholder stubs + sign-in stub)
- **Tests:** `npm run build` (11 routes, no errors), `npm run lint` clean, compiled CSS checked for mobile menu / FAQ utilities
- **Known issues:** all content beyond the shell is placeholder, clearly labelled; request-care and sign-in are stubs
- **Next action:** Phase 5 - service pages

## PHASE 5 — Public service pages
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** `src/lib/services-data.ts`, real `/services` index, `/services/[slug]` dynamic detail pages
- **Tests:** `npm run build` shows all 6 services statically generated; lint clean
- **Known issues:** content is illustrative, clearly labelled
- **Next action:** Phase 6 - about, care approach and trust content

## PHASE 6 — About, care approach and trust content
- **Status:** Complete
- **Date:** 15 September 2026
- **Files:** real `/about` and `/contact` pages
- **Tests:** build (19 routes) and lint both clean
- **Known issues:** address/phone/stats still placeholder pending confirmation
- **Next action:** Phase 7 - request care form

## PHASE 7 — Contact and request care
- **Status:** Not started

## MILESTONE C — Spine: database, auth, API, RBAC, audit
- **Status:** Not started
- **Note:** repository must go private before this milestone begins

## MILESTONE D — Core operations
- **Status:** Not started

## MILESTONE E — Portals
- **Status:** Not started

## MILESTONE F — Production readiness
- **Status:** Not started
