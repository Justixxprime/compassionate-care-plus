import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { AuroraField } from "@/components/marketing/aurora-field";
import { SiteImage } from "@/components/marketing/site-image";
import type { SiteImageData } from "@/lib/site-images";

export function EditorialHero({
  eyebrow,
  title,
  summary,
  image,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  image?: SiteImageData;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink px-6 py-20 text-white sm:py-24 lg:py-32">
      {image ? <SiteImage image={image} sizes="100vw" className="absolute inset-0 -z-20 h-full w-full opacity-35" /> : null}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(23,36,32,.98)_0%,rgba(23,36,32,.92)_43%,rgba(23,36,32,.68)_100%)]" />
      <AuroraField />
      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="flex items-center gap-3 text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            <span aria-hidden="true" className="h-px w-8 bg-marigold" />
            {eyebrow}
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.8rem,6vw,5.25rem)] font-semibold leading-[.96] tracking-[-0.035em]">{title}</h1>
          <p className="mt-7 max-w-2xl text-body-lg text-white/78">{summary}</p>
          {children ? <div className="mt-9 flex flex-wrap gap-3">{children}</div> : null}
        </div>
        <p className="hidden border-l border-white/20 pl-5 text-body-sm leading-relaxed text-white/65 lg:block">
          Care is personal. The next step should feel clear, calm, and human.
          <ArrowUpRight className="mt-4 h-5 w-5 text-marigold" aria-hidden="true" />
        </p>
      </div>
    </section>
  );
}
