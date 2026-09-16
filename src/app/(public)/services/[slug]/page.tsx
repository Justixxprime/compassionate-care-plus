import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getServiceBySlug, services } from "@/lib/services-data";

/*
  Individual service page. Renders whichever service matches the URL slug.
  generateStaticParams below tells Next.js to build one of these pages per
  service in services-data.ts at build time, rather than one hand-written
  file per service - so adding a seventh service later means adding one
  entry to that data file, not creating a new page.
*/

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const related = services.filter((s) =>
    service.relatedSlugs.includes(s.slug),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
      <Link
        href="/services"
        className="text-body-sm font-medium text-slate hover:text-ink"
      >
        ← All services
      </Link>

      <p className="mt-6 text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Services
      </p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold text-ink">{service.title}</h1>
      <p className="mt-4 text-body-lg text-slate">{service.summary}</p>

      <section className="mt-12">
        <h2 className="font-display text-h3 text-ink">Who it may serve</h2>
        <ul className="mt-4 space-y-2">
          {service.whoItMayServe.map((item) => (
            <li key={item} className="flex gap-3 text-body text-slate">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-marigold" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-h3 text-ink">What to expect</h2>
        <ul className="mt-4 space-y-2">
          {service.whatToExpect.map((item) => (
            <li key={item} className="flex gap-3 text-body text-slate">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-marigold" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-h3 text-ink">Care process</h2>
        <ol className="mt-6 space-y-6">
          {service.careProcess.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="font-display text-h4 text-marigold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-h4 font-semibold text-ink">
                  {step.title}
                </p>
                <p className="mt-1 text-body text-slate">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {service.commonQuestions.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-h3 text-ink">Common questions</h2>
          <div className="mt-4 divide-y divide-border">
            {service.commonQuestions.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none text-h4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 text-body text-slate">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-label font-semibold text-slate">
            Related services
          </h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {related.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="text-body font-medium text-pine underline underline-offset-2"
              >
                {s.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12">
        <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
          Request care
        </Link>
      </div>
    </div>
  );
}
