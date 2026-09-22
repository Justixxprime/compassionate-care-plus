"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Shown when something inside the app fails unexpectedly. It says nothing
// about what went wrong: an error message can hold details that should
// never reach a screen. The short reference code lets someone find the
// matching entry in the server's own log.
//
// This version of Next.js gives an error screen a retry() function that
// asks the server for the page again (reset() only clears the screen
// without fetching, see node_modules/next/dist/docs error.md).

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-md border border-border bg-white px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-bg">
        <TriangleAlert className="h-5 w-5 text-warning" aria-hidden="true" />
      </span>
      <h1 className="mt-4 font-display text-h4 font-semibold text-ink">
        Something went wrong
      </h1>
      <p className="mt-1 text-body-sm text-slate">
        This screen could not be shown. Nothing was lost. Try again, and if it
        keeps happening tell an administrator.
      </p>
      {error.digest ? (
        <p className="mt-2 text-caption text-slate">
          Reference: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => retry()}
        className={cn(buttonVariants({ size: "md" }), "mt-5")}
      >
        Try again
      </button>
    </div>
  );
}
