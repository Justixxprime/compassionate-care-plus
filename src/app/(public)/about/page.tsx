import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { brandName } from "@/components/marketing/nav-links";
import { SiteImage } from "@/components/marketing/site-image";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import { siteImages } from "@/lib/site-images";

const beliefs = [
  "We treat every patient like family, with dignity, respect and compassion.",
  "We believe in evidence based care, tailored to each person rather than a one size plan.",
  "We communicate clearly, anticipate needs, and don\u2019t disappear between visits.",
  "We aim to be reachable when it matters. Not a voicemail, not a call center.",
] as const;

const stats = [
  { value: "Listen", label: "Begin with what matters to the patient" },
  { value: "Plan", label: "Make the next step understandable" },
  { value: "Support", label: "Keep the right people connected" },
  { value: "Adapt", label: "Revisit care as needs change" },
] as const;

function CheckIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 flex-none"
    >
      <circle cx="11" cy="11" r="11" fill="var(--color-marigold)" />
      <path
        d="M6 11.2 9.3 14.5 16 7.5"
        stroke="var(--color-ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div>
      <EditorialHero eyebrow={`About ${brandName}`} title="Care should still feel like home." summary="We believe good home-based care pairs professional attention with clear communication, practical education, and respect for the life already happening at home." image={siteImages.about} />

      <div className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
        {/* WHAT WE BELIEVE */}
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
                What we believe
              </h2>
              <ul className="mt-8 space-y-6">
                {beliefs.map((item, i) => (
                  <Reveal
                    key={item}
                    as="li"
                    delay={i * 80}
                    className="flex gap-4 text-body-lg text-slate"
                  >
                    <CheckIcon />
                    {item}
                  </Reveal>
                ))}
              </ul>
            </div>
            {/* A stock photograph from src/lib/site-images.ts. Swap it for a
                real photo of the actual team later (see docs/IMAGES.md). */}
            <SiteImage
              image={siteImages.about}
              sizes="(min-width: 1024px) 40vw, 0px"
              className="hidden aspect-[4/5] w-full rounded-md lg:block"
            />
          </div>
        </Reveal>

        {/* STATS */}
        <Reveal className="mt-20 border-t border-border pt-16">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
            Why choose {brandName}
          </h2>
          <dl className="mt-10 grid grid-cols-2 gap-10 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-[clamp(1.45rem,3vw,2.35rem)] font-semibold text-pine">{stat.value}</dd>
                <p className="mt-2 text-body-sm text-slate">{stat.label}</p>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* MISSION */}
        <Reveal className="mt-20 border-t border-border pt-16">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
            Our mission
          </h2>
          <p className="mt-6 max-w-2xl text-body-lg text-slate">
            The mission of {brandName} is simply to be the very best at
            what we do, in a customized and supportive environment that
            benefits our clients and their families. We are confident in
            our ability to serve the needs of your loved ones 24 hours a
            day, seven days a week, the same way we would for our own
            family members.
          </p>
        </Reveal>

        <Reveal className="mt-20 flex flex-wrap gap-3 border-t border-border pt-16">
          <Link href="/services" className={buttonVariants({ size: "lg" })}>
            See our services
          </Link>
          <Link
            href="/request-care"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Request care
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
