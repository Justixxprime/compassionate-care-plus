/*
  AuroraField
  ===========
  A slow-moving, soft gradient backdrop - the "alive" premium feel behind
  the hero, built entirely from CSS (no image, no video file needed).
  Three blurred glows drift on independent loops so the motion never
  feels mechanical or looped in an obvious way.

  Purely decorative and marked aria-hidden. Respects prefers-reduced-motion
  through the global rule in globals.css, same as every other animation
  in the app - reduced-motion visitors get the same rich color field,
  just static.
*/

export function AuroraField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
    </div>
  );
}
