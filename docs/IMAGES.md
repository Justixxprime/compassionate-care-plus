# IMAGES

Every photograph on the public website, where it came from, and how to replace it.

## Current state

Four stock photos from Unsplash (free for commercial use; no credit is legally required, but the photographers are named here). They stand in until the organization has real photography. All four are named in ONE file, `src/lib/site-images.ts`, and drawn by `src/components/marketing/site-image.tsx`.

| Where | Photo | Photographer |
|---|---|---|
| Homepage, behind the opening headline (`hero`) | A nurse smiling as she talks with an older patient | Age Cymru |
| Homepage, beside "Who we serve" (`whoWeServe`) | A caregiver helping an older woman walk with a walker | Age Cymru |
| About page, beside "What we believe" (`about`) | A woman in scrubs leaning in to talk with an older person | Age Cymru |
| Who we serve page (`whoWeServePage`) | A caregiver sitting with an older couple | Age Cymru |

Links to each photo's Unsplash page are in `src/lib/site-images.ts`. Three more candidates for the same slots are listed at the bottom of that file.

These are strangers, not the real team. Their alt text (what a screen reader says) describes what is shown and does not claim they work here. The old Pexels photo on the About page was removed.

## How they load

Straight from Unsplash's image servers, which resize on request: the browser asks for the width it needs. There is no download step and nothing to install. The site therefore needs internet access to show them. `next.config.ts` allows `images.unsplash.com` in case a photo is ever moved to `next/image`.

## Swap one photo for another Unsplash photo

In `src/lib/site-images.ts`, change that entry's `photo` to the part of the image address after `images.unsplash.com/` and before the `?`, for example `photo-1765896387387-0538bc9f997e`. Update `alt` and `credit`. `focus` is where the picture is anchored when it is cropped (for example `"60% 40%"` keeps a point 60 percent across and 40 percent down in view).

## When you have real photos (the last stage before showing)

1. Put the files in `public/images/` (for example `public/images/team.jpg`).
2. In `src/lib/site-images.ts`, change that entry's `photo` to `"/images/team.jpg"`, fix the `alt` to describe the real photo, and delete `credit`.
3. That is the whole change. Nothing else in the code names a photo.

Use photos of real staff only with their permission, and real patients only with written consent. Aim for at least 1600 pixels wide for the homepage photo.

## Not checked

The photographs were chosen from the search results' descriptions. They could not be previewed in a browser in the build environment, so a crop or a pick may need a second look.
