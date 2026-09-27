import Link from "next/link";
import { ArrowUpRight, BookOpen, CircleHelp, HeartHandshake } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

const resourcePaths = [
  { icon: CircleHelp, slug: "starting-home-health", title: "Starting home health", body: "A calm place to begin when you are figuring out what kind of support might help." },
  { icon: HeartHandshake, slug: "family-caregivers", title: "For family caregivers", body: "Questions to bring to the first conversation, and ways to stay connected with consent." },
  { icon: BookOpen, slug: "preparing-for-a-visit", title: "Preparing for a visit", body: "Simple ways to make the first visit feel easier for the patient and family." },
] as const;

export default function ResourcesPage() {
  return (
    <div>
      <Reveal as="section" className="bg-ink px-6 py-24 text-white lg:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            Resources
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
            Guides and answers, in one place.
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-white/75">
            Helpful guides for patients and families are on their way. In
            the meantime, the fastest way to get an answer is to reach
            out directly.
          </p>
        </div>
      </Reveal>

      <Reveal as="section" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid gap-5 md:grid-cols-3">
          {resourcePaths.map(({ icon: Icon, title, body }, index) => (
            <Link href={`/resources/${slug}`} key={title} className="group relative block overflow-hidden border border-border bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-pine hover:shadow-raised">
              <span className="text-label font-semibold text-marigold">0{index + 1}</span>
              <Icon className="mt-8 h-7 w-7 text-pine" aria-hidden="true" />
              <h2 className="mt-5 text-h3 font-semibold text-ink">{title}</h2>
              <p className="mt-3 text-body-sm text-slate">{body}</p>
              <span className="mt-7 flex items-center gap-2 text-body-sm font-semibold text-pine">Ask the team <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
        <div className="mt-14 border-l-2 border-marigold bg-sage/55 px-7 py-8 sm:flex sm:items-center sm:justify-between">
          <div><p className="font-display text-h2 text-ink">Need an answer today?</p><p className="mt-2 max-w-xl text-body text-slate">The best resource is still a conversation about your particular situation.</p></div>
          <Link href="/contact" className={buttonVariants({ size: "lg", className: "mt-5 sm:mt-0" })}>Contact us</Link>
        </div>
      </Reveal>
    </div>
  );
}
