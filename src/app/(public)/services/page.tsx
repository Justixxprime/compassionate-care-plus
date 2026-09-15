import Link from "next/link";
import { services } from "@/lib/services-data";

export default function ServicesIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
      <p className="text-caption text-slate">
        Illustrative — to be confirmed by the organization
      </p>
      <h1 className="mt-2 font-display text-h1 text-ink">Services</h1>
      <p className="mt-4 max-w-xl text-body-lg text-slate">
        Home health covers a range of clinical and support services,
        usually combined into one care plan around what a patient actually
        needs. Here is an overview of the categories, with more detail on
        each one below.
      </p>

      <ul className="mt-12 divide-y divide-border-strong border-y border-border-strong">
        {services.map((service) => (
          <li key={service.slug} className="py-6">
            <Link
              href={`/services/${service.slug}`}
              className="group flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <p className="text-h4 font-semibold text-ink group-hover:text-pine sm:w-64 sm:flex-none">
                {service.title}
              </p>
              <p className="text-body text-slate">{service.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
