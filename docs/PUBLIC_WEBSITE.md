# PUBLIC WEBSITE

What exists on the public marketing site, and the decisions behind it.

## Structure

Everything public lives under the `(public)` route group, which shares one layout: `DevelopmentBanner` → `Header` → page content → `Footer`. The route group's parentheses don't appear in the URL - `app/(public)/about/page.tsx` is just `/about`.

```
src/app/(public)/
├── layout.tsx        Header, footer, development banner - wraps every page below
├── page.tsx           Homepage - the real content build
├── about/
├── services/
├── who-we-serve/
├── how-we-care/
├── resources/
├── contact/
└── request-care/
```

`src/app/sign-in/` sits outside this group deliberately - it's the door into the internal application, not a marketing page, and it doesn't get the marketing header/footer.

## What's real vs. what's a placeholder

**Real, working:** the layout shell, navigation (desktop + mobile), the homepage's structure and copy pattern, the FAQ accordion, the request-care and sign-in entry points existing as real links rather than 404s.

**Placeholder, clearly marked:** every service name, every "who we serve" specific, the address in the footer, all four legal documents, and the FAQ answers themselves. The service list on the homepage (skilled nursing, PT, OT, etc.) uses standard home-health industry categories as *illustrative examples* - labelled "Illustrative - to be confirmed by the organization" directly on the page - not asserted as this organization's actual services.

Every non-homepage page beyond the shell is a `ComingSoonPage` stub: honest about what it is, states which phase builds the real version, and exists so no nav link 404s.

## Design decisions specific to this milestone

**No stock photography.** Rather than sourcing photos of real people to stand in for an organization that hasn't supplied any of its own, the hero uses an original SVG illustration (`hero-illustration.tsx`) - a house held within two arcing lines, in the brand palette. It's a considered choice, not a placeholder waiting to be swapped for a photo, though real photography can replace it later if the organization wants that.

**Mobile menu uses `<details>`/`<summary>`**, not a hand-built dropdown. The browser already handles the keyboard and screen-reader behavior correctly for free; I only style it. If a more elaborate animated mobile menu is wanted later, `header.tsx` is the file to revisit - this was a deliberate scope decision for this phase, not an oversight.

**FAQ accordion also uses `<details>`** for the same reason - zero JavaScript, fully accessible, and the `group-open:` Tailwind variant handles the +/− indicator.

**Layout variety, on purpose.** The homepage deliberately avoids repeating "three cards in a row": the hero is an asymmetric two-column, "How we care" is a numbered sequence (a genuine one - referral through ongoing care - so the numbering is earned), services is a plain descriptive list rather than cards, and "Who we serve" is an editorial two-column. That variety is itself a decision described in `PHASE_0_ARCHITECTURE.md` section 10 and the frontend design guidance I'm following.

**The development banner stays** across every public page until real content replaces every placeholder - not just some of them. It's the thing that keeps this from accidentally reading as a published, factual website.

## Service pages (Phase 5)

`src/lib/services-data.ts` holds every service's content in one file - title, summary, who it may serve, what to expect, a care process sequence, common questions, and related services. Both `/services` (the index) and `/services/[slug]` (each detail page) render from this file rather than being separate hand-written pages, so adding a seventh service later means adding one entry to the data file, not building a new page from scratch.

`generateStaticParams()` in `[slug]/page.tsx` tells Next.js to pre-build one page per service at build time - all six render as static HTML, same as every other public page.

Every service's content still carries the same "illustrative - to be confirmed" label as the homepage's service list, for the same reason: these are standard home-health industry categories used as example content, not a confirmed fact about what Compassionate Care Plus offers.

## What's not built yet

The real about/trust content, the real request-care form (currently a stub - the real one needs the fields specified in section 19 of the architecture doc, without collecting sensitive medical information through a public form), and real contact details. These are Phases 6-7.
