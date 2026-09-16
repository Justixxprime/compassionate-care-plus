import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { services } from "@/lib/services-data";
import { serviceIcons } from "@/lib/service-icons";

export default function ServicesIndexPage() {
  return (
    <div>
      <Reveal as="section" className="bg-ink px-6 py-24 text-white lg:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            What we offer
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
            Services
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-white/75">
            A full range of clinical and support services, combined into
            one care plan built around what each patient actually needs.
          </p>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
        <ul className="divide-y divide-border-strong border-y border-border-strong">
          {services.map((service) => {
            const Icon = serviceIcons[service.slug];
            return (
              <li key={service.slug} className="py-7">
                <Link
                  href={`/services/${service.slug}`}
                  className="group flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-sage text-pine">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-h4 font-semibold text-ink group-hover:text-pine sm:w-56 sm:flex-none">
                    {service.title}
                  </span>
                  <span className="text-body text-slate">{service.summary}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </div>
  );
}
