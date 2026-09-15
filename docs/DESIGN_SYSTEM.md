# DESIGN SYSTEM

This is my design system: the colors, type and first components everything else in the project builds from. If I ever catch myself typing a raw hex code or a random pixel value into a component, that is the signal I have skipped this file.

## Where it lives

- `src/styles/tokens.css` — every raw value: colors, type sizes, spacing, radius, shadow. This is the single source of truth.
- `src/app/globals.css` — wires those tokens into Tailwind, so I can write `bg-pine` or `text-h2` directly in markup and it traces back to `tokens.css`.
- `src/components/ui/` — the first real components: `Button`, `Input`, `Label`, `Card`, `Badge`.
- `/design-system` — a page in the running app that shows all of this rendered. Not a real page in the finished site — it's my own reference, and it gets removed or hidden before this goes anywhere near a real audience.

## Why this exists instead of styling each page by hand

If I style every page individually, "make the primary color a little darker" becomes a search-and-replace across dozens of files, and I will inevitably miss one. With tokens, I change one value in `tokens.css` and every button, link and badge in the app updates together. It also means the public website and the internal application can share the same underlying system while looking and feeling different — same foundation, different composition.

## Color

| Token | Hex | What it's for |
|---|---|---|
| `ink` | `#172420` | Body text, dark surfaces |
| `paper` | `#faf9f6` | Page background |
| `pine` | `#1c4a3c` | Primary — main buttons, links, active states |
| `sage` | `#e6ede7` | Muted surfaces — section bands, table headers |
| `marigold` | `#c98a14` | The one accent — used for things that need attention, not decoration |
| `slate` | `#5c6a66` | Secondary text, muted labels |

Plus semantic pairs for the internal application: `success`, `warning`, `danger`, `info` — each with a matching `-bg` tint for badges.

**The rule that matters most:** status is always color *plus* text. A green dot means nothing to someone who can't see color; the word "Completed" does. Every `Badge` in this system renders its label — there's no color-only variant.

## Typography

Two typefaces, self-hosted (no request to Google Fonts at runtime — the font files ship inside the app):

- **Source Serif 4** — `font-display`. Used for headlines. It's what gives the public site its warmth; a serif at real size reads as considered rather than default.
- **IBM Plex Sans** — `font-sans`, the default body font. Chosen partly because its numerals are genuinely good in tables — that matters a lot once schedules and visit counts show up.

Scale: `text-display` down through `text-h1` / `text-h2` / `text-h3` / `text-h4` / `text-body-lg` / `text-body` / `text-body-sm` / `text-caption` / `text-label` / `text-data`. Each pairs a size with its own line-height, so `text-h2` is never just a font-size — it's a complete, considered text style.

## Components so far

| Component | What it's for |
|---|---|
| `Button` | Three variants (`primary`, `secondary`, `ghost`), three sizes. One main action per screen gets `primary`. |
| `Input` | Text fields, styled once and shared everywhere — public forms and internal app alike. |
| `Label` | Always paired with a field via `htmlFor`/`id`. A field without a linked label is invisible to screen readers. |
| `Card` | For content that genuinely needs a bounded container. Not the default answer to every layout problem — see the warning below. |
| `Badge` | Status indicators. Always renders text, never color alone. |

More get added as real screens need them — a `Table`, a `Dialog`, a `Select` — but only once an actual screen needs one, not speculatively.

## What I'm deliberately avoiding

Straight from the brief and the design skill I'm following: no glassmorphism, no gradient washes as decoration, no identical rounded cards stacked in threes, no all-caps eyebrow labels above every heading, no arrow appended to every link, one shadow style used sparingly rather than shadows on everything. If a page turns into "three cards in a row" as its default structure, that's the tell of a templated design, and I stop and rethink the layout instead.

## Accessibility built in from here

- Visible focus ring on every interactive element (`:focus-visible` in `globals.css`), not just the browser default.
- 44px minimum height on buttons and inputs at the default size.
- `prefers-reduced-motion` respected globally.
- Tabular numerals (`.text-data`) so digits in schedules and counts line up in columns.

## How to see it

```bash
npm run dev
```

Then open <http://localhost:3000/design-system>.
