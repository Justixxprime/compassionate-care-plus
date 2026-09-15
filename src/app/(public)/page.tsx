import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HeroIllustration } from "@/components/marketing/hero-illustration";
import { Reveal } from "@/components/motion/reveal";

const careSteps = [
  {
    number: "01",
    title: "A referral comes in",
    body: "From a hospital, a physician, or a family member reaching out directly. We gather the basics and confirm eligibility before anything else happens.",
  },
  {
    number: "02",
    title: "We visit and assess",
    body: "A clinician meets the patient at home, understands their situation, and starts shaping a care plan around what they actually need.",
  },
  {
    number: "03",
    title: "Care begins, on a schedule that fits",
    body: "Visits are scheduled, the care team is assigned, and the family knows what to expect and when.",
  },
  {
    number: "04",
    title: "We stay in touch",
    body: "Care plans get reviewed and adjusted. Families can reach the care team directly rather than starting over with someone new each time.",
  },
] as const;

const serviceCategories = [
  { title: "Skilled nursing", body: "Clinical care delivered at home by a licensed nurse." },
  { title: "Physical therapy", body: "Regaining strength, balance and mobility after an illness, injury or surgery." },
  { title: "Occupational therapy", body: "Relearning the everyday tasks that make independent living possible." },
  { title: "Speech therapy", body: "Support for communication, swallowing and related recovery." },
  { title: "Medical social services", body: "Help navigating the practical and emotional side of a health change." },
  { title: "Home health aide", body: "Help with the daily tasks of living, at the pace the patient needs." },
] as const;

const faqs = [
  {
    q: "Who is home health care for?",
    a: "Generally, anyone recovering from surgery, managing a chronic condition, or needing skilled clinical support who is able to remain safely at home. The specific eligibility for this organization's programs will be confirmed here directly.",
  },
  {
    q: "How quickly can care start?",
    a: "This depends on the referral source, insurance authorization and the specific service needed. Exact timelines will be confirmed by the organization.",
  },
  {
    q: "Does insurance cover home health care?",
    a: "Coverage varies by payer and by service. Specific insurance information for this organization will be confirmed here directly rather than guessed at.",
  },
  {
    q: "What does a family member see once care starts?",
    a: "An authorized family member can be given access to a limited, consent-based view of care information through the family portal - never more than the patient has agreed to share.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <h1 className="animate-fade-in-up font-display text-display leading-[1.05] text-ink">
            Compassionate care, wherever home is.
          </h1>
          <p className="mt-6 max-w-lg animate-fade-in-up text-body-lg text-slate [animation-delay:150ms]">
            Home health services for patients and families across Texas —
            skilled clinical care delivered where recovery actually
            happens: at home.
          </p>
          <div className="mt-8 flex animate-fade-in-up flex-wrap gap-3 [animation-delay:300ms]">
            <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
              Request care
            </Link>
            <Link href="/how-we-care" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              See how we care
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm animate-fade-in-up [animation-delay:200ms] lg:max-w-none">
          <HeroIllustration />
        </div>
      </section>

      <Reveal as="section" className="border-t border-border bg-white px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-h2 text-ink">How we care</h2>
          <p className="mt-3 max-w-xl text-body-lg text-slate">
            From the first call to ongoing visits, here is what the process
            actually looks like.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {careSteps.map((step, i) => (
              <Reveal key={step.number} delay={i * 100} as="li">
                <p className="font-display text-h3 text-marigold">{step.number}</p>
                <p className="mt-2 text-h4 font-semibold text-ink">{step.title}</p>
                <p className="mt-2 text-body-sm text-slate">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal as="section" className="border-t border-border bg-sage px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-h2 text-ink">Services</h2>
            <p className="text-caption text-slate">Illustrative — to be confirmed by the organization</p>
          </div>
          <ul className="mt-10 divide-y divide-border-strong border-y border-border-strong">
            {serviceCategories.map((service) => (
              <li key={service.title} className="flex flex-col gap-2 py-6 transition-colors hover:bg-white/60 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="text-h4 font-semibold text-ink sm:w-64 sm:flex-none">{service.title}</p>
                <p className="text-body text-slate">{service.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link href="/services" className="text-body font-medium text-pine underline underline-offset-2">
              See all services
            </Link>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="border-t border-border bg-white px-6 py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <h2 className="font-display text-h2 text-ink">Who we serve</h2>
          <div className="space-y-4 text-body-lg text-slate">
            <p>
              People come to home health care from very different starting
              points — recovering from a hospital stay, managing a chronic
              condition day to day, or simply needing more support than a
              family can safely provide alone.
            </p>
            <p>
              The exact conditions, age ranges and payer types this
              organization supports will be confirmed and listed here
              directly, rather than assumed.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="border-t border-border bg-pine px-6 py-16 text-white lg:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-h2">Ready to talk about care?</h2>
            <p className="mt-2 max-w-md text-body-lg text-white/80">
              Tell us a little about the situation, and someone from the
              care team will follow up.
            </p>
          </div>
          <Link
            href="/request-care"
            className={buttonVariants({ variant: "secondary", size: "lg", className: "bg-white text-pine hover:bg-sage" })}
          >
            Request care
          </Link>
        </div>
      </Reveal>

      <Reveal as="section" className="border-t border-border bg-white px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-h2 text-ink">Common questions</h2>
          <div className="mt-8 divide-y divide-border">
            {faqs.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-h4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="ml-4 text-h4 font-normal text-slate transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-body text-slate">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Reveal>
    </>
  );
}