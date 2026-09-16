# IMAGES

Real photography the site uses, where it came from, and how to replace it.

## Current state

Three photos are wired in right now, hotlinked directly from Pexels (free for commercial use, no attribution legally required):

| Where | Photo | Pexels page |
|---|---|---|
| Homepage hero background | Healthcare professional checking an elderly man's blood pressure, cozy room | pexels.com/photo/woman-and-man-with-sphygmomanometer-7345474 |
| About page, beside "What we believe" | Caregiver adjusting bedding in a warm home setting | pexels.com/photo/caregiver-adjusting-bed-in-a-prague-home-library-29372710 |
| Homepage, "Who we serve" section | Elderly couple at home checking blood pressure together | pexels.com/photo/adult-woman-checking-the-digital-blood-pressure-monitor-8088856 |

These are stock photos, not photos of the real team or office. Good enough to make the site feel alive right now, not a substitute for the real thing.

## Why hotlinked rather than downloaded

Pexels photos are served from a stable CDN (`images.pexels.com`) specifically meant to be linked to directly - that's different from scraping a random website's images, which is never okay. Pexels' own license permits this use with no cost and no attribution requirement.

The trade-off: the site now depends on Pexels staying up, and the image won't get Next.js's automatic optimization (resizing, modern formats, lazy loading) the way a local file would through `next/image`. `next.config.ts` already has `images.pexels.com` allowed as a remote pattern, so switching these from plain `<img>` tags to `next/image` later is a small, contained change, not a rebuild.

## When you have real photos

This is what actually matters for a business site - real photos of the real office, the real team, real care visits, beat any stock photo. When you have them:

1. Save them into `public/images/` inside the project folder (create the folder if it doesn't exist).
2. Tell me the filenames, or just replace the `src="https://images.pexels.com/..."` line in the relevant file with `src="/images/your-filename.jpg"`.
3. At that point it's worth switching to `next/image` for the performance benefit - ask and I'll do it.

## If you want different stock photos in the meantime

Search pexels.com or unsplash.com yourself, right-click the photo you like on the search results page, "Copy image address", and send me that URL - I'll wire it in the same way as these three.
