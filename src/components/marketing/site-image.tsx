import { cn } from "@/lib/cn";
import {
  siteImageSrc,
  siteImageSrcSet,
  type SiteImageData,
} from "@/lib/site-images";

/*
  SiteImage
  =========
  Draws one photograph from src/lib/site-images.ts.

  A plain <img> with a list of sizes, not next/image, on purpose: Unsplash's
  image servers already resize and compress on request, so the browser asks
  for the size it needs (srcset) and the site depends on nothing else. The
  lint rule that prefers next/image is switched off for this one line and
  this one reason.

  `priority` is for the single picture at the very top of a page, so it
  loads first instead of last.
*/

const WIDTHS = [480, 768, 1080, 1440, 1920] as const;

export function SiteImage({
  image,
  sizes,
  priority = false,
  className,
}: {
  image: SiteImageData;
  // What share of the screen the picture fills, for example "100vw" or
  // "(min-width: 1024px) 40vw, 100vw". Helps the browser pick a size.
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={siteImageSrc(image, 1080)}
      srcSet={siteImageSrcSet(image, WIDTHS)}
      sizes={sizes}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      style={{ objectPosition: image.focus }}
      className={cn("object-cover", className)}
    />
  );
}
