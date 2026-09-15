import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

const hours = [
  ["Monday", "9:00 am – 5:00 pm"],
  ["Tuesday", "9:00 am – 5:00 pm"],
  ["Wednesday", "9:00 am – 5:00 pm"],
  ["Thursday", "9:00 am – 5:00 pm"],
  ["Friday", "9:00 am – 5:00 pm"],
  ["Saturday", "Closed"],
  ["Sunday", "Closed"],
] as const;

export default function ContactPage() {
  return (
    <Reveal as="section" className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
      <h1 className="font-display text-h1 text-ink">Contact us</h1>
      <p className="mt-4 max-w-xl text-body-lg text-slate">
        For a specific care need, Request Care is the fastest path to the
        care team. For anything else, reach out directly below.
      </p>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="text-label font-semibold text-slate">
            Office location
          </h2>
          <p className="mt-2 text-body text-ink">
            4434 Blue Bonnet Dr, Suite 151
            <br />
            Stafford, TX 77477
          </p>

          <h2 className="mt-8 text-label font-semibold text-slate">
            Phone &amp; fax
          </h2>
          <p className="mt-2 text-body text-ink">
            Office:{" "}
            <a href="tel:2819037551" className="text-pine hover:underline">
              (281) 903-7551
            </a>
            <br />
            Fax: [to be confirmed]
          </p>
        </div>

        <div>
          <h2 className="text-label font-semibold text-slate">
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
    </Reveal>
  );
}
