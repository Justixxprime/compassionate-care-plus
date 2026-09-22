import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { brandName } from "@/components/marketing/nav-links";
import { SiteImage } from "@/components/marketing/site-image";
import { siteImages } from "@/lib/site-images";

const situations = [
  "Recovering from surgery or a hospital stay",
  "Managing a chronic condition day to day",
  "Regaining strength, balance or mobility after an illness or injury",
  "Adjusting to a new diagnosis and needing support navigating it",
  "Needing more consistent support than a family can safely provide alone",
] as const;

export default function WhoWeServePage() {
  return (
    <div>
      <Reveal as="section" className="bg-ink px-6 py-24 text-white lg:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            Who we serve
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
            People, not conditions.
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-white/75">
            {brandName} builds every care plan around the person in front
            of us, not a category. Here are the situations that most often
            bring families to home health care.
          </p>
        </div>
      </Reveal>

      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:py-28">
        <div>
        <ul className="space-y-6">
          {situations.map((item, i) => (
            <Reveal
              key={item}
              delay={i * 80}
              as="li"
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

        <Reveal className="mt-14 border-t border-border pt-10">
          <p className="text-body-lg text-slate">
            Not sure whether home health is the right fit? Reach out and
            we will talk it through together.
          </p>
          <div className="mt-6">
            <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
              Request care
            </Link>
          </div>
        </Reveal>
        </div>
        <SiteImage
          image={siteImages.whoWeServePage}
          sizes="(min-width: 1024px) 38vw, 0px"
          className="hidden aspect-[4/5] w-full rounded-md lg:sticky lg:top-24 lg:block"
        />
      </div>
    </div>
  );
}
