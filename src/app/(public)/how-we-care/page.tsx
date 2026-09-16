import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { brandName } from "@/components/marketing/nav-links";

const steps = [
  {
    number: "01",
    title: "A referral comes in",
    body: "From a hospital, a physician, or a family member reaching out directly. Our team gathers the basics and confirms eligibility before anything else happens.",
  },
  {
    number: "02",
    title: "We visit and assess",
    body: "A clinician meets the patient at home, understands their situation, and starts shaping a care plan around what they actually need. Nothing generic, nothing rushed.",
  },
  {
    number: "03",
    title: "Care begins on a schedule that fits",
    body: "Visits are scheduled, the care team is assigned, and the family knows exactly what to expect and when. No surprises.",
  },
  {
    number: "04",
    title: "We stay in touch",
    body: "Care plans get reviewed and adjusted over time. Families reach the same care team directly, rather than starting over with someone new each visit.",
  },
  {
    number: "05",
    title: "Education, not just treatment",
    body: "Patients and the people caring for them learn how to manage the condition long after the last visit. That is the difference between recovery and lasting health.",
  },
] as const;

export default function HowWeCarePage() {
  return (
    <div>
      <Reveal as="section" className="bg-ink px-6 py-24 text-white lg:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            Our approach
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
            How we care
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-white/75">
            {brandName} treats the illness, then teaches you to manage it.
            Here is exactly what that looks like, step by step.
          </p>
        </div>
      </Reveal>

      <div className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
        <ol className="space-y-14">
          {steps.map((step, i) => (
            <Reveal key={step.number} delay={i * 80} as="li" className="flex gap-6">
              <p className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold text-marigold">
                {step.number}
              </p>
              <div>
                <p className="text-h3 font-semibold text-ink">{step.title}</p>
                <p className="mt-2 max-w-xl text-body-lg text-slate">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-20 border-t border-border pt-12">
          <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
            Request care
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
