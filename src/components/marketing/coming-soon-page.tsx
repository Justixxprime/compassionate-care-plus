/*
  ComingSoonPage
  ==============
  Every nav link needs somewhere real to go, even before its real content
  exists. This is that placeholder - honest about what it is, rather than
  a broken link or a fake filled-in page.
*/

export function ComingSoonPage({
  title,
  phase,
  body,
}: {
  title: string;
  phase: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-label font-medium text-slate">{phase}</p>
      <h1 className="mt-2 font-display text-h1 text-ink">{title}</h1>
      <p className="mt-4 text-body-lg text-slate">{body}</p>
      <div className="mt-8 rounded-md border border-border bg-sage p-4 text-body-sm text-ink">
        This page is a placeholder. No content here has been confirmed by
        Compassionate Care Plus.
      </div>
    </div>
  );
}
