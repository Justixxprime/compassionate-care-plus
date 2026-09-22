"use client";

import { useState, useTransition } from "react";
import { revokeShareAction } from "@/lib/document-grants-actions";
import { buttonVariants } from "@/components/ui/button";

// Drawn only for someone who may manage shares (the page decides), but
// revokeShare re-checks on the server whatever this button says.
export function RevokeShareButton({ grantId }: { grantId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm("Take this access back? It ends immediately.")) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeShareAction(grantId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={buttonVariants({ size: "sm", variant: "secondary" })}
      >
        Take back
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
