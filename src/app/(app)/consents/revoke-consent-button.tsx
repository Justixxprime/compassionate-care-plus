"use client";

import { useState, useTransition } from "react";
import { revokeConsentAction } from "@/lib/family-consents-actions";
import { buttonVariants } from "@/components/ui/button";

// Drawn only for someone who may manage consents (the page decides), but
// revokeConsent re-checks on the server whatever this button says.
export function RevokeConsentButton({ consentId }: { consentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm("Withdraw this permission? The family member loses access immediately.")) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeConsentAction(consentId);
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
        Withdraw
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
