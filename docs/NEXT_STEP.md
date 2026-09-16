# NEXT_STEP.md

**Last updated:** 15 September 2026
**Just finished:** Full rebrand, tone shift, and a cinematic visual overhaul

---

## What changed and why

You asked for four things, and this covers all four:

1. **No dashes, anywhere.** Every em dash used as a bullet marker or mid-sentence punctuation is gone across the entire public site, replaced with real sentences or proper icon/dot bullets.

2. **"Cheliv" confirmed.** The brand name is now "Cheliv Compassionate Care Plus" everywhere: header, footer, page titles, About, Contact, Services, How We Care, Who We Serve. It comes from one shared constant (`brandName` in `nav-links.ts`), so if it ever needs to change again, it changes in one place.

3. **No visible placeholder framing.** The development banner is gone entirely (deleted, not just hidden). Every "Illustrative, to be confirmed by the organization" label is gone. Every page that was a build-phase stub (How We Care, Who We Serve, Resources, Sign In) now has real, professional copy instead of exposed phase numbers. The one thing I did NOT touch: the four legal links in the footer (privacy policy, terms, accessibility, notice of privacy practices) still point at nothing real yet - not because of a policy about placeholders, but because writing actual legal text wrong is a real liability for the organization. They're shown as plain unlabelled text now instead of flagged as placeholders, so they don't look unfinished, but they're not real documents yet either. That is the one boundary I'm holding regardless of how the rest of the site's tone changed.

4. **Cinematic upgrade.** Built:
   - A full-bleed, nearly full-viewport-height hero with a dark background and a slow-drifting animated gradient backdrop (three soft color blobs on independent loops, pure CSS, no video file needed)
   - Much bigger, bolder type throughout, using `clamp()` so headlines scale smoothly from phone to large desktop rather than jumping between fixed sizes
   - A bold, dark "by the numbers" stat band moved onto the homepage itself (not just the About page), with the real confirmed numbers counting up
   - Every major page (About, Contact, Services, How We Care, Who We Serve) now opens with the same dark, cinematic header treatment for a consistent premium feel site-wide

## What files changed

Nearly everything under `src/app/(public)/`, plus:
- `src/components/marketing/nav-links.ts` - added `brandName`
- `src/components/marketing/header.tsx` - real brand name
- `src/components/marketing/footer.tsx` - rewritten
- `src/components/marketing/aurora-field.tsx` - new, the animated hero backdrop
- `src/app/globals.css` - aurora keyframes and blob styles added
- `src/app/layout.tsx` - metadata updated to the real brand name
- `src/components/marketing/request-care-form.tsx` - dash cleanup

## What was deleted

- `src/components/marketing/development-banner.tsx` - the whole component, not just its usage
- `src/components/marketing/coming-soon-page.tsx` - no longer needed now that every page has real content

## How to test it

```bash
npm install
npm run dev
```

Load the homepage. You should see a big, dark, cinematic hero with a slowly drifting colored glow behind the headline, not the plain white page from before. Scroll down to the "by the numbers" band, bold and dark. Click through About, Contact, Services, How We Care, and Who We Serve, they should all open with the same dark header treatment now.

```bash
npm run build
npm run lint
npx tsc --noEmit
```

All three pass clean, checked before packaging this. I also confirmed directly in the compiled CSS output that the aurora animation and the responsive `clamp()` type sizes actually generated, not just that the build didn't error.

## Known issues

- Real photography still isn't in the site. See the open question below.
- The four legal footer links still lead nowhere real. This is intentional, not an oversight, see point 3 above.
- Fax number was dropped from Contact entirely rather than shown as unconfirmed, since only the office phone had a real, working link in the source material.

## Open question - I need an answer before I add real imagery

You asked for pictures. Two real constraints, not preferences: I'm not allowed to hotlink random photos scraped from the web into the site (copyright and reliability both), and I don't have a way to download and license stock photos into the project from inside this environment. So the actual options are:

1. **Send me real photos** of the actual office, staff, or care setting. Most authentic, best fit for a surprise built around a real person's real business.
2. **I tell you exactly which two or three free, properly licensed stock photos to download** (from Unsplash or Pexels) and where to drop them in the project folder. A two minute task on your end, then I wire them in.
3. **Keep it photography free** and lean further into the abstract, cinematic gradient treatment already built. This is a legitimate, often-preferred premium direction, plenty of top tier healthcare and SaaS sites do exactly this instead of stock photos.

Tell me which and I'll move immediately.

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run dev
```

Look through the whole site, then:

```bash
git add .
git commit -m "Rebrand to Cheliv Compassionate Care Plus, remove all placeholder framing, cinematic visual overhaul"
git push
```
