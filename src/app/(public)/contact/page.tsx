import Link from "next/link";
import { MapPin, Phone, Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { brandName } from "@/components/marketing/nav-links";

const hours = [
  ["Monday", "9:00 am to 5:00 pm"],
  ["Tuesday", "9:00 am to 5:00 pm"],
  ["Wednesday", "9:00 am to 5:00 pm"],
  ["Thursday", "9:00 am to 5:00 pm"],
  ["Friday", "9:00 am to 5:00 pm"],
  ["Saturday", "Closed"],
  ["Sunday", "Closed"],
] as const;

export default function ContactPage() {
  return (
    <div>
      <Reveal as="section" className="bg-ink px-6 py-24 text-white lg:py-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
            Get in touch
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
            Talk to {brandName}
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-white/75">
            For a specific care need, Request Care is the fastest path to
            the team. For anything else, reach out directly below.
          </p>
        </div>
      </Reveal>

      <div className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-label font-semibold text-slate">
              <MapPin className="h-4 w-4 text-pine" aria-hidden="true" />
              Office location
            </h2>
            <p className="mt-2 text-body text-ink">
              4434 Blue Bonnet Dr, Suite 151
              <br />
              Stafford, TX 77477
            </p>

            <h2 className="mt-8 flex items-center gap-2 text-label font-semibold text-slate">
              <Phone className="h-4 w-4 text-pine" aria-hidden="true" />
              Phone
            </h2>
            <p className="mt-2 text-body text-ink">
              <a href="tel:2819037551" className="text-pine hover:underline">
                (281) 903-7551
              </a>
            </p>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-label font-semibold text-slate">
              <Clock className="h-4 w-4 text-pine" aria-hidden="true" />
              Office hours
            </h2>
            <dl className="mt-3 space-y-1">
              {hours.map(([day, time]) => (
                <div key={day} className="flex justify-between text-body-sm">
                  <dt className="text-slate">{day}</dt>
                  <dd className="text-data text-ink">{time}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <Link href="/request-care" className={buttonVariants({ size: "lg" })}>
            Request care
          </Link>
        </div>
      </div>
    </div>
  );
}
