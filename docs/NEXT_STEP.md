# NEXT_STEP.md

**Last updated:** 15 September 2026
**Just finished:** Phase 2 — design system

---

## What I just completed

Built the actual design system: color tokens, a type scale, spacing and radius tokens, two self-hosted typefaces, and the first five real components (`Button`, `Input`, `Label`, `Card`, `Badge`). Added a `/design-system` page so I can see all of it rendered in the browser instead of just reading about it in a file.

I went with the direction from `PHASE_0_ARCHITECTURE.md` section 10: deep pine green as primary, warm paper background, marigold as the single accent, Source Serif 4 for headings paired with IBM Plex Sans for body and UI text.

## What files were created

- `src/styles/tokens.css` — every raw design value: colors, type scale, spacing, radius, shadow
- `src/app/globals.css` — rewritten to wire tokens into Tailwind's theme and load the self-hosted fonts
- `src/lib/cn.ts` — small utility for merging Tailwind classes without conflicts
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/app/design-system/page.tsx` — a reference page showing everything rendered together
- `src/app/page.tsx` — updated to use the real tokens instead of the Phase 1 placeholder grays
- `docs/DESIGN_SYSTEM.md`

## What changed

- Two new dependencies for fonts: `@fontsource/source-serif-4`, `@fontsource/ibm-plex-sans` — these ship the actual font files inside the app, so there's no live request to Google Fonts when the site loads or builds.
- Two small utility dependencies: `clsx`, `tailwind-merge` — used inside `cn()`.
- `globals.css` no longer has the Phase 1 placeholder styling — it now defines the real system.

## How to test it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — the homepage should now show pine green, marigold and the serif headline instead of plain black-and-white text.

Then open <http://localhost:3000/design-system> — this shows every color swatch, every type size, all three button variants, badges, an input with a label, and a card, all in one place. This is the page to actually check against — if a color looks wrong or a font isn't loading, it will be obvious here.

Also run:

```bash
npm run build
npm run lint
```

Both should finish with no errors.

## What should work

- The homepage shows the pine/paper/marigold palette and the serif headline
- `/design-system` renders all six color swatches, the full type scale, three button variants (including a disabled one), five status badges, a labeled input, and a card
- Clicking into the input and tabbing through the buttons shows a visible outline (keyboard focus)
- `npm run build` and `npm run lint` both pass clean

## Known issues

- `/design-system` is a working reference page, not a real page in the site — it gets removed or moved behind an internal-only route before this goes near a real audience.
- Only five components exist. More (`Table`, `Dialog`, `Select`, etc.) get added as real screens actually need them.
- No real branding from the organization exists to check this against, since this is being kept as a surprise. If real branding ever does show up, this palette gets revisited then.

## What I should not change

- The token names in `tokens.css` — components already reference them by name (`bg-pine`, `text-h2`, etc.). Renaming a token means updating every place that uses it.
- The `@theme inline` block in `globals.css` — it deliberately mirrors `tokens.css` using Tailwind v4's naming convention (`--text-h1`, `--color-pine`, etc.) so those values become real utility classes.

## What comes next

**Milestone B — the public website**, starting with the shared layout: header, footer, and the navigation shell every public page sits inside. After that: the homepage for real, then the individual service pages.

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npm run dev
```

Check both `/` and `/design-system`, then commit:

```bash
git add .
git commit -m "Phase 2: design system - tokens, typography, and first components"
git push
```
