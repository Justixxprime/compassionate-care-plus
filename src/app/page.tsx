export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-label font-medium text-slate">
        Phase 2 — design system
      </p>

      <h1 className="font-display text-display leading-tight text-ink">
        Compassionate Care Plus
      </h1>

      <p className="text-body-lg text-slate">
        The design system now exists — colors, type and the first
        components. The real homepage is still ahead, built once the public
        website phase starts. Take a look at{" "}
        <a
          href="/design-system"
          className="font-medium text-pine underline underline-offset-2"
        >
          /design-system
        </a>{" "}
        to see everything in one place.
      </p>

      <div className="rounded-md border border-border bg-sage p-4 text-body-sm text-ink">
        <p className="mb-2 font-medium">Not a real website yet</p>
        <p className="text-slate">
          Nothing on this page has been confirmed with the organization. No
          services, staff, claims or contact details appear anywhere in this
          project until Compassionate Care Plus provides them.
        </p>
      </div>

      <p className="text-body-sm text-slate">
        Next: Milestone B — the public website, starting with layout and
        navigation.
      </p>
    </main>
  );
}
