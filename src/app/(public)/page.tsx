import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { StatCounter } from "@/components/motion/stat-counter";
import { brandName } from "@/components/marketing/nav-links";

const beliefs = [
  "We treat every patient like family, with dignity, respect and compassion.",
  "We believe in evidence based care, tailored to each person rather than a one size plan.",
  "We communicate clearly, anticipate needs, and don\u2019t disappear between visits.",
  "We aim to be reachable when it matters. Not a voicemail, not a call center.",
] as const;

const stats = [
  { target: 10, suffix: "+", label: "Counties served" },
  { target: 50, suffix: "+", label: "Licensed clinicians" },
  { target: 1000, suffix: "+", label: "Patients cared for annually" },
  { target: 100, suffix: "%", label: "Focused on home based recovery" },
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
      <Reveal as="section" className="bg-ink px-6 py-24 text-white lg:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            About {brandName}
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
            We treat the illness. Then we teach you to manage it.
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg text-white/75">
            Most home health agencies focus on short term recovery and step
            back once it&rsquo;s done. Our approach goes a step further:
            clinical treatment paired with real education, so patients and
            the people caring for them stay healthier long after a visit
            ends.
          </p>
        </div>
      </Reveal>

      <div className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
        {/* WHAT WE BELIEVE */}
        <Reveal>
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
                <dd className="font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold text-pine">
                  <StatCounter target={stat.target} suffix={stat.suffix} />
                </dd>
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
