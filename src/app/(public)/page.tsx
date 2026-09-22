import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuroraField } from "@/components/marketing/aurora-field";
import { SiteImage } from "@/components/marketing/site-image";
import { siteImages } from "@/lib/site-images";
import { Reveal } from "@/components/motion/reveal";
import { StatCounter } from "@/components/motion/stat-counter";
import { brandName } from "@/components/marketing/nav-links";
import { services } from "@/lib/services-data";
import { serviceIcons } from "@/lib/service-icons";

const stats = [
  { target: 10, suffix: "+", label: "Counties served" },
  { target: 50, suffix: "+", label: "Licensed clinicians" },
  { target: 1000, suffix: "+", label: "Patients cared for annually" },
  { target: 100, suffix: "%", label: "Focused on home based recovery" },
] as const;

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

const whoWeServeExcerpt = [
  "Recovering from surgery or a hospital stay",
  "Managing a chronic condition day to day",
  "Regaining strength, balance or mobility after an illness or injury",
] as const;

const faqs = [
  {
    q: "Who is home health care for?",
    a: "Anyone recovering from surgery, managing a chronic condition, or needing skilled clinical support who is able to remain safely at home.",
  },
  {
    q: "How quickly can care start?",
    a: "This depends on the referral source, insurance authorization and the specific service needed. Our team will confirm exact timelines during intake.",
  },
  {
    q: "Does insurance cover home health care?",
    a: "Coverage varies by payer and by service. Reach out and our team can walk through what applies to your situation.",
  },
  {
    q: "What does a family member see once care starts?",
    a: "An authorized family member can be given access to a limited, consent based view of care information through the family portal, never more than the patient has agreed to share.",
  },
] as const;

export default function HomePage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-white">
        {/* The photograph sits at the back. Two dark layers on top keep the
            white headline readable: an even wash on phones, and on wide
            screens a fade from solid on the left (where the words are) to
            mostly clear on the right (where the photograph shows). */}
        <SiteImage
          image={siteImages.hero}
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-ink/80 lg:hidden" />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(23,36,32,0.97) 0%, rgba(23,36,32,0.86) 42%, rgba(23,36,32,0.38) 100%)",
          }}
        />
        <AuroraField />
        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-36">
          <p className="animate-fade-in-up text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            {brandName}
          </p>
          <h1 className="mt-4 animate-fade-in-up font-display text-[clamp(2.75rem,6.5vw,5rem)] font-semibold leading-[1.02] [animation-delay:100ms]">
            Compassionate care, wherever home is.
          </h1>
          <p className="mt-6 max-w-xl animate-fade-in-up text-body-lg text-white/75 [animation-delay:200ms]">
            Skilled clinical home health for patients and families across
            Texas. We treat the illness, then we teach you to manage it, so
            recovery holds long after a visit ends.
          </p>
          <div className="mt-8 flex animate-fade-in-up flex-wrap gap-3 [animation-delay:300ms]">
            <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
              Request care
            </Link>
            <Link
              href="/how-we-care"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              See how we care
            </Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <Reveal as="section" className="border-b border-border bg-white px-6 py-16 lg:py-20">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-10 sm:grid-cols-4">
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

      {/* HOW WE CARE */}
      <Reveal as="section" className="border-b border-border px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
            How we care
          </h2>
          <p className="mt-3 max-w-xl text-body-lg text-slate">
            From the first call to ongoing visits, here is what the process
            actually looks like.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {careSteps.map((step, i) => (
              <Reveal key={step.number} delay={i * 100} as="li">
                <p className="font-display text-[clamp(1.5rem,3vw,2.25rem)] text-marigold">
                  {step.number}
                </p>
                <p className="mt-2 text-h4 font-semibold text-ink">{step.title}</p>
                <p className="mt-2 text-body-sm text-slate">{step.body}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-10">
            <Link href="/how-we-care" className={buttonVariants({ variant: "secondary" })}>
              More on how we care
            </Link>
          </div>
        </div>
      </Reveal>

      {/* SERVICES PREVIEW */}
      <Reveal as="section" className="border-b border-border bg-sage/30 px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
            Services
          </h2>
          <p className="mt-3 max-w-xl text-body-lg text-slate">
            A full range of clinical and support services, combined into one
            care plan built around what each patient actually needs.
          </p>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => {
              const Icon = serviceIcons[service.slug];
              return (
                <Reveal key={service.slug} delay={i * 60} as="li">
                  <Link
                    href={`/services/${service.slug}`}
                    className="group flex h-full flex-col gap-3 rounded-md border border-border-strong bg-white p-6 transition-colors hover:border-pine"
                  >
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-sage text-pine">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-h4 font-semibold text-ink group-hover:text-pine">
                      {service.title}
                    </span>
                    <span className="text-body-sm text-slate">{service.summary}</span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
          <div className="mt-10">
            <Link href="/services" className={buttonVariants({ size: "lg" })}>
              See all services
            </Link>
          </div>
        </div>
      </Reveal>

      {/* WHO WE SERVE PREVIEW */}
      <Reveal as="section" className="border-b border-border px-6 py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
              Who we serve
            </h2>
            <p className="mt-3 max-w-xl text-body-lg text-slate">
              We build every care plan around the person in front of us, not a
              category. Home health often fits families who are:
            </p>
            <ul className="mt-8 space-y-4">
              {whoWeServeExcerpt.map((item, i) => (
                <Reveal
                  key={item}
                  as="li"
                  delay={i * 80}
                  className="flex gap-4 text-body-lg text-slate"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 flex-none rounded-full bg-marigold"
                  />
                  {item}
                </Reveal>
              ))}
            </ul>
            <div className="mt-10">
              <Link href="/who-we-serve" className={buttonVariants({ variant: "secondary" })}>
                See who we serve
              </Link>
            </div>
          </div>
          <SiteImage
            image={siteImages.whoWeServe}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="aspect-[4/3] w-full rounded-md lg:aspect-[4/5]"
          />
        </div>
      </Reveal>

      {/* FAQ */}
      <Reveal as="section" className="border-b border-border px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-ink">
            Common questions
          </h2>
          <div className="mt-10 divide-y divide-border">
            {faqs.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-h4 font-semibold text-ink">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="flex-none text-body-lg text-pine transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-body text-slate">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CLOSING CTA */}
      <section className="relative overflow-hidden bg-ink px-6 py-20 text-white lg:py-28">
        <AuroraField />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05]">
            Ready to talk about care?
          </h2>
          <p className="mt-4 text-body-lg text-white/75">
            Reach out and a member of our team will walk you through what
            comes next.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
              Request care
            </Link>
            <Link
              href="/contact"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Contact us
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}