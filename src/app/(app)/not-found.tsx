import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Shown when a screen inside the app asks for something that is not
// there. Deliberately gives the same words whether the thing does not
// exist or the person may not see it.

export default function AppNotFound() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-md border border-border bg-white px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage">
        <SearchX className="h-5 w-5 text-pine" aria-hidden="true" />
      </span>
      <h1 className="mt-4 font-display text-h4 font-semibold text-ink">
        That could not be found
      </h1>
      <p className="mt-1 text-body-sm text-slate">
        It may not exist, or it may not be something your account can open.
      </p>
      <Link href="/dashboard" className={cn(buttonVariants({ size: "md" }), "mt-5")}>
        Back to the dashboard
      </Link>
    </div>
  );
}
