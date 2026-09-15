/*
  DevelopmentBanner
  =================
  A quiet, permanent reminder — on every public page — that nothing here
  has been confirmed by the organization yet. This is not decoration; it
  is the thing that keeps a placeholder from accidentally being mistaken
  for a real published claim once this project is shared with anyone.

  It comes off the site only when real, confirmed content replaces the
  placeholders throughout - not before.
*/

export function DevelopmentBanner() {
  return (
    <div className="border-b border-border-strong bg-ink px-4 py-2 text-center text-caption text-paper">
      Development preview — services, staff and contact details shown here
      are placeholders and have not been confirmed by Compassionate Care
      Plus.
    </div>
  );
}
