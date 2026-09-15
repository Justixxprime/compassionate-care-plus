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
