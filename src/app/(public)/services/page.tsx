import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import { services } from "@/lib/services-data";
import { serviceIcons } from "@/lib/service-icons";
import { siteImages } from "@/lib/site-images";

export default function ServicesIndexPage() {
  return (
    <div>
      <EditorialHero eyebrow="What we offer" title="Care that meets people where they are." summary="Explore the types of home-based support that may be part of a care plan. A conversation with the office helps determine what is appropriate for a specific person." image={siteImages.about} />

      <Reveal as="section" className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="mb-10 flex flex-col gap-3 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-label font-semibold uppercase tracking-[.18em] text-pine">Explore care</p><h2 className="mt-2 font-display text-h2 text-ink">Designed around a real home and a real life.</h2></div><p className="max-w-sm text-body-sm text-slate">Select a service to see common questions and what the first steps can look like.</p></div>
        <ul className="grid gap-px overflow-hidden border border-border-strong bg-border-strong sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = serviceIcons[service.slug];
            return (
              <li key={service.slug} className="bg-paper">
                <Link
                  href={`/services/${service.slug}`}
                  className="group flex h-full min-h-64 flex-col p-7 transition-colors duration-300 hover:bg-white"
                >
                  <span className="flex items-start justify-between"><span className="text-label font-semibold text-marigold">0{index + 1}</span><ArrowUpRight className="h-5 w-5 text-slate transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-pine" aria-hidden="true" /></span>
                  <span className="mt-auto flex h-12 w-12 flex-none items-center justify-center rounded-md bg-sage text-pine">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mt-5 text-h3 font-semibold text-ink group-hover:text-pine">{service.title}</span>
                  <span className="mt-2 text-body-sm text-slate">{service.summary}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </div>
  );
}
