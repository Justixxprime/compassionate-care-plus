// src/lib/site-images.ts
//
// EVERY photograph on the public website, in one place.
//
// These are free stock photos from Unsplash (free to use commercially, no
// credit legally required; the photographers are named below anyway). They
// stand in until the organization has real photography of its own. Nothing
// else in the code names a photo, so swapping one takes one edit here:
//
//   To use a photo from your own computer instead:
//     1. Put the file in public/images/ (for example public/images/team.jpg)
//     2. Change that entry's `photo` to "/images/team.jpg"
//     3. Fix its `alt` text so it describes the real photo, and delete `credit`
//
//   To use a different Unsplash photo:
//     Change `photo` to the part of its image address after
//     images.unsplash.com/ and before the "?", for example
//     "photo-1765896387387-0538bc9f997e". Update `alt` and `credit`.
//
// The `alt` text is what a screen reader says, and it must describe what
// is actually in the picture. These are strangers, not the real team, so
// the descriptions say what is shown and nothing more.
//
// The images are loaded straight from Unsplash's own image servers, which
// resize them to the width asked for (see SiteImage). A photo from
// public/images is used as it is.

export interface SiteImageData {
  // An Unsplash photo id ("photo-...") or a path into public/ ("/images/x.jpg").
  photo: string;
  alt: string;
  // Where the picture is anchored when it is cropped (CSS object-position).
  focus: string;
  credit?: { photographer: string; pageUrl: string };
}

export const siteImages = {
  // Homepage, behind the opening headline.
  hero: {
    photo: "photo-1765896387387-0538bc9f997e",
    alt: "A nurse smiling as she talks with an older patient",
    focus: "60% 40%",
    credit: {
      photographer: "Age Cymru",
      pageUrl: "https://unsplash.com/photos/nurse-smiling-with-elderly-patient-in-room-dMhB7w99ju8",
    },
  },
  // Homepage, beside "Who we serve".
  whoWeServe: {
    photo: "photo-1773227055624-07b515ba87c5",
    alt: "A caregiver helping an older woman walk with a walker",
    focus: "50% 45%",
    credit: {
      photographer: "Age Cymru",
      pageUrl: "https://unsplash.com/photos/caregiver-assists-elderly-woman-with-walker-2obyM4zYt3Y",
    },
  },
  // About page, beside "What we believe".
  about: {
    photo: "photo-1765896387398-1e1ae8d2eb85",
    alt: "A woman in scrubs leaning in to talk with an older person seated in a chair",
    focus: "45% 35%",
    credit: {
      photographer: "Age Cymru",
      pageUrl: "https://unsplash.com/photos/woman-in-scrubs-talking-to-senior-qW3DLnehg9w",
    },
  },
  // Who we serve page, beside the list of situations.
  whoWeServePage: {
    photo: "photo-1762955911431-4c44c7c3f408",
    alt: "A caregiver sitting with an older couple, helping them with a colouring activity",
    focus: "50% 40%",
    credit: {
      photographer: "Age Cymru",
      pageUrl: "https://unsplash.com/photos/caregiver-assisting-elderly-couple-with-coloring-bSXk1lOp8T0",
    },
  },
} as const satisfies Record<string, SiteImageData>;

// Other good candidates found for the same slots, ready to swap in:
//   photo-1758691462477-976f771224d8  a doctor talking with an older man on his sofa at home (Vitaly Gariev)
//   photo-1773227059784-c1e36cc8c8c9  two older women sitting and talking (Age Cymru)
//   photo-1658314755707-1fbdf7c40145  an older couple holding hands outdoors (Centre for Ageing Better)

const isLocal = (photo: string) => photo.startsWith("/");

// The address of the picture at a given width in pixels.
export function siteImageSrc(image: SiteImageData, width: number): string {
  if (isLocal(image.photo)) return image.photo;
  return `https://images.unsplash.com/${image.photo}?auto=format&fit=max&w=${width}&q=75`;
}

// The list of widths a browser may choose from. Undefined for a local file,
// which is a single size.
export function siteImageSrcSet(
  image: SiteImageData,
  widths: readonly number[],
): string | undefined {
  if (isLocal(image.photo)) return undefined;
  return widths.map((w) => `${siteImageSrc(image, w)} ${w}w`).join(", ");
}
