import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { StatCounter } from "@/components/motion/stat-counter";

const beliefs = [
  "We treat every patient like family — with dignity, respect and compassion.",
  "We believe in evidence-based care, tailored to each person rather than a one-size plan.",
  "We communicate clearly, anticipate needs, and don\u2019t disappear between visits.",
  "We aim to be reachable when it matters — not a voicemail, not a call center.",
] as const;

const stats = [
  { target: 10, suffix: "+", label: "Counties served" },
  { target: 50, suffix: "+", label: "Licensed clinicians" },
  { target: 1000, suffix: "+", label: "Patients cared for annually" },
  { target: 100, suffix: "%", label: "Focused on home-based recovery" },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
      <Reveal>
        <h1 className="font-display text-h1 text-ink">
          We treat the illness. Then we teach you to manage it.
        </h1>
        <p className="mt-4 max-w-2xl text-body-lg text-slate">
          Most home health agencies focus on short-term recovery and step
          back once it&rsquo;s done. Our approach goes a step further:
          clinical treatment paired with real education, so patients and
          the people caring for them are equipped to stay healthier long
          after a visit ends.
        </p>
      </Reveal>

      {/* WHAT WE BELIEVE */}
      <Reveal className="mt-16 border-t border-border pt-12">
        <h2 className="font-display text-h2 text-ink">What we believe</h2>
        <ul className="mt-6 space-y-4">
          {beliefs.map((item, i) => (
            <Reveal key={item} as="li" delay={i * 80} className="flex gap-3 text-body-lg text-slate">
              <span aria-hidden="true" className="mt-1 text-marigold">
                —
              </span>
              {item}
            </Reveal>
          ))}
        </ul>
      </Reveal>

      {/* STATS — real, confirmed numbers, counted up on scroll */}
      <Reveal className="mt-16 border-t border-border pt-12">
        <h2 className="font-display text-h2 text-ink">
          Why choose Compassionate Care Plus
        </h2>
        <dl className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-display text-h1 text-pine">
                <StatCounter target={stat.target} suffix={stat.suffix} />
              </dd>
              <p className="mt-1 text-body-sm text-slate">{stat.label}</p>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* MISSION */}
      <Reveal className="mt-16 border-t border-border pt-12">
        <h2 className="font-display text-h2 text-ink">Our mission</h2>
        <p className="mt-4 max-w-2xl text-body-lg text-slate">
          The mission of Compassionate Care Plus is simply to be the very
          best at what we do, in a customized and supportive environment
          that benefits our clients and their families. We are confident
          in our ability to serve the needs of your loved ones 24/7 — the
          same way we would for our own family members.
        </p>
      </Reveal>

      <Reveal className="mt-16 flex flex-wrap gap-3 border-t border-border pt-12">
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
  );
}
