import Link from "next/link";
import { LogoMark } from "@/components/marketing/logo-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
  PortalClosed
  ============
  What a visitor sees at /sign-in on a website whose secure portal is not
  connected to a database (see src/lib/app/portal-availability.ts). Calm and
  plain: no error code, no technical words, and a way forward (request care,
  call the office, go back to the website).

  Drawing only. It reads nothing and decides no access. It has no hooks, so
  it is a Server Component like the page that uses it.
*/

export function PortalClosed() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-8 font-display text-h1 text-ink">
        The secure portal is not open here yet
      </h1>
      <p className="mt-4 text-body-lg text-slate">
        Staff, patients and families will sign in here with the account the
        office sets up for them. If you expected access today, please call the
        office and someone will help you.
      </p>
      <p className="mt-3 text-body text-slate">
        Looking for care for yourself or someone you love? You can send a
        request in a few minutes.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/request-care" className={cn(buttonVariants({ size: "lg" }))}>
          Request care
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
        >
          Back to the website
        </Link>
      </div>

      <p className="mt-8 text-body-sm text-slate">
        Office phone:{" "}
        <a href="tel:2819037551" className="font-medium text-pine hover:underline">
          (281) 903-7551
        </a>
      </p>
    </div>
  );
}
