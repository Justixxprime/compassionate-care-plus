import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

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

      <Reveal as="section" className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
        <Link href="/contact" className={buttonVariants({ size: "lg" })}>
          Contact us
        </Link>
      </Reveal>
    </div>
  );
}
