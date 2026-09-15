import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/*
  About
  =====
  Structure inspired by a mock site the founder built while learning
  (a disease-management-focused home health concept: treat, then teach).
  The PATTERN is real and worth keeping - treat-then-teach is a genuine,
  common home-health positioning. The SPECIFICS (stats, address, phone)
  are not confirmed for Compassionate Care Plus and are marked as such
  throughout - see docs/PHASE_0_ARCHITECTURE.md section 2.
*/

const beliefs = [
  "We treat every patient like family — with dignity, respect and compassion.",
  "We believe in evidence-based care, tailored to each person rather than a one-size plan.",
  "We communicate clearly, anticipate needs, and don't disappear between visits.",
  "We aim to be reachable when it matters — not a voicemail, not a call center.",
] as const;

const stats = [
  { value: "—", label: "Counties served" },
  { value: "—", label: "Licensed clinicians" },
  { value: "—", label: "Patients cared for annually" },
  { value: "Home-based", label: "Focus of every visit" },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
      <p className="text-caption text-slate">
        Illustrative — to be confirmed by the organization
      </p>
      <h1 className="mt-2 font-display text-h1 text-ink">
        We treat the illness. Then we teach you to manage it.
      </h1>
      <p className="mt-4 max-w-2xl text-body-lg text-slate">
        Most home health agencies focus on short-term recovery and step
        back once it&rsquo;s done. The approach here goes a step further:
        clinical treatment paired with real education, so patients and the
        people caring for them are equipped to stay healthier long after a
        visit ends.
      </p>

      {/* WHAT WE BELIEVE — editorial list, not a card grid */}
      <section className="mt-16 border-t border-border pt-12">
        <h2 className="font-display text-h2 text-ink">What we believe</h2>
        <ul className="mt-6 space-y-4">
          {beliefs.map((item) => (
            <li key={item} className="flex gap-3 text-body-lg text-slate">
              <span aria-hidden="true" className="mt-1 text-marigold">
                —
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* STATS — every number a placeholder, labelled plainly rather than
          quietly implying it's real */}
      <section className="mt-16 border-t border-border pt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-h2 text-ink">
            Why choose Compassionate Care Plus
          </h2>
          <p className="text-caption text-slate">Numbers to be confirmed</p>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-display text-h1 text-pine">
                {stat.value}
              </dd>
              <p className="mt-1 text-body-sm text-slate">{stat.label}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* MISSION */}
      <section className="mt-16 border-t border-border pt-12">
        <h2 className="font-display text-h2 text-ink">Our mission</h2>
        <p className="mt-4 max-w-2xl text-body-lg text-slate">
          [The organization&rsquo;s real mission statement will replace this
          paragraph once confirmed.] In the meantime, the working
          principle behind this build is simple: care that treats the
          whole person, delivered where recovery actually happens —
          at home — with the same attention given whether it&rsquo;s a first
          visit or the fiftieth.
        </p>
      </section>

      <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-12">
        <Link href="/services" className={buttonVariants({ size: "lg" })}>
          See our services
        </Link>
        <Link
          href="/request-care"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Request care
        </Link>
      </div>
    </div>
  );
}
